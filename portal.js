
(()=>{
 const {brand,storage}=window.EventSystem.config;
 const qs=(s)=>document.querySelector(s);
 const STATUSES={received:'Solicitação recebida',analysis:'Em análise',complement:'Ação necessária',quoting:'Em cotação',consolidating:'Preparando proposta',proposal:'Aguardando aprovação',review:'Em revisão',approved:'Aprovada',closed:'Encerrada',cancelled:'Cancelada'};
 let currentUser=null, cachedQuotes=[], loadVersion=0;
 const dateLabel=value=>value?new Date(value.length===10?value+'T12:00:00':value).toLocaleDateString('pt-BR'):'A definir';
 function duplicateQuote(q){if(localStorage.getItem(storage.draftPrefix+currentUser.companyId)&&!window.confirm('Substituir o rascunho atual por uma cópia deste evento?'))return;try{localStorage.setItem(storage.draftPrefix+currentUser.companyId,JSON.stringify(q.form||{}));sessionStorage.removeItem(storage.attemptPrefix+currentUser.companyId);location.assign('/formulario.html');}catch(e){qs('#workspace-message').textContent='Não foi possível criar o rascunho neste navegador.';}}

 async function resumeAccountDraft(){const owner=currentUser;const feedback=qs('#workspace-message');try{const result=await api('/api/draft');if(owner!==currentUser)return;if(!result.draft){feedback.textContent='Você ainda não salvou um rascunho na sua conta.';return;}if(localStorage.getItem(storage.draftPrefix+currentUser.companyId)&&!window.confirm('Substituir o preenchimento deste navegador pelo rascunho salvo na sua conta?'))return;localStorage.setItem(storage.draftPrefix+currentUser.companyId,JSON.stringify(result.draft.form));sessionStorage.removeItem(storage.attemptPrefix+currentUser.companyId);location.assign('/formulario.html');}catch(e){feedback.textContent=e.message;}}
 async function api(url,method='GET',body){const res=await fetch(url,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok)throw Error(data.error||'Falha na solicitação');return data;}
 function el(tag,cl,text){const x=document.createElement(tag);if(cl)x.className=cl;if(text!=null)x.textContent=text;return x;}


 function proposalLink(q){if(currentUser.role!=='consultant'&&!q.commercial?.version)return document.createDocumentFragment();const link=el('a','proposal-link',currentUser.role==='consultant'?'Preparar proposta ':'Ver proposta v'+q.commercial.version+' ');link.href='/assets/proposal/index.html?quote='+encodeURIComponent(q.id);return link;}
 function operationEditor(d,refresh=loadQuotes){
  const box=el('section','operation-editor request-operations'),heading=el('h2',null,'Acompanhamento interno');
  box.id='request-operations';
  const op=d.operation,owner=el('dd',null,op.assignedName||'Sem responsável');
  const dueSummary=el('dd',null,op.dueDate?dateLabel(op.dueDate):'Sem prazo');
  const facts=el('dl','request-operation-facts'),controls=el('details','workflow-details');
  facts.append(el('dt',null,'Responsável'),owner,el('dt',null,'Prazo interno'),dueSummary);
  controls.append(el('summary',null,'Editar acompanhamento'));
  const claim=el('button','secondary',op.assignedTo===currentUser.id?'Você é responsável':'Assumir cotação');
  claim.type='button';claim.disabled=!!op.assignedTo;
  const dueLabel=el('label',null,'Prazo de retorno'),due=el('input');due.type='date';due.id='operation-due';due.value=op.dueDate||'';dueLabel.htmlFor=due.id;
  const noteLabel=el('label',null,'Pendência / próximo passo'),note=el('textarea');note.id='operation-note';note.maxLength=2000;note.rows=3;note.value=op.pendingNote;noteLabel.htmlFor=note.id;
  const save=el('button','primary','Salvar acompanhamento'),feedback=el('p','operation-feedback');save.type='button';feedback.setAttribute('role','status');
  const update=async changes=>{
    save.disabled=claim.disabled=true;
    try{
      const result=await api('/api/quotes/'+d.id+'/operation','PATCH',{expectedRevision:op.revision,...changes});
      Object.assign(op,result.operation);
      owner.textContent=op.assignedName||'Sem responsável';
      dueSummary.textContent=op.dueDate?dateLabel(op.dueDate):'Sem prazo';
      claim.textContent=op.assignedTo===currentUser.id?'Você é responsável':'Assumir cotação';
      feedback.textContent='Acompanhamento salvo. Alteração registrada no histórico.';
      await refresh();
    }catch(error){feedback.textContent=error.message;}
    finally{save.disabled=false;claim.disabled=!!op.assignedTo;}
  };
  claim.onclick=()=>update({claim:true});
  save.onclick=()=>update({dueDate:due.value||null,pendingNote:note.value});
  controls.append(claim,dueLabel,due,noteLabel,note,save,feedback);
  box.append(heading,facts,controls);
  return box;
 }
 async function commercialPanel(d,target,refresh){try{const state=await api('/api/quotes/'+d.id+'/commercial');if(!target.isConnected)return;const box=el('section','operation-editor');box.append(el('h2',null,'Proposta e evento'));const labels={planned:'Previsto',in_progress:'Em andamento',completed:'Concluído',cancelled:'Cancelado'},latest=state.versions[0];box.append(el('p',null,latest?'Proposta v'+latest.version+(latest.approval?' · aprovada':latest.review?' · revisão solicitada':' · aguardando aprovação'):'Proposta em preparação'),el('p',null,'Evento: '+labels[state.event.state]));const label=el('label',null,'Situação do evento'),select=el('select');select.id='event-state';label.htmlFor=select.id;for(const [value,text]of Object.entries(labels)){const o=el('option',null,text);o.value=value;select.append(o);}select.value=state.event.state;const reasonLabel=el('label',null,'Motivo da alteração'),reason=el('textarea');reason.id='event-reason';reason.maxLength=1000;reasonLabel.htmlFor=reason.id;const feedback=el('p');feedback.setAttribute('role','status');const save=el('button','secondary','Confirmar situação do evento');save.onclick=async()=>{save.disabled=true;try{const r=await api('/api/quotes/'+d.id+'/commercial/event','POST',{state:select.value,reason:reason.value,expectedRevision:state.event.revision});state.event=r;feedback.textContent='Situação do evento registrada no histórico. Reabra para consultar o histórico atualizado.';await loadQuotes();}catch(e){feedback.textContent=e.message;}finally{save.disabled=false;}};const lifecycle=el('details','workflow-details');lifecycle.append(el('summary',null,'Alterar situação do evento'),label,select,reasonLabel,reason,save);box.append(lifecycle,feedback);
 if(latest?.review){
  const review=el('section','proposal-review-summary');
  review.id='request-proposal-review-'+latest.version;
  const revise=proposalLink(d);revise.textContent='Preparar nova versão ';
  review.append(el('h3',null,'Revisão solicitada · v'+latest.version),
    el('p',null,latest.review.requestedBy+' · '+dateLabel(latest.review.requestedAt)),
    el('p',null,latest.review.note),revise);
  box.prepend(review);
 }
 const correctionLabel=el('label',null,'Registro de correção informativa'),note=el('textarea');note.id='correction-note';note.maxLength=2000;correctionLabel.htmlFor=note.id;const add=el('button','secondary','Registrar correção');add.onclick=async()=>{add.disabled=true;try{await api('/api/quotes/'+d.id+'/commercial/correction','POST',{note:note.value});feedback.textContent='Correção registrada. Alterações comerciais precisam de nova versão da proposta.';note.value='';}catch(e){feedback.textContent=e.message;}finally{add.disabled=false;}};const correction=el('details','workflow-details');correction.append(el('summary',null,'Registrar correção informativa'),correctionLabel,note,add,el('p','operation-caption','Mudanças de serviços, quantidades ou valores exigem nova versão e aceite.'));box.append(correction);const log=el('details','operation-log');log.append(el('summary',null,'Histórico comercial e do evento'));for(const entry of state.audit){if(entry.action==='draft_saved')continue;log.append(el('p',null,new Date(entry.created_at).toLocaleString('pt-BR')+' · '+({published:'Versão publicada',approved:'Versão aprovada',event_changed:'Situação do evento alterada',information_corrected:'Correção informativa'}[entry.action]||entry.action)+' · '+(entry.detail.version?'v'+entry.detail.version:entry.detail.reason||entry.detail.note||'')));}box.append(log);target.append(box);QuoteWorkflow.proposalFeedback(target,state.feedback,async id=>{await api('/api/quotes/'+d.id+'/commercial/resolve','POST',{id});await refresh();});}catch(e){target.prepend(el('p',null,e.message));}}
 async function openRequest(q,trigger,initialTarget,returnToQueue,initialView='overview'){
  const workspace=qs('#workspace');
  const panel=el('main','request-panel');
  workspace.classList.add('hidden');
  document.body.insertBefore(panel,qs('.footer'));

  const back=el('button','request-back',returnToQueue?' Voltar às pendências':' Voltar às cotações');
  back.type='button';
  back.onclick=()=>{
    panel.remove();
    workspace.classList.remove('hidden');
    if(returnToQueue)returnToQueue();
    else if(trigger.isConnected)trigger.focus();
    else ([...qs('#cards').querySelectorAll('[data-quote-id]')].find(button=>button.dataset.quoteId===q.id)||qs('#list-heading')).focus();
  };
  const title=el('h1',null,'Solicitação #'+String(q.protocol).padStart(6,'0'));
  title.tabIndex=-1;
  const loading=el('p',null,'Carregando informações do evento…');
  loading.setAttribute('role','status');
  panel.append(back,title,loading);
  title.focus();
  window.scrollTo(0,0);

  try{
    const d=await api('/api/quotes/'+q.id);
    if(!panel.isConnected)return;
    const consultant=currentUser.role==='consultant';
    title.textContent=d.form?.eventName||'Detalhes do evento';
    const identity=el('p','request-identity','#'+String(d.protocol).padStart(6,'0')+' · '+d.companyName);
    const header=el('div','request-heading');
    const context=el('div');
    const dates=[d.form?.departureDate,d.form?.returnDate];
    const period=dates.every(Boolean)?dates.map(dateLabel).join(' a '):'';
    const eventState={in_progress:'Evento em andamento',completed:'Evento concluído',cancelled:'Evento cancelado'}[d.commercial?.event];
    const facts=[d.form?.destination,period,
      d.form?.totalPassengers&&!d.form?.participantsUnknown?d.form.totalPassengers+' participantes':'',eventState].filter(Boolean);
    context.append(identity,title);
    if(facts.length)context.append(el('p','request-facts',facts.join(' · ')));
    header.append(context,el('span','status '+d.status,d.progress?.label||STATUSES[d.status]));
    panel.insertBefore(header,loading);
    const nav=el('nav','request-tabs');
    nav.setAttribute('aria-label','Seções da cotação');
    const navigationStatus=el('p','workflow-feedback');
    navigationStatus.setAttribute('role','status');
    panel.append(nav,navigationStatus);
    loading.remove();

    const views=new Map();
    let activeView,navigationVersion=0,focusedTask=returnToQueue?initialTarget:null;
    let sourcingReady,commercialReady;
    const definitions=[
      ['overview','Visão geral'],['briefing','Briefing'],
      ['suppliers',consultant?'Fornecedores':'Hotéis'],
      ...(consultant?[['budget','Orçamento']]:[]),
      ['proposals','Propostas'],['history','Histórico']
    ];
    function selectView(key){
      activeView=key;
      for(const [name,{section,tab}] of views){
        section.hidden=name!==key;
        tab.setAttribute('aria-pressed',String(name===key));
      }
      panel.querySelectorAll('.task-context-hidden,.task-destination').forEach(node=>{
        node.classList.remove('task-context-hidden','task-destination');
      });
    }
    for(const [key,label] of definitions){
      const section=el('section','request-view');
      const tab=el('button',null,label);
      section.id='quote-view-'+key;
      tab.type='button';
      tab.setAttribute('aria-controls',section.id);
      tab.onclick=()=>{
        navigationVersion++;
        focusedTask=null;
        navigationStatus.textContent='';
        selectView(key);
      };
      views.set(key,{section,tab});
      nav.append(tab);
      panel.append(section);
    }
    selectView(initialView);
    const overview=views.get('overview').section,briefing=views.get('briefing').section;
    const suppliers=views.get('suppliers').section,historyView=views.get('history').section;
    const overviewMain=el('div','request-overview-main');
    overview.append(overviewMain);

    async function jumpTo(id){
      const version=++navigationVersion;
      if(id.startsWith('supplier-')||id==='request-budget')await sourcingReady;
      if(id.startsWith('request-proposal-'))await commercialReady;
      if(!panel.isConnected||version!==navigationVersion)return;
      const target=document.getElementById(id);
      if(!target||!panel.contains(target)){
        navigationStatus.textContent='A pendência mudou. Consulte a situação atual da cotação.';
        selectView('overview');
        return;
      }
      const view=target.closest('.request-view');
      selectView(view.id.slice('quote-view-'.length));
      target.classList.add('task-destination');
      navigationStatus.textContent='';
      if(focusedTask){
        for(let node=target;node!==view;node=node.parentElement){
          for(const sibling of node.parentElement.children){
            if(sibling!==node&&!sibling.matches('h2,h3,summary'))sibling.classList.add('task-context-hidden');
          }
        }
      }
      for(let node=target;node!==view;node=node.parentElement){
        if(node.tagName==='DETAILS')node.open=true;
      }
      if(id==='request-operations')target.querySelector('details').open=true;
      const heading=target.querySelector(':scope > summary, :scope > h2, :scope > h3')||target;
      if(heading.tagName!=='SUMMARY')heading.tabIndex=-1;
      heading.focus({preventScroll:true});
      heading.scrollIntoView({block:'nearest'});
    }

    const attention=el('section','quote-attention');
    attention.id='request-attention';
    const refreshAttention=async()=>{
      await loadQuotes();
      if(!panel.isConnected||!consultant)return;
      const fresh=cachedQuotes.find(quote=>quote.id===d.id);
      if(!fresh)return;
      QuoteWorkflow.attention(attention,fresh.progress?.tasks,jumpTo);
      overviewMain.classList.toggle('has-tasks',!!fresh.progress?.tasks?.length);
      const message=overviewMain.querySelector('.progress-next-action');
      if(message)message.textContent=fresh.progress.nextAction;
    };
    const reloadDetail=async()=>{
      await loadQuotes();
      if(panel.isConnected){
        panel.remove();
        await openRequest(d,trigger,focusedTask,returnToQueue,activeView);
      }
    };
    if(consultant){
      overviewMain.append(attention);
      QuoteWorkflow.attention(attention,d.progress?.tasks,jumpTo);
      overviewMain.classList.toggle('has-tasks',!!d.progress?.tasks?.length);
    }
    if(d.progress)QuoteWorkflow.progress(overviewMain,d,currentUser,api,reloadDetail);
    const proposals=QuoteWorkflow.group(views.get('proposals').section,'request-proposals','Propostas');
    if(d.commercial?.version)proposals.append(el('p','proposal-current','Versão publicada: v'+d.commercial.version));
    if(d.commercial?.acceptedVersion)proposals.append(el('p',null,'Última versão aprovada: v'+d.commercial.acceptedVersion));
    if(!d.commercial?.version&&!consultant)proposals.append(el('p',null,'A proposta será exibida após a publicação pela equipe.'));
    proposals.append(proposalLink(d));
    if(!consultant&&d.commercial?.version)overviewMain.append(proposalLink(d));

    sourcingReady=QuoteWorkflow.sourcing(suppliers,d,currentUser,api,async()=>{
      await refreshAttention();
      if(panel.isConnected&&focusedTask?.startsWith('supplier-')){
        await jumpTo(document.getElementById(focusedTask)?focusedTask:'request-sourcing');
      }
    },views.get('budget')?.section,jumpTo);
    for(const item of d.sections||[]){
      const section=QuoteWorkflow.group(briefing,'request-'+item.id,item.title);
      section.classList.add('briefing-section');
      const fields=el('dl','briefing-fields');
      for(const field of item.fields){
        const row=el('div','request-field');
        row.append(el('dt',null,field.label),el('dd',null,field.value));
        fields.append(row);
      }
      section.append(fields);
    }
    if(!d.sections?.length){
      const legacy=QuoteWorkflow.group(briefing,'request-legacy','Registro anterior');
      legacy.append(el('p',null,d.summary||'Sem informações registradas.'));
    }
    const history=QuoteWorkflow.group(historyView,'request-history','Histórico da cotação');
    const timeline=el('ol','status-timeline');
    for(const event of d.history||[]){
      const item=el('li','visited');
      item.append(el('strong',null,STATUSES[event.new_status]||event.new_status),
        el('time',null,new Date(event.changed_at).toLocaleString('pt-BR')));
      timeline.append(item);
    }
    const activities=el('ol','status-timeline');
    for(const event of d.activity||[]){
      if(event.kind==='briefing_fields_updated')continue;
      activities.append(el('li',null,dateLabel(event.created_at)+' · '+(event.actor?event.actor+' · ':'')+event.message));
    }
    if(timeline.children.length)history.append(timeline);
    if(activities.children.length)history.append(activities);
    if(!timeline.children.length&&!activities.children.length)history.append(el('p',null,'Nenhum registro de histórico ainda.'));

    if(consultant){
      const operation=operationEditor(d,refreshAttention);
      const editor=statusEditor(d);
      editor.querySelector('select').addEventListener('status-saved',()=>{void reloadDetail();});
      operation.querySelector('details').append(editor);
      overview.append(operation);
      commercialReady=commercialPanel(d,proposals,refreshAttention);
      const logs=el('details','operation-log');
      logs.append(el('summary',null,'Histórico do acompanhamento interno'));
      for(const entry of d.operationHistory||[]){
        logs.append(el('p',null,new Date(entry.changedAt).toLocaleString('pt-BR')+' · Responsável: '+(entry.next.assignedName||'Não atribuído')+' · Prazo: '+dateLabel(entry.next.dueDate)+' · Pendência: '+(entry.next.pendingNote||'Nenhuma')));
      }
      if(logs.children.length>1)historyView.append(logs);
    }
    if(focusedTask&&!d.progress?.tasks?.some(task=>task.target===focusedTask)){
      focusedTask=null;
      navigationStatus.textContent='Esta pendência mudou desde a última atualização. Consulte a cotação atual.';
      void loadQuotes();
    }else if(initialTarget)await jumpTo(initialTarget);
  }catch(error){
    loading.textContent=error.message;
    if(!loading.isConnected)panel.append(loading);
  }
 }
 function matchesFilter(q,filter){
   if(!filter)return true;
   const status=q.progress?.status||q.status;
   if(filter==='action')return !!q.progress?.actionable;
   if(filter==='decision')return q.progress?.awaitingDecision===true;
   if(filter==='urgent')return q.progress?.tasks?.some(task=>task.priority<=2)||false;
   if(filter==='done')return ['closed','cancelled'].includes(status);
   if(filter==='active')return !['closed','cancelled'].includes(status);
   return status===filter;
 }
 function setWorkspaceView(showQueue){
  qs('#queue-panel').hidden=!showQueue;
  qs('#quotes-panel').hidden=showQueue;
  qs('#view-queue').setAttribute('aria-pressed',String(showQueue));
  qs('#view-quotes').setAttribute('aria-pressed',String(!showQueue));
 }
 function restoreQueuePosition(keys,index,scrollY){
  const rows=[...qs('#queue-items').querySelectorAll('[data-task-key]')];
  const byKey=new Map(rows.map(row=>[row.dataset.taskKey,row]));
  const nearby=[keys[index],...keys.slice(index+1),...keys.slice(0,index).reverse()];
  const destination=nearby.map(key=>byKey.get(key)).find(Boolean)||rows[index]||rows.at(-1)||qs('#queue-heading');
  destination.focus({preventScroll:true});
  window.scrollTo(0,scrollY);
  destination.scrollIntoView({block:'nearest'});
 }
 function renderQueue(){
  if(currentUser?.role!=='consultant')return;
  const owner=qs('#queue-owner').value,priority=qs('#queue-priority').value;
  const list=qs('#queue-items'),focused=document.activeElement;
  const previous=[...list.querySelectorAll('[data-task-key]')];
  const previousIndex=previous.indexOf(focused),scrollY=window.scrollY;
  const tasks=cachedQuotes.flatMap(quote=>{
    const assignee=quote.operation?.assignedTo;
    if(owner==='mine'&&assignee!==currentUser.id||owner==='unassigned'&&assignee)return [];
    return (quote.progress?.tasks||[])
      .filter(task=>priority!=='urgent'||task.priority<=2)
      .map(task=>({quote,task,key:quote.id+':'+task.target}));
  });
  tasks.sort((a,b)=>a.task.priority-b.task.priority
    ||(a.task.date||'9999').localeCompare(b.task.date||'9999')
    ||a.quote.protocol-b.quote.protocol||a.key.localeCompare(b.key));
  const keys=tasks.map(item=>item.key);
  list.replaceChildren();
  const empty=qs('#queue-empty');
  empty.hidden=tasks.length>0;
  empty.textContent=owner==='all'&&priority==='all'
    ?'Nenhuma tarefa pendente. Consulte Cotações para acompanhar os eventos em espera.'
    :'Nenhuma pendência com os filtros selecionados.';
  qs('#queue-count').textContent=tasks.length===1?'1 pendência':tasks.length+' pendências';
  for(const [index,{quote,task,key}] of tasks.entries()){
    const item=el('li'),button=el('button','queue-task');
    button.type='button';
    button.dataset.taskKey=key;
    const identity=el('span','queue-task-identity');
    identity.append(el('strong',null,task.label),
      el('span','cell-secondary',(quote.form?.eventName||'Evento sem nome')+' · #'+String(quote.protocol).padStart(6,'0')+' · '+quote.companyName));
    const timing=el('span','queue-task-timing');
    if(task.priority<=2)timing.append(el('span','queue-urgent','Urgente'));
    if(task.date)timing.append(el('span','cell-secondary',(task.dateType==='received'?'Entrada: ':'Prazo: ')+dateLabel(task.date)));
    const assignee=el('span','queue-task-owner',quote.operation?.assignedName||'Sem responsável');
    button.append(identity,timing,assignee);
    button.onclick=()=>{
      const scrollY=window.scrollY;
      void openRequest(quote,button,task.target,()=>restoreQueuePosition(keys,index,scrollY));
    };
    item.append(button);
    list.append(item);
  }
  if(previousIndex>=0)restoreQueuePosition(previous.map(row=>row.dataset.taskKey),previousIndex,scrollY);
 }
 function statusEditor(q){
  const section=el('section','status-editor'),label=el('label',null,'Situação da cotação'),select=el('select');
  select.id='status-'+q.id;label.htmlFor=select.id;select.setAttribute('aria-label','Atualizar status da cotação '+q.protocol);
  for(const [value,text] of Object.entries(STATUSES).filter(([key])=>!q.progress||key===q.status||q.progress.transitions?.includes(key))){const option=el('option',null,text);option.value=value;select.append(option)}
  select.value=q.status;
  const panel=el('div','status-confirmation'),message=el('p'),actions=el('div','status-confirm-actions'),confirm=el('button',null,'Confirmar alteração'),cancel=el('button',null,'Cancelar'),feedback=el('p','status-feedback');
  panel.hidden=true;panel.setAttribute('aria-live','polite');feedback.setAttribute('role','alert');
  confirm.type=cancel.type='button';actions.append(confirm,cancel);panel.append(message,actions,feedback);
  select.onchange=()=>{feedback.textContent='';panel.hidden=select.value===q.status;if(!panel.hidden)message.textContent='Alterar de “'+STATUSES[q.status]+'” para “'+STATUSES[select.value]+'”? O cliente verá a nova situação após sua confirmação.';};
  cancel.onclick=()=>{select.value=q.status;panel.hidden=true;feedback.textContent='';select.focus();};
  confirm.onclick=async()=>{
   const next=select.value;if(next===q.status)return;
   select.disabled=confirm.disabled=cancel.disabled=true;feedback.textContent='';confirm.textContent='Atualizando…';
   try{await api('/api/quotes/'+q.id+'/status','PATCH',{status:next,expectedStatus:q.status});q.status=next;panel.hidden=true;if(select.dispatchEvent)select.dispatchEvent(new Event('status-saved'));await loadQuotes();qs('#workspace-message').textContent='Situação atualizada para “'+STATUSES[next]+'”. O cliente já pode visualizar a alteração.';}
   catch(error){feedback.textContent=error.message;}
   finally{select.disabled=confirm.disabled=cancel.disabled=false;confirm.textContent='Confirmar alteração';}
  };
  section.append(label,select,panel);return section;
 }

 function enterWorkspace(user){
  const url=new URL(location.href);
  if(user&&url.searchParams.get('acao')==='nova-cotacao'){
    if(user.role==='client'){
      location.replace('/formulario.html?novo=1');
      return;
    }
    url.searchParams.delete('acao');
    history.replaceState(null,'',url);
  }
  showView(user);
 }
 const clientViews=[['','Todas'],['action','Precisa de você'],['done','Encerradas']];
 function renderClientFilters(){
  const filters=qs('#client-filters');
  filters.hidden=currentUser?.role!=='client'||!cachedQuotes.length;
  if(filters.hidden)return;
  const selected=qs('#quote-filter').value;
  for(const button of filters.querySelectorAll('button')){
    const [value,label]=clientViews.find(([key])=>key===button.dataset.filter);
    button.textContent=label+' ('+cachedQuotes.filter(q=>matchesFilter(q,value)).length+')';
    button.setAttribute('aria-pressed',String(selected===value));
  }
 }
 function showView(user){
  const logo=qs('header img'),consultant=user?.role==='consultant';
  logo.src=brand.logoLight;
  logo.dataset.brandImage='logoLight';
  document.querySelectorAll('.request-panel').forEach(panel=>panel.remove());
  currentUser=user;
  cachedQuotes=[];
  renderClientFilters();
  loadVersion++;
  document.body.classList.toggle('is-consultant',consultant);
  document.body.classList.toggle('is-client',user?.role==='client');
  qs('#client-sidebar').classList.toggle('hidden',user?.role!=='client');
  qs('#client-company').textContent=user?.companyName||'';
  qs('#client-person').textContent=user?.name||'';
  document.body.classList.toggle('is-authenticated',!!user);
  qs('#login').classList.toggle('hidden',!!user);
  qs('#workspace').classList.toggle('hidden',!user);
  qs('#exit').classList.toggle('hidden',!user);
  adminButton.classList.toggle('hidden',!user?.admin);
  qs('#consultant-nav').hidden=!consultant;
  setWorkspaceView(consultant);
  for(const selector of ['#cards','#queue-items','#queue-count','#empty','#workspace-message','#workspace-load']){
    qs(selector).replaceChildren();
  }
  qs('#queue-empty').hidden=true;
  qs('#quote-search').value=qs('#quote-filter').value='';
  qs('#queue-owner').value=qs('#queue-priority').value='all';
  qs('#pending-only').checked=false;
  if(!user)return;
  const preferences=qs('#company-preferences');
  preferences.textContent=user.preferences?[user.preferences.budget?'Investimento desejado: '+user.preferences.budget:'',user.preferences.criteria].filter(Boolean).join(' · '):'';
  preferences.hidden=!preferences.textContent;
  qs('#workspace-role').textContent=consultant?'Consultoria':'PORTAL DO CLIENTE · '+user.companyName;
  qs('#greeting').textContent=consultant?'Central de cotações':'Meus eventos';
  qs('#workspace-lead').textContent='';
  qs('#workspace-lead').hidden=true;
  qs('#client-hero').classList.toggle('hidden',consultant);
  qs('#list-heading').textContent=consultant?'Cotações':'Cotações';
  qs('#quote-sort').value=consultant?'action':'newest';
  void loadQuotes();
 }
 async function loadQuotes(){
  if(!currentUser)return;
  const version=++loadVersion,session=currentUser;
  const status=qs('#workspace-load');
  status.hidden=false;
  status.textContent='Atualizando solicitações…';
  try{
    const quotes=await api('/api/quotes');
    if(version!==loadVersion||session!==currentUser)return;
    cachedQuotes=quotes;
    status.hidden=true;
    renderQuotes();
    renderQueue();
  }catch(e){
    if(version===loadVersion&&session===currentUser)status.textContent=e.message+' Use Atualizar para tentar novamente.';
  }
 }
 function renderQuotes(){if(!currentUser)return;renderClientFilters();const box=qs('#cards');box.replaceChildren();const consultant=currentUser.role==='consultant',query=(qs('#quote-search')?.value||'').toLocaleLowerCase('pt-BR'),filter=qs('#quote-filter')?.value||'',pending=consultant&&qs('#pending-only')?.checked;
  let quotes=cachedQuotes.filter(q=>matchesFilter(q,filter)&&(!pending||q.operation?.pendingNote||q.progress?.actionable)&&(!query||[q.form?.eventName,q.companyName,q.protocol,String(q.protocol).padStart(6,'0')].join(' ').toLocaleLowerCase('pt-BR').includes(query)));
  if(qs('#quote-sort').value==='action')quotes.sort((a,b)=>(a.progress?.tasks?.[0]?.priority??(a.progress?.actionable?6:7))-(b.progress?.tasks?.[0]?.priority??(b.progress?.actionable?6:7))||(a.progress?.tasks?.[0]?.date||'9999').localeCompare(b.progress?.tasks?.[0]?.date||'9999')||b.created.localeCompare(a.created));else if(qs('#quote-sort').value==='oldest')quotes.sort((a,b)=>a.created.localeCompare(b.created));else if(qs('#quote-sort').value==='due')quotes.sort((a,b)=>(a.operation?.dueDate||'9999').localeCompare(b.operation?.dueDate||'9999'));else quotes.sort((a,b)=>b.created.localeCompare(a.created));
  qs('#empty').style.display=quotes.length?'none':'block';qs('#empty').textContent=cachedQuotes.length?'Nenhuma cotação encontrada para esta busca.':'Nenhuma cotação registrada ainda.';qs('#quote-count').textContent=quotes.length+' de '+cachedQuotes.length+' solicitações';
  tools.hidden=!cachedQuotes.length;qs('#refresh').hidden=!cachedQuotes.length;qs('#list-heading').hidden=!cachedQuotes.length;qs('#pending-label').hidden=!consultant;qs('#quote-sort').querySelector('[value=due]').disabled=!consultant;
  if(consultant){
    if(!quotes.length)return;
    const table=el('table','quote-table'),caption=el('caption','sr-only','Solicitações de cotação');
    const head=el('thead'),row=el('tr'),tbody=el('tbody');
    const labels=['Evento','Empresa','Situação','Responsável','Prazo interno'];
    for(const text of labels){
      const cell=el('th',null,text);
      cell.scope='col';
      row.append(cell);
    }
    head.append(row);
    table.append(caption,head,tbody);
    box.append(table);
    for(const q of quotes){
      const tr=el('tr'),event=el('td'),company=el('td',null,q.companyName),status=el('td');
      const owner=el('td',null,q.operation?.assignedName||'Sem responsável');
      const due=el('td',null,q.operation?.dueDate?dateLabel(q.operation.dueDate):'—');
      const open=el('button','quote-event-link',q.form?.eventName||'Evento sem nome');
      open.type='button';
      open.dataset.quoteId=q.id;
      open.onclick=()=>openRequest(q,open);
      event.append(open,el('span','cell-secondary','#'+String(q.protocol).padStart(6,'0')+' · '+(q.form?.destination||'Destino a definir')));
      status.append(el('span','status '+q.status,q.progress?.label||STATUSES[q.status]));
      if(!q.progress?.actionable&&q.progress?.nextAction)status.append(el('span','cell-secondary',q.progress.nextAction));
      for(const [index,cell] of [event,company,status,owner,due].entries()){
        cell.dataset.label=labels[index];
        tr.append(cell);
      }
      tbody.append(tr);
    }
    return;
  }

  for(const q of quotes){
    const card=el('article','card client-quote-row');
    const identity=el('div','client-quote-identity');
    const title=el('button','quote-event-link',q.form?.eventName||'Evento sem nome');
    title.type='button';
    title.dataset.quoteId=q.id;
    title.onclick=()=>openRequest(q,title);
    identity.append(title,el('p','cell-secondary',
      (q.form?.destination||'Destino a definir')+' · '+dateLabel(q.form?.departureDate)+' a '+dateLabel(q.form?.returnDate)),
      el('span','num','#'+String(q.protocol).padStart(6,'0')));
    const state=el('div','client-quote-state');
    state.append(el('span','status '+q.status,q.progress?.label||STATUSES[q.status]));
    if(q.progress)state.append(el('p','quote-next-action',q.progress.nextAction),
      el('span','cell-secondary','Atualizada em '+dateLabel(q.progress.lastUpdated)));
    const actions=el('div','client-quote-actions');
    if(q.commercial?.version)actions.append(proposalLink(q));
    const options=el('details','client-quote-options');
    const duplicate=el('button','duplicate-quote','Duplicar cotação');
    duplicate.type='button';
    duplicate.onclick=()=>duplicateQuote(q);
    options.append(el('summary',null,'Mais ações'),duplicate);
    actions.append(options);
    card.append(identity,state,actions);
    box.append(card);
  }
 }
 qs('#login-form').onsubmit=async(e)=>{e.preventDefault();qs('#login-error').textContent='';qs('#enter').disabled=true;try{const r=await api('/api/login','POST',{email:qs('#email').value,password:qs('#password').value}); // não compartilhar rascunhos entre empresas no mesmo navegador demo
 // Rascunhos ficam isolados por empresa na aplicação integrada.
 enterWorkspace(r.user);}catch(e){qs('#login-error').textContent=e.message;}finally{qs('#enter').disabled=false;}};
 document.querySelectorAll('[data-email]').forEach(button=>button.addEventListener('click',()=>{
  if(qs('#enter').disabled)return;
  qs('#email').value=button.dataset.email;
  qs('#password').value='Demo@2026!';
  qs('#login-form').requestSubmit();
 }));
 qs('#exit').onclick=async()=>{try{await api('/api/logout','POST',{});if(currentUser?.companyId){localStorage.removeItem(storage.draftPrefix+currentUser.companyId);sessionStorage.removeItem(storage.attemptPrefix+currentUser.companyId);}showView(null);qs('#password').value='';}catch(e){qs('#workspace-message').textContent=e.message;}};
 const preferences=el('p','workflow-preferences');preferences.id='company-preferences';preferences.hidden=true;
 qs('#client-hero').after(preferences);
 const adminButton=el('button','secondary hidden','Administração');adminButton.type='button';
 qs('#exit').before(adminButton);
 adminButton.onclick=()=>{
   if(document.querySelector('#administration'))return;
   document.querySelectorAll('.request-panel').forEach(panel=>panel.remove());
   qs('#workspace').classList.add('hidden');
   const panel=el('main','request-panel');
   const back=el('button','secondary','Voltar às cotações');back.type='button';
   back.onclick=()=>{panel.remove();qs('#workspace').classList.remove('hidden');adminButton.focus();};
   panel.append(back);
   document.body.insertBefore(panel,qs('.footer'));
   back.focus();
   QuoteWorkflow.administration(panel,api);
 };
 const resume=el('button','secondary','Retomar rascunho da conta');resume.type='button';resume.onclick=resumeAccountDraft;qs('#client-hero').append(resume);
 qs('#view-queue').onclick=()=>setWorkspaceView(true);
 qs('#view-quotes').onclick=()=>setWorkspaceView(false);
 qs('#queue-owner').onchange=qs('#queue-priority').onchange=renderQueue;
 qs('#refresh').onclick=loadQuotes;qs('#refresh').textContent='Atualizar ';qs('#list-heading').tabIndex=-1;const tools=el('div','quote-tools'),searchLabel=el('label',null,'Buscar evento, empresa ou protocolo'),search=el('input');search.id='quote-search';search.type='search';search.placeholder='Digite para buscar';searchLabel.append(search);const filterLabel=el('label',null,'Situação'),filter=el('select');filter.id='quote-filter';for(const [v,t]of [['','Todas'],['action','Com próxima ação'],['urgent','Urgentes'],['active','Em andamento'],['done','Encerradas e canceladas'],...Object.entries(STATUSES)]){const o=el('option',null,t);o.value=v;filter.append(o);}filterLabel.append(filter);const sortLabel=el('label',null,'Ordenar por'),sort=el('select');sort.id='quote-sort';for(const [v,t]of [['action','Próxima ação'],['newest','Mais recentes'],['oldest','Mais antigas'],['due','Prazo de retorno']]){const o=el('option',null,t);o.value=v;sort.append(o);}sortLabel.append(sort);const pendingLabel=el('label','pending-filter','Somente com pendência'),pending=el('input');pending.id='pending-only';pending.type='checkbox';pendingLabel.id='pending-label';pendingLabel.prepend(pending);const count=el('p','quote-count');count.id='quote-count';count.setAttribute('role','status');const advanced=el('details','quote-advanced');advanced.append(el('summary',null,'Filtros e ordenação'),filterLabel,sortLabel);tools.append(searchLabel,advanced,pendingLabel,count);qs('#cards').before(tools);search.oninput=filter.onchange=sort.onchange=pending.onchange=renderQuotes;
 const scene=qs('#scene');window.addEventListener('pointermove',e=>{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const x=(e.clientX/window.innerWidth-.5)*9,y=(e.clientY/window.innerHeight-.5)*9;scene.style.setProperty('--x',x.toFixed(1)+'px');scene.style.setProperty('--y',y.toFixed(1)+'px');},{passive:true});
 const quoteFilter=qs('#quote-filter');
 quoteFilter.add(new Option('Propostas aguardando decisão','decision'));
 for(const [value,label] of clientViews){
  const button=el('button',null,label);
  button.type='button';
  button.dataset.filter=value;
  button.setAttribute('aria-controls','cards');
  button.onclick=()=>{quoteFilter.value=value;renderQuotes();};
  qs('#client-filters').append(button);
 }
 api('/api/session').then(r=>enterWorkspace(r.user)).catch(()=>showView(null));
})();
