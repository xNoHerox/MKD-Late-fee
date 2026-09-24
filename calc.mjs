import { rateOn, RATES, VERIFIED_THROUGH } from './rates.mjs';

const DAY = 86400000;
export function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0,10) === s;
}
export function dateMs(s) { return Date.parse(`${s}T00:00:00Z`); }
export function addDays(s,n) { return new Date(dateMs(s)+n*DAY).toISOString().slice(0,10); }
function inclusiveOverlap(a,b,c,d) {
  const lo=Math.max(dateMs(a),dateMs(c)), hi=Math.min(dateMs(b),dateMs(d));
  return hi<lo?0:Math.round((hi-lo)/DAY)+1;
}
export function countDays(due,end,first,last,opts={}) {
  const a=addDays(due,first), b=last==null?end:(end<addDays(due,last)?end:addDays(due,last));
  if (b<a) return 0;
  let count=Math.round((dateMs(b)-dateMs(a))/DAY)+1;
  if (opts.moratorium2020) count-=inclusiveOverlap(a,b,'2020-04-06','2020-12-31');
  if (opts.moratorium2022 && due<'2022-04-01') count-=inclusiveOverlap(a,b,'2022-04-01','2022-09-30');
  return count;
}

export function calculate({ charges, payments, asOf, moratorium2020=true, moratorium2022=true, rates=RATES, verifiedThrough=VERIFIED_THROUGH }) {
  const issues=[];
  if (!validDate(asOf)) issues.push({level:'error',text:'Укажите корректную дату расчета.'});
  if (!validDate(verifiedThrough)) issues.push({level:'error',text:'Укажите дату проверки справочника ставок.'});
  if (asOf>'2026-12-31') issues.push({level:'error',text:'Правила расчета после 2026 года требуют обновления.'});
  if (asOf>verifiedThrough) issues.push({level:'error',text:`Ставки подтверждены только по ${verifiedThrough}. Обновите справочник.`});
  if(!rates.length) issues.push({level:'error',text:'Справочник ключевой ставки пуст.'});
  for(let i=0;i<rates.length;i++){
    const [date,rate]=rates[i];
    if(!validDate(date)||!(Number(rate)>0&&Number(rate)<=100)) issues.push({level:'error',text:`Проверьте строку ставки ${i+1}.`});
    if(i>0&&date===rates[i-1][0]) issues.push({level:'error',text:`Ставка на ${date} указана дважды.`});
  }
  const activeCharges=charges.filter(x=>x.include!==false);
  if (!activeCharges.length) issues.push({level:'error',text:'Нет начислений для расчета.'});
  for(const c of activeCharges) {
    if(c.unconfirmed) issues.push({level:'error',text:`Строка ${c.row}: подтвердите исправление исходной даты ${c.rawDue} на ${c.due}.`,action:'confirm-date',row:c.row});
    if(!validDate(c.due)) issues.push({level:'error',text:`Строка ${c.row}: неверная дата срока оплаты.`});
    if(!(Number(c.amount)>0)) issues.push({level:'error',text:`Строка ${c.row}: неверная сумма начисления.`});
    if(validDate(c.due) && c.due>asOf) issues.push({level:'error',text:`Строка ${c.row}: срок оплаты позже даты расчета.`});
  }
  for(const p of payments) {
    if(!validDate(p.date)) issues.push({level:'error',text:`Оплата, строка ${p.row}: неверная дата.`});
    if(!(Number(p.amount)>0)) issues.push({level:'error',text:`Оплата, строка ${p.row}: неверная сумма.`});
    if(validDate(p.date) && p.date>asOf) issues.push({level:'error',text:`Оплата, строка ${p.row}: дата позже даты расчета.`});
  }
  const dup=new Map();
  for(const c of activeCharges) {
    const k=`${c.due}|${Number(c.amount).toFixed(2)}`;
    if(dup.has(k)) issues.push({level:c.duplicateConfirmed?'warning':'error',text:`Похожее повторное начисление: строки ${dup.get(k)} и ${c.row}. ${c.duplicateConfirmed?'Повтор подтвержден.':'Подтвердите повтор или исключите строку.'}`,action:c.duplicateConfirmed?null:'confirm-duplicate',row:c.row});
    else dup.set(k,c.row);
  }
  if(issues.some(x=>x.level==='error')) return {issues,details:[],totalPenalty:null,principal:null};
  const sortedCharges=activeCharges.map(c=>({...c, cents:Math.round(Number(c.amount)*100)})).sort((a,b)=>a.due.localeCompare(b.due)||a.row-b.row);
  const sortedPayments=payments.map(p=>({...p,cents:Math.round(Number(p.amount)*100)})).sort((a,b)=>a.date.localeCompare(b.date)||a.row-b.row);
  const allocations=[];
  for(const p of sortedPayments) {
    if(p.date>verifiedThrough) issues.push({level:'error',text:`Нет подтвержденной ставки для оплаты ${p.date}.`});
    let left=p.cents;
    for(const c of sortedCharges) {
      if(left<=0) break;
      if(c.due>p.date || c.cents<=0) continue;
      const amount=Math.min(left,c.cents);
      allocations.push({charge:c,amount,paidOn:p.date,paymentRow:p.row});
      c.cents-=amount;left-=amount;
    }
    if(left>0) issues.push({level:'error',text:`Оплата, строка ${p.row}: ${formatMoney(left/100)} ₽ не распределены на наступившие обязательства. Проверьте предоплату.`});
  }
  if(issues.some(x=>x.level==='error')) return {issues,details:[],totalPenalty:null,principal:null};
  for(const c of sortedCharges) if(c.cents>0) allocations.push({charge:c,amount:c.cents,paidOn:null,paymentRow:null});
  const opts={moratorium2020,moratorium2022};
  const details=[];
  for(const x of allocations) {
    const end=x.paidOn||asOf;
    const actualRate=rateOn(end,rates);
    if(actualRate==null) { issues.push({level:'error',text:`Нет ставки Банка России на ${end}.`});continue; }
    const appliedRate=end>='2022-02-28'?Math.min(actualRate,9.5):actualRate;
    const d300=countDays(x.charge.due,end,31,90,opts);
    const d130=countDays(x.charge.due,end,91,null,opts);
    const amount=x.amount/100, pen300=amount*(appliedRate/100)*d300/300, pen130=amount*(appliedRate/100)*d130/130;
    details.push({chargeRow:x.charge.row,due:x.charge.due,amount,paidOn:x.paidOn,end,paymentRow:x.paymentRow,actualRate,rate:appliedRate,d300,d130,pen300,pen130,penalty:pen300+pen130});
  }
  if(issues.some(x=>x.level==='error')) return {issues,details:[],totalPenalty:null,principal:null};
  const sumCharges=activeCharges.reduce((s,x)=>s+Math.round(Number(x.amount)*100),0)/100;
  const sumPayments=payments.reduce((s,x)=>s+Math.round(Number(x.amount)*100),0)/100;
  const principal=sortedCharges.reduce((s,x)=>s+x.cents,0)/100;
  const totalPenalty=details.reduce((s,x)=>s+x.penalty,0);
  return {issues,details,sumCharges,sumPayments,principal,totalPenalty,total:principal+totalPenalty,asOf,opts};
}
export function formatMoney(n,digits=2) { return new Intl.NumberFormat('ru-RU',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n); }
export function displayDate(s) { return s?`${s.slice(8,10)}.${s.slice(5,7)}.${s.slice(0,4)}`:'—'; }
