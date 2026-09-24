import {validDate} from './calc.mjs';

function text(node,tag){return node?.getElementsByTagName(tag)[0]?.textContent??'';}
function excelDate(value,date1904=false){
  const serial=Number(value);
  if(!Number.isFinite(serial)) return '';
  const base=date1904?Date.UTC(1904,0,1):Date.UTC(1899,11,30);
  return new Date(base+Math.floor(serial)*86400000).toISOString().slice(0,10);
}
function looseDate(value){
  if(!value) return '';
  if(validDate(value)) return value;
  const m=String(value).trim().match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if(!m) return '';
  const s=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return validDate(s)?s:'';
}
function colOf(ref){let n=0;for(const c of ref.match(/^[A-Z]+/)?.[0]||'')n=n*26+c.charCodeAt(0)-64;return n-1;}

export async function readWorkbook(file){
  if(file.size>20*1024*1024) throw new Error('Файл больше 20 МБ. Разделите данные на меньшие файлы.');
  if(!globalThis.JSZip) throw new Error('Не загружен модуль чтения Excel.');
  const zip=await globalThis.JSZip.loadAsync(await file.arrayBuffer());
  const xml=async path=>{const f=zip.file(path);if(!f)throw new Error(`В Excel-файле нет ${path}.`);return new DOMParser().parseFromString(await f.async('text'),'application/xml');};
  const book=await xml('xl/workbook.xml');
  const rels=await xml('xl/_rels/workbook.xml.rels');
  const date1904=book.getElementsByTagName('workbookPr')[0]?.getAttribute('date1904')==='1';
  const sheets=[...book.getElementsByTagName('sheet')];
  const sheet=sheets.find(x=>x.getAttribute('name')==='Данные проекта')||sheets[0];
  if(!sheet) throw new Error('В файле не найден лист с данными.');
  const relationshipId=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
  const rel=[...rels.getElementsByTagName('Relationship')].find(x=>x.getAttribute('Id')===relationshipId);
  if(!rel) throw new Error('Не удалось открыть лист Excel.');
  let path=rel.getAttribute('Target').replace(/^\//,'');
  if(!path.startsWith('xl/')) path=`xl/${path.replace(/^\.\//,'')}`;
  const worksheet=await xml(path);
  let strings=[];
  if(zip.file('xl/sharedStrings.xml')) {
    const shared=await xml('xl/sharedStrings.xml');
    strings=[...shared.getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(t=>t.textContent).join(''));
  }
  const records=[];
  const sourceRows=worksheet.getElementsByTagName('row');
  if(sourceRows.length>5001) throw new Error('На листе более 5000 строк. Проверьте диапазон исходных данных.');
  for(const row of sourceRows) {
    const rowNo=Number(row.getAttribute('r'));
    if(rowNo<2) continue;
    const cells={};
    for(const cell of row.getElementsByTagName('c')){
      const col=colOf(cell.getAttribute('r'));
      if(col>3) continue;
      let value=text(cell,'v');
      const type=cell.getAttribute('t');
      if(type==='s')value=strings[Number(value)]??'';
      else if(type==='inlineStr')value=[...cell.getElementsByTagName('t')].map(t=>t.textContent).join('');
      cells[col]={value,type};
    }
    if(Object.keys(cells).length===0) continue;
    const rawAmount=String(cells[0]?.value??'').trim(),rawPayment=String(cells[2]?.value??'').trim();
    const amount=rawAmount?Number(rawAmount.replace(',','.')):null;
    const payment=rawPayment?Number(rawPayment.replace(',','.')):null;
    const dateValue=(c)=>{
      if(!c?.value)return '';
      return c.type==='s'||c.type==='inlineStr'?looseDate(c.value):excelDate(c.value,date1904);
    };
    records.push({row:rowNo,amount:amount===null?null:Number.isFinite(amount)?amount:0,due:dateValue(cells[1]),rawDue:cells[1]?.value??'',payment:payment===null?null:Number.isFinite(payment)?payment:0,paidOn:dateValue(cells[3]),rawPaidOn:cells[3]?.value??''});
  }
  const charges=[],payments=[];
  for(const x of records){
    if(x.amount!=null){
      let due=x.due,unconfirmed=false;
      if(!due && String(x.rawDue).trim()==='31.11.2022'){due='2022-11-30';unconfirmed=true;}
      charges.push({row:x.row,amount:x.amount,due,include:true,unconfirmed,rawDue:x.rawDue});
    }
    if(x.payment!=null) payments.push({row:x.row,amount:x.payment,date:x.paidOn,rawDate:x.rawPaidOn});
  }
  if(!charges.length) throw new Error('В колонках A–D не найдены начисления. Ожидаются: сумма, срок оплаты, сумма оплаты, дата оплаты.');
  return {sheetName:sheet.getAttribute('name'),charges,payments};
}
