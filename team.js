'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const labels = {received:'Recebida',needs_information:'Aguardando informações',quoting:'Em cotação',proposal_sent:'Proposta enviada',completed:'Concluída'};
  let setup = false, requests = [], selectedProtocol = null;
  const node = (tag,text,className) => { const el=document.createElement(tag); if(text!==undefined)el.textContent=String(text); if(className)el.className=className; return el; };
  const date = value => value ? new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}) : 'A definir';
  const text = value => Array.isArray(value) ? value.join(', ') || 'A definir' : value === '' || value === null || value === undefined ? 'A definir' : String(value);
  function feedback(message='',error=false) { $('feedback').textContent=message; $('feedback').classList.toggle('is-error',error); }
  async function api(url,options={}) {
    const response=await fetch(url,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
    const data=await response.json();
    if(!response.ok){
      if(response.status===401 && !$('workspace').hidden) { showAccess(); feedback('Sua sessão terminou. Entre novamente.',true); }
      const message=response.status===429?'Muitas tentativas. Aguarde um minuto e tente novamente.':response.status===401?'Senha incorreta ou sessão encerrada.':response.status===409?'O acesso já foi configurado. Atualize a página para entrar.':response.status===422?Object.values(data.errors||{}).join(' ')||'Confira as informações preenchidas.':'Não foi possível concluir a operação. Verifique o servidor local.';
      throw new Error(message);
    }
    return data;
  }
  function showAccess() { $('access').hidden=false; $('workspace').hidden=true; $('logout').hidden=true; $('password').value=''; $('confirm-password').value=''; $('request-detail').replaceChildren(node('p','Selecione uma solicitação.')); $('request-list').replaceChildren(); requests=[]; selectedProtocol=null; }
  async function configureAccess() {
    const data=await api('/api/team/setup-status'); setup=!data.configured;
    $('access-heading').textContent=setup?'Crie o acesso da equipe local':'Entre na equipe local';
    $('access-description').textContent=setup?'Defina uma senha para proteger os briefings neste computador. Guarde-a: ela não será enviada por e-mail.':'Use a senha definida neste computador para consultar e atualizar as solicitações.';
    $('password').autocomplete=setup?'new-password':'current-password';
    $('confirm-password-wrap').hidden=!setup; $('confirm-password').required=setup;
    $('access-submit').textContent=setup?'Criar acesso local':'Entrar'; $('access-form').hidden=false;
  }
  function renderList() {
    const search=$('search').value.trim().toLocaleLowerCase('pt-BR'),status=$('status-filter').value;
    const filtered=requests.filter(item=>(!status||item.status===status)&&(!search||[item.eventName,item.companyName,item.protocol].join(' ').toLocaleLowerCase('pt-BR').includes(search)));
    $('request-count').textContent=filtered.length+' solicitação(ões) nesta lista';
    const list=$('request-list');list.replaceChildren();
    if(!filtered.length)list.append(node('li',requests.length?'Nenhuma solicitação corresponde aos filtros.':'Nenhuma solicitação registrada neste computador.'));
    for(const item of filtered){const li=node('li'),button=node('button',undefined,'team-request-button');button.type='button';button.setAttribute('aria-pressed',String(item.protocol===selectedProtocol));button.append(node('span',labels[item.status]||item.status,'team-status'),node('strong',item.eventName),node('small',item.companyName),node('small',item.protocol),node('small','Responsável: '+(item.assignedTo||'A definir')),node('small',date(item.createdAt)+' (Brasília)'));button.addEventListener('click',()=>loadDetail(item.protocol));li.append(button);list.append(li);}
  }
  async function loadRequests() { const data=await api('/api/team/requests');requests=data.requests;renderList(); }
  function addPairs(target,pairs) {const dl=node('dl');for(const [label,value] of pairs){const row=node('div');row.append(node('dt',label),node('dd',text(value)));dl.append(row)}target.append(dl);}
  function renderDetail(data) {
    const {request,history}=data, f=request.payload, detail=$('request-detail');detail.replaceChildren();
    const title=node('h2',request.eventName);title.tabIndex=-1;detail.append(node('p',request.protocol,'team-protocol'),title);
    addPairs(detail,[['Empresa',request.companyName],['Contato',f.requesterName],['E-mail',f.email],['Telefone',f.phone],['Destino',f.destination],['Participantes',f.participantsUnknown?'Quantidade a definir':(f.participantsEstimated?'Aproximadamente ':'')+f.totalPassengers],['Período',f.datesUnknown?'Datas a definir':f.departureDate+' a '+f.returnDate+(f.datesFlexible?' (flexível)':'')],['Registro',date(request.createdAt)+' (Brasília)']]);const metadataEnd=detail.lastChild;
    const services=[['svcAereo','Aéreo','aereoGuidance',[['Companhia','airlinePreference'],['Companhia específica','specificAirline'],['Restrição','restrictedAirline'],['Ida','departureTimes'],['Volta','returnTimes'],['Cabine','cabinClass'],['Distribuição de cabines','cabinClassNotes'],['Conexões','flightConnection'],['Conexão máxima (h)','maxLayoverHours'],['Bagagem','baggageType'],['Observações','aereoNotes']]],['svcHospedagem','Hospedagem','hospedagemGuidance',[['Padrão','hotelStandard'],['Localização','hotelLocationPref'],['Endereço do evento','eventAddress'],['Outra localização','hotelLocationOther'],['Single','roomsSingle'],['Twin','roomsDoubleTwin'],['Casal','roomsDoubleCasal'],['Triplo','roomsTriple'],['Refeições','mealRegime'],['Lista de hóspedes','roomingList'],['Observações','hospedagemNotes']]],['svcEspacoAlimentacao','Espaços e alimentação','espacoGuidance',[['Pessoas na sala','plenaryCapacity'],['Montagem','roomLayout'],['Salas de apoio','breakoutRoomsCount'],['Audiovisual','avServices'],['Outros recursos','avOtherNotes'],['Alimentação','cateringServices'],['Coffee break/dia','coffeeBreakPerDay'],['Observações','espacoAlimentacaoNotes']]],['svcTransfers','Transfers','transfersGuidance',[['Trajetos','transferTypes'],['Veículo','vehicleType'],['Tempo à disposição','dedicatedVehicleHoursDays'],['Observações','transfersNotes']]]];
    for(const [service,label,guidance,fields] of services)if(f[service]){detail.append(node('h3',label));if(f[guidance])detail.append(node('p','Cliente solicita orientação para este serviço.','team-note'));const provided=fields.filter(([,field])=>Array.isArray(f[field])?f[field].length>0:f[field]!==''&&f[field]!==undefined&&f[field]!==null);if(provided.length)addPairs(detail,provided.map(([label,field])=>[label,f[field]]));else detail.append(node('p','Preferências ainda não definidas.','team-note'));}
    if(f.generalNotes){detail.append(node('h3','Observações gerais'));addPairs(detail,[['Observações',f.generalNotes]]);}
    const extras=[['CNPJ',f.cnpj],['Cargo',f.requesterRole],['Centro de custo',f.costCenterNotApplicable?'Não se aplica':f.costCenter],['Extras',f.extraBillingType]].filter(([,value])=>value);if(extras.length){detail.append(node('h3','Dados complementares'));addPairs(detail,extras);}
    const workflowTitle=node('h3','Atualizar acompanhamento local');detail.insertBefore(workflowTitle,metadataEnd.nextSibling);
    const form=node('form'),statusLabel=node('label','Situação do pedido'),select=node('select');select.id='workflow-status';statusLabel.htmlFor=select.id;for(const [key,label]of Object.entries(labels)){const option=node('option',label);option.value=key;select.append(option)}select.value=request.status;
    const assignedLabel=node('label','Responsável'),assigned=node('input');assigned.id='workflow-assigned';assigned.maxLength=120;assigned.value=request.assignedTo||'';assignedLabel.htmlFor=assigned.id;assigned.placeholder='Nome de quem acompanha o pedido';
    const noteLabel=node('label','Nota no histórico (opcional)'),note=node('textarea');note.id='workflow-note';note.maxLength=2000;note.rows=3;noteLabel.htmlFor=note.id;
    const save=node('button','Salvar acompanhamento','team-primary');save.type='submit';form.append(statusLabel,select,assignedLabel,assigned,noteLabel,note,node('p','Alterações são locais e não enviam mensagens ao cliente.','team-note'),save);
    form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;feedback();try{const updated=await api('/api/team/requests/'+encodeURIComponent(request.protocol),{method:'PATCH',body:JSON.stringify({status:select.value,assignedTo:assigned.value.trim(),note:note.value.trim()})});if(selectedProtocol===request.protocol)renderDetail(updated);await loadRequests();feedback('Acompanhamento salvo no histórico local.');}catch(error){feedback(error.message,true);}finally{save.disabled=false;}});
    detail.insertBefore(form,workflowTitle.nextSibling);detail.append(node('h3','Histórico local'));
    const events=node('ol',undefined,'team-history');for(const event of history){const li=node('li');li.append(node('strong',labels[event.status]||event.status),node('small',date(event.createdAt)+' (Brasília) • '+(event.actor||'Equipe local')),node('p','Responsável: '+(event.assignedTo||'A definir')));if(event.note)li.append(node('p',event.note));events.append(li)}if(!history.length)events.append(node('li','Nenhuma atualização da equipe.'));detail.append(events);title.focus({preventScroll:true});
  }
  async function loadDetail(protocol) {selectedProtocol=protocol;renderList();feedback('Carregando briefing…');try{const data=await api('/api/team/requests/'+encodeURIComponent(protocol));if(selectedProtocol!==protocol)return;renderDetail(data);feedback();if(matchMedia('(max-width:900px)').matches)$('request-detail').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});}catch(error){feedback(error.message,true);}}
  async function enterWorkspace() {$('access').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;$('password').value='';$('confirm-password').value='';await loadRequests();}
  $('access-form').addEventListener('submit',async event=>{event.preventDefault();feedback();if(setup&&$('password').value!==$('confirm-password').value){feedback('As senhas não coincidem.',true);return;}$('access-submit').disabled=true;try{await api('/api/team/'+(setup?'setup':'login'),{method:'POST',body:JSON.stringify({password:$('password').value})});await enterWorkspace();}catch(error){feedback(error.message,true);}finally{$('access-submit').disabled=false;}});
  $('logout').addEventListener('click',async()=>{try{await api('/api/team/logout',{method:'POST',body:'{}'});showAccess();await configureAccess();feedback('Sessão encerrada.');}catch(error){feedback(error.message,true);}});
  $('search').addEventListener('input',renderList);$('status-filter').addEventListener('change',renderList);$('refresh').addEventListener('click',async()=>{try{await loadRequests();feedback('Lista atualizada.');}catch(error){feedback(error.message,true);}});
  (async()=>{try{await configureAccess();const response=await fetch('/api/team/session',{credentials:'same-origin'});if(response.ok)await enterWorkspace();}catch{feedback('O painel requer o servidor local. Inicie pelo arquivo Iniciar-Paytrack.cmd ou pelo comando npm start.',true);}})();
})();
