'use strict';

const {randomUUID}=require('node:crypto');
const {clean,required,problem,transaction,closed,currentDay}=require('./workflow.cjs');
const {calculate}=require('../assets/proposal/proposal-rules.js');

const services={hotel:'Hospedagem',air:'Aéreo',transfer:'Transfer',venue:'Salas e alimentação',food:'Alimentação',insurance:'Seguro'};
const states={requested:'Solicitação registrada',sent:'Cotação enviada',responded:'Resposta recebida',validated:'Resposta validada',cancelled:'Pedido cancelado'};
const now=()=>new Date().toISOString();
const rooms=form=>['roomsSingle','roomsDoubleTwin','roomsDoubleCasal','roomsTriple'].reduce((sum,k)=>sum+(Number(form[k])||0),0);
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

function createSourcing(db,workflow){
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers(
      id TEXT PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id), service TEXT NOT NULL,
      name TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL, description TEXT NOT NULL,
      capacity INTEGER, latitude REAL, longitude REAL, photo TEXT NOT NULL, source TEXT NOT NULL,
      checked_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, contact TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS supplier_requests(
      id TEXT PRIMARY KEY, quote_id TEXT NOT NULL REFERENCES quotes(id), supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, requested_at TEXT NOT NULL,
      requested_by INTEGER NOT NULL REFERENCES app_users(id), briefing TEXT, delivery_evidence TEXT, follow_up_on TEXT,
      UNIQUE(quote_id,supplier_id)
    );
    CREATE TABLE IF NOT EXISTS supplier_offers(
      id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES supplier_requests(id),
      received_at TEXT NOT NULL, data TEXT NOT NULL, total_cents INTEGER NOT NULL,
      reviewed_at TEXT, reviewed_by INTEGER REFERENCES app_users(id)
    );
    CREATE INDEX IF NOT EXISTS supplier_offers_request ON supplier_offers(request_id);
  `);
  if(!db.prepare('PRAGMA table_info(supplier_requests)').all().some(column=>column.name==='follow_up_on')){
    db.exec('ALTER TABLE supplier_requests ADD COLUMN follow_up_on TEXT');
  }
  const insertDemo=db.prepare(`INSERT OR IGNORE INTO suppliers(id,company_id,service,name,city,address,description,capacity,latitude,longitude,photo,source,checked_at,contact,demo)
    VALUES(?,?,'hotel',?,'São Paulo','',?,?,NULL,NULL,'','Catálogo fictício de teste','', '',1)`);
  for(const company of [1,2]){
    insertDemo.run('hotel-demo-centro-'+company,company,'Hotel Modelo Centro','Exemplo de hotel com salas para reuniões.',80);
    insertDemo.run('hotel-demo-parque-'+company,company,'Hotel Modelo Parque','Exemplo de hospedagem para grupos.',140);
  }

  function catalogRecord(row,internal){
    const {id,service,name,city,address,description,capacity,latitude,longitude,photo,source,checked_at,demo}=row;
    return {id,service,name,city,address,description,capacity,latitude,longitude,photo,source,checkedAt:checked_at,demo:!!demo,
      ...(internal?{contact:row.contact,active:!!row.active}:{})};
  }
  function catalog(user,id,body){
    if(!user)problem('Faça login para continuar.',401);
    if(user.role!=='consultant')problem('Ação exclusiva da equipe.',403);
    const companyId=Number(id);
    if(!workflow.companyAccess(user,companyId))problem('Empresa não encontrada.',404);
    if(!body)return db.prepare('SELECT * FROM suppliers WHERE company_id=? ORDER BY name').all(companyId).map(row=>catalogRecord(row,true));
    const service=body.service;
    if(!Object.hasOwn(services,service))problem('Escolha a categoria de serviço.');
    const supplierId=body.id||randomUUID();
    const old=db.prepare('SELECT * FROM suppliers WHERE id=? AND company_id=?').get(supplierId,companyId);
    if(body.id&&!old)problem('Fornecedor não encontrado.',404);
    const coordinates=[body.latitude,body.longitude].map(v=>v===''||v==null?null:Number(v));
    if((coordinates[0]===null)!==(coordinates[1]===null)||coordinates.some((n,i)=>n!==null&&(!Number.isFinite(n)||Math.abs(n)>(i===0?90:180))))problem('Informe latitude e longitude válidas.');
    const photo=clean(body.photo,1024);
    if(photo&&(!/^https:\/\//i.test(photo)||!URL.canParse(photo)))problem('Use uma URL HTTPS para a foto.');
    const checkedAt=required(body.checkedAt,10);
    if(!date(checkedAt)||checkedAt>currentDay())problem('Informe a data de verificação do cadastro.');
    const capacity=body.capacity===''||body.capacity==null?null:Number(body.capacity);
    if(capacity!==null&&(!Number.isInteger(capacity)||capacity<1||capacity>100000))problem('Informe uma capacidade válida.');
    const values=[service,required(body.name,180),required(body.city,180),clean(body.address,250),clean(body.description),capacity,...coordinates,photo,required(body.source,250),checkedAt,body.active!==false?1:0,clean(body.contact,250)];
    if(old){
      if(old.service!==service&&db.prepare('SELECT 1 FROM supplier_requests WHERE supplier_id=?').get(supplierId))problem('A categoria já foi usada em uma cotação.');
      db.prepare(`UPDATE suppliers SET service=?,name=?,city=?,address=?,description=?,capacity=?,latitude=?,longitude=?,photo=?,source=?,checked_at=?,active=?,contact=? WHERE id=? AND company_id=?`)
        .run(...values,supplierId,companyId);
    }else{
      db.prepare(`INSERT INTO suppliers(service,name,city,address,description,capacity,latitude,longitude,photo,source,checked_at,active,contact,id,company_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(...values,supplierId,companyId);
    }
    return {id:supplierId};
  }

  function list(user,quote){
    const internal=user.role==='consultant';
    const suppliers=db.prepare('SELECT * FROM suppliers WHERE company_id=? AND (?=1 OR active=1) ORDER BY name').all(quote.company_id,internal?1:0);
    const byId=new Map(suppliers.map(row=>[row.id,row]));
    const requests=db.prepare('SELECT * FROM supplier_requests WHERE quote_id=? ORDER BY requested_at,id').all(quote.id);
    return {
      suppliers:suppliers.filter(row=>internal||row.service==='hotel').map(row=>catalogRecord(row,internal)),
      services,states,briefing:context(quote),preferences:workflow.view(user,quote).preferences,
      closed:closed(quote.status),
      requests:requests.map(row=>{
        const supplier=byId.get(row.supplier_id)||db.prepare('SELECT * FROM suppliers WHERE id=?').get(row.supplier_id);
        const result={id:row.id,supplier:catalogRecord(supplier,internal),state:row.state,requestedAt:row.requested_at};
        if(internal){
          Object.assign(result,{revision:row.revision,evidence:row.delivery_evidence,briefing:row.briefing?JSON.parse(row.briefing):null,followUpOn:row.follow_up_on});
          result.offers=db.prepare('SELECT * FROM supplier_offers WHERE request_id=? ORDER BY rowid DESC').all(row.id).map(offer=>({
            id:offer.id,receivedAt:offer.received_at,reviewedAt:offer.reviewed_at,totalCents:offer.total_cents,...JSON.parse(offer.data)
          }));
        }
        return result;
      })
    };
  }
  function context(quote){
    const form=JSON.parse(quote.payload);
    return {
      event:form.eventName||'',destination:form.destination||'',startDate:form.departureDate||'',endDate:form.returnDate||'',
      people:form.participantsUnknown?null:form.totalPassengers,rooms:rooms(form),hotel:!!form.svcHospedagem,
      budget:form.desiredBudget||'',hotelPreferences:[form.hotelStandard,form.hotelLocationPref,form.mealRegime].filter(Boolean),
      roomMix:{single:form.roomsSingle||'',twin:form.roomsDoubleTwin||'',double:form.roomsDoubleCasal||'',triple:form.roomsTriple||''},
      spaces:!!form.svcEspacoAlimentacao
    };
  }
  function handle(user,id,action,body){
    const quote=workflow.getQuote(user,id);
    if(!action)return list(user,quote);
    return transaction(db,()=>{
      if(closed(quote.status))problem('A solicitação está encerrada ou cancelada.',409);
      if(action==='request'){
        if(!Array.isArray(body.supplierIds)||!body.supplierIds.length||body.supplierIds.length>30||body.supplierIds.some(v=>typeof v!=='string'))problem('Escolha os fornecedores de interesse.');
        const briefing=context(quote);
        const inserted=[];
        for(const supplierId of new Set(body.supplierIds)){
          const supplier=db.prepare('SELECT * FROM suppliers WHERE id=? AND company_id=? AND active=1').get(supplierId,quote.company_id);
          if(!supplier)problem('Fornecedor não encontrado.',404);
          if(user.role==='client'&&(supplier.service!=='hotel'||!briefing.hotel))problem('Inclua hospedagem no briefing para solicitar hotéis.',409);
          const changed=db.prepare(`INSERT OR IGNORE INTO supplier_requests(id,quote_id,supplier_id,state,requested_at,requested_by) VALUES(?,?,?,'requested',?,?)`)
            .run(randomUUID(),id,supplierId,now(),user.id);
          if(changed.changes)inserted.push(supplier.name);
        }
        for(const name of inserted)workflow.activity(id,user,'supplier_requested','Orçamento solicitado à equipe para '+name+'.',true);
        return {added:inserted.length};
      }
      if(user.role!=='consultant')problem('Ação exclusiva da equipe.',403);
      const request=db.prepare('SELECT r.*,s.name,s.service FROM supplier_requests r JOIN suppliers s ON s.id=r.supplier_id WHERE r.quote_id=? AND r.id=?').get(id,body.requestId??null);
      if(!request)problem('Pedido não encontrado.',404);
      if(request.revision!==body.expectedRevision)problem('O pedido mudou. Atualize para continuar.',409);
      if(action==='follow-up'){
        if(request.state!=='sent')problem('O pedido já não está aguardando resposta.',409);
        const followUpOn=followUpDate(body.followUpOn);
        if(followUpOn!==request.follow_up_on){
          db.prepare('UPDATE supplier_requests SET follow_up_on=?,revision=revision+1 WHERE id=?').run(followUpOn,request.id);
          workflow.activity(id,user,'supplier_follow_up',followUpOn
            ? 'Cobrança de retorno de '+request.name+' programada para '+followUpOn+'.'
            : 'Cobrança de retorno de '+request.name+' concluída ou removida.');
        }
        return {state:request.state,followUpOn};
      }
      let next;
      let message;
      if(action==='send'){
        if(request.state!=='requested'||quote.status==='complement')problem('Conclua a conferência do briefing antes de registrar o envio.',409);
        const briefing=context(quote);
        if(!briefing.destination||!date(briefing.startDate)||!date(briefing.endDate)||Number(briefing.people)<1||request.service==='hotel'&&(briefing.rooms<1||briefing.endDate<=briefing.startDate)){
          problem('Confirme destino, datas, participantes e quartos aplicáveis no briefing.');
        }
        const evidence=required(body.evidence);
        if(body.confirmSent!==true)problem('Confirme que o pedido foi efetivamente encaminhado.');
        db.prepare('UPDATE supplier_requests SET briefing=?,delivery_evidence=?,follow_up_on=? WHERE id=?')
          .run(JSON.stringify(briefing),evidence,followUpDate(body.followUpOn),request.id);
        next='sent';
        message='Pedido encaminhado a '+request.name+'.';
        if(['received','analysis','consolidating'].includes(quote.status))workflow.setStatus(quote,user,'quoting');
      }else if(action==='offer'){
        if(!['sent','responded','validated'].includes(request.state))problem('Registre o envio antes de lançar a resposta.',409);
        const offer=normalizeOffer(request,body);
        db.prepare('INSERT INTO supplier_offers(id,request_id,received_at,data,total_cents) VALUES(?,?,?,?,?)')
          .run(randomUUID(),request.id,now(),JSON.stringify(offer.data),offer.totalCents);
        next='responded';
        message='Resposta recebida de '+request.name+'.';
      }else if(action==='validate'){
        if(request.state!=='responded')problem('Registre a resposta antes de validar.',409);
        const offer=db.prepare('SELECT * FROM supplier_offers WHERE request_id=? ORDER BY rowid DESC LIMIT 1').get(request.id);
        if(offer?.id!==body.offerId)problem('Valide a resposta mais recente.',409);
        const details=JSON.parse(offer.data);
        if(details.validUntil<currentDay()||details.availability!=='confirmed')problem('Confirme a disponibilidade e a validade da resposta antes de validar.');
        db.prepare('UPDATE supplier_offers SET reviewed_at=?,reviewed_by=? WHERE id=?').run(now(),user.id,offer.id);
        next='validated';
        message='Resposta de '+request.name+' conferida pela equipe.';
      }else if(action==='cancel'){
        if(request.state==='cancelled')problem('O pedido já está cancelado.',409);
        workflow.activity(id,user,'supplier_cancel_reason',required(body.reason));
        next='cancelled';
        message='Pedido para '+request.name+' cancelado.';
      }else problem('Ação não encontrada.',404);
      db.prepare('UPDATE supplier_requests SET state=?,follow_up_on=CASE WHEN ?=\'sent\' THEN follow_up_on END,revision=revision+1 WHERE id=?')
        .run(next,next,request.id);
      workflow.activity(id,user,'supplier_'+next,message,true);
      return {state:next};
    });
  }
  function summary(id){
    const requests=db.prepare(`
      SELECT r.id, r.state, r.requested_at, r.follow_up_on, s.name, o.id offer_id, o.received_at,
        json_extract(o.data,'$.validUntil') valid_until
      FROM supplier_requests r JOIN suppliers s ON s.id=r.supplier_id
      LEFT JOIN supplier_offers o ON o.rowid=(
        SELECT rowid FROM supplier_offers WHERE request_id=r.id ORDER BY rowid DESC LIMIT 1
      )
      WHERE r.quote_id=? AND r.state<>'cancelled'
      ORDER BY r.requested_at,r.id
    `).all(id);
    const counts={requested:0,responded:0,waiting:0};
    for(const request of requests){
      if(request.state==='sent')counts.waiting++;
      else if(Object.hasOwn(counts,request.state))counts[request.state]++;
    }
    return {...counts,requests};
  }
  return {catalog,handle,summary};
}
function followUpDate(value){
  const followUpOn=clean(value,10);
  if(followUpOn&&!date(followUpOn))problem('Informe uma data válida para cobrar o retorno.');
  return followUpOn||null;
}
function normalizeOffer(request,body){
  const validUntil=required(body.validUntil,10);
  if(!date(validUntil))problem('Informe a validade da resposta.');
  if(!['confirmed','pending','unavailable'].includes(body.availability))problem('Informe a disponibilidade.');
  const row={
    name:required(body.item,180),state:'priced',unitPrice:required(body.unitPrice,30),
    quantity:required(body.quantity,12),units:clean(body.units,12)||'1',
    taxMode:body.taxMode,taxPercent:clean(body.taxPercent,20)||'0',category:request.service==='air'?'fare':'other',
    occupancy:clean(body.occupancy,10),startDate:clean(body.startDate,10),endDate:clean(body.endDate,10)
  };
  if(request.service==='hotel'&&(!date(row.startDate)||!date(row.endDate)||row.endDate<=row.startDate||!/^[1-9]\d*$/.test(row.occupancy))){
    problem('Informe check-in, check-out e ocupação da hospedagem.');
  }
  if(request.service!=='hotel'){row.startDate='';row.endDate='';}
  if(request.service==='air')row.units='1';
  const option={id:randomUUID(),name:row.name,supplier:request.name,currency:'BRL',feePercent:'0',feeBase:'withTaxes',conditions:required(body.conditions),description:clean(body.inclusions),rows:[row]};
  const result=calculate(option);
  if(!result.valid)problem(result.error);
  return {data:{option,validUntil,availability:body.availability,units:result.lines[0].units},totalCents:result.total};
}
module.exports={createSourcing};
