import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,countDays,validDate} from '../calc.mjs';

test('календарные границы',()=>{
  assert.equal(validDate('2022-11-31'),false);
  assert.equal(validDate('2024-02-29'),true);
  assert.equal(countDays('2024-01-01','2024-01-30',31,90,{}),0);
  assert.equal(countDays('2024-01-01','2024-02-01',31,90,{}),1);
  assert.equal(countDays('2024-01-01','2024-03-31',31,90,{}),60);
  assert.equal(countDays('2024-01-01','2024-04-01',91,null,{}),1);
});

test('моратории исключают только применимые дни',()=>{
  assert.equal(countDays('2019-01-01','2021-01-01',91,null,{moratorium2020:true}),
    countDays('2019-01-01','2021-01-01',91,null,{})-270);
  assert.equal(countDays('2022-03-01','2022-10-01',31,90,{moratorium2022:true}),0);
  assert.equal(countDays('2022-04-30','2022-10-01',91,null,{moratorium2022:true}),
    countDays('2022-04-30','2022-10-01',91,null,{}));
});

test('частичная оплата гасит старейший долг',()=>{
  const r=calculate({
    charges:[{row:2,due:'2024-01-01',amount:100,include:true},{row:3,due:'2024-02-01',amount:100,include:true}],
    payments:[{row:2,date:'2024-05-01',amount:150}],asOf:'2024-05-01',
    moratorium2020:false,moratorium2022:false,verifiedThrough:'2026-09-24'
  });
  assert.equal(r.issues.filter(x=>x.level==='error').length,0);
  assert.equal(r.principal,50);
  assert.deepEqual(r.details.map(x=>[x.chargeRow,x.amount,x.paymentRow]),[[2,100,2],[3,50,2],[3,50,null]]);
  assert.equal(r.details[0].rate,9.5);
});

test('повтор и исправленная дата требуют подтверждения',()=>{
  const r=calculate({
    charges:[{row:2,due:'2022-11-30',rawDue:'31.11.2022',unconfirmed:true,amount:100},{row:3,due:'2022-11-30',amount:100}],
    payments:[],asOf:'2024-01-01',verifiedThrough:'2026-09-24'
  });
  assert.ok(r.issues.some(x=>x.action==='confirm-date'));
  assert.ok(r.issues.some(x=>x.action==='confirm-duplicate'));
  assert.equal(r.totalPenalty,null);
});
