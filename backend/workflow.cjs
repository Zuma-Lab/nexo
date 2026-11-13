'use strict';

const {randomUUID}=require('node:crypto');
const {validateBriefing}=require('./server.cjs');

function problem(message,status=422){
  throw Object.assign(new Error(message),{status});
}
function clean(value,limit=2000){
  if(value===undefined||value===null)return '';
  if(typeof value!=='string'||value.length>limit)problem('Revise o tamanho e o formato dos campos.');
  return value.trim();
}
function required(value,limit=2000){
  const result=clean(value,limit);
  if(!result)problem('Preencha os campos obrigatórios.');
  return result;
}
function transaction(db,action){
  db.exec('BEGIN IMMEDIATE');
  try{
    const result=action();
    db.exec('COMMIT');
    return result;
  }catch(error){
    db.exec('ROLLBACK');
    throw error;
  }
}
const labels={
  received:'Solicitação recebida',analysis:'Em análise',complement:'Ação necessária',
  quoting:'Em cotação',consolidating:'Preparando proposta',proposal:'Aguardando aprovação',
  review:'Em revisão',approved:'Aprovada',closed:'Encerrada',cancelled:'Cancelada'
};
const transitions={
  received:['analysis','quoting','cancelled'],
  analysis:['quoting','consolidating','cancelled'],
  complement:['cancelled'],
  quoting:['analysis','consolidating','cancelled'],
  consolidating:['quoting','analysis','cancelled'],
  proposal:['closed','cancelled'],
  review:['cancelled'],
  approved:['closed','cancelled'],
  closed:[],cancelled:[]
};
const closed=status=>['closed','cancelled'].includes(status);
const stamp=()=>new Date().toISOString();
const currentDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

// Use calendar dates in São Paulo for both supplier and client proposal deadlines.
function deadlineTasks(status,commercial,suppliers,operation,feedback,today){
  const feedbackTasks=feedback.map(entry=>({
    kind:'feedback',label:'Analisar observação do cliente · v'+entry.version,
    target:'request-proposal-feedback-'+entry.id,priority:3,date:entry.created_at,dateType:'received'
  }));
  if(closed(status))return status==='closed'&&commercial.event==='in_progress'?feedbackTasks:[];
  const tasks=[];
  function add(kind,label,target,priority,date,dateType='deadline'){
    tasks.push({kind,label,target,priority,...(date?{date,dateType}:{})});
  }
  function expires(date,label,target,kind){
    if(!date)return false;
    const days=(Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000;
    if(days<0)add(kind,label+' vencida',target,0,date);
    else if(days===0)add(kind,label+' vence hoje',target,1,date);
    else if(days<=3)add(kind,label+' vence em '+days+(days===1?' dia':' dias'),target,2,date);
    else return false;
    return true;
  }
  const due=operation?.due_date;
  if(due&&due<=today&&status!=='approved'){
    add('return',due<today?'Prazo de retorno vencido':'Retorno previsto para hoje','request-operations',due<today?0:1,due);
  }else if(operation?.pending_note&&status!=='approved'){
    add('operation','Revisar acompanhamento interno','request-operations',4,due);
  }
  if(status==='review'&&commercial.version)add('review','Revisão solicitada · v'+commercial.version,'request-proposal-review-'+commercial.version,1);
  if(status==='proposal')expires(commercial.validUntil,'Proposta v'+commercial.version,'request-proposals','proposal-deadline');
  tasks.push(...feedbackTasks);
  if(status!=='approved'){
    for(const request of suppliers.requests||[]){
      const target='supplier-request-'+request.id;
      const response=request.offer_id?'supplier-offer-'+request.offer_id:target;
      if(['responded','validated'].includes(request.state)&&expires(request.valid_until,'Resposta de '+request.name,response,'supplier-deadline'))continue;
      if(request.state==='responded')add('supplier-response','Conferir resposta de '+request.name,response,3,request.received_at,'received');
      if(request.state==='requested'&&status!=='complement')add('supplier-request','Conferir pedido de '+request.name,target,4,request.requested_at,'received');
      if(request.state==='sent'&&request.follow_up_on&&request.follow_up_on<=today){
        add('supplier-follow-up','Cobrar retorno de '+request.name,'supplier-follow-up-'+request.id,request.follow_up_on<today?0:1,request.follow_up_on);
      }
    }
  }
  if(!tasks.length&&['received','analysis','consolidating'].includes(status)){
    add('briefing',status==='consolidating'?'Consolidar orçamentos e publicar':'Conferir briefing',
      status==='consolidating'?'request-proposals':'request-progress',4);
  }
  return tasks.sort((a,b)=>a.priority-b.priority||(a.date||'9999').localeCompare(b.date||'9999'));
}

function createWorkflow(db,{hashPassword}){
  db.exec(`
    CREATE TABLE IF NOT EXISTS access_profiles(
      user_id INTEGER PRIMARY KEY REFERENCES app_users(id),
      admin INTEGER NOT NULL DEFAULT 0,
      approval TEXT NOT NULL DEFAULT 'none' CHECK(approval IN ('none','company','assigned')),
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS consultant_companies(
      user_id INTEGER NOT NULL REFERENCES app_users(id), company_id INTEGER NOT NULL REFERENCES companies(id),
      PRIMARY KEY(user_id,company_id)
    );
    CREATE TABLE IF NOT EXISTS quote_approvers(
      quote_id TEXT NOT NULL REFERENCES quotes(id), user_id INTEGER NOT NULL REFERENCES app_users(id),
      PRIMARY KEY(quote_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS quote_activity(
      id INTEGER PRIMARY KEY, quote_id TEXT NOT NULL REFERENCES quotes(id), actor_id INTEGER NOT NULL REFERENCES app_users(id),
      kind TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, client_visible INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS quote_initial_payload(
      quote_id TEXT PRIMARY KEY REFERENCES quotes(id), payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS briefing_complements(
      id TEXT PRIMARY KEY, quote_id TEXT NOT NULL REFERENCES quotes(id), prompt TEXT NOT NULL,
      answer TEXT, previous_status TEXT NOT NULL, requested_by INTEGER NOT NULL REFERENCES app_users(id),
      requested_at TEXT NOT NULL, answered_by INTEGER REFERENCES app_users(id), answered_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_open_complement ON briefing_complements(quote_id) WHERE answered_at IS NULL;
    CREATE TABLE IF NOT EXISTS company_preferences(
      company_id INTEGER PRIMARY KEY REFERENCES companies(id), budget TEXT NOT NULL, criteria TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS administration_audit(
      id INTEGER PRIMARY KEY, actor_id INTEGER NOT NULL REFERENCES app_users(id),
      action TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);
  // Grant demo profiles once. Revoked permissions remain revoked after restart.
  transaction(db,()=>{
    for(const [email,admin,approval] of [
      ['maria@alpha.demo',0,'company'],['joao@beta.demo',0,'company'],
      ['consultor@paytrack.demo',0,'none'],['admin@paytrack.demo',1,'none']
    ]){
      const account=db.prepare('SELECT id FROM app_users WHERE email=?').get(email);
      if(!account)continue;
      const result=db.prepare('INSERT OR IGNORE INTO access_profiles(user_id,admin,approval) VALUES(?,?,?)').run(account.id,admin,approval);
      if(result.changes&&email==='consultor@paytrack.demo'){
        for(const company of [1,2])db.prepare('INSERT OR IGNORE INTO consultant_companies VALUES(?,?)').run(account.id,company);
      }
    }
  });

  function profile(userId){
    const row=db.prepare('SELECT * FROM access_profiles WHERE user_id=?').get(userId);
    return {admin:row?.admin===1,approval:row?.approval||'none',active:row?.active!==0};
  }
  function companyAccess(user,companyId){
    if(!user||!companyId||!profile(user.id).active)return false;
    if(user.role==='client')return user.companyId===companyId;
    if(profile(user.id).admin)return true;
    return !!db.prepare('SELECT 1 FROM consultant_companies WHERE user_id=? AND company_id=?').get(user.id,companyId);
  }
  function canAccess(user,quote){
    if(!quote||!companyAccess(user,quote.company_id))return false;
    if(user.role==='client'){
      if(profile(user.id).approval!=='assigned'||quote.requested_by===user.id)return true;
      return !!db.prepare('SELECT 1 FROM quote_approvers WHERE quote_id=? AND user_id=?').get(quote.id,user.id);
    }
    if(profile(user.id).admin)return true;
    const owner=db.prepare('SELECT assigned_to FROM quote_operations WHERE quote_id=?').get(quote.id)?.assigned_to;
    return !owner||owner===user.id;
  }
  function getQuote(user,id){
    if(!user)problem('Faça login para continuar.',401);
    const quote=typeof id==='string'?db.prepare('SELECT * FROM quotes WHERE id=?').get(id):null;
    if(!canAccess(user,quote))problem('Cotação não encontrada.',404);
    return quote;
  }
  function mayApprove(user,quote){
    if(user.role!=='client'||!canAccess(user,quote))return false;
    const {approval}=profile(user.id);
    return approval==='company'||approval==='assigned'&&!!db.prepare('SELECT 1 FROM quote_approvers WHERE quote_id=? AND user_id=?').get(quote.id,user.id);
  }
  function activity(quote,user,kind,message,visible=false){
    db.prepare('INSERT INTO quote_activity(quote_id,actor_id,kind,message,created_at,client_visible) VALUES(?,?,?,?,?,?)')
      .run(quote,user.id,kind,message,stamp(),visible?1:0);
  }
  function setStatus(quote,user,next){
    if(quote.status===next)return;
    const now=stamp();
    db.prepare('UPDATE quotes SET status=? WHERE id=?').run(next,quote.id);
    db.prepare('INSERT INTO quote_status_history(quote_id,previous_status,new_status,changed_by,changed_at) VALUES(?,?,?,?,?)')
      .run(quote.id,quote.status,next,user.id,now);
  }
  function manualStatus(user,id,next,expected){
    return transaction(db,()=>{
      const quote=getQuote(user,id);
      if(expected!==undefined&&expected!==quote.status)problem('A situação mudou. Atualize a cotação.',409);
      if(next===quote.status)return;
      if(!transitions[quote.status]?.includes(next))problem('Essa transição depende de uma ação do fluxo ou está indisponível.',409);
      setStatus(quote,user,next);
    });
  }
  const preference=companyId=>db.prepare('SELECT budget,criteria FROM company_preferences WHERE company_id=?').get(companyId)||{budget:'',criteria:''};
  const complement=id=>db.prepare('SELECT id,prompt,requested_at FROM briefing_complements WHERE quote_id=? AND answered_at IS NULL').get(id)||null;

  function view(user,quote,commercial={},suppliers={}){
    const latestStatus=db.prepare('SELECT changed_at FROM quote_status_history WHERE quote_id=? ORDER BY id DESC LIMIT 1').get(quote.id)?.changed_at;
    const lastActivity=db.prepare('SELECT created_at FROM quote_activity WHERE quote_id=? AND (?=1 OR client_visible=1) ORDER BY id DESC LIMIT 1')
      .get(quote.id,user.role==='consultant'?1:0)?.created_at;
    const openComplement=complement(quote.id);
    const consultant=user.role==='consultant';
    let status=quote.status;
    if(status==='proposal'&&commercial.version===0)status='consolidating';
    if(status==='proposal'&&commercial.approved)status='approved';
    const operation=consultant?db.prepare('SELECT due_date,pending_note FROM quote_operations WHERE quote_id=?').get(quote.id):null;
    const feedback=consultant&&commercial.openFeedback?db.prepare(
      'SELECT id,version,created_at FROM proposal_feedback WHERE quote_id=? AND resolved_at IS NULL ORDER BY created_at,id'
    ).all(quote.id):[];
    const today=currentDay();
    const tasks=consultant?deadlineTasks(status,commercial,suppliers,operation,feedback,today):[];
    const awaitingDecision=status==='proposal'&&commercial.version>0&&commercial.validUntil>=today;
    const actionable=consultant?tasks.length>0
      : !closed(status)&&(!!openComplement||awaitingDecision&&mayApprove(user,quote));
    let nextAction=consultant?'Acompanhar a cotação.':'Acompanhe a cotação pelo portal.';
    if(status==='received'||status==='analysis')nextAction=consultant?'Conferir briefing.':'A equipe vai conferir o briefing.';
    if(status==='quoting')nextAction=consultant?'Conferir pedidos e respostas dos fornecedores.':'A equipe está cotando os serviços.';
    if(status==='consolidating')nextAction=consultant?'Consolidar orçamentos e publicar.':'A equipe está preparando a proposta.';
    if(status==='review')nextAction=consultant?'Analisar a revisão solicitada e preparar nova versão.':'A equipe está revisando a proposta.';
    if(openComplement&&!closed(status))nextAction=consultant?'Aguardar complementação do cliente.':'Responder à complementação do briefing.';
    if(status==='proposal')nextAction=commercial.validUntil<currentDay()
      ? (consultant?'Atualizar proposta vencida.':'A proposta venceu. Aguarde uma atualização da equipe.')
      : (consultant?'Aguardar a decisão do cliente.':mayApprove(user,quote)?'Revisar e decidir sobre a proposta.':'Aguardar a decisão do aprovador da empresa.');
    if(consultant&&!closed(status)&&status!=='complement'){
      if(suppliers.responded)nextAction='Conferir respostas dos fornecedores.';
      else if(suppliers.requested)nextAction='Conferir pedidos de orçamento.';
      else if(suppliers.waiting)nextAction='Acompanhar fornecedores sem resposta.';
    }
    if(status==='approved'&&!actionable)nextAction='Consulte a versão aprovada.';
    if(closed(status))nextAction='Consulte o histórico e as versões registradas.';
    if(consultant&&commercial.openFeedback&&(!closed(status)||status==='closed'&&commercial.event==='in_progress'))nextAction='Analisar observações do cliente sobre a proposta.';
    if(tasks.length)nextAction=tasks[0].label+'.';
    return {
      status,label:labels[status]||labels.received,nextAction,actionable,awaitingDecision,
      lastUpdated:[quote.created,latestStatus,lastActivity].filter(Boolean).sort().at(-1),
      complement:closed(status)?null:openComplement,
      ...(consultant?{transitions:transitions[quote.status]||[],tasks}:{}),
      preferences:preference(quote.company_id)
    };
  }

  function updateBriefing(quote,user,fields){
    const original=JSON.parse(quote.payload);
    const patch={};
    for(const key of ['destination','departureDate','returnDate','totalPassengers','roomsSingle','roomsDoubleTwin','roomsDoubleCasal','roomsTriple']){
      if(Object.hasOwn(fields||{},key))patch[key]=clean(fields[key],200);
    }
    if(patch.departureDate&&patch.returnDate)patch.datesUnknown=false;
    if(patch.totalPassengers)patch.participantsUnknown=false;
    if(Object.keys(patch).length){
      const validated=validateBriefing({...original,...patch});
      if(Object.keys(validated.errors).length)problem(Object.values(validated.errors)[0]);
      db.prepare('INSERT OR IGNORE INTO quote_initial_payload VALUES(?,?)').run(quote.id,quote.payload);
      db.prepare('UPDATE quotes SET payload=? WHERE id=?').run(JSON.stringify(validated.payload),quote.id);
      activity(quote.id,user,'briefing_fields_updated',JSON.stringify({before:original,after:validated.payload}));
    }
  }

  function quoteAction(user,id,action,body){
    return transaction(db,()=>{
      const quote=getQuote(user,id);
      if(closed(quote.status))problem('A solicitação está encerrada ou cancelada.',409);
      if(action==='answer'){
        if(user.role!=='client')problem('Ação reservada ao cliente.',403);
        const open=complement(id);
        if(!open||body.complementId!==open.id||quote.status!=='complement')problem('A complementação mudou. Atualize a cotação.',409);
        const answer=required(body.answer);
        updateBriefing(quote,user,body.fields);
        db.prepare('UPDATE briefing_complements SET answer=?,answered_by=?,answered_at=? WHERE id=?').run(answer,user.id,stamp(),open.id);
        setStatus(quote,user,'analysis');
        activity(id,user,'briefing_answered',answer,true);
        return {ok:true};
      }
      if(user.role!=='consultant')problem('Ação exclusiva da equipe.',403);
      if(action==='amend'){
        if(!['received','analysis','quoting','consolidating'].includes(quote.status))problem('Use uma nova versão para alterações comerciais.',409);
        const reason=required(body.reason);
        if(typeof body.expectedLastUpdated!=='string'||body.expectedLastUpdated!==view(user,quote).lastUpdated)
          problem('O briefing mudou. Atualize a cotação.',409);
        if(!Object.keys(body.fields||{}).length)problem('Informe o que deve ser atualizado.');
        updateBriefing(quote,user,body.fields);
        activity(id,user,'briefing_amended','Briefing complementado pela equipe: '+reason,true);
        return {ok:true};
      }
      if(action==='complement'){
        if(!['received','analysis','quoting','consolidating'].includes(quote.status)||complement(id))problem('A complementação não está disponível nesta situação.',409);
        const prompt=required(body.prompt);
        db.prepare('INSERT INTO briefing_complements(id,quote_id,prompt,previous_status,requested_by,requested_at) VALUES(?,?,?,?,?,?)')
          .run(randomUUID(),id,prompt,quote.status,user.id,stamp());
        setStatus(quote,user,'complement');
        activity(id,user,'briefing_requested',prompt,true);
        return {ok:true};
      }
      problem('Ação não encontrada.',404);
    });
  }

  function admin(user,action,body={}){
    if(!user)problem('Faça login para continuar.',401);
    if(!profile(user.id).admin)problem('Ação exclusiva da administração.',403);
    if(!action)return {
      companies:db.prepare('SELECT c.*,p.budget,p.criteria FROM companies c LEFT JOIN company_preferences p ON p.company_id=c.id ORDER BY c.name').all(),
      users:db.prepare('SELECT id,name,email,role,company_id FROM app_users ORDER BY name').all().map(account=>({
        ...account,...profile(account.id),
        companies:db.prepare('SELECT company_id FROM consultant_companies WHERE user_id=?').all(account.id).map(x=>x.company_id)
      })),
      quotes:db.prepare('SELECT id,protocol,company_id FROM quotes WHERE company_id IS NOT NULL ORDER BY created DESC').all(),
      grants:db.prepare('SELECT quote_id,user_id FROM quote_approvers').all(),
      audit:db.prepare('SELECT a.action,a.details,a.created_at,u.name FROM administration_audit a JOIN app_users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 100').all()
    };
    return transaction(db,()=>{
      let details;
      if(action==='company'){
        const name=required(body.name,180);
        const cnpj=clean(body.cnpj,30);
        if(db.prepare('SELECT 1 FROM companies WHERE name=? AND id<>?').get(name,body.id||0))problem('Já existe empresa com esse nome.',409);
        if(body.id){
          if(!db.prepare('UPDATE companies SET name=?,cnpj=? WHERE id=?').run(name,cnpj,body.id).changes)problem('Empresa não encontrada.',404);
          details={companyId:body.id};
        }else{
          details={companyId:Number(db.prepare('INSERT INTO companies(name,cnpj) VALUES(?,?)').run(name,cnpj).lastInsertRowid)};
        }
        db.prepare('INSERT INTO company_preferences VALUES(?,?,?) ON CONFLICT(company_id) DO UPDATE SET budget=excluded.budget,criteria=excluded.criteria')
          .run(details.companyId,clean(body.budget,150),clean(body.criteria));
      }else if(action==='user'){
        if(!['client','consultant'].includes(body.role))problem('Perfil inválido.');
        const name=required(body.name,180),email=required(body.email,254).toLowerCase();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))problem('Informe um e-mail válido.');
        const company=body.role==='client'?body.companyId:null;
        if(body.role==='client'&&!db.prepare('SELECT 1 FROM companies WHERE id=?').get(company??null))problem('Escolha a empresa do cliente.');
        if(db.prepare('SELECT 1 FROM app_users WHERE email=? AND id<>?').get(email,body.id||0))problem('Já existe uma conta com esse e-mail.',409);
        const approval=body.role==='client'?body.approval:'none';
        if(!['none','company','assigned'].includes(approval))problem('Permissão de aprovação inválida.');
        const active=body.active!==false;
        const password=body.password||'';
        if(typeof password!=='string'||(!body.id||password)&&(password.length<12||password.length>128))problem('Use senha entre 12 e 128 caracteres.');
        let id=body.id;
        if(id){
          const prior=db.prepare('SELECT id,company_id,role FROM app_users WHERE id=?').get(id);
          if(!prior)problem('Usuário não encontrado.',404);
          if(prior.role!==body.role||prior.company_id!==company)problem('Crie outra conta para mudar o perfil ou a empresa de um usuário existente.');
          if(id===user.id&&!active)problem('A própria conta administrativa deve permanecer ativa.');
          db.prepare('UPDATE app_users SET name=?,email=? WHERE id=?').run(name,email,id);
          if(password)db.prepare('UPDATE app_users SET password_hash=? WHERE id=?').run(hashPassword(password),id);
          if(password||!active)db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
        }else{
          id=Number(db.prepare('INSERT INTO app_users(company_id,name,email,password_hash,role) VALUES(?,?,?,?,?)')
            .run(company,name,email,hashPassword(password),body.role).lastInsertRowid);
        }
        db.prepare('INSERT INTO access_profiles(user_id,approval,active) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET approval=excluded.approval,active=excluded.active')
          .run(id,approval,active?1:0);
        if(body.role==='consultant'){
          const companies=body.companies||[];
          if(!Array.isArray(companies)||companies.some(c=>!Number.isInteger(c)||!db.prepare('SELECT 1 FROM companies WHERE id=?').get(c)))problem('Carteira inválida.');
          db.prepare('DELETE FROM consultant_companies WHERE user_id=?').run(id);
          for(const c of new Set(companies))db.prepare('INSERT INTO consultant_companies VALUES(?,?)').run(id,c);
        }
        details={userId:id,active,approval};
      }else if(action==='grant'){
        const quote=getQuote(user,body.quoteId);
        const account=db.prepare('SELECT role,company_id FROM app_users WHERE id=?').get(body.userId??null);
        if(account?.role!=='client'||account.company_id!==quote.company_id)problem('Escolha um cliente da empresa desta cotação.');
        if(body.granted===true)db.prepare('INSERT OR IGNORE INTO quote_approvers VALUES(?,?)').run(quote.id,body.userId);
        else db.prepare('DELETE FROM quote_approvers WHERE quote_id=? AND user_id=?').run(quote.id,body.userId);
        details={quoteId:quote.id,userId:body.userId,granted:body.granted===true};
      }else if(action==='assign'){
        const quote=getQuote(user,body.quoteId);
        const account=db.prepare('SELECT id,role FROM app_users WHERE id=?').get(body.userId??null);
        if(body.userId!==null&&(!account||account.role!=='consultant'||!companyAccess(account,quote.company_id)))problem('Escolha um consultor ativo da carteira.');
        const old=db.prepare('SELECT assigned_to FROM quote_operations WHERE quote_id=?').get(quote.id)?.assigned_to||null;
        db.prepare('INSERT INTO quote_operations(quote_id,assigned_to,revision) VALUES(?,?,1) ON CONFLICT(quote_id) DO UPDATE SET assigned_to=excluded.assigned_to,revision=quote_operations.revision+1')
          .run(quote.id,body.userId);
        details={quoteId:quote.id,before:old,assignedTo:body.userId};
      }else problem('Ação não encontrada.',404);
      db.prepare('INSERT INTO administration_audit(actor_id,action,details,created_at) VALUES(?,?,?,?)').run(user.id,action,JSON.stringify(details),stamp());
      return details;
    });
  }

  function history(user,quote){
    return db.prepare('SELECT a.kind,a.message,a.created_at,u.name actor FROM quote_activity a JOIN app_users u ON u.id=a.actor_id WHERE a.quote_id=? AND (?=1 OR a.client_visible=1) ORDER BY a.id')
      .all(quote.id,user.role==='consultant'?1:0).map(entry=>user.role==='client'?{...entry,actor:undefined}:entry);
  }
  return {profile,companyAccess,canAccess,getQuote,mayApprove,manualStatus,setStatus,view,quoteAction,admin,history,activity,preference};
}
module.exports={createWorkflow,problem,clean,required,transaction,labels,closed,currentDay};
