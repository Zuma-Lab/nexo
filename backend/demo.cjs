'use strict';
// AMBIENTE DE DEMONSTRACAO, SOMENTE LOCAL: NAO PUBLICAR COMO AUTENTICACAO DE PRODUCAO.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { validateBriefing } = require('./server.cjs');
const CONFIG = require('../system-config.js');
const { sections } = require('../briefing-view.js');
const FRONTEND = path.resolve(__dirname, '..');

const USERS = [
  { email: 'maria@alpha.demo', name: 'Maria Silva', role: 'client', companyId: 1 },
  { email: 'joao@beta.demo', name: 'João Costa', role: 'client', companyId: 2 },
  { email: 'consultor@paytrack.demo', name: 'Consultor Paytrack', role: 'consultant', companyId: null },
  { email: 'solicitante@alpha.demo', name: 'Solicitante Alpha', role: 'client', companyId: 1 },
  { email: 'admin@paytrack.demo', name: 'Administração demo', role: 'consultant', companyId: null }
];
const DEMO_PASSWORD = 'Demo@2026!';
const {createWorkflow,labels:STATUSES}=require('./workflow.cjs');
const SESSION_TTL = 8 * 60 * 60 * 1000;
const hashToken = value => crypto.createHash('sha256').update(value).digest('hex');
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(password, salt, 64).toString('hex');
}
function verifyPassword(password, stored) {
  const [salt, value] = String(stored || '').split(':');
  if (!salt || !value || !/^[a-f0-9]{128}$/.test(value)) return false;
  return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 64), Buffer.from(value, 'hex'));
}
function createApp({ database = path.join(FRONTEND, 'data', 'quotes.sqlite') } = {}) {
  if (database !== ':memory:') fs.mkdirSync(path.dirname(database), { recursive: true });
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, request_key TEXT NOT NULL,
      protocol TEXT UNIQUE NOT NULL, created TEXT NOT NULL,
      payload TEXT NOT NULL, summary TEXT NOT NULL,
      delivery TEXT NOT NULL DEFAULT 'pending',
      UNIQUE(owner,request_key)
    );
    CREATE TABLE IF NOT EXISTS sequences (year INTEGER PRIMARY KEY, value INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE IF NOT EXISTS app_users (
      id INTEGER PRIMARY KEY, company_id INTEGER, name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('client','consultant')),
      FOREIGN KEY(company_id) REFERENCES companies(id)
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES app_users(id)
    );
    CREATE TABLE IF NOT EXISTS quote_status_history (
      id INTEGER PRIMARY KEY, quote_id TEXT NOT NULL,
      previous_status TEXT, new_status TEXT NOT NULL,
      changed_by INTEGER NOT NULL, changed_at TEXT NOT NULL,
      FOREIGN KEY(quote_id) REFERENCES quotes(id),
      FOREIGN KEY(changed_by) REFERENCES app_users(id)
    );`);
  db.exec(`CREATE TABLE IF NOT EXISTS quote_operations (
    quote_id TEXT PRIMARY KEY REFERENCES quotes(id),
    assigned_to INTEGER REFERENCES app_users(id), due_date TEXT, pending_note TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS quote_operation_history (
    id INTEGER PRIMARY KEY, quote_id TEXT NOT NULL REFERENCES quotes(id), changed_by INTEGER NOT NULL REFERENCES app_users(id),
    changed_at TEXT NOT NULL, previous_value TEXT NOT NULL, new_value TEXT NOT NULL
  );`);
  db.exec(`CREATE TABLE IF NOT EXISTS briefing_drafts (
    user_id INTEGER NOT NULL REFERENCES app_users(id),company_id INTEGER NOT NULL REFERENCES companies(id),
    payload TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(user_id,company_id)
  );`);
  const operation = id => {
    const row=db.prepare('SELECT o.*,u.name AS assigned_name FROM quote_operations o LEFT JOIN app_users u ON u.id=o.assigned_to WHERE quote_id=?').get(id);
    return {assignedTo:row?.assigned_to||null,assignedName:row?.assigned_name||null,dueDate:row?.due_date||null,pendingNote:row?.pending_note||'',revision:row?.revision||0};
  };
  // Preserva os registros existentes sem conceder acesso automaticamente a outra empresa.
  const companyColumns = db.prepare('PRAGMA table_info(companies)').all().map(x => x.name);
  if (!companyColumns.includes('cnpj')) db.exec("ALTER TABLE companies ADD COLUMN cnpj TEXT NOT NULL DEFAULT ''");
  const quoteColumns = db.prepare('PRAGMA table_info(quotes)').all().map(x => x.name);
  if (!quoteColumns.includes('company_id')) db.exec('ALTER TABLE quotes ADD COLUMN company_id INTEGER REFERENCES companies(id)');
  if (!quoteColumns.includes('requested_by')) db.exec('ALTER TABLE quotes ADD COLUMN requested_by INTEGER REFERENCES app_users(id)');
  if (!quoteColumns.includes('status')) db.exec("ALTER TABLE quotes ADD COLUMN status TEXT NOT NULL DEFAULT 'received'");
  db.prepare('INSERT OR IGNORE INTO companies(id,name) VALUES(?,?)').run(1, 'Empresa Alpha Demo');
  db.prepare('INSERT OR IGNORE INTO companies(id,name) VALUES(?,?)').run(2, 'Empresa Beta Demo');
  const insertUser = db.prepare('INSERT OR IGNORE INTO app_users(company_id,name,email,password_hash,role) VALUES(?,?,?,?,?)');
  for (const u of USERS) insertUser.run(u.companyId, u.name, u.email, hashPassword(DEMO_PASSWORD), u.role);

  const workflow=createWorkflow(db,{hashPassword});
  // Keep the sequence above existing numeric protocols without reassigning legacy ownership.
  db.exec(`INSERT INTO sequences(year,value) SELECT 0,COALESCE(MAX(CAST(protocol AS INTEGER)),0) FROM quotes
    WHERE protocol NOT GLOB '*[^0-9]*' ON CONFLICT(year) DO UPDATE SET value=MAX(value,excluded.value)`);
  const getSession = req => {
    const token = /(?:^|;\s*)pt_demo_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (!token) return null;
    const user=db.prepare(`SELECT u.id,u.name,u.email,u.role,u.company_id AS companyId,
      c.name AS companyName,c.cnpj AS companyCnpj FROM sessions s JOIN app_users u ON s.user_id=u.id
      LEFT JOIN companies c ON c.id=u.company_id WHERE s.token_hash=? AND s.expires_at>?`)
      .get(hashToken(token), Date.now()) || null;
    return user&&workflow.profile(user.id).active?user:null;
  };
  const publicUser = user => ({ id:user.id, name:user.name, email:user.email, role:user.role, companyId:user.companyId, companyName:user.companyName, companyCnpj:user.companyCnpj || '', admin:workflow.profile(user.id).admin, approval:workflow.profile(user.id).approval, preferences:user.companyId?workflow.preference(user.companyId):null });
  const record = (row,user) => ({ id:row.id, protocol:row.protocol, created:row.created,
    delivery:row.delivery, recipient:'Ambiente de demonstração — nenhum e-mail real',
    status:row.status || 'received', statusLabel:STATUSES[row.status] || 'Recebida',
    companyId:row.company_id, companyName:row.company_name || null,
    form:JSON.parse(row.payload), summary:row.summary, commercial:commercial.summary(row.id), ...(user?{progress:workflow.view(user,row,commercial.summary(row.id),user.role==='consultant'?sourcing.summary(row.id):{})}:{}) });
  const commercial=require('./commercial.cjs').createCommercial(db,workflow);
  const sourcing=require('./sourcing.cjs').createSourcing(db,workflow);
  const errors = new Map();
  const server = http.createServer(async (req,res) => {
    const respond = (code, body) => {res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
    try {
      const host = req.headers.host || '';
      if (host !== '127.0.0.1:' + server.address()?.port) return respond(403,{error:'Host não permitido. Execute localmente.'});
      if (req.headers.origin && req.headers.origin !== 'http://' + host) return respond(403,{error:'Origem não permitida.'});
      if (req.headers['sec-fetch-site'] === 'cross-site') return respond(403,{error:'Origem não permitida.'});
      const url = new URL(req.url,'http://'+host);
      const pathname = url.pathname;
      const user = getSession(req);
      const cookie = (token, age) => 'pt_demo_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+age;
      if (pathname.startsWith('/api/')) {
        if (req.method === 'GET' && pathname === '/api/health') return respond(200,{status:'ok',mode:'local',registration:true,demo:true,notificationStatus:'disabled_demo'});
        if (req.method === 'GET' && pathname === '/api/session') return respond(200,{user:user?publicUser(user):null, demo:true});
        const commercialMatch=/^\/api\/quotes\/([a-f0-9-]{36})\/commercial(?:\/(draft|publish|approve|review|feedback|resolve|event|correction))?$/.exec(pathname);
        if(req.method==='GET'&&commercialMatch){try{return respond(200,commercial.handle(commercialMatch[1],user,req.method,commercialMatch[2]));}catch(e){if(e.status)return respond(e.status,{error:e.message});throw e;}}
        const adminMatch=/^\/api\/administration(?:\/(company|user|grant|assign))?$/.exec(pathname);
        const workflowMatch=/^\/api\/quotes\/([a-f0-9-]{36})\/workflow\/(complement|answer|amend)$/.exec(pathname);
        const sourcingMatch=/^\/api\/quotes\/([a-f0-9-]{36})\/sourcing(?:\/(request|send|offer|validate|cancel|follow-up))?$/.exec(pathname);
        const catalogMatch=/^\/api\/supplier-catalog\/(\d+)$/.exec(pathname);
        if(req.method==='GET'&&sourcingMatch&&!sourcingMatch[2])return respond(200,sourcing.handle(user,sourcingMatch[1]));
        if(req.method==='GET'&&catalogMatch)return respond(200,sourcing.catalog(user,catalogMatch[1]));
        if(req.method==='GET'&&adminMatch&&!adminMatch[1])return respond(200,workflow.admin(user));
        if(req.method==='GET'&&pathname==='/api/draft'){
          if(!user)return respond(401,{error:'Faça login para continuar.'});
          if(user.role!=='client')return respond(403,{error:'Ação exclusiva do cliente.'});
          const row=db.prepare('SELECT payload,revision,updated_at FROM briefing_drafts WHERE user_id=? AND company_id=?').get(user.id,user.companyId);
          return respond(200,{draft:row?{form:JSON.parse(row.payload),revision:row.revision,updatedAt:row.updated_at}:null});
        }
        if (req.method === 'GET' && pathname === '/api/quotes') {
          if (!user) return respond(401,{error:'Faça login para continuar.'});
          const where = user.role === 'consultant' ? 'WHERE q.company_id IS NOT NULL' : 'WHERE q.company_id=?';
          const sql = `SELECT q.*,c.name AS company_name FROM quotes q LEFT JOIN companies c ON c.id=q.company_id ${where} ORDER BY q.created DESC`;
          return respond(200,(user.role === 'consultant' ? db.prepare(sql).all() : db.prepare(sql).all(user.companyId)).filter(row=>workflow.canAccess(user,row)).map(row=>({...record(row,user),...(user.role==='consultant'?{operation:operation(row.id)}:{})})));
        }
        const quoteId = /^\/api\/quotes\/([a-f0-9-]{36})$/.exec(pathname)?.[1];
        if (req.method === 'GET' && quoteId) {
          if (!user) return respond(401,{error:'Faça login para continuar.'});
          const row = db.prepare('SELECT q.*,c.name company_name FROM quotes q LEFT JOIN companies c ON c.id=q.company_id WHERE q.id=?').get(quoteId);
          if (!workflow.canAccess(user,row)) return respond(404,{error:'Cotação não encontrada.'});
          return respond(200,{...record(row,user),activity:workflow.history(user,row),sections:sections(JSON.parse(row.payload)),...(user.role==='consultant'?{operation:operation(row.id),operationHistory:db.prepare('SELECT changed_at,previous_value,new_value FROM quote_operation_history WHERE quote_id=? ORDER BY id').all(row.id).map(h=>({changedAt:h.changed_at,previous:JSON.parse(h.previous_value),next:JSON.parse(h.new_value)}))}:{}),history:db.prepare('SELECT previous_status,new_status,changed_at FROM quote_status_history WHERE quote_id=? ORDER BY id').all(row.id)});
        }
        if (!['POST','PATCH'].includes(req.method) || !String(req.headers['content-type']||'').startsWith('application/json')) return respond(405,{error:'Requisição inválida.'});
        const chunks=[]; let bytes=0;
        for await(const part of req) { bytes+=part.length; if(bytes>256000) return respond(413,{error:'Limite de 256 KB excedido.'}); chunks.push(part); }
        let body; try { body=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {return respond(400,{error:'JSON inválido.'});}
        if (!body || typeof body!=='object' || Array.isArray(body)) return respond(400,{error:'Conteúdo inválido.'});
        if (req.method==='POST' && pathname==='/api/login') {
          const email=String(body.email||'').toLowerCase().trim();
          const failed=errors.get(email)||{count:0,until:0};
          if (Date.now()>failed.until) {failed.count=0;failed.until=Date.now()+60000;}
          if (failed.count>=10) return respond(429,{error:'Muitas tentativas. Tente novamente mais tarde.'});
          const match=db.prepare('SELECT * FROM app_users WHERE email=?').get(email);
          if (!match || !workflow.profile(match.id).active || typeof body.password!=='string' || !verifyPassword(body.password,match.password_hash)) {
            failed.count++; errors.set(email,failed);
            return respond(401,{error:'E-mail ou senha inválidos.'});
          }
          errors.delete(email);
          const token=crypto.randomBytes(32).toString('hex');
          db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(hashToken(token),match.id,Date.now()+SESSION_TTL);
          res.setHeader('Set-Cookie',cookie(token,SESSION_TTL/1000));
          return respond(200,{user:publicUser(getSession({headers:{cookie:'pt_demo_session='+token}})),demo:true});
        }
        if (req.method==='POST' && pathname==='/api/logout') {
          const token=/(?:^|;\s*)pt_demo_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
          if(token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
          res.setHeader('Set-Cookie',cookie('',0));
          return respond(200,{ok:true});
        }
        if (!user) return respond(401,{error:'Faça login para continuar.'});
        if(commercialMatch){try{return respond(200,commercial.handle(commercialMatch[1],user,req.method,commercialMatch[2],body));}catch(e){if(e.status)return respond(e.status,{error:e.message});throw e;}}
        if(req.method==='POST'&&sourcingMatch?.[2])return respond(200,sourcing.handle(user,sourcingMatch[1],sourcingMatch[2],body));
        if(req.method==='POST'&&catalogMatch)return respond(200,sourcing.catalog(user,catalogMatch[1],body));
        if(req.method==='POST'&&adminMatch?.[1])return respond(200,workflow.admin(user,adminMatch[1],body));
        if(req.method==='POST'&&workflowMatch)return respond(200,workflow.quoteAction(user,workflowMatch[1],workflowMatch[2],body));
        if(req.method==='POST'&&pathname==='/api/draft'){
          if(user.role!=='client')return respond(403,{error:'Ação exclusiva do cliente.'});
          if(body.expectedUserId!==user.id)return respond(409,{error:'A conta ativa mudou. Entre novamente antes de salvar o rascunho.'});
          if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||!body.form||typeof body.form!=='object'||Array.isArray(body.form))return respond(400,{error:'Rascunho inválido.'});
          for(const value of Object.values(body.form)){
            if(value!==null&&typeof value==='object'&&!Array.isArray(value)||typeof value==='string'&&value.length>10000||Array.isArray(value)&&(value.length>50||value.some(x=>typeof x!=='string'||x.length>500)))return respond(422,{error:'Revise o conteúdo do rascunho.'});
          }
          const form=require('../briefing-rules.js').prepareSubmission({...body.form,companyName:user.companyName,cnpj:user.companyCnpj||''});
          db.exec('BEGIN IMMEDIATE');
          try{
            const previous=db.prepare('SELECT revision FROM briefing_drafts WHERE user_id=? AND company_id=?').get(user.id,user.companyId);
            if((previous?.revision||0)!==body.expectedRevision){db.exec('ROLLBACK');return respond(409,{error:'O rascunho foi alterado em outra sessão. Retome a versão salva antes de substituir.'});}
            const revision=(previous?.revision||0)+1,updatedAt=new Date().toISOString();
            db.prepare('INSERT INTO briefing_drafts(user_id,company_id,payload,revision,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,company_id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision,updated_at=excluded.updated_at').run(user.id,user.companyId,JSON.stringify(form),revision,updatedAt);
            db.exec('COMMIT');return respond(200,{revision,updatedAt});
          }catch(error){db.exec('ROLLBACK');throw error;}
        }
        if (req.method==='POST' && pathname==='/api/quotes') {
          if(user.role!=='client') return respond(403,{error:'Somente clientes podem registrar solicitações.'});
          let {key,form,summary}=body;
          if (!/^[a-f0-9-]{36}$/.test(key||'') || !form || typeof form!=='object' || typeof summary!=='string' || !summary.trim()) return respond(400,{error:'Briefing inválido.'});
          if(![form.eventName,form.companyName,form.requesterName].every(x=>typeof x==='string'&&x.trim()) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email||'')) return respond(400,{error:'Complete nome do evento, empresa, solicitante e e-mail.'});
          if(form.companyName.trim()!==user.companyName) return respond(403,{error:'A empresa informada não corresponde à sua conta.'});
          form = {...form, cnpj:user.companyCnpj || ''};
          const validation = validateBriefing(form);
          if (Object.keys(validation.errors).length) return respond(422,{error:'Revise os campos do briefing.',errors:validation.errors});
          form = validation.payload;
          const owner='company:'+user.companyId;
          let row=db.prepare('SELECT * FROM quotes WHERE owner=? AND request_key=?').get(owner,key);
          const original=row?db.prepare('SELECT payload FROM quote_initial_payload WHERE quote_id=?').get(row.id)?.payload||row.payload:null;
          if(row&&!workflow.canAccess(user,row))return respond(404,{error:'Cotação não encontrada.'});
          if(row && (original!==JSON.stringify(form)||row.summary!==summary)) return respond(409,{error:'Envio já registrado com dados diferentes.'});
          if(!row) {
            db.exec('BEGIN IMMEDIATE');
            try {
              db.prepare('INSERT INTO sequences(year,value) VALUES(0,1) ON CONFLICT(year) DO UPDATE SET value=value+1').run();
              const number=db.prepare('SELECT value FROM sequences WHERE year=0').get().value;
              const id=crypto.randomUUID(), created=new Date().toISOString();
              db.prepare(`INSERT INTO quotes(id,owner,request_key,protocol,created,payload,summary,delivery,company_id,requested_by,status)
                VALUES(?,?,?,?,?,?,?,'demo',?,?,'received')`).run(id,owner,key,String(number),created,JSON.stringify(form),summary,user.companyId,user.id);
              db.prepare('INSERT INTO quote_status_history(quote_id,previous_status,new_status,changed_by,changed_at) VALUES(?,?,?,?,?)').run(id,null,'received',user.id,created);
              db.exec('COMMIT'); row=db.prepare('SELECT * FROM quotes WHERE id=?').get(id);
            } catch(error) {db.exec('ROLLBACK');throw error;}
          }
          return respond(200,record({...row,company_name:user.companyName}));
        }
        if(req.method==='POST' && pathname==='/api/retry') {
          if(user.role!=='client') return respond(403,{error:'Ação indisponível.'});
          const row=db.prepare('SELECT * FROM quotes WHERE id=? AND company_id=?').get(body.id,user.companyId);
          if(!row) return respond(404,{error:'Cotação não encontrada.'});
          return respond(200,record({...row,company_name:user.companyName}));
        }
        const operationMatch=/^\/api\/quotes\/([a-f0-9-]{36})\/operation$/.exec(pathname);
        if(req.method==='PATCH'&&operationMatch){
          if(user.role!=='consultant')return respond(403,{error:'Ação exclusiva da equipe.'});
          const id=operationMatch[1];
          workflow.getQuote(user,id);
          if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0||Object.keys(body).some(k=>!['expectedRevision','claim','dueDate','pendingNote'].includes(k)))return respond(400,{error:'Atualização inválida.'});
          if(body.claim!==undefined&&body.claim!==true)return respond(400,{error:'Responsável inválido.'});
          if(body.dueDate!==undefined&&body.dueDate!==null&&!(typeof body.dueDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)&&Number.isFinite(Date.parse(body.dueDate+'T00:00:00Z'))&&new Date(body.dueDate+'T00:00:00Z').toISOString().slice(0,10)===body.dueDate))return respond(422,{error:'Informe um prazo válido.'});
          if(body.pendingNote!==undefined&&(typeof body.pendingNote!=='string'||body.pendingNote.length>2000))return respond(422,{error:'A pendência deve ter até 2.000 caracteres.'});
          db.exec('BEGIN IMMEDIATE');
          try{
            const before=operation(id);
            if(before.revision!==body.expectedRevision||(body.claim&&before.assignedTo&&before.assignedTo!==user.id)){
              db.exec('ROLLBACK');return respond(409,{error:'A cotação foi atualizada. Reabra a solicitação antes de salvar.'});
            }
            const after={...before,assignedTo:body.claim?user.id:before.assignedTo,assignedName:body.claim?user.name:before.assignedName,dueDate:body.dueDate===undefined?before.dueDate:body.dueDate,pendingNote:body.pendingNote===undefined?before.pendingNote:body.pendingNote.trim()};
            if(JSON.stringify(before)!==JSON.stringify(after)){
              after.revision++;
              db.prepare('INSERT INTO quote_operations(quote_id,assigned_to,due_date,pending_note,revision) VALUES(?,?,?,?,?) ON CONFLICT(quote_id) DO UPDATE SET assigned_to=excluded.assigned_to,due_date=excluded.due_date,pending_note=excluded.pending_note,revision=excluded.revision').run(id,after.assignedTo,after.dueDate,after.pendingNote,after.revision);
              db.prepare('INSERT INTO quote_operation_history(quote_id,changed_by,changed_at,previous_value,new_value) VALUES(?,?,?,?,?)').run(id,user.id,new Date().toISOString(),JSON.stringify(before),JSON.stringify(after));
            }
            db.exec('COMMIT');return respond(200,{operation:after});
          }catch(error){db.exec('ROLLBACK');throw error;}
        }
        const statusMatch=/^\/api\/quotes\/([a-f0-9-]{36})\/status$/.exec(pathname);
        if(req.method==='PATCH'&&statusMatch) {
          if(user.role!=='consultant') return respond(403,{error:'Somente consultores podem mudar status.'});
          if(!Object.hasOwn(STATUSES,body.status)) return respond(400,{error:'Status inválido.'});
          const old=db.prepare('SELECT * FROM quotes WHERE id=? AND company_id IS NOT NULL').get(statusMatch[1]);
          if(!old) return respond(404,{error:'Cotação não encontrada.'});
          workflow.manualStatus(user,old.id,body.status,body.expectedStatus);
          const row=db.prepare('SELECT q.*,c.name company_name FROM quotes q JOIN companies c ON c.id=q.company_id WHERE q.id=?').get(old.id);
          return respond(200,record(row,user));
        }
        return respond(404,{error:'Rota não encontrada.'});
      }
      if(!['GET','HEAD'].includes(req.method)) return respond(405,{error:'Método não permitido.'});
      const fileName=pathname==='/'?'index.html':decodeURIComponent(pathname).replace(/^\//,'');
      if(fileName==='formulario.html' && (!user || user.role!=='client')) {
        res.writeHead(303,{Location:'/portal.html'});res.end();return;
      }
      if(!/^(portal\.html|index\.html|formulario\.html|system-config\.js|design\.css|demo\.css|portal\.js|cities\.js|briefing-rules\.js|assets\/[\w./ -]+|fonts\/[\w./, -]+)$/.test(fileName) || fileName.split('/').includes('..')) return respond(404,{error:'Não encontrado.'});
      const file=path.join(FRONTEND,fileName==='formulario.html'?'index.html':fileName);
      if(!fs.existsSync(file)||!fs.statSync(file).isFile()) return respond(404,{error:'Não encontrado.'});
      const real=fs.realpathSync(file);
      if(!real.startsWith(fs.realpathSync(FRONTEND)+path.sep)) return respond(404,{error:'Não encontrado.'});
      const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
      if(fileName==='formulario.html') res.setHeader('X-Robots-Tag','noindex, nofollow');
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
      if(req.method==='HEAD') return res.end();
      if(fileName==='formulario.html') {
        const identity=JSON.stringify(publicUser(user)).replace(/</g,'\\u003c');
        return res.end(fs.readFileSync(file,'utf8').replace('<head>','<head><script>window.PAYTRACK_USER='+identity+';</script>').replace('<title data-page-title>Cotação de grupos e eventos · Nexo</title>','<title data-page-title>Briefing da cotação · Nexo</title>'));
      }
      fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    } catch(e) { if(e.status)return respond(e.status,{error:e.message});console.error('[demo]',e);respond(500,{error:'Falha ao processar. Dados preservados.'}); }
  });
  return { server, db };
}
if(require.main===module) {
  const port=Number(process.env.PORT||8000);
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('Porta inválida');
  const app=createApp({database:process.env.PAYTRACK_DEMO_DB_PATH});
  app.server.listen(port,'127.0.0.1',()=>{
    console.log(CONFIG.brand.name+' DEMO: http://127.0.0.1:'+port+' — e-mail real desativado');
    if(process.argv.includes('--open')) require('node:child_process').spawn('cmd.exe',['/c','start','','http://127.0.0.1:'+port],{stdio:'ignore',windowsHide:true}).unref();
  });
  const stop=()=>app.server.close(()=>{app.db.close();process.exit(0);});
  process.once('SIGINT',stop); process.once('SIGTERM',stop);
}
module.exports={createApp,STATUSES};
