'use strict';
const {closed,problem,transaction}=require('./workflow.cjs');
const {calculate,selectionTotal,perPerson}=require('../assets/proposal/proposal-rules.js');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status});};
const text=(v,max=10000)=>{if(v===undefined||v===null)return '';if(!['string','number'].includes(typeof v)||String(v).length>max)fail('Texto inválido ou muito longo.');return String(v).trim();};
const id=v=>{if(typeof v!=='string'||['__proto__','constructor','prototype'].includes(v)||!/^[-\w]{1,64}$/.test(v))fail('Identificador inválido.');return v;};
function normalize(input){
 if(!input||typeof input!=='object'||!Array.isArray(input.groups)||!input.groups.length||input.groups.length>20)fail('Adicione de 1 a 20 grupos de serviços.');
 const data={event:text(input.event,200),people:text(input.people,10),validUntil:text(input.validUntil,10),groups:[]};const groups=new Set();
 for(const g of input.groups){if(!g||groups.has(id(g.id)))fail('Grupos com identificadores repetidos.');groups.add(g.id);if(!['air','hotel','transfer','food','insurance','venue'].includes(g.service)||typeof g.optional!=='boolean'||!Array.isArray(g.options)||!g.options.length||g.options.length>20)fail('Grupo de serviço inválido.');
  const group={id:g.id,name:text(g.name,200),service:g.service,optional:g.optional,description:text(g.description),options:[]},ids=new Set();
  for(const o of g.options){if(!o||ids.has(id(o.id)))fail('Alternativas com identificadores repetidos.');ids.add(o.id);if(!Array.isArray(o.rows)||!o.rows.length||o.rows.length>100)fail('Adicione de 1 a 100 itens por alternativa.');
   const option={id:o.id,name:text(o.name,200),supplier:text(o.supplier,200),currency:text(o.currency,3),feePercent:text(o.feePercent,20),feeBase:text(o.feeBase,30),description:text(o.description),conditions:text(o.conditions),...(o.sourceOfferId?{sourceOfferId:id(o.sourceOfferId)}:{}),rows:[]};
   for(const r of o.rows){if(!r||typeof r!=='object')fail('Item inválido.');const row={};for(const key of ['name','unitPrice','quantity','units','taxPercent','taxMode','state','unit','startDate','endDate','occupancy','category'])row[key]=text(r[key],key==='name'?500:100);option.rows.push(row);}group.options.push(option);
  }data.groups.push(group);
 }return data;
}
function validatePublication(data){
 if(!data.event||!date(data.validUntil)||data.validUntil<today())fail('Informe evento e validade de hoje ou futura.');
 for(const g of data.groups)for(const o of g.options){if(!g.name||!o.name||!o.supplier||!o.conditions)fail('Preencha grupo, alternativa, fornecedor e condições.');if(g.service==='hotel'&&o.rows.some(r=>r.state==='priced'&&(!date(r.startDate)||!date(r.endDate)||!/^\d+$/.test(r.occupancy)||Number(r.occupancy)<1)))fail('Informe check-in, check-out e ocupação dos quartos.');const result=calculate(o);if(!result.valid||result.pending)fail(result.error||'Resolva os valores pendentes antes de publicar.');if(g.service==='air'&&!perPerson(o).valid)fail(perPerson(o).error);}
}
function createCommercial(db,workflow){
 db.exec(`CREATE TABLE IF NOT EXISTS commercial_drafts(quote_id TEXT PRIMARY KEY REFERENCES quotes(id),revision INTEGER NOT NULL,payload TEXT NOT NULL,changed_by INTEGER NOT NULL REFERENCES app_users(id),updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS commercial_versions(quote_id TEXT NOT NULL REFERENCES quotes(id),version INTEGER NOT NULL,payload TEXT NOT NULL,calculations TEXT NOT NULL,published_by INTEGER NOT NULL REFERENCES app_users(id),published_at TEXT NOT NULL,PRIMARY KEY(quote_id,version));
 CREATE TABLE IF NOT EXISTS commercial_approvals(quote_id TEXT NOT NULL,version INTEGER NOT NULL,approved_by INTEGER NOT NULL REFERENCES app_users(id),approved_at TEXT NOT NULL,choices TEXT NOT NULL,total_cents INTEGER NOT NULL,PRIMARY KEY(quote_id,version),FOREIGN KEY(quote_id,version) REFERENCES commercial_versions(quote_id,version));
 CREATE TABLE IF NOT EXISTS commercial_reviews(
   quote_id TEXT NOT NULL, version INTEGER NOT NULL, requested_by INTEGER NOT NULL REFERENCES app_users(id),
   requested_at TEXT NOT NULL, note TEXT NOT NULL, PRIMARY KEY(quote_id,version),
   FOREIGN KEY(quote_id,version) REFERENCES commercial_versions(quote_id,version)
 );
 CREATE TABLE IF NOT EXISTS proposal_feedback(
   id INTEGER PRIMARY KEY, quote_id TEXT NOT NULL, version INTEGER NOT NULL, note TEXT NOT NULL,
   actor_id INTEGER NOT NULL REFERENCES app_users(id), created_at TEXT NOT NULL,
   resolved_at TEXT, resolved_by INTEGER REFERENCES app_users(id),
   FOREIGN KEY(quote_id,version) REFERENCES commercial_versions(quote_id,version)
 );
 CREATE TABLE IF NOT EXISTS proposal_decision_identity(
   quote_id TEXT NOT NULL, version INTEGER NOT NULL, action TEXT NOT NULL,
   user_id INTEGER NOT NULL REFERENCES app_users(id), company_id INTEGER NOT NULL REFERENCES companies(id),
   name TEXT NOT NULL, PRIMARY KEY(quote_id,version,action),
   FOREIGN KEY(quote_id,version) REFERENCES commercial_versions(quote_id,version)
 );
 CREATE TABLE IF NOT EXISTS event_lifecycle(quote_id TEXT PRIMARY KEY REFERENCES quotes(id),state TEXT NOT NULL,revision INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS commercial_audit(id INTEGER PRIMARY KEY,quote_id TEXT NOT NULL REFERENCES quotes(id),actor INTEGER NOT NULL REFERENCES app_users(id),action TEXT NOT NULL,created_at TEXT NOT NULL,detail TEXT NOT NULL);`);
 const latest=q=>db.prepare('SELECT MAX(version) n FROM commercial_versions WHERE quote_id=?').get(q).n||0;
 const audit=(q,u,action,detail)=>db.prepare('INSERT INTO commercial_audit(quote_id,actor,action,created_at,detail) VALUES(?,?,?,?,?)').run(q,u.id,action,new Date().toISOString(),JSON.stringify(detail));
 const transact=action=>transaction(db,action);
 function visibleVersion(row,internal){
  const approval=db.prepare(`SELECT a.approved_at, a.choices, a.total_cents, COALESCE(i.name,u.name) name
    FROM commercial_approvals a JOIN app_users u ON a.approved_by=u.id
    LEFT JOIN proposal_decision_identity i ON i.quote_id=a.quote_id AND i.version=a.version AND i.action='approved'
    WHERE a.quote_id=? AND a.version=?`).get(row.quote_id,row.version);
  const review=db.prepare(`SELECT r.requested_at,r.note,COALESCE(i.name,u.name) name
    FROM commercial_reviews r JOIN app_users u ON r.requested_by=u.id
    LEFT JOIN proposal_decision_identity i ON i.quote_id=r.quote_id AND i.version=r.version AND i.action='review'
    WHERE r.quote_id=? AND r.version=?`).get(row.quote_id,row.version);
  const data=JSON.parse(row.payload);
  const calculations=JSON.parse(row.calculations);
  return {
   version:row.version,
   data:internal?data:publicProposal(data,calculations),
   ...(internal?{calculations}:{}),
   publishedAt:row.published_at,
   approval:approval?{approvedAt:approval.approved_at,approvedBy:approval.name,choices:JSON.parse(approval.choices),totalCents:approval.total_cents}:null,
   review:review?{requestedAt:review.requested_at,requestedBy:review.name,note:review.note}:null
  };
 }
 function handle(q,user,method,action,body={}){
  let quote=workflow.getQuote(user,q);
  const change=actionCallback=>transact(()=>{
   quote=workflow.getQuote(user,q);
   if(['approve','review','draft','publish'].includes(action)&&closed(quote.status))fail('A solicitação está encerrada ou cancelada.',409);
   if(action==='publish'&&quote.status==='complement')fail('Aguarde a complementação do briefing.',409);
   if(['approve','review'].includes(action)&&!workflow.mayApprove(user,quote))fail('Ação reservada ao aprovador autorizado.',403);
   return actionCallback();
  });
  if(method==='GET'&&!action){
   const internal=user.role==='consultant';
   const versions=db.prepare('SELECT * FROM commercial_versions WHERE quote_id=? ORDER BY version DESC').all(q)
    .map(row=>visibleVersion(row,internal));
   const draft=internal?db.prepare('SELECT * FROM commercial_drafts WHERE quote_id=?').get(q):null;
   const event=db.prepare('SELECT state,revision FROM event_lifecycle WHERE quote_id=?').get(q)||{state:'planned',revision:0};
   const history=db.prepare('SELECT action,created_at,detail FROM commercial_audit WHERE quote_id=? ORDER BY id').all(q)
    .filter(entry=>internal||['published','approved','review_requested'].includes(entry.action))
    .map(entry=>({...entry,detail:JSON.parse(entry.detail)}));
   const feedback=db.prepare(`SELECT f.id,f.version,f.note,f.created_at,f.resolved_at,u.name
     FROM proposal_feedback f JOIN app_users u ON u.id=f.actor_id WHERE f.quote_id=? ORDER BY f.id`).all(q);
   return {versions,feedback,open:!closed(quote.status),draft:draft?{revision:draft.revision,data:JSON.parse(draft.payload)}:null,event,audit:history,
    canApprove:workflow.mayApprove(user,quote)&&!closed(quote.status)&&summary(q).validUntil>=today(),
    canReview:workflow.mayApprove(user,quote)&&!closed(quote.status)};
  }
  if(method!=='POST')fail('Método inválido.',405);
  if(action==='feedback')return change(()=>{
   if(user.role!=='client')problem('Ação exclusiva do cliente.',403);
   if(closed(quote.status)||!latest(q)||body.version!==latest(q))problem('Atualize a proposta para enviar uma observação.',409);
   const note=text(body.note,2000);
   if(!note)problem('Descreva a alteração desejada.');
   const prior=db.prepare('SELECT id FROM proposal_feedback WHERE quote_id=? AND version=? AND actor_id=? AND note=? AND resolved_at IS NULL')
    .get(q,body.version,user.id,note);
   if(prior)return {id:prior.id};
   const result=db.prepare('INSERT INTO proposal_feedback(quote_id,version,note,actor_id,created_at) VALUES(?,?,?,?,?)')
    .run(q,body.version,note,user.id,new Date().toISOString());
   workflow.activity(q,user,'proposal_feedback','Cliente enviou uma observação sobre a proposta v'+body.version+'.',true);
   return {id:Number(result.lastInsertRowid)};
  });
  if(action==='approve'){
   if(!workflow.mayApprove(user,quote))fail('Aprovação reservada ao aprovador autorizado.',403);
   if(closed(quote.status))fail('A solicitação está encerrada ou cancelada.',409);
   return change(()=>{const version=latest(q);if(!version||body.version!==version)fail('Existe uma versão mais recente. Reabra a proposta.',409);if(db.prepare('SELECT 1 FROM commercial_reviews WHERE quote_id=? AND version=?').get(q,version))fail('Aguarde a nova versão solicitada.',409);if(body.confirm!==true)fail('Confirme explicitamente a versão e as condições.');const v=db.prepare('SELECT * FROM commercial_versions WHERE quote_id=? AND version=?').get(q,version),data=JSON.parse(v.payload);if(data.validUntil<today())fail('A validade expirou. Solicite uma atualização.',409);
    if(!body.choices||typeof body.choices!=='object'||Array.isArray(body.choices)||Object.keys(body.choices).some(k=>!data.groups.some(g=>g.id===k)))fail('Escolhas inválidas.');
    const choices={};for(const g of data.groups){if(typeof body.choices[g.id]!=='string')fail('Escolha uma alternativa em cada grupo.');choices[g.id]=body.choices[g.id];}const prices=JSON.parse(v.calculations);const result=selectionTotal(data.groups,choices,(option,group)=>prices.find(item=>item.group===group.id)?.options.find(item=>item.id===option.id)||{valid:false,error:'Preço publicado indisponível.'});if(!result.complete||result.errors.length)fail('Escolhas incompletas ou inválidas.');
    const previous=db.prepare('SELECT * FROM commercial_approvals WHERE quote_id=? AND version=?').get(q,version);if(previous){if(previous.choices!==JSON.stringify(choices))fail('Esta versão já foi aprovada com outras escolhas.',409);return {version,totalCents:previous.total_cents,approved:true,approvedAt:previous.approved_at,approvedBy:db.prepare('SELECT name FROM app_users WHERE id=?').get(previous.approved_by)?.name};}
    const approvedAt=new Date().toISOString();
    db.prepare('INSERT INTO commercial_approvals VALUES(?,?,?,?,?,?)').run(q,version,user.id,approvedAt,JSON.stringify(choices),result.total);db.prepare('INSERT INTO proposal_decision_identity VALUES(?,?,?,?,?,?)').run(q,version,'approved',user.id,quote.company_id,user.name);
    audit(q,user,'approved',{version,choices,totalCents:result.total});workflow.setStatus(quote,user,'approved');workflow.activity(q,user,'proposal_approved','Proposta v'+version+' aprovada.',true);return {version,totalCents:result.total,approved:true,approvedAt,approvedBy:user.name};});
  }
  if(action==='review'){
   if(!workflow.mayApprove(user,quote))problem('Revisão reservada ao aprovador autorizado.',403);
   if(closed(quote.status))problem('A solicitação está encerrada ou cancelada.',409);
   return change(()=>{
    const version=latest(q);
    if(!version||body.version!==version)problem('Atualize a proposta para decidir sobre a versão vigente.',409);
    if(db.prepare('SELECT 1 FROM commercial_approvals WHERE quote_id=? AND version=?').get(q,version))problem('O aceite desta versão já foi registrado.',409);
    const note=text(body.note,2000);
    if(!note)problem('Descreva a alteração solicitada.');
    const existing=db.prepare('SELECT note,requested_by FROM commercial_reviews WHERE quote_id=? AND version=?').get(q,version);
    if(existing){
     if(existing.note===note&&existing.requested_by===user.id)return {version,review:true};
     problem('Já existe revisão solicitada para esta versão.',409);
    }
    db.prepare('INSERT INTO commercial_reviews VALUES(?,?,?,?,?)').run(q,version,user.id,new Date().toISOString(),note);
    db.prepare('INSERT INTO proposal_decision_identity VALUES(?,?,?,?,?,?)').run(q,version,'review',user.id,quote.company_id,user.name);
    workflow.setStatus(quote,user,'review');
    audit(q,user,'review_requested',{version,note});
    workflow.activity(q,user,'proposal_review','Revisão solicitada para a proposta v'+version+'.',true);
    return {version,review:true};
   });
  }
  if(user.role!=='consultant')fail('Ação exclusiva da equipe.',403);
  if(['draft','publish'].includes(action)&&closed(quote.status))fail('A solicitação está encerrada ou cancelada.',409);
  if(action==='publish'&&quote.status==='complement')fail('Aguarde a complementação do briefing.',409);
  if(action==='resolve')return change(()=>{
   const entry=db.prepare('SELECT id,resolved_at FROM proposal_feedback WHERE id=? AND quote_id=?').get(body.id??null,q);
   if(!entry)problem('Observação não encontrada.',404);
   if(!entry.resolved_at){
    db.prepare('UPDATE proposal_feedback SET resolved_at=?,resolved_by=? WHERE id=?').run(new Date().toISOString(),user.id,entry.id);
    workflow.activity(q,user,'proposal_feedback_resolved','A equipe analisou a observação sobre a proposta.',true);
   }
   return {ok:true};
  });
  if(action==='draft')return change(()=>{const data=normalize(body.data),previous=db.prepare('SELECT revision FROM commercial_drafts WHERE quote_id=?').get(q);if(body.expectedRevision!==(previous?.revision||0))fail('O rascunho mudou. Reabra a proposta.',409);const revision=(previous?.revision||0)+1;db.prepare('INSERT INTO commercial_drafts VALUES(?,?,?,?,?) ON CONFLICT(quote_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,changed_by=excluded.changed_by,updated_at=excluded.updated_at').run(q,revision,JSON.stringify(data),user.id,new Date().toISOString());audit(q,user,'draft_saved',{revision});return {revision};});
  if(action==='publish')return change(()=>{const draft=db.prepare('SELECT * FROM commercial_drafts WHERE quote_id=?').get(q);if(!draft||body.expectedRevision!==draft.revision||body.expectedVersion!==latest(q))fail('O rascunho ou a versão mudou. Reabra a proposta.',409);const data=normalize(JSON.parse(draft.payload));validatePublication(data);for(const group of data.groups)for(const option of group.options){
    if(!option.sourceOfferId)continue;
    const source=db.prepare(`SELECT o.data,r.state,s.service FROM supplier_offers o JOIN supplier_requests r ON r.id=o.request_id
      JOIN suppliers s ON s.id=r.supplier_id WHERE o.id=? AND r.quote_id=? AND o.reviewed_at IS NOT NULL
      AND o.id=(SELECT id FROM supplier_offers WHERE request_id=r.id ORDER BY rowid DESC LIMIT 1)`).get(option.sourceOfferId,q);
    if(!source||source.state!=='validated'||source.service!==group.service||JSON.parse(source.data).validUntil<data.validUntil)
      fail('A resposta vinculada perdeu a validade ou precisa de nova conferência.');
   }const version=latest(q)+1,calculations=data.groups.map(g=>({group:g.id,options:g.options.map(o=>({id:o.id,...calculate(o)}))}));db.prepare('INSERT INTO commercial_versions VALUES(?,?,?,?,?,?)').run(q,version,JSON.stringify(data),JSON.stringify(calculations),user.id,new Date().toISOString());if(quote.status!=='proposal'){db.prepare('UPDATE quotes SET status=? WHERE id=?').run('proposal',q);db.prepare('INSERT INTO quote_status_history(quote_id,previous_status,new_status,changed_by,changed_at) VALUES(?,?,?,?,?)').run(q,quote.status,'proposal',user.id,new Date().toISOString());}audit(q,user,'published',{version,revision:draft.revision});workflow.activity(q,user,'proposal_published','Proposta v'+version+' publicada.',true);return {version};});
  if(action==='event')return change(()=>{const old=db.prepare('SELECT * FROM event_lifecycle WHERE quote_id=?').get(q)||{state:'planned',revision:0};if(body.expectedRevision!==old.revision)fail('O evento foi atualizado. Reabra a solicitação.',409);if(!['planned','in_progress','completed','cancelled'].includes(body.state)||!text(body.reason,1000))fail('Informe uma situação válida e o motivo.');if(['in_progress','completed'].includes(body.state)&&!db.prepare('SELECT 1 FROM commercial_approvals WHERE quote_id=?').get(q))fail('Registre a aprovação da proposta antes de avançar o evento.');const revision=old.revision+1;db.prepare('INSERT INTO event_lifecycle VALUES(?,?,?) ON CONFLICT(quote_id) DO UPDATE SET state=excluded.state,revision=excluded.revision').run(q,body.state,revision);audit(q,user,'event_changed',{from:old.state,to:body.state,reason:body.reason});return {state:body.state,revision};});
  if(action==='correction')return change(()=>{if(!text(body.note,2000))fail('Descreva a correção informativa.');audit(q,user,'information_corrected',{note:text(body.note,2000)});return {ok:true};});
  fail('Ação não encontrada.',404);
 }
 function summary(q){
  const last=db.prepare('SELECT version,payload FROM commercial_versions WHERE quote_id=? ORDER BY version DESC LIMIT 1').get(q);
  const accepted=db.prepare('SELECT version FROM commercial_approvals WHERE quote_id=? ORDER BY version DESC LIMIT 1').get(q);
  return {
   version:last?.version||0,approved:!!last&&accepted?.version===last.version,acceptedVersion:accepted?.version||null,
   validUntil:last?JSON.parse(last.payload).validUntil:null,
   openFeedback:db.prepare('SELECT COUNT(*) n FROM proposal_feedback WHERE quote_id=? AND resolved_at IS NULL').get(q).n,
   event:db.prepare('SELECT state FROM event_lifecycle WHERE quote_id=?').get(q)?.state||'planned'
  };
 }
 return {handle,summary};
}
function publicProposal(data,calculations){
 return {
  event:data.event,people:data.people,validUntil:data.validUntil,
  groups:data.groups.map(group=>({
   id:group.id,name:group.name,service:group.service,optional:group.optional,description:group.description,
   options:group.options.map(option=>{
    const calc=calculations.find(entry=>entry.group===group.id)?.options.find(entry=>entry.id===option.id);
    return {
     id:option.id,name:option.name,supplier:option.supplier,currency:option.currency,
     description:option.description,conditions:option.conditions,
     saleTotalCents:calc?.total??null,
     rows:option.rows.map((row,index)=>({
      name:row.name,quantity:row.quantity,unit:row.unit,state:row.state,category:row.category,
      startDate:row.startDate,endDate:row.endDate,occupancy:row.occupancy,units:calc?.lines[index]?.units??row.units
     }))
    };
   })
  }))
 };
}
module.exports={createCommercial,normalize,validatePublication};
