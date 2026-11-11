'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {DatabaseSync}=require('node:sqlite');
const {createApp}=require('./demo.cjs');
const password='Demo@2026!';
const fixture=(company='Empresa Alpha Demo')=>({key:crypto.randomUUID(),form:{companyName:company,eventName:'Encontro de teste',requesterName:'Pessoa fictícia',email:'teste@example.test',destination:'São Paulo - SP',participantsUnknown:true,datesUnknown:true,svcAereo:true},summary:'Briefing exclusivamente de teste'});
async function start(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paytrack-integration-'));
 const database=path.join(dir,'quotes.sqlite');
 let app=createApp({database});
 const listen=async()=>{await new Promise(r=>app.server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+app.server.address().port;};
 let base=await listen();
 const stop=async()=>{await new Promise(r=>app.server.close(r));app.db.close();};
 t.after(async()=>{await stop();fs.rmSync(dir,{recursive:true,force:true});});
 const http=async(route,method='GET',body,cookie)=>{
  const r=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
 };
 return {http,get base(){return base;},get db(){return app.db;},async login(email='maria@alpha.demo'){const r=await http('/api/login','POST',{email,password});assert.equal(r.status,200);return r.cookie;},async restart(){await stop();app=createApp({database});base=await listen();}};
}
test('landing is public; form requires client; private files and legacy write routes stay inaccessible',async t=>{
 const a=await start(t);
 assert.match(await (await fetch(a.base+'/')).text(),/assets\/runtime\/app.js/);
 assert.equal((await fetch(a.base+'/formulario.html',{redirect:'manual'})).status,303);
 const consultant=await a.login('consultor@paytrack.demo');
 assert.equal((await fetch(a.base+'/formulario.html',{headers:{Cookie:consultant},redirect:'manual'})).status,303);
 const alpha=await a.login();
 const form=await (await fetch(a.base+'/formulario.html',{headers:{Cookie:alpha}})).text();
 assert.match(form,/window.PAYTRACK_USER=/);assert.match(form,/Empresa Alpha Demo/);
 for(const file of ['/backend/demo.cjs','/.local/requests.sqlite','/data/quotes.sqlite','/package.json','/.env','/assets/%2e%2e/backend/demo.cjs']) assert.equal((await fetch(a.base+file)).status,404,file);
 assert.equal((await a.http('/api/requests','POST',fixture(),alpha)).status,404);
 assert.equal((await fetch(a.base+'/api/session',{headers:{Origin:'https://example.test'}})).status,403);
 assert.equal(await new Promise((resolve,reject)=>{require('node:http').get(a.base+'/api/session',{headers:{Host:'127.0.0.1:1'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);}),403);
 assert.equal((await a.http('/api/health')).data.notificationStatus,'disabled_demo');
});
test('server applies main form validation and enforces company even when payload is forged',async t=>{
 const a=await start(t),cookie=await a.login(),body=fixture();
 assert.equal((await a.http('/api/quotes','POST',{...body,form:{...body.form,destination:''}},cookie)).status,422);
 assert.equal((await a.http('/api/quotes','POST',{...body,form:{...body.form,companyName:'Empresa Beta Demo'}},cookie)).status,403);
 assert.equal(a.db.prepare('SELECT count(*) n FROM quotes').get().n,0);
 const q=await a.http('/api/quotes','POST',body,cookie);
 assert.equal(q.status,200);assert.equal(q.data.delivery,'demo');
 assert.equal((await a.http('/api/retry','POST',{id:q.data.id},cookie)).data.delivery,'demo');
 assert.equal(a.db.prepare('SELECT count(*) n FROM quotes').get().n,1);
});
test('company records and sequence persist across restart; expired sessions lose access',async t=>{
 const a=await start(t),alpha=await a.login();
 const first=await a.http('/api/quotes','POST',fixture(),alpha);assert.equal(first.data.protocol,'1');
 await a.restart();
 const beta=await a.login('joao@beta.demo');
 const second=await a.http('/api/quotes','POST',fixture('Empresa Beta Demo'),beta);assert.equal(second.data.protocol,'2');
 assert.equal((await a.http('/api/quotes','GET',null,alpha)).data.length,1);
 a.db.exec('UPDATE sessions SET expires_at=0');
 assert.equal((await a.http('/api/quotes','GET',null,alpha)).status,401);
 assert.equal((await a.http('/api/session','GET',null,beta)).data.user,null);
});
test('legacy unassigned quotes remain intact and are never exposed to demo tenants',async t=>{
 const a=await start(t);
 a.db.prepare("INSERT INTO quotes(id,owner,request_key,protocol,created,payload,summary) VALUES(?,?,?,?,?,?,?)").run(crypto.randomUUID(),'legacy','old-key','17',new Date().toISOString(),'{}','Legado preservado');
 await a.restart();
 const alpha=await a.login(),consultant=await a.login('consultor@paytrack.demo');
 assert.equal((await a.http('/api/quotes','GET',null,consultant)).data.length,0);
 const q=await a.http('/api/quotes','POST',fixture(),alpha);assert.equal(q.data.protocol,'18');
 assert.equal(a.db.prepare("SELECT summary FROM quotes WHERE protocol='17'").get().summary,'Legado preservado');
});
test('invalid status is rejected and repeated status changes do not duplicate history',async t=>{
 const a=await start(t),alpha=await a.login(),consultant=await a.login('consultor@paytrack.demo');
 const q=(await a.http('/api/quotes','POST',fixture(),alpha)).data;
 assert.equal((await a.http('/api/quotes/'+q.id+'/status','PATCH',{status:'proposal'},consultant)).status,409);
 for(const status of ['analysis','quoting','consolidating','quoting']){
  assert.equal((await a.http('/api/quotes/'+q.id+'/status','PATCH',{status},consultant)).status,200);
  assert.equal((await a.http('/api/quotes/'+q.id+'/status','PATCH',{status},consultant)).status,200);
 }
 assert.equal((await a.http('/api/quotes/'+q.id,'GET',null,alpha)).data.history.length,5);
 assert.equal((await a.http('/api/quotes/'+q.id+'/status','PATCH',{status:'invalid'},consultant)).status,400);
});

test('company CNPJ comes from the account and cannot be overwritten in a briefing',async t=>{
 const a=await start(t);
 a.db.prepare('UPDATE companies SET cnpj=? WHERE id=1').run('11222333000181');
 const cookie=await a.login();
 const session=await a.http('/api/session','GET',undefined,cookie);
 assert.equal(session.data.user.companyCnpj,'11222333000181');
 const body=fixture();body.form.cnpj='99888777000166';
 const saved=await a.http('/api/quotes','POST',body,cookie);
 assert.equal(saved.status,200);assert.equal(saved.data.form.cnpj,'11222333000181');
});

test('cross-company retry and history remain inaccessible; stale status cannot overwrite another session',async t=>{
 const a=await start(t),alpha=await a.login(),beta=await a.login('joao@beta.demo'),consultant=await a.login('consultor@paytrack.demo');
 const q=(await a.http('/api/quotes','POST',fixture(),alpha)).data;
 assert.equal((await a.http('/api/quotes/'+q.id,'GET',null,beta)).status,404);
 assert.equal((await a.http('/api/retry','POST',{id:q.id},beta)).status,404);
 assert.equal((await a.http('/api/quotes/'+q.id+'/status','PATCH',{status:'closed',expectedStatus:'received'},beta)).status,403);
 assert.equal((await a.http('/api/quotes/'+q.id+'/status','PATCH',{status:'analysis',expectedStatus:'received'},consultant)).status,200);
 assert.equal((await a.http('/api/quotes/'+q.id+'/status','PATCH',{status:'closed',expectedStatus:'received'},consultant)).status,409);
 const latest=await a.http('/api/quotes/'+q.id,'GET',null,alpha);
 assert.equal(latest.data.status,'analysis');assert.equal(latest.data.history.length,2);
});

test('structured detail ignores a forged summary and preserves submitted history without rewriting it',async t=>{
 const a=await start(t),alpha=await a.login(),body=fixture();body.summary='Nome: RESUMO FALSO';body.form.eventName='Evento validado';
 const q=(await a.http('/api/quotes','POST',body,alpha)).data;
 const detail=(await a.http('/api/quotes/'+q.id,'GET',null,alpha)).data;
 assert.equal(detail.sections[0].fields.find(x=>x.key==='eventName').value,'Evento validado');
 assert.equal(detail.summary,'Nome: RESUMO FALSO');
 assert.equal(detail.sections.some(x=>x.id==='hotel'),false);
});

test('internal owner, manual due date and pending note are revisioned, persistent and hidden from clients',async t=>{
 const a=await start(t),alpha=await a.login(),beta=await a.login('joao@beta.demo'),consultant=await a.login('consultor@paytrack.demo');
 const q=(await a.http('/api/quotes','POST',fixture(),alpha)).data,route='/api/quotes/'+q.id+'/operation';
 assert.equal((await a.http(route,'PATCH',{expectedRevision:0,claim:true},alpha)).status,403);
 assert.equal((await a.http(route,'PATCH',{expectedRevision:0,claim:true},beta)).status,403);
 assert.equal((await a.http(route,'PATCH',{expectedRevision:0,dueDate:'2026-02-30'},consultant)).status,422);
 assert.equal((await a.http(route,'PATCH',{expectedRevision:0,assignedTo:1},consultant)).status,400);
 const saved=await a.http(route,'PATCH',{expectedRevision:0,claim:true,dueDate:'2026-11-10',pendingNote:'Aguardar briefing complementar'},consultant);
 assert.equal(saved.status,200);assert.equal(saved.data.operation.revision,1);assert.equal(saved.data.operation.assignedTo,3);
 assert.equal((await a.http(route,'PATCH',{expectedRevision:0,dueDate:null},consultant)).status,409);
 assert.equal((await a.http(route,'PATCH',{expectedRevision:1,dueDate:'2026-11-10',pendingNote:'Aguardar briefing complementar'},consultant)).data.operation.revision,1);
 let detail=(await a.http('/api/quotes/'+q.id,'GET',null,consultant)).data;
 assert.equal(detail.operationHistory.length,1);
 for(const response of [(await a.http('/api/quotes','GET',null,alpha)).data[0],(await a.http('/api/quotes/'+q.id,'GET',null,alpha)).data,(await a.http('/api/retry','POST',{id:q.id},alpha)).data]){
  assert.equal(Object.hasOwn(response,'operation'),false);assert.equal(Object.hasOwn(response,'operationHistory'),false);assert.equal(JSON.stringify(response).includes('Aguardar briefing complementar'),false);
 }
 await a.restart();
 detail=(await a.http('/api/quotes/'+q.id,'GET',null,consultant)).data;
 assert.equal(detail.operation.dueDate,'2026-11-10');assert.equal(detail.operationHistory.length,1);
 const cleared=await a.http(route,'PATCH',{expectedRevision:1,dueDate:null,pendingNote:''},consultant);assert.equal(cleared.status,200);assert.equal(cleared.data.operation.revision,2);
});

test('internal workflow and audit history roll back together on failure',async t=>{
 const a=await start(t),alpha=await a.login(),consultant=await a.login('consultor@paytrack.demo');
 const q=(await a.http('/api/quotes','POST',fixture(),alpha)).data;
 a.db.exec("CREATE TRIGGER fail_operation_history BEFORE INSERT ON quote_operation_history BEGIN SELECT RAISE(ABORT,'test rollback'); END");
 assert.equal((await a.http('/api/quotes/'+q.id+'/operation','PATCH',{expectedRevision:0,claim:true},consultant)).status,500);
 assert.equal(a.db.prepare('SELECT count(*) n FROM quote_operations').get().n,0);
 assert.equal(a.db.prepare('SELECT count(*) n FROM quote_operation_history').get().n,0);
});

test('account drafts are isolated by user and company, accept incomplete briefing and reject stale saves',async t=>{
 const a=await start(t),alpha=await a.login(),beta=await a.login('joao@beta.demo'),consultant=await a.login('consultor@paytrack.demo');
 a.db.exec("INSERT INTO app_users(company_id,name,email,password_hash,role) SELECT 1,'Outra pessoa fictícia','outra@alpha.demo',password_hash,'client' FROM app_users WHERE id=1");
 const second=await a.login('outra@alpha.demo');
 assert.equal((await a.http('/api/draft')).status,401);assert.equal((await a.http('/api/draft','GET',null,consultant)).status,403);
 const payload={expectedRevision:0,expectedUserId:1,form:{companyName:'Empresa forjada',eventName:'Rascunho incompleto',svcAereo:true,departureTimes:['Manhã']}};
 assert.equal((await a.http('/api/draft','POST',payload,alpha)).status,200);
 assert.equal((await a.http('/api/draft','POST',payload,beta)).status,409);
 assert.equal((await a.http('/api/draft','GET',null,beta)).data.draft,null);
 assert.equal((await a.http('/api/draft','GET',null,second)).data.draft,null);
 assert.equal((await a.http('/api/draft','POST',payload,alpha)).status,409);
 await a.restart();const draft=(await a.http('/api/draft','GET',null,alpha)).data.draft;
 assert.equal(draft.form.companyName,'Empresa Alpha Demo');assert.equal(draft.form.eventName,'Rascunho incompleto');assert.equal(draft.revision,1);
 assert.equal((await a.http('/api/draft','POST',{...payload,expectedRevision:1,form:{eventName:{nested:'invalid'}}},alpha)).status,422);
 assert.equal(a.db.prepare('SELECT count(*) n FROM quotes').get().n,0);
});
