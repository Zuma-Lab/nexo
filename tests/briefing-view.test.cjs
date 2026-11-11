const {test}=require('node:test');const assert=require('node:assert/strict');const {sections}=require('../briefing-view.js');
test('briefing view covers services and renders zero, notes and arrays as plain data',()=>{
 const data=sections({eventName:'<script>example</script>',svcHospedagem:true,roomsSingle:0,hospedagemGuidance:true,svcAereo:true,departureTimes:['Manhã'],generalNotes:'Linha 1\nLinha 2',notAField:'hidden'});
 assert.equal(data[0].fields[0].value,'<script>example</script>');
 assert.equal(data.find(x=>x.id==='hotel').fields.find(x=>x.key==='roomsSingle').value,'0');
 assert.equal(data.find(x=>x.id==='hotel').fields.find(x=>x.key==='hospedagemGuidance').value,'Sim');
 assert.equal(data.find(x=>x.id==='air').fields.find(x=>x.key==='departureTimes').value,'Manhã');
 assert.equal(JSON.stringify(data).includes('hidden'),false);assert.deepEqual(sections(null),[]);
});

test('selected services without preferences stay visible in the briefing',()=>{const data=sections({eventName:'Evento',svcAereo:true,svcTransfers:true});assert.match(data[0].fields.find(x=>x.key==='services').value,/Aéreo, Transfer/);assert.equal(data.find(x=>x.id==='transfer').fields[0].value,'A definir com a equipe');});
