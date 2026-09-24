import {readWorkbook} from './xlsx-read.mjs';
import {calculate,formatMoney,displayDate,validDate} from './calc.mjs';
import {RATES,VERIFIED_THROUGH} from './rates.mjs';
import {courtHtml,demandHtml,printDocument,demandDocx,calculationXlsx,download,suggestedFilename} from './exports.mjs';

const $=id=>document.getElementById(id);
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const state={charges:[],payments:[],rates:RATES.map(x=>[...x]),verifiedThrough:VERIFIED_THROUGH,loaded:false,error:'',result:null};
const today=new Date().toISOString().slice(0,10);
$('asOf').value=today<VERIFIED_THROUGH?today:VERIFIED_THROUGH;
$('letterDate').value=today;
$('verifiedThrough').value=VERIFIED_THROUGH;
$('ratesStatus').textContent=`по ${displayDate(VERIFIED_THROUGH)}`;

function metadata(){return Object.fromEntries(['object','claimant','claimantAddress','debtor','debtorAddress','letterDate','deadline','paymentDetails'].map(k=>[k,$(k).value.trim()]));}
function currentResult(){
 if(!state.loaded)return null;
 return calculate({charges:state.charges,payments:state.payments,asOf:$('asOf').value,moratorium2020:$('m2020').checked,moratorium2022:$('m2022').checked,rates:state.rates,verifiedThrough:state.verifiedThrough});
}
function renderIssues(issues){
 const box=$('issues');
 if(state.error){box.innerHTML=`<div class="issue error">${escapeHtml(state.error)}</div>`;return;}
 if(!state.loaded){box.className='issues empty-state';box.textContent='После загрузки здесь появятся строки, требующие проверки.';return;}
 box.className='issues';
 if(!issues.length){box.innerHTML='<div class="issue ok">Строки проверены. Можно формировать документы.</div>';return;}
 box.innerHTML=issues.map(issue=>`<div class="issue ${issue.level}"><span>${escapeHtml(issue.text)}</span>${issue.action?`<button type="button" data-action="${issue.action}" data-row="${issue.row}">Подтвердить</button>`:''}</div>`).join('');
}
function renderTables(){
 $('dataActions').hidden=!state.loaded;
 if(!state.loaded)return;
 $('recordCount').textContent=`${state.charges.length} начисл. · ${state.payments.length} оплат`;
 $('chargeCount').textContent=state.charges.length;
 $('paymentCount').textContent=state.payments.length;
 $('chargesTable').querySelector('tbody').innerHTML=state.charges.map((c,i)=>`<tr class="${c.include===false?'excluded':c.unconfirmed||c.duplicateConfirmed?'flagged':''}"><td>${c.row}</td><td><input aria-label="Срок оплаты строки ${c.row}" type="date" data-kind="charge" data-index="${i}" data-field="due" value="${escapeHtml(c.due||'')}"></td><td><input aria-label="Сумма строки ${c.row}" type="number" min="0" step="0.01" data-kind="charge" data-index="${i}" data-field="amount" value="${c.amount??''}"></td><td><input aria-label="Учитывать строку ${c.row}" type="checkbox" data-kind="charge" data-index="${i}" data-field="include" ${c.include!==false?'checked':''}></td><td>${c.unconfirmed?'Дата исправлена':c.duplicateConfirmed?'Повтор подтвержден':''}</td></tr>`).join('');
 $('paymentsTable').querySelector('tbody').innerHTML=state.payments.map((p,i)=>`<tr><td>${p.row}</td><td><input aria-label="Дата оплаты строки ${p.row}" type="date" data-kind="payment" data-index="${i}" data-field="date" value="${escapeHtml(p.date||'')}"></td><td><input aria-label="Оплата строки ${p.row}" type="number" min="0" step="0.01" data-kind="payment" data-index="${i}" data-field="amount" value="${p.amount??''}"></td><td><button type="button" data-delete-payment="${i}" aria-label="Удалить оплату строки ${p.row}">Удалить</button></td></tr>`).join('');
}
function renderRates(){
 $('ratesStatus').textContent=`по ${displayDate(state.verifiedThrough)}`;
 $('ratesTable').querySelector('tbody').innerHTML=state.rates.map(([date,rate],i)=>`<tr><td><input aria-label="Дата изменения ставки" type="date" data-rate-index="${i}" data-rate-field="date" value="${escapeHtml(date)}"></td><td><input aria-label="Ключевая ставка" type="number" min="0" max="100" step="0.01" data-rate-index="${i}" data-rate-field="rate" value="${rate}"></td><td><button type="button" data-delete-rate="${i}" aria-label="Удалить ставку с ${date}">×</button></td></tr>`).join('');
}
function render(){
 const result=currentResult();state.result=result;
 const issues=result?.issues||[];
 renderIssues(issues);
 const ready=result&&result.totalPenalty!=null&&!issues.some(x=>x.level==='error');
 $('resultStatus').textContent=ready?'Расчет готов':state.loaded?'Нужна проверка':'Ожидание файла';
 $('resultStatus').className=`result-status ${ready?'ready':state.loaded?'blocked':''}`;
 $('penaltyTotal').textContent=ready?`${formatMoney(result.totalPenalty)} ₽`:'—';
 $('principalTotal').textContent=ready?`${formatMoney(result.principal)} ₽`:'—';
 $('grandTotal').textContent=ready?`${formatMoney(result.total)} ₽`:'—';
 $('resultNote').textContent=ready?`Расчет на ${displayDate(result.asOf)}. ${result.details.length} строк детализации.`:state.loaded?'Исправьте ошибки выше, чтобы сформировать документы.':'Загрузите Excel-файл, чтобы увидеть расчет.';
 for(const id of ['printCourt','downloadXlsx'])$(id).disabled=!ready;
 const m=metadata(),required=['object','claimant','claimantAddress','debtor','debtorAddress','letterDate','deadline','paymentDetails'];
 const missing=required.filter(x=>!m[x]);
 const demandReady=ready&&!missing.length&&validDate(m.letterDate)&&validDate(m.deadline)&&m.deadline>m.letterDate;
 for(const id of ['downloadDocx','printDemand'])$(id).disabled=!demandReady;
 $('docStatus').textContent=!ready?'Сначала завершите расчет. Исходный файл остается на вашем устройстве.':demandReady?'Документы готовы. Перед отправкой сверьте их с квитанциями и платежными документами.':`Для претензии заполните все поля; срок оплаты должен быть позже даты претензии. Пустых полей: ${missing.length}.`;
}
async function loadFile(file){
 if(!file)return;
 state.error='';$('uploadLabel').textContent='Читаю файл…';
 try{
  const parsed=await readWorkbook(file);
  state.charges=parsed.charges;state.payments=parsed.payments;state.loaded=true;
  $('uploadLabel').textContent=file.name;
  if(!$('object').value)$('object').value=file.name.replace(/\.xlsx$/i,'').replace(/\s+/g,' ').trim();
  renderTables();render();
 }catch(err){state.loaded=false;state.error=`Не удалось прочитать файл: ${err.message}`;$('uploadLabel').textContent='Выберите Excel-файл';render();}
}
$('fileInput').addEventListener('change',e=>loadFile(e.target.files?.[0]));
const dz=$('dropzone');
for(const name of ['dragenter','dragover'])dz.addEventListener(name,e=>{e.preventDefault();dz.classList.add('dragover')});
for(const name of ['dragleave','drop'])dz.addEventListener(name,e=>{e.preventDefault();dz.classList.remove('dragover')});
dz.addEventListener('drop',e=>loadFile(e.dataTransfer.files?.[0]));
for(const id of ['asOf','m2020','m2022'])$(id).addEventListener('change',render);
for(const id of ['object','claimant','claimantAddress','debtor','debtorAddress','letterDate','deadline','paymentDetails'])$(id).addEventListener('input',render);
$('verifiedThrough').addEventListener('change',e=>{state.verifiedThrough=e.target.value;renderRates();render()});
$('issues').addEventListener('click',e=>{
 const btn=e.target.closest('button[data-action]');if(!btn)return;
 const c=state.charges.find(x=>x.row===Number(btn.dataset.row));if(!c)return;
 if(btn.dataset.action==='confirm-date')c.unconfirmed=false;
 if(btn.dataset.action==='confirm-duplicate')c.duplicateConfirmed=true;
 renderTables();render();
});
function editTable(e){
 const el=e.target.closest('[data-kind]');if(!el)return;
 const item=(el.dataset.kind==='charge'?state.charges:state.payments)[Number(el.dataset.index)];
 if(!item)return;
 const field=el.dataset.field;
 item[field]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
 if(field==='due')item.unconfirmed=false;
 render();
}
$('chargesTable').addEventListener('change',editTable);
$('paymentsTable').addEventListener('change',editTable);
$('paymentsTable').addEventListener('click',e=>{const b=e.target.closest('[data-delete-payment]');if(!b)return;state.payments.splice(Number(b.dataset.deletePayment),1);renderTables();render()});
$('addCharge').addEventListener('click',()=>{state.charges.push({row:Math.max(1,...state.charges.map(x=>x.row))+1,amount:0,due:'',include:true});renderTables();render();$('chargesTable').closest('details').open=true});
$('addPayment').addEventListener('click',()=>{state.payments.push({row:Math.max(1,...state.payments.map(x=>x.row))+1,amount:0,date:''});renderTables();render();$('paymentsTable').closest('details').open=true});
$('ratesTable').addEventListener('change',e=>{
 const el=e.target.closest('[data-rate-index]');if(!el)return;
 const idx=Number(el.dataset.rateIndex),field=el.dataset.rateField;
 state.rates[idx][field==='date'?0:1]=field==='date'?el.value:Number(el.value);
 state.rates.sort((a,b)=>a[0].localeCompare(b[0]));renderRates();render();
});
$('ratesTable').addEventListener('click',e=>{const b=e.target.closest('[data-delete-rate]');if(!b)return;state.rates.splice(Number(b.dataset.deleteRate),1);renderRates();render()});
$('addRate').addEventListener('click',()=>{state.rates.push([state.verifiedThrough,14]);state.rates.sort((a,b)=>a[0].localeCompare(b[0]));renderRates();render()});

function runAction(fn){try{if(!state.result||state.result.totalPenalty==null||state.result.issues.some(x=>x.level==='error'))return;return fn(state.result,metadata())}catch(err){alert(err.message)}}
$('printCourt').addEventListener('click',()=>runAction((r,m)=>printDocument(courtHtml(r,m))));
$('printDemand').addEventListener('click',()=>runAction((r,m)=>printDocument(demandHtml(r,m))));
$('downloadDocx').addEventListener('click',async()=>{try{await runAction(async(r,m)=>download(await demandDocx(r,m),suggestedFilename('Досудебная_претензия',r.asOf,'docx')))}catch(err){alert(err.message)}});
$('downloadXlsx').addEventListener('click',async()=>{try{await runAction(async(r,m)=>download(await calculationXlsx(r,m),suggestedFilename('Расчет_пеней',r.asOf,'xlsx')))}catch(err){alert(err.message)}});

renderRates();render();
