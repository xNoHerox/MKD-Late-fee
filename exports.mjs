import {displayDate,formatMoney} from './calc.mjs';

const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xml=esc;
const money=n=>formatMoney(n);
const formula='S × r × D300 / 300 + S × r × D130 / 130';
const filenameDate=s=>s.replaceAll('-','');

function docCss(){return `<style>
@page{size:A4 landscape;margin:14mm 11mm 15mm}
*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#161b22;font-size:10pt;line-height:1.35;margin:0}
h1{font-size:16pt;margin:0 0 7mm}h2{font-size:11pt;margin:5mm 0 2mm}p{margin:0 0 2.5mm}
table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border-bottom:1px solid #d7dce3;padding:3px 4px;vertical-align:top;word-break:normal}th{background:#edf1f6;font-size:8pt;text-align:center}td{font-size:8pt}.num{text-align:right;white-space:nowrap}.center{text-align:center}.small{font-size:8.5pt}.summary{width:100%;margin:3mm 0 5mm}.summary td{font-size:9pt}.summary tr:last-child td{font-weight:bold;border-top:1px solid #657080}
.detail{font-size:7.5pt}.detail th,.detail td{font-size:7.2pt;padding:2.5px 3px}.detail thead{display:table-header-group}.detail tr{break-inside:avoid}
.sign{margin-top:9mm}.warn{border-left:3px solid #aa6a18;padding-left:3mm;margin-top:4mm}
@media print{button{display:none}}
</style>`;}

export function courtHtml(result,meta={}){
 const {details}=result;
 const rows=details.map((x,i)=>`<tr><td class="center">${i+1}</td><td class="center">${x.chargeRow}</td><td class="center">${displayDate(x.due)}</td><td class="num">${money(x.amount)}</td><td class="center">${displayDate(x.paidOn||result.asOf)}</td><td class="center">${x.paymentRow||'остаток'}</td><td class="center">${x.rate.toFixed(2)}%</td><td class="center">${x.d300}</td><td class="center">${x.d130}</td><td class="num">${formatMoney(x.pen300,4)}</td><td class="num">${formatMoney(x.pen130,4)}</td><td class="num">${formatMoney(x.penalty,4)}</td></tr>`).join('');
 const notes=[
  'Для оплаченной части применена ставка на дату оплаты, для непогашенного остатка — на дату расчета. С 28.02.2022 ставка ограничена меньшим из фактического значения и 9,5%.',
  result.opts.moratorium2020?'Период 06.04.2020–31.12.2020 исключен.':'Мораторий 2020 года не применен.',
  result.opts.moratorium2022?'По обязательствам со сроком до 01.04.2022 исключен период 01.04.2022–30.09.2022. Требуется подтвердить применимость моратория к должнику и отсутствие отказа.':'Мораторий 2022 года не применен. Требуется проверить основание такого выбора.',
 ];
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Расчет пеней для суда</title>${docCss()}</head><body>
 <h1>Расчет пеней по задолженности за жилищно-коммунальные услуги</h1>
 <p>Приложение к исковому заявлению. Объект: ${esc(meta.object||'________________________')}. Расчет по состоянию на ${displayDate(result.asOf)}.</p>
 <p>Истец: ${esc(meta.claimant||'________________________')} &nbsp;&nbsp; Ответчик: ${esc(meta.debtor||'________________________')}</p>
 <table class="summary"><tbody><tr><td>Начислено</td><td class="num">${money(result.sumCharges)} ₽</td></tr><tr><td>Оплачено</td><td class="num">${money(result.sumPayments)} ₽</td></tr><tr><td>Остаток основного долга</td><td class="num">${money(result.principal)} ₽</td></tr><tr><td>Пени</td><td class="num">${money(result.totalPenalty)} ₽</td></tr><tr><td>Основной долг и пени</td><td class="num">${money(result.total)} ₽</td></tr></tbody></table>
 <p class="small"><b>Формула каждой строки:</b> ${formula}, где S — часть долга, r — ключевая ставка в долях единицы; D300 — дни с 31-го по 90-й день просрочки, D130 — дни с 91-го дня. День оплаты включен. Оплаты распределены по самым ранним неоплаченным начислениям.</p>
 <p class="small">${notes.join(' ')}</p><h2>Подробный расчет</h2>
 <table class="detail"><thead><tr><th style="width:3%">№</th><th style="width:4%">Стр.<br>ист.</th><th style="width:8%">Срок<br>оплаты</th><th style="width:10%">Часть<br>долга, ₽</th><th style="width:9%">Дата оплаты<br>или среза</th><th style="width:6%">Стр.<br>оплаты</th><th style="width:6%">Ставка</th><th style="width:5%">Дней<br>/300</th><th style="width:5%">Дней<br>/130</th><th style="width:11%">Пени<br>/300, ₽</th><th style="width:11%">Пени<br>/130, ₽</th><th style="width:12%">Всего<br>пени, ₽</th></tr></thead><tbody>${rows}</tbody></table>
 <p class="small">Промежуточные суммы показаны до 4 знаков. Общий итог рассчитан без промежуточного округления и округлен до копеек в конце.</p>
 <p class="small">Основание: ч. 14 ст. 155 ЖК РФ; постановления Правительства РФ № 424 от 02.04.2020, № 474 от 26.03.2022, № 497 от 28.03.2022, № 329 от 18.03.2025; п. 7 постановления Пленума ВС РФ № 44 от 24.12.2020. Ставки: cbr.ru/hd_base/KeyRate/.</p>
 <p class="warn small">Перед подачей сверить начисления, оплаты, исправленные даты и повторяющиеся строки с первичными документами. Начисления после последней строки исходного файла не включены.</p>
 <p class="sign">Расчет составил(а): _______________________ &nbsp;&nbsp; Подпись: ______________ &nbsp;&nbsp; Дата: ______________</p>
 </body></html>`;
}

export function demandHtml(result,meta={}){
 const deadline=meta.deadline?displayDate(meta.deadline):'____________';
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Досудебная претензия</title>${docCss()}<style>@page{size:A4 portrait;margin:20mm 18mm}body{font-size:11pt}h1{text-align:center;margin:14mm 0 10mm}.address{text-align:right;margin-left:35%;white-space:pre-line}.sign{margin-top:18mm}</style></head><body>
 <div class="address">Кому: ${esc(meta.debtor||'________________________')}<br>Адрес: ${esc(meta.debtorAddress||'________________________')}<br><br>От: ${esc(meta.claimant||'________________________')}<br>Адрес: ${esc(meta.claimantAddress||'________________________')}</div>
 <h1>Досудебная претензия</h1>
 <p>По объекту ${esc(meta.object||'________________________')} образовалась задолженность за жилое помещение и коммунальные услуги. Согласно прилагаемому расчету по состоянию на ${displayDate(result.asOf)} начислено ${money(result.sumCharges)} ₽, оплачено ${money(result.sumPayments)} ₽. Остаток основного долга составляет ${money(result.principal)} ₽.</p>
 <p>За просрочку оплаты рассчитаны пени по ч. 14 ст. 155 Жилищного кодекса РФ в размере ${money(result.totalPenalty)} ₽. Общая сумма требования по указанному расчету составляет <b>${money(result.total)} ₽</b>.</p>
 <p>Прошу погасить указанную задолженность и пени до ${deadline}. При наличии возражений или документов об оплате прошу направить их для сверки расчета.</p>
 <p>Реквизиты для оплаты: ${esc(meta.paymentDetails||'________________________')}</p>
 <p>Приложение: расчет задолженности и пеней по состоянию на ${displayDate(result.asOf)}.</p>
 <p class="sign">Дата: ${displayDate(meta.letterDate||result.asOf)} &nbsp;&nbsp; Подпись: ____________________ &nbsp;&nbsp; ${esc(meta.claimant||'________________________')}</p>
 </body></html>`;
}

export function printDocument(html){
 const w=window.open('','_blank');
 if(!w) throw new Error('Браузер заблокировал окно печати. Разрешите всплывающие окна для этого сайта.');
 w.document.open();w.document.write(html);w.document.close();
 w.addEventListener('load',()=>setTimeout(()=>w.print(),250),{once:true});
}

function para(text,bold=false){return `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial"/>${bold?'<w:b/>':''}<w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;}
export async function demandDocx(result,meta){
 if(!globalThis.JSZip) throw new Error('Не загружен модуль создания документов.');
 const lines=[
  `Кому: ${meta.debtor||'________________________'}`,
  `Адрес: ${meta.debtorAddress||'________________________'}`,
  `От: ${meta.claimant||'________________________'}`,
  `Адрес: ${meta.claimantAddress||'________________________'}`,
  'ДОСУДЕБНАЯ ПРЕТЕНЗИЯ',
  `По объекту ${meta.object||'________________________'} образовалась задолженность за жилое помещение и коммунальные услуги. Согласно прилагаемому расчету по состоянию на ${displayDate(result.asOf)} начислено ${money(result.sumCharges)} руб., оплачено ${money(result.sumPayments)} руб. Остаток основного долга составляет ${money(result.principal)} руб.`,
  `За просрочку оплаты рассчитаны пени по ч. 14 ст. 155 Жилищного кодекса РФ в размере ${money(result.totalPenalty)} руб. Общая сумма требования составляет ${money(result.total)} руб.`,
  `Прошу погасить задолженность и пени до ${meta.deadline?displayDate(meta.deadline):'____________'}. При наличии возражений или документов об оплате прошу направить их для сверки расчета.`,
  `Реквизиты для оплаты: ${meta.paymentDetails||'________________________'}`,
  `Приложение: расчет задолженности и пеней по состоянию на ${displayDate(result.asOf)}.`,
  `Дата: ${displayDate(meta.letterDate||result.asOf)}     Подпись: ____________________     ${meta.claimant||'________________________'}`
 ];
 const z=new JSZip();
 z.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
 z.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
 z.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map((v,i)=>para(v,i===4)).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`);
 return z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

function xlsxCell(ref,value,style=0,formulaText=null){
 if(formulaText) return `<c r="${ref}" s="${style}"><f>${xml(formulaText)}</f><v>${Number(value)}</v></c>`;
 if(typeof value==='number') return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`;
 return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${xml(value??'')}</t></is></c>`;
}
function sheetXml(rows,widths){
 const last=String.fromCharCode(64+Math.max(...rows.map(r=>r.length)));
 const cols=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}${rows.length}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows.map((row,i)=>`<row r="${i+1}">${row.map((c,j)=>xlsxCell(`${String.fromCharCode(65+j)}${i+1}`,c.v,c.s||0,c.f)).join('')}</row>`).join('')}</sheetData></worksheet>`;
}
export async function calculationXlsx(result,meta){
 if(!globalThis.JSZip) throw new Error('Не загружен модуль создания Excel.');
 const C=(v,s=0,f=null)=>({v,s,f});
 const summary=[
  [C('Расчет пеней за ЖКУ')],[C('Объект'),C(meta.object||'')],[C('Дата расчета'),C(displayDate(result.asOf))],
  [C('Начислено, ₽'),C(result.sumCharges,1)],[C('Оплачено, ₽'),C(result.sumPayments,1)],
  [C('Остаток долга, ₽'),C(result.principal,1)],[C('Пени, ₽'),C(result.totalPenalty,1)],
  [C('Долг и пени, ₽'),C(result.total,1)],
  [C('Формула'),C(formula)],[C('Дни 1/300'),C('31–90')],[C('Дни 1/130'),C('91-й день и далее')]
 ];
 const header=['Строка источника','Срок оплаты','Часть долга, ₽','Дата оплаты','Дата среза','Ставка','Дней 1/300','Дней 1/130','Пени 1/300, ₽','Пени 1/130, ₽','Всего пени, ₽','Строка оплаты'];
 const rows=[header.map(v=>C(v))];
 result.details.forEach((x,i)=>{
  const r=i+2;
  rows.push([C(x.chargeRow),C(displayDate(x.due)),C(x.amount,1),C(displayDate(x.paidOn)),C(displayDate(x.end)),C(x.rate/100,2),C(x.d300),C(x.d130),C(x.pen300,3,`C${r}*F${r}*G${r}/300`),C(x.pen130,3,`C${r}*F${r}*H${r}/130`),C(x.penalty,3,`I${r}+J${r}`),C(x.paymentRow||'остаток')]);
 });
 const z=new JSZip();
 z.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
 z.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
 z.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Итог" sheetId="1" r:id="rId1"/><sheet name="Расчет пеней" sheetId="2" r:id="rId2"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>`);
 z.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
 z.file('xl/styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.00%"/><numFmt numFmtId="166" formatCode="#,##0.0000"/></numFmts><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
 z.file('xl/worksheets/sheet1.xml',sheetXml(summary,[38,95]));z.file('xl/worksheets/sheet2.xml',sheetXml(rows,[17,18,19,18,18,13,16,16,21,21,22,17]));
 return z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

export function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),10000);}
export function suggestedFilename(kind,asOf,ext){return `${kind}_${filenameDate(asOf)}.${ext}`;}
