(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ProposalRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const max=1000000000000n;
  function decimal(value,places,label){
    const text=String(value??'').trim().replace(',','.');
    if(!new RegExp('^\\d+(?:\\.\\d{1,'+places+'})?$').test(text))throw Error('Informe '+label+'.');
    const [whole,fraction='']=text.split('.');
    const number=BigInt(whole)*10n**BigInt(places)+BigInt(fraction.padEnd(places,'0'));
    if(number>max)throw Error(label+' excede o limite da prévia.');return number;
  }
  function count(value,label){const n=String(value??'');if(!/^\d+$/.test(n)||Number(n)<1||Number(n)>100000)throw Error('Informe '+label+' como inteiro maior que zero.');return BigInt(n);}
  function round(n,d){return (n+d/2n)/d;}
  function safe(n){if(n>max)throw Error('Valor calculado excede o limite da prévia.');return Number(n);}
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
  function nights(start,end){
    if(!validDate(start)||!validDate(end))throw Error('Informe check-in e check-out válidos.');
    const n=(Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000;
    if(n<1)throw Error('O check-out deve ser posterior ao check-in.');return n;
  }
  function calculate(option){
    try{
      if(option.currency!=='BRL')throw Error('Nesta fase, a proposta aceita somente valores em reais (BRL).');
      let base=0n,tax=0n,pending=false;
      const lines=option.rows.map(row=>{
        if(row.state==='included')return {base:0,tax:0,total:0,state:'included'};
        if(row.state==='pending'){pending=true;return {base:null,tax:null,total:null,state:'pending'};}
        if(row.state!=='priced')throw Error('Revise a situação do item.');
        const units=row.startDate||row.endDate?nights(row.startDate,row.endDate):row.units;
        const b=decimal(row.unitPrice,2,'o valor unitário')*count(row.quantity,'a quantidade')*count(units,'as diárias ou ocorrências');
        if(!['added','included','none'].includes(row.taxMode))throw Error('Informe como a taxa do fornecedor será tratada.');
        const rate=row.taxMode==='none'?0n:decimal(row.taxPercent,2,'o percentual da taxa');
        if(rate>10000n)throw Error('A taxa do fornecedor deve estar entre 0 e 100%.');
        const t=row.taxMode==='added'?round(b*rate,10000n):0n;
        base+=b;tax+=t;return {base:safe(b),tax:safe(t),total:safe(b+t),state:'priced',units:Number(units)};
      });
      if(!option.rows.length)throw Error('Adicione pelo menos um item à opção.');
      const percent=decimal(option.feePercent,2,'o percentual de agenciamento (zero quando não houver)');
      if(percent>10000n)throw Error('Agenciamento deve estar entre 0 e 100%.');
      if(!['withTaxes','withoutTaxes'].includes(option.feeBase))throw Error('Selecione a base do agenciamento.');
      const fee=round((option.feeBase==='withTaxes'?base+tax:base)*percent,10000n),total=base+tax+fee;
      return {valid:true,lines,base:safe(base),tax:safe(tax),subtotal:safe(base+tax),fee:safe(fee),total:safe(total),totalBRL:safe(total),pending};
    }catch(error){return {valid:false,error:error.message,total:null,totalBRL:null,pending:false};}
  }
  function selectionTotal(groups,choices,pricing=calculate){
    let total=0,complete=true,pending=false;const errors=[];
    for(const group of groups){
      const choice=choices[group.id];
      if(choice==='none'&&group.optional)continue;
      const option=group.options.find(o=>o.id===choice);
      if(!option){complete=false;continue;}
      const result=pricing(option,group);
      if(!result.valid){complete=false;errors.push(result.error);continue;}
      pending=pending||result.pending;total+=result.totalBRL;
      if(!Number.isSafeInteger(total)||total>Number(max)){errors.push('Total excede o limite da prévia.');complete=false;}
    }
    return {total,complete:complete&&!pending,pending,errors};
  }
  function perPerson(option){
    const result=calculate(option);
    if(!result.valid||result.pending)return {valid:false,error:result.error||'Há valores a confirmar.'};
    const rows=option.rows.filter(row=>row.state==='priced');
    if(!rows.length)return {valid:false,error:'Informe a tarifa e os passageiros.'};
    const people=Number(rows[0].quantity);
    if(rows.some(row=>Number(row.quantity)!==people||Number(row.units)!==1||row.startDate||row.endDate))return {valid:false,error:'Os custos do aéreo devem atender ao mesmo grupo e ao período completo. Separe grupos com tarifas diferentes.'};
    let fare=0,boarding=0,other=0;
    for(const row of rows){
      const cents=Number(decimal(row.unitPrice,2,'o valor unitário'));
      if(row.category==='fare')fare+=cents;else if(row.category==='boarding')boarding+=cents;else other+=cents;
    }
    const unit=value=>Math.floor((value+people/2)/people);
    return {valid:true,people,fare,boarding,other,supplierTax:unit(result.tax),fee:unit(result.fee),total:unit(result.total),groupTotal:result.total,approximate:result.tax%people!==0||result.fee%people!==0||result.total%people!==0};
  }
  return {calculate,selectionTotal,nights,perPerson};
});
