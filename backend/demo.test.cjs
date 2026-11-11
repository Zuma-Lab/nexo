'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {createApp}=require('./demo.cjs');

test('login demo, cotação, tenant isolation, status and sequential idempotent protocol',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'paytrack-demo-'));
 const app=createApp({database:path.join(folder,'db.sqlite')});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+app.server.address().port;
 async function http(path,method='GET',body,cookie){const r=await fetch(url+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function login(email){const r=await http('/api/login','POST',{email,password:'Demo@2026!'});assert.equal(r.status,200);return r.cookie;}
 try{
  assert.equal((await http('/api/quotes')).status,401);
  assert.equal((await http('/api/login','POST',{email:'maria@alpha.demo',password:'wrong'})).status,401);
  const alpha=await login('maria@alpha.demo'), beta=await login('joao@beta.demo'), consultant=await login('consultor@paytrack.demo');
  assert.equal((await http('/api/session','GET',null,alpha)).data.user.companyName,'Empresa Alpha Demo');
  const body={key:crypto.randomUUID(),form:{companyName:'Empresa Alpha Demo',eventName:'Convenção Alpha',requesterName:'Maria Silva',email:'maria@alpha.demo',totalPassengers:'42',destination:'São Paulo - SP',datesUnknown:true,svcAereo:true},summary:'Briefing Alpha'};
  assert.equal((await http('/api/quotes','POST',body,beta)).status,403);
  const created=await http('/api/quotes','POST',body,alpha);assert.equal(created.status,200);const q=created.data;
  assert.equal(q.protocol,'1');assert.equal(q.delivery,'demo');assert.equal(q.status,'received');
  const repeated=await http('/api/quotes','POST',body,alpha);assert.equal(repeated.data.id,q.id);
  assert.equal((await http('/api/quotes','GET',null,beta)).data.length,0);
  assert.equal((await http('/api/quotes/'+q.id,'GET',null,beta)).status,404);
  assert.equal((await http('/api/quotes/'+q.id+'/status','PATCH',{status:'closed'},alpha)).status,403);
  assert.equal((await http('/api/quotes','GET',null,consultant)).data.length,1);
  assert.equal((await http('/api/quotes','POST',body,consultant)).status,403);
  assert.equal((await http('/api/quotes/'+q.id+'/status','PATCH',{status:'notreal'},consultant)).status,400);
  const updated=await http('/api/quotes/'+q.id+'/status','PATCH',{status:'quoting'},consultant);
  assert.equal(updated.data.status,'quoting');
  assert.equal((await http('/api/quotes','GET',null,alpha)).data[0].statusLabel,'Em cotação');
  const history=app.db.prepare('SELECT * FROM quote_status_history WHERE quote_id=?').all(q.id);
  assert.equal(history.length,2);
  assert.equal((await http('/api/quotes/'+q.id,'GET',null,alpha)).data.history.length,2);
  assert.equal((await http('/api/quotes','POST',{...body,form:{...body.form,eventName:'Alterado'}},alpha)).status,409);
  const bbody={key:crypto.randomUUID(),form:{companyName:'Empresa Beta Demo',eventName:'Treinamento Beta',requesterName:'João Costa',email:'joao@beta.demo',participantsUnknown:true,destination:'Curitiba - PR',datesUnknown:true,svcHospedagem:true},summary:'Briefing Beta'};
  const b=await http('/api/quotes','POST',bbody,beta);assert.equal(b.data.protocol,'2');
  assert.equal((await http('/api/quotes','GET',null,alpha)).data.length,1);
  assert.equal((await http('/api/quotes','GET',null,consultant)).data.length,2);
  const out=await http('/api/logout','POST',{},alpha);assert.equal(out.status,200);
  assert.equal((await http('/api/quotes','GET',null,alpha)).status,401);
  assert.equal((await fetch(url+'/formulario.html',{redirect:'manual'})).status,303);
  assert.equal((await fetch(url+'/portal.html')).status,200);
  assert.equal((await fetch(url+'/data/db.sqlite')).status,404);
 }finally{await new Promise(resolve=>app.server.close(resolve));app.db.close();fs.rmSync(folder,{recursive:true,force:true});}
});
