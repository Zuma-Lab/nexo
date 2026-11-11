'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('./demo.cjs');

async function setup(t){
  const app=createApp({database:':memory:'});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{
    await new Promise(resolve=>app.server.close(resolve));
    app.db.close();
  });
  const origin='http://127.0.0.1:'+app.server.address().port;
  async function call(path,cookie,body,method=body?'POST':'GET'){
    const response=await fetch(origin+path,{method,headers:{
      ...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})
    },body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  async function login(email,password='Demo@2026!'){
    const result=await call('/api/login',null,{email,password});
    assert.equal(result.status,200);
    return result.cookie;
  }
  const requester=await login('solicitante@alpha.demo');
  const approver=await login('maria@alpha.demo');
  const beta=await login('joao@beta.demo');
  const consultant=await login('consultor@paytrack.demo');
  const admin=await login('admin@paytrack.demo');
  const briefing={
    eventName:'Convenção de teste',companyName:'Empresa Alpha Demo',requesterName:'Pessoa de teste',
    email:'pessoa@example.test',destination:'São Paulo - SP',departureDate:'2099-11-10',returnDate:'2099-11-12',
    totalPassengers:'40',svcHospedagem:true,roomsDoubleTwin:'20',desiredBudget:'R$ 30.000 a R$ 40.000'
  };
  const submission={key:crypto.randomUUID(),form:briefing,summary:'Teste'};
  const quote=await call('/api/quotes',requester,submission);
  assert.equal(quote.status,200);
  return {app,call,login,requester,approver,beta,consultant,admin,submission,id:quote.data.id,path:'/api/quotes/'+quote.data.id};
}
const option={
  id:'duplo',name:'Quarto duplo',supplier:'Hotel Modelo',currency:'BRL',
  feePercent:'12.5',feeBase:'withTaxes',conditions:'Cancelamento com 48 h de antecedência.',
  rows:[{name:'Quarto duplo',state:'priced',unitPrice:'300',quantity:'20',units:'1',
    startDate:'2099-11-10',endDate:'2099-11-12',occupancy:'2',taxMode:'added',taxPercent:'5'}]
};
async function publish(a,revision=0,version=0,selected=option){
  const saved=await a.call(a.path+'/commercial/draft',a.consultant,{expectedRevision:revision,data:{
    event:'Convenção de teste',validUntil:'2099-11-09',groups:[
      {id:'hotel',name:'Hospedagem',service:'hotel',optional:false,options:[selected]}
    ]
  }});
  assert.equal(saved.status,200);
  const published=await a.call(a.path+'/commercial/publish',a.consultant,{expectedRevision:saved.data.revision,expectedVersion:version});
  assert.equal(published.status,200,JSON.stringify(published.data));
}
test('only a designated approver can decide; revision supersedes the decision for that version',async t=>{
  const a=await setup(t);
  await publish(a);
  const approval={version:1,choices:{hotel:'duplo'},confirm:true};
  assert.equal((await a.call(a.path+'/commercial/approve',a.requester,approval)).status,403);
  assert.equal((await a.call(a.path+'/commercial/review',a.requester,{version:1,note:'Trocar período.'})).status,403);
  const feedback=await a.call(a.path+'/commercial/feedback',a.requester,{version:1,note:'Trocar período.'});
  assert.equal(feedback.status,200);
  assert.equal((await a.call(a.path,a.consultant)).data.progress.actionable,true);
  assert.equal((await a.call(a.path+'/commercial/resolve',a.consultant,{id:feedback.data.id})).status,200);
  const review={version:1,note:'Rever política de cancelamento.'};
  assert.equal((await a.call(a.path+'/commercial/review',a.approver,review)).status,200);
  assert.equal((await a.call(a.path+'/commercial/review',a.approver,review)).status,200);
  assert.equal((await a.call(a.path+'/commercial/approve',a.approver,approval)).status,409);
  assert.equal((await a.call(a.path,a.requester)).data.progress.status,'review');
  await publish(a,1,1);
  assert.equal((await a.call(a.path+'/commercial/approve',a.approver,approval)).status,409);
  const accepted=await a.call(a.path+'/commercial/approve',a.approver,{...approval,version:2});
  assert.equal(accepted.status,200);
  assert.equal(accepted.data.totalCents,1417500);
  const customer=(await a.call(a.path+'/commercial',a.requester)).data;
  assert.equal(customer.versions[0].approval.approvedBy,'Maria Silva');
  assert.equal(customer.versions[1].review.note,review.note);
  assert.equal(customer.versions[0].data.groups[0].options[0].saleTotalCents,accepted.data.totalCents);
  assert.doesNotMatch(JSON.stringify(customer),/"(?:feePercent|feeBase|unitPrice|taxPercent|calculations|sourceOfferId)"/);
  assert.equal((await a.call(a.path+'/commercial',a.beta)).status,404);
});

test('administration grants per quote and isolates a consultant after assignment',async t=>{
  const a=await setup(t);
  assert.equal((await a.call('/api/administration',a.consultant)).status,403);
  const initial=(await a.call('/api/administration',a.admin)).data;
  const requester=initial.users.find(u=>u.email==='solicitante@alpha.demo');
  assert.equal((await a.call('/api/administration/user',a.admin,{...requester,companyId:1,approval:'assigned'})).status,200);
  await publish(a);
  const decision={version:1,choices:{hotel:'duplo'},confirm:true};
  assert.equal((await a.call(a.path+'/commercial/approve',a.requester,decision)).status,403);
  assert.equal((await a.call('/api/administration/grant',a.admin,{quoteId:a.id,userId:requester.id,granted:true})).status,200);
  assert.equal((await a.call(a.path+'/commercial/approve',a.requester,decision)).status,200);
  const email='carteira@example.test',password='TesteFicticio2026!';
  const extra=await a.call('/api/administration/user',a.admin,{
    name:'Consultor de teste',email,password,role:'consultant',companies:[1],active:true
  });
  assert.equal(extra.status,200);
  const other=await a.login(email,password);
  assert.equal((await a.call('/api/administration/assign',a.admin,{quoteId:a.id,userId:extra.data.userId})).status,200);
  assert.equal((await a.call(a.path,a.consultant)).status,404);
  assert.equal((await a.call(a.path+'/commercial',a.consultant)).status,404);
  assert.equal((await a.call(a.path+'/sourcing',other)).status,200);
  assert.equal((await a.call('/api/quotes',a.consultant)).data.length,0);
});

test('complementation updates the same protocol, preserves history and blocks false status',async t=>{
  const a=await setup(t);
  assert.equal((await a.call(a.path+'/status',a.consultant,{status:'proposal'},'PATCH')).status,409);
  assert.equal((await a.call(a.path+'/workflow/complement',a.consultant,{prompt:'Confirme a quantidade de quartos.'})).status,200);
  const detail=(await a.call(a.path,a.requester)).data;
  assert.equal(detail.progress.actionable,true);
  const payload={complementId:detail.progress.complement.id,answer:'Serão 22 quartos.',fields:{roomsDoubleTwin:'22'}};
  assert.equal((await a.call(a.path+'/workflow/answer',a.beta,payload)).status,404);
  assert.equal((await a.call(a.path+'/workflow/answer',a.requester,payload)).status,200);
  assert.equal((await a.call(a.path+'/workflow/answer',a.requester,payload)).status,409);
  const updated=(await a.call(a.path,a.requester)).data;
  assert.equal(updated.protocol,detail.protocol);
  assert.equal(updated.form.roomsDoubleTwin,'22');
  const replay=await a.call('/api/quotes',a.requester,a.submission);
  assert.equal(replay.status,200);
  assert.equal(replay.data.protocol,detail.protocol);
  assert.equal(updated.form.desiredBudget,'R$ 30.000 a R$ 40.000');
  assert.equal(updated.status,'analysis');
  assert.equal(updated.activity.some(row=>row.kind==='briefing_fields_updated'),false);
});

test('hotel selection is scoped and does not represent a send; validated offers stay internal',async t=>{
  const a=await setup(t);
  const url=a.path+'/sourcing';
  assert.equal((await a.call(url,a.beta)).status,404);
  const initial=(await a.call(url,a.requester)).data;
  assert.equal(initial.briefing.rooms,20);
  assert.equal(initial.suppliers.length,2);
  const supplierIds=initial.suppliers.map(row=>row.id);
  assert.equal((await a.call(url+'/request',a.requester,{supplierIds:[supplierIds[0],'hotel-demo-parque-2']})).status,404);
  assert.equal((await a.call(url,a.requester)).data.requests.length,0);
  assert.equal((await a.call(url+'/request',a.requester,{supplierIds})).data.added,2);
  assert.equal((await a.call(url+'/request',a.requester,{supplierIds})).data.added,0);
  const selected=(await a.call(url,a.consultant)).data.requests[0];
  assert.equal(selected.state,'requested');
  const send={requestId:selected.id,expectedRevision:1,evidence:'Referência do envio fictício',confirmSent:true};
  assert.equal((await a.call(url+'/send',a.requester,send)).status,403);
  assert.equal((await a.call(url+'/send',a.consultant,{...send,confirmSent:false})).status,422);
  assert.equal((await a.call(url+'/send',a.consultant,send)).status,200);
  assert.equal((await a.call(url+'/send',a.consultant,send)).status,409);
  const offer={
    requestId:selected.id,expectedRevision:2,item:'Quarto duplo',unitPrice:'300',quantity:'20',
    startDate:'2099-11-10',endDate:'2099-11-12',occupancy:'2',validUntil:'2099-11-09',
    conditions:'Cancelamento com 48 h de antecedência.',availability:'confirmed',taxMode:'added',taxPercent:'5'
  };
  assert.equal((await a.call(url+'/offer',a.consultant,offer)).status,200);
  const received=(await a.call(url,a.consultant)).data.requests.find(row=>row.id===selected.id);
  assert.equal(received.offers[0].totalCents,1260000);
  const validation={requestId:selected.id,expectedRevision:3,offerId:received.offers[0].id};
  assert.equal((await a.call(url+'/validate',a.consultant,validation)).status,200);
  const publicView=(await a.call(url,a.requester)).data;
  assert.equal(publicView.requests.find(row=>row.id===selected.id).state,'validated');
  assert.doesNotMatch(JSON.stringify(publicView),/"(?:offers|evidence|unitPrice|totalCents|contact)"/);
  await publish(a,0,0,{...received.offers[0].option,sourceOfferId:received.offers[0].id,feePercent:'12.5'});
  const commercial=(await a.call(a.path+'/commercial',a.requester)).data;
  assert.equal(commercial.versions[0].data.groups[0].options[0].saleTotalCents,1417500);
  assert.equal(commercial.versions[0].data.groups[0].options[0].sourceOfferId,undefined);
});

test('consultant keeps all simultaneous tasks with exact targets and the client does not receive them',async t=>{
  const a=await setup(t);
  const {currentDay}=require('./workflow.cjs');
  const shift=days=>new Date(Date.parse(currentDay()+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
  const sourcing=a.path+'/sourcing';
  const catalog=(await a.call(sourcing,a.requester)).data.suppliers;
  assert.equal((await a.call(sourcing+'/request',a.requester,{supplierIds:catalog.map(s=>s.id)})).status,200);
  const requests=(await a.call(sourcing,a.consultant)).data.requests;
  for(const request of requests){
    const sent=await a.call(sourcing+'/send',a.consultant,{
      requestId:request.id,expectedRevision:1,evidence:'Envio fictício',confirmSent:true
    });
    assert.equal(sent.status,200);
  }
  const [waiting,quoted]=requests;
  const offered=await a.call(sourcing+'/offer',a.consultant,{
    requestId:quoted.id,expectedRevision:2,item:'Duplo',unitPrice:'300',quantity:'20',
    startDate:'2099-11-10',endDate:'2099-11-12',occupancy:'2',validUntil:shift(2),
    conditions:'Condições fictícias',availability:'confirmed',taxMode:'none'
  });
  assert.equal(offered.status,200);
  const latest=(await a.call(sourcing,a.consultant)).data.requests.find(r=>r.id===quoted.id);
  assert.equal((await a.call(sourcing+'/validate',a.consultant,{
    requestId:quoted.id,expectedRevision:3,offerId:latest.offers[0].id
  })).status,200);
  await publish(a);
  assert.equal((await a.call(a.path+'/commercial/review',a.approver,{version:1,note:'Rever o cancelamento.'})).status,200);
  assert.equal((await a.call(a.path+'/operation',a.consultant,{expectedRevision:0,dueDate:shift(-1)},'PATCH')).status,200);

  const detail=(await a.call(a.path,a.consultant)).data;
  assert.deepEqual(detail.progress.tasks.map(task=>[task.kind,task.target]),[
    ['return','request-operations'],['review','request-proposal-review-1'],
    ['supplier-deadline','supplier-offer-'+latest.offers[0].id]
  ]);
  assert.equal(detail.progress.tasks[2].date,shift(2));
  assert.match(detail.progress.tasks[2].label,/vence em 2 dias/);
  const client=(await a.call(a.path,a.requester)).data;
  assert.equal(Object.hasOwn(client.progress,'tasks'),false);
  assert.equal(client.progress.status,'review');
  const update=(user,expectedRevision,followUpOn)=>a.call(sourcing+'/follow-up',user,{
    requestId:waiting.id,expectedRevision,followUpOn
  });
  const readTasks=async()=>((await a.call('/api/quotes',a.consultant)).data.find(q=>q.id===a.id)).progress.tasks;
  assert.equal((await update(a.requester,2,shift(0))).status,403);
  assert.equal((await update(a.beta,2,shift(0))).status,404);
  assert.equal((await update(a.consultant,2,'2099-02-30')).status,422);
  assert.equal((await update(a.consultant,2,shift(1))).status,200);
  assert.equal((await update(a.consultant,2,shift(0))).status,409);
  assert.equal((await readTasks()).some(task=>task.kind==='supplier-follow-up'),false);
  assert.equal((await update(a.consultant,3,shift(0))).status,200);
  const due=(await readTasks()).find(task=>task.kind==='supplier-follow-up');
  assert.equal(due.target,'supplier-follow-up-'+waiting.id);
  assert.equal(due.date,shift(0));
  const publicRequests=(await a.call(sourcing,a.requester)).data.requests;
  assert.equal(Object.hasOwn(publicRequests.find(item=>item.id===waiting.id),'followUpOn'),false);
  assert.equal((await update(a.consultant,4,null)).status,200);
  assert.equal((await readTasks()).some(task=>task.kind==='supplier-follow-up'),false);
  assert.ok((await a.call(a.path,a.consultant)).data.activity.some(entry=>entry.kind==='supplier_follow_up'));
  assert.equal((await a.call(a.path,a.requester)).data.activity.some(entry=>entry.kind==='supplier_follow_up'),false);
});
