const test=require('node:test'),assert=require('node:assert/strict');
const {calculate,selectionTotal,nights,perPerson}=require('../assets/proposal/proposal-rules.js');
const row=(extra={})=>({name:'Item',state:'priced',unitPrice:'300',quantity:'2',units:'3',taxMode:'added',taxPercent:'5',...extra});
const option=(extra={})=>({id:'a',currency:'BRL',feePercent:'10',feeBase:'withTaxes',rows:[row()],...extra});
test('hotel nights, supplier tax and agency fee reconcile in cents',()=>{
 const r=calculate(option());assert.equal(r.base,180000);assert.equal(r.tax,9000);assert.equal(r.fee,18900);assert.equal(r.total,207900);assert.equal(nights('2026-11-20','2026-11-23'),3);
 const dates=calculate(option({rows:[row({startDate:'2026-11-20',endDate:'2026-11-23',units:'99'})]}));assert.equal(dates.total,207900);
});
test('supplier tax already included is not added twice; fee base is explicit',()=>{
 assert.equal(calculate(option({rows:[row({taxMode:'included'})]})).tax,0);
 assert.equal(calculate(option({feeBase:'withoutTaxes'})).fee,18000);
});
test('missing prices and pending courtesy are distinct from zero and included items',()=>{
 assert.equal(calculate(option({rows:[row({unitPrice:''})]})).valid,false);
 const pending=calculate(option({rows:[row({state:'pending'})]}));assert.equal(pending.pending,true);assert.equal(pending.lines[0].total,null);
 const included=calculate(option({rows:[row({state:'included'})]}));assert.equal(included.total,0);assert.equal(included.pending,false);
 assert.equal(calculate(option({rows:[row({unitPrice:'0'})]})).valid,true);
});
test('only selected alternatives and explicitly included optional services compose the total',()=>{
 const groups=[{id:'hotel',options:[option(),option({id:'b',rows:[row({unitPrice:'500'})]})]},{id:'extra',optional:true,options:[option({id:'insurance'})]}];
 const r=selectionTotal(groups,{hotel:'a',extra:'none'});assert.equal(r.complete,true);assert.equal(r.total,207900);
 assert.equal(selectionTotal(groups,{}).complete,false);
 assert.equal(selectionTotal(groups,{hotel:'b',extra:'insurance'}).total,554400);
});
test('this phase accepts only reais and never reinterprets an old foreign-currency value',()=>{
 for(const currency of ['USD','EUR',''])assert.equal(calculate(option({currency})).valid,false);
 assert.equal(calculate(option()).totalBRL,calculate(option()).total);
});
test('dates, quantities, excessive values and rounding are validated',()=>{
 assert.throws(()=>nights('2026-11-22','2026-11-20'));assert.throws(()=>nights('2026-02-30','2026-03-02'));
 for(const quantity of ['','0','-1','1.5'])assert.equal(calculate(option({rows:[row({quantity})]})).valid,false);
 assert.equal(calculate(option({rows:[row({unitPrice:'0.05',quantity:'1',units:'1',taxPercent:'10'})],feePercent:'0'})).total,6);
 assert.equal(calculate(option({feePercent:''})).valid,false);
});

test('airfare and boarding tax are displayed per passenger, with group total kept separately',()=>{
 const o=option({feePercent:'0',rows:[row({category:'fare',unitPrice:'900',quantity:'30',units:'1',taxMode:'none'}),row({category:'boarding',unitPrice:'100',quantity:'30',units:'1',taxMode:'none'})]});
 const result=perPerson(o);assert.equal(result.valid,true);assert.equal(result.fare,90000);assert.equal(result.boarding,10000);assert.equal(result.total,100000);assert.equal(result.groupTotal,3000000);assert.equal(result.people,30);assert.equal(result.approximate,false);
 o.rows[1].quantity='20';assert.equal(perPerson(o).valid,false);
});
test('per-person apportionment exposes fractional cent rounding and rejects incomplete prices',()=>{
 const o=option({feePercent:'10',rows:[row({category:'fare',unitPrice:'0.05',quantity:'3',units:'1',taxMode:'none'})]});
 const result=perPerson(o);assert.equal(result.groupTotal,17);assert.equal(result.total,6);assert.equal(result.approximate,true);
 o.rows[0].state='pending';assert.equal(perPerson(o).valid,false);
});
