(()=>{
  const {calculate,selectionTotal,perPerson}=window.ProposalRules;
  const row=(name,price,quantity,units='1',extra={})=>({name,unitPrice:price,quantity,units,taxPercent:'0',taxMode:'none',state:'priced',...extra});
  const option=(id,name,supplier,rows,extra={})=>({id,name,supplier,currency:'BRL',feePercent:'0',feeBase:'withTaxes',description:'',conditions:'Valores fictícios. Disponibilidade e condições serão confirmadas pelo consultor.',rows,...extra});
  const initial={event:'Encontro de lideranças',people:'50',validUntil:'',version:1,groups:[
    {id:'air',name:'Aéreo',service:'air',optional:false,description:'Compare tarifa, taxas, horários e bagagem por passageiro.',options:[
      option('air-a','LATAM · voo direto','LATAM',[row('Tarifa aérea','900','30','1',{category:'fare'}),row('Taxa de embarque','100','30','1',{category:'boarding'})],{description:'Ida e volta · horários a confirmar\nOrigem  destino\nBagagem: 1 mala de mão. Exemplo fictício.'}),
      option('air-b','GOL · voo com conexão','GOL',[row('Tarifa aérea','780','30','1',{category:'fare'}),row('Taxa de embarque','120','30','1',{category:'boarding'})],{description:'Ida e volta · uma conexão\nOrigem  conexão  destino\nBagagem: 1 mala de mão. Exemplo fictício.'})]},
    {id:'hotel',name:'Hospedagem',service:'hotel',optional:false,description:'Compare o valor da diária por quarto e confira quantos hóspedes cada opção atende.',options:[
      option('hotel-a','Hotel Transamérica X','Hotel Transamérica X',[row('Apartamento duplo','300','15','2',{unit:'quartos',startDate:'2026-11-20',endDate:'2026-11-22',taxMode:'added',taxPercent:'5',occupancy:'2'}),row('Café da manhã incluso','','30','2',{state:'included',unit:'pessoas'})],{description:'Localização próxima ao evento\nCafé da manhã incluso\nCheck-in: 14h · check-out: 12h'}),
      option('hotel-b','Hotel Comfort Y','Hotel Comfort Y',[row('Apartamento duplo','330','15','2',{unit:'quartos',startDate:'2026-11-20',endDate:'2026-11-22',taxMode:'added',taxPercent:'5',occupancy:'2'}),row('Café da manhã incluso','','30','2',{state:'included',unit:'pessoas'})],{description:'Localização central\nCafé da manhã incluso\nCheck-in: 14h · check-out: 12h'})]},
    {id:'transfer',name:'Transfer',service:'transfer',optional:false,description:'30 passageiros · compare o valor por veículo e por trecho, com a capacidade claramente indicada.',options:[
      option('transfer-a','Transfer A','Transfer A',[row('Van executiva · até 15 passageiros','450','2','1',{unit:'veículos'})],{description:'Aeroporto  hotel · um trecho\n2 vans para até 30 passageiros\nBagagem e horário a confirmar com o consultor.'}),
      option('transfer-b','Transfer B','Transfer B',[row('Micro-ônibus · até 30 passageiros','850','1','1',{unit:'veículos'})],{description:'Aeroporto  hotel · um trecho\n1 micro-ônibus para até 30 passageiros\nBagagem e horário a confirmar com o consultor.'})]},
    {id:'food',name:'Alimentação',service:'food',optional:false,description:'Confira o valor por pessoa e a quantidade de refeições.',options:[option('food-a','Almoço do grupo','Fornecedor fictício',[row('Almoço','70','50','1',{unit:'pessoas',taxMode:'added',taxPercent:'5'})],{description:'Uma refeição por participante. Cardápio será detalhado em uma próxima etapa do projeto.'})]},
    {id:'insurance',name:'Seguro viagem',service:'insurance',optional:true,description:'Serviço opcional. Escolha incluir ou continuar sem seguro nesta proposta.',options:[option('insurance-a','Seguro para o período completo','Seguradora fictícia',[row('Seguro viagem','150','30','1',{unit:'pessoas'})],{description:'30 viajantes · período completo\nCoberturas a preencher pelo consultor. Não incluso no aéreo.'})]}
  ]};
  let data=initial,choices={},view='client',editorStep=0,clientStep=0,section='details',optionIndex=0,confirmed=false,editingChoice=false,inputEditing=false;
  const quoteId=new URLSearchParams(location.search).get('quote');
  let live=null,liveUser=null,draftRevision=0,latestVersion=0,viewVersion=0,liveLocked=false,busy=false;
  const commercialUrl=()=>'/api/quotes/'+quoteId+'/commercial';
  async function remote(action,body){const r=await fetch(commercialUrl()+action,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const result=await r.json();if(!r.ok)throw Error(result.error||'Falha na proposta.');return result;}
  async function saveRemote(){const r=await remote('/draft',{expectedRevision:draftRevision,data});draftRevision=r.revision;}
  let key='event_system_proposal_prototype_brl_steps_v3';
  // Rascunhos anteriores, inclusive em outras moedas, ficam preservados na chave v1.
  try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.schema===3&&saved.data?.groups?.length)data=saved.data;}catch{}
  const $=s=>document.querySelector(s);
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
  const cents=s=>Math.round(Number(String(s).replace(',','.'))*100);
  const date=s=>s?s.split('-').reverse().join('/'):'A confirmar';
  function button(text,fn,cls='small-button'){const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;}
  function input(parent,label,value,change,type='text',items){
    const wrap=el('label',label),c=el(items?'select':type==='textarea'?'textarea':'input');
    if(items)for(const [v,text]of items){const o=el('option',text);o.value=v;c.append(o);}else if(type!=='textarea'){c.type=type;if(type==='number'){c.min='0';c.step='any';}}
    c.value=value??'';
    // Mantém o rascunho atualizado durante a digitação, sem recriar o campo a cada tecla.
    if(!items)c.oninput=()=>{inputEditing=true;try{change(c.value);confirmed=false;}finally{inputEditing=false;}};
    c.onchange=()=>{inputEditing=true;try{change(c.value);confirmed=false;}finally{inputEditing=false;}if(items)render();};wrap.append(c);parent.append(wrap);return c;
  }
  function rerender(){data.version++;confirmed=false;if(!inputEditing)render();}
  function move(next){if(view==='editor')editorStep=next;else clientStep=next;section='details';optionIndex=0;render();window.scrollTo({top:0,behavior:'instant'});$('#screen-title')?.focus({preventScroll:true});}
  function screen(main,label,title,description){main.append(el('span',label,'eyebrow'));const h=el('h1',title);h.id='screen-title';h.tabIndex=-1;main.append(h);if(description)main.append(el('p',description,'intro'));}
  function smallTotals(target,result,label='Total do grupo'){
    if(!result.valid){target.append(el('p',result.error,'error'));return;}
    const d=el('dl',undefined,'totals');
    for(const [name,value]of [['Serviços',result.base],['Taxas adicionais do fornecedor',result.tax],['Agenciamento',result.fee],[result.pending?'Subtotal conhecido':label,result.total]])d.append(el('dt',name),el('dd',money(value)));
    target.append(d);if(result.pending)target.append(el('p','Valor final a confirmar. Pendências não são consideradas gratuitas.','error'));
  }
  function save(main){
    const feedback=el('p',undefined,'version');feedback.setAttribute('role','status');
    const saveButton=button(quoteId?'Salvar rascunho na conta':'Salvar rascunho',async()=>{if(busy)return;busy=true;saveButton.disabled=true;try{if(quoteId){await saveRemote();feedback.textContent='Rascunho salvo. O cliente continua vendo somente a versão publicada.';}else{localStorage.setItem(key,JSON.stringify({schema:3,data}));feedback.textContent='Rascunho salvo somente neste navegador.';}}catch(e){feedback.textContent=e.message;}finally{busy=false;saveButton.disabled=false;}},'link-button');main.append(saveButton,feedback);
    if(quoteId&&editorStep===data.groups.length+1){const publish=button('Publicar nova versão',async()=>{if(busy||!window.confirm('Publicar esta versão para análise do cliente? A versão e os aceites anteriores serão preservados.'))return;busy=true;publish.disabled=true;try{await saveRemote();const r=await remote('/publish',{expectedRevision:draftRevision,expectedVersion:latestVersion});latestVersion=r.version;live=await remote('');$('#content .live-version-banner strong').textContent='Rascunho privado · última publicação: v'+latestVersion;feedback.textContent='Versão '+r.version+' publicada para o cliente.';}catch(e){feedback.textContent=e.message;}finally{busy=false;publish.disabled=false;}},'primary');main.append(publish);}
  }
  function pager(main,step,total,nextLabel,canAdvance=true){
    const footer=el('div',undefined,'screen-footer');
    const back=button(' Voltar',()=>move(step-1));back.disabled=step===0;
    const next=button(view==='client'&&editingChoice?'Voltar à revisão ':nextLabel,()=>{const destination=view==='client'&&editingChoice?data.groups.length:step+1;editingChoice=false;move(destination);},'primary');next.disabled=!canAdvance;
    footer.append(back,el('span',(step+1)+' de '+total,'version'),next);main.append(footer);
  }
  function editor(main){
    const total=data.groups.length+2;
    if(editorStep===0){
      screen(main,'CONSULTOR · DADOS DA PROPOSTA','Prepare a proposta','Defina o contexto. Depois, preencha um serviço de cada vez.');
      const card=el('section',undefined,'option'),grid=el('div',undefined,'grid');
      input(grid,'Evento',data.event,v=>data.event=v);input(grid,'Participantes no evento',data.people,v=>data.people=v,'number');input(grid,'Validade da proposta',data.validUntil,v=>data.validUntil=v,'date');card.append(grid,el('p','Valores exclusivamente em reais. A quantidade atendida é definida em cada serviço.','supplier-detail'));main.append(card);save(main);pager(main,0,total,'Preencher serviços ');return;
    }
    if(editorStep===total-1){
      screen(main,'CONSULTOR · REVISÃO','Confira antes de apresentar','Cada alternativa tem seu próprio preço. O cliente escolherá uma opção em cada serviço.');
      for(const g of data.groups){const card=el('section',undefined,'option');card.append(el('h2',g.name));for(const o of g.options){const r=calculate(o),line=el('div',undefined,'review-choice');line.append(el('span',o.name),el('strong',r.valid?(r.pending?'A confirmar · subtotal '+money(r.total):money(r.total)+' para o grupo'):'Preenchimento pendente'));card.append(line);}card.append(button('Editar '+g.name.toLowerCase(),()=>move(data.groups.indexOf(g)+1),'link-button'));main.append(card);}
      main.append(el('p','Cardápio e outras moedas estão previstos para etapas futuras.','notice'));save(main);
      const bar=el('div',undefined,'screen-footer');bar.append(button(' Voltar',()=>move(editorStep-1)),button('Ver como cliente',()=>switchView('client'),'primary'));main.append(bar);return;
    }
    const g=data.groups[editorStep-1];optionIndex=Math.min(optionIndex,g.options.length-1);const o=g.options[optionIndex];
    screen(main,'CONSULTOR · '+g.name.toUpperCase(),'Prepare as opções de '+g.name.toLowerCase(),'Uma alternativa de cada vez. O cliente verá os valores unitários e poderá comparar as opções.');
    const optionBar=el('div',undefined,'option-switch');
    input(optionBar,'Alternativa em edição',o.id,v=>{optionIndex=g.options.findIndex(x=>x.id===v);render();},'text',g.options.map(x=>[x.id,x.name]));
    optionBar.append(button('+ Nova alternativa',()=>{g.options.push(option(crypto.randomUUID(),'Nova alternativa','',g.service==='air'?[row('Tarifa aérea','','30','1',{category:'fare'}),row('Taxa de embarque','','30','1',{category:'boarding'})]:[row('Novo item','','','1',{unit:'unidades'})]));optionIndex=g.options.length-1;section='details';rerender();}));if(g.options.length>1){
      optionBar.append(button('Remover alternativa',()=>{
        if(!window.confirm('Remover esta alternativa do rascunho?'))return;
        g.options.splice(optionIndex,1);
        optionIndex=0;
        render();
      },'link-button'));
    }
    main.append(optionBar);
    const tabs=el('nav',undefined,'section-tabs');for(const [id,name]of [['details','Detalhes'],['prices','Valores'],['conditions','Condições']]){const b=button(name,()=>{section=id;render();});b.setAttribute('aria-pressed',String(section===id));tabs.append(b);}main.append(tabs);
    const card=el('section',undefined,'option'),grid=el('div',undefined,'grid');
    if(section==='details'){
      input(grid,'Título da opção',o.name,v=>o.name=v);input(grid,'Fornecedor',o.supplier,v=>o.supplier=v);
      const desc=el('div',undefined,'wide');input(desc,g.service==='air'?'Itinerário, horários, conexões e bagagem':g.service==='hotel'?'Localização, regime e horários do hotel':'Descrição do serviço',o.description,v=>o.description=v,'textarea');grid.append(desc);card.append(grid);
      if(g.service==='food')card.append(el('p','O detalhamento de cardápio será desenvolvido em uma próxima etapa.','notice'));
      card.append(button('Preencher valores ',()=>{section='prices';render();},'small-button'));
    }else if(section==='prices'){
      if(g.service==='air')input(grid,'Passageiros desta opção',o.rows.find(x=>x.state==='priced')?.quantity||'',v=>{for(const r of o.rows){r.quantity=v;r.units='1';}rerender();},'number');
      input(grid,'Agenciamento (%) · zero se não houver',o.feePercent,v=>{o.feePercent=v;rerender();},'number');
      input(grid,'Base do agenciamento',o.feeBase,v=>{o.feeBase=v;rerender();},'text',[['withTaxes','Serviços + taxas adicionais'],['withoutTaxes','Serviços antes das taxas adicionais']]);card.append(grid);
      o.rows.forEach((r,i)=>{
        if(g.service==='air'&&r.category==='boarding')return;
        const block=el('div',undefined,'row-editor'),fields=el('div',undefined,'grid');
        input(fields,g.service==='hotel'?'Tipo de acomodação ou item':'Descrição do item',r.name,v=>r.name=v);if(g.service==='hotel')block.append(el('p','Exemplos: apartamento single, duplo ou triplo. Adicione uma acomodação para cada tipo.','supplier-detail'));
        if(g.service==='air')input(fields,'Tipo de custo',r.category||'other',v=>{r.category=v;rerender();},'text',[['fare','Tarifa aérea'],['boarding','Taxa de embarque'],['other','Outro custo por pessoa']]);
        input(fields,'Cobrança',r.state,v=>{r.state=v;rerender();},'text',[['priced','Informar valor'],['included','Incluso no pacote'],['pending','Consultar valor']]);
        if(r.state==='priced'){
          if(g.service==='air'&&r.category==='fare'){let boarding=o.rows.find(x=>x.category==='boarding');if(!boarding){boarding=row('Taxa de embarque','',r.quantity,'1',{category:'boarding'});o.rows.push(boarding);}input(fields,'Taxa de embarque por pessoa (R$)',boarding.unitPrice,v=>{boarding.unitPrice=v;rerender();},'number');}
          input(fields,g.service==='air'?'Passagem por pessoa (R$)':g.service==='hotel'?'Diária por quarto (R$)':'Valor unitário (R$)',r.unitPrice,v=>{r.unitPrice=v;rerender();},'number');
          if(g.service==='air'&&r.category==='fare'){const pair=el('div',undefined,'wide grid');pair.style.gridTemplateColumns='repeat(2,minmax(0,1fr))';const fareField=fields.lastElementChild,taxField=fareField.previousElementSibling;pair.append(fareField,taxField);fields.append(pair);}
          if(g.service!=='air')input(fields,g.service==='hotel'?'Quantidade de quartos':g.service==='transfer'?'Quantidade de veículos':g.service==='venue'?'Quantidade de unidades':'Quantidade de pessoas',r.quantity,v=>{r.quantity=v;rerender();},'number');
          if(g.service==='hotel'){input(fields,'Check-in',r.startDate,v=>{r.startDate=v;rerender();},'date');input(fields,'Check-out',r.endDate,v=>{r.endDate=v;rerender();},'date');input(fields,'Hóspedes por quarto',r.occupancy||'',v=>r.occupancy=v,'number');}
          else if(g.service!=='air')input(fields,g.service==='transfer'?'Quantidade de trechos':g.service==='food'?'Refeições por pessoa':'Quantidade de períodos',r.units,v=>{r.units=v;rerender();},'number');
          input(fields,'Taxa adicional do fornecedor',r.taxMode,v=>{r.taxMode=v;rerender();},'text',[['none','Não se aplica'],['included','Já incluída no valor'],['added','Acrescentar ao valor']]);
          if(r.taxMode!=='none')input(fields,'Taxa do fornecedor (%)',r.taxPercent,v=>{r.taxPercent=v;rerender();},'number');
        }
        block.append(fields,button('Remover item',()=>{o.rows.splice(i,1);rerender();},'link-button'));card.append(block);
      });
      card.append(button(g.service==='hotel'?'+ Adicionar acomodação':'+ Adicionar item',()=>{o.rows.push(row('Novo item','',g.service==='air'?(o.rows[0]?.quantity||'30'):'','1',{unit:g.service==='hotel'?'quartos':'pessoas',category:'other'}));rerender();}));
      if(Number(data.people)>0){const priced=o.rows.filter(x=>x.state==='priced');const exceeds=g.service==='hotel'?priced.reduce((n,x)=>n+Number(x.quantity)*Number(x.occupancy||1),0)>Number(data.people):g.service==='air'&&Number(priced[0]?.quantity)>Number(data.people);if(exceeds)card.append(el('p','Confira a quantidade: esta opção atende mais pessoas que o total informado para o evento.','notice'));}if(g.service==='air')airPrice(card,o);else smallTotals(card,calculate(o));
    }else{
      input(grid,'Condições desta alternativa',o.conditions,v=>o.conditions=v,'textarea');card.append(grid,el('p','Descreva validade, pagamento, disponibilidade e cancelamento conforme a oferta do fornecedor.','supplier-detail'));
    }
    main.append(card);save(main);pager(main,editorStep,total,editorStep===data.groups.length?'Revisar proposta ':'Próximo serviço ');
  }
  function unitRows(target,rows){const dl=el('dl',undefined,'unit-breakdown');for(const [name,value]of rows){dl.append(el('dt',name),el('dd',money(value)));}target.append(dl);}
  function airPrice(card,o){
    const unit=perPerson(o);if(!unit.valid){card.append(el('p',unit.error,'error'));return;}
    const hero=el('div',undefined,'unit-hero');hero.append(el('span',unit.approximate?'Total por pessoa · aproximado':'Total por pessoa'),el('strong',money(unit.total)),el('small',unit.people+' passageiros nesta opção'));card.append(hero);
    const breakdown=[['Tarifa por pessoa',unit.fare],['Taxa de embarque por pessoa',unit.boarding]];
    if(unit.other)breakdown.push(['Outros custos por pessoa',unit.other]);if(unit.supplierTax)breakdown.push(['Taxas adicionais por pessoa',unit.supplierTax]);if(unit.fee)breakdown.push(['Agenciamento por pessoa',unit.fee]);unitRows(card,breakdown);
    card.append(el('p','Total do grupo: '+money(unit.groupTotal),'group-price'));
    if(unit.approximate)card.append(el('p','O rateio de taxas ou agenciamento gera frações de centavo. O total do grupo preserva o valor exato.','supplier-detail'));
  }
  function itemDetails(card,o,g){
    const r=calculate(o);if(!r.valid){card.append(el('p',r.error,'error'));return;}
    for(let i=0;i<o.rows.length;i++){
      const item=o.rows[i],v=r.lines[i],block=el('div',undefined,'unit-item');block.append(el('strong',item.name));
      if(item.state==='included')block.append(el('span','Incluso · sem cobrança adicional','tag'));
      else if(item.state==='pending')block.append(el('span','Valor ou cortesia a confirmar','error'));
      else{
        const label=g.service==='hotel'?'por quarto / diária':g.service==='food'?'por pessoa / refeição':g.service==='transfer'?'por veículo / trecho':g.service==='venue'?'por unidade / período':'por pessoa / período';
        block.append(el('p',money(cents(item.unitPrice))+' '+label,'item-unit'));
        if(item.taxMode==='added')block.append(el('p','Taxa por unidade: '+money(Math.floor(cents(item.unitPrice)*Number(item.taxPercent)/100+.5))+' ('+item.taxPercent+'%)','supplier-detail'));
        else block.append(el('p',item.taxMode==='included'?'Taxa do fornecedor já incluída.':'Sem taxa adicional do fornecedor.','supplier-detail'));
        block.append(el('p',g.service==='hotel'?item.quantity+' quartos · '+(item.occupancy?item.occupancy+' hóspedes por quarto · ':'')+v.units+' diárias · '+date(item.startDate)+' a '+date(item.endDate):item.quantity+(g.service==='transfer'?' veículo(s) · ':' pessoas · ')+v.units+(g.service==='transfer'?' trecho(s)':' ocorrência(s)'),'supplier-detail'));
      }card.append(block);
    }
    card.append(el('p',r.pending?(r.total?'Subtotal conhecido: '+money(r.total)+' · total a confirmar':'Total a confirmar'):'Total do grupo: '+money(r.total),'group-price'));
    if(r.fee)card.append(el('p','Agenciamento do grupo: '+money(r.fee)+' · incluso no total acima.','supplier-detail'));
    if(r.pending)card.append(el('p','Esta opção ainda não tem um preço final confirmado.','error'));
  }
  const publicOption=o=>Object.hasOwn(o,'saleTotalCents');
  const displayPrice=o=>publicOption(o)
    ? {valid:Number.isSafeInteger(o.saleTotalCents),pending:false,total:o.saleTotalCents,totalBRL:o.saleTotalCents}
    : calculate(o);
  function displayDetails(card,o,g){
    if(!publicOption(o)&&!quoteId){
      if(g.service==='air')airPrice(card,o);
      else itemDetails(card,o,g);
      return;
    }
    const pricing=displayPrice(o);
    if(g.service==='air'){
      const passengers=Number(o.rows.find(row=>row.state==='priced')?.quantity);
      if(passengers>0&&pricing.valid){
        const each=Math.round(pricing.total/passengers);
        card.append(el('p',money(each)+' por pessoa'+(pricing.total%passengers?' · valor aproximado':'')+' · '+passengers+' passageiros','supplier-detail'));
      }
    }
    for(const row of o.rows){
      const parts=[row.name];
      if(row.state==='included')parts.push('Incluso');
      else if(g.service==='hotel')parts.push(row.quantity+' quartos',row.units+' diárias',row.occupancy+' hóspedes por quarto',date(row.startDate)+' a '+date(row.endDate));
      else if(g.service!=='air')parts.push(row.quantity+' unidades',row.units+' períodos');
      card.append(el('p',parts.join(' · '),'supplier-detail'));
    }
  }
  const displaySelection=()=>selectionTotal(data.groups,choices,displayPrice);
  function reviewRequest(main){
    if(!quoteId||liveUser.role!=='client'||viewVersion!==latestVersion||liveLocked||!live.canReview)return;
    const wrap=el('details',undefined,'option');
    wrap.append(el('summary','Solicitar revisão da versão '+viewVersion));
    const form=el('form');
    const note=input(form,'O que precisa mudar?','',()=>{},'textarea');
    note.onchange=null;
    note.oninput=null;
    note.required=true;
    note.maxLength=2000;
    const feedback=el('p');
    feedback.setAttribute('role','status');
    const submit=el('button','Enviar pedido de revisão','primary');
    form.append(submit,feedback);
    form.onsubmit=async event=>{
      event.preventDefault();
      if(busy)return;
      busy=true;
      submit.disabled=true;
      try{
        await remote('/review',{version:viewVersion,note:note.value});
        live=await remote('');
        loadVersion(live.versions[0]);
        render();
      }catch(error){feedback.textContent=error.message;}
      finally{busy=false;submit.disabled=false;}
    };
    wrap.append(form);
    main.append(wrap);
  }
  function feedbackPanel(main){
    if(!quoteId||liveUser.role!=='client'||!viewVersion)return;
    const comments=(live.feedback||[]).filter(entry=>entry.version===viewVersion);
    if(!comments.length&&(!live.open||viewVersion!==latestVersion))return;
    const wrap=el('details',undefined,'option');
    wrap.append(el('summary','Observações e pedidos de alteração'));
    for(const entry of comments)wrap.append(el('p',entry.name+' · '+entry.note+(entry.resolved_at?' · Analisada':' · Aguardando análise')));
    if(live.open&&viewVersion===latestVersion){
      const form=el('form');
      const note=input(form,'Alteração sugerida','',()=>{},'textarea');
      note.onchange=null;
      note.oninput=null;
      note.required=true;
      note.maxLength=2000;
      const submit=el('button','Enviar observação','secondary');
      const feedback=el('p');
      feedback.setAttribute('role','status');
      form.append(submit,feedback);
      form.onsubmit=async event=>{
        event.preventDefault();
        submit.disabled=true;
        try{
          await remote('/feedback',{version:viewVersion,note:note.value});
          live=await remote('');
          render();
        }catch(error){feedback.textContent=error.message;}
        finally{submit.disabled=false;}
      };
      wrap.append(form);
    }
    main.append(wrap);
  }
  function loadVersion(version){
    data=structuredClone(version.data);
    viewVersion=version.version;
    choices=version.approval?.choices||{};
    confirmed=!!version.approval;
    liveLocked=confirmed||!!version.review||viewVersion!==latestVersion;
    clientStep=0;
  }
  function customer(main){
    const total=data.groups.length+1;
    if(clientStep===data.groups.length){review(main);return;}
    const g=data.groups[clientStep];
    screen(main,'SUA PROPOSTA · '+(clientStep+1)+' DE '+total,'Escolha '+(g.service==='air'?'seu aéreo':g.service==='hotel'?'sua hospedagem':g.service==='food'?'a alimentação':g.service==='transfer'?'seu transfer':g.service==='venue'?'seu espaço':'o seguro'),g.description);
    main.append(el('p',data.event+' · '+(data.people||'Quantidade a definir')+' participantes no evento · valores em reais','screen-context'));
    if(g.optional){const skip=button('Continuar sem este serviço',()=>{choices[g.id]='none';confirmed=false;const destination=editingChoice?data.groups.length:clientStep+1;editingChoice=false;move(destination);},choices[g.id]==='none'?'primary':'small-button');skip.disabled=liveLocked;main.append(skip);}
    const cards=el('div',undefined,'choices-grid');
    for(const o of g.options){
      const result=displayPrice(o),valid=result.valid&&!result.pending,card=el('article',undefined,'option'+(choices[g.id]===o.id?' selected':''));
      card.append(el('span',o.name,'eyebrow'),el('h2',o.supplier||'Fornecedor a informar'));const headline=el('div',undefined,'group-total-hero');headline.append(el('span','Total do grupo'),el('strong',result.valid&&!result.pending?money(result.total):'A confirmar'));card.append(headline);const selectedOption=g.options.find(x=>x.id===choices[g.id]);if(selectedOption&&selectedOption.id!==o.id){const chosen=displayPrice(selectedOption);if(chosen.valid&&!chosen.pending&&result.valid&&!result.pending){const diff=result.total-chosen.total;card.append(el('p',(diff>0?'+':diff<0?'−':'')+money(Math.abs(diff))+' em relação à sua escolha','price-difference'));}}
      displayDetails(card,o,g);
      const details=el('details',undefined,'option-details');details.append(el('summary',g.service==='air'?'Ver itinerário, bagagem e condições':'Ver detalhes e condições'),el('p',o.description,'supplier-detail'),el('p',o.conditions,'conditions'));card.append(details);
      const label=el('label',undefined,'selection'),radio=el('input');radio.type='radio';radio.name=g.id;radio.value=o.id;radio.checked=choices[g.id]===o.id;radio.disabled=!valid||liveLocked;
      radio.onchange=()=>{choices[g.id]=o.id;confirmed=false;render();document.querySelector('input[name="'+g.id+'"]:checked')?.focus({preventScroll:true});};label.append(radio,el('span','Escolher '+o.name));card.append(label);const heading=el('div',undefined,'alternative-heading'),pricing=el('div',undefined,'alternative-pricing');const first=card.children[0],second=card.children[1];heading.append(first,second);for(const child of [...card.children])if(child!==details&&child!==label)pricing.append(child);card.replaceChildren(heading,pricing,details,label);card.onclick=e=>{if(e.target.closest('button,a,input,label,details,select,textarea'))return;if(!radio.disabled)radio.click();};cards.append(card);
    }main.append(cards);
    const selected=choices[g.id]==='none'&&g.optional||g.options.some(o=>o.id===choices[g.id]&&displayPrice(o).valid&&!displayPrice(o).pending);
    if(!selected)main.append(el('p',g.optional?'Escolha uma opção ou continue sem este serviço.':'Selecione uma opção para continuar.','selection-help'));
    pager(main,clientStep,total,clientStep===data.groups.length-1?'Revisar escolhas ':'Continuar ',selected||liveLocked);
  }
  function review(main){
    screen(main,'SUA PROPOSTA · REVISÃO','Confira suas escolhas','Cada serviço mantém sua quantidade. Revise os valores antes de confirmar.');
    const cards=el('div',undefined,'review-grid');
    for(const [index,g]of data.groups.entries()){
      const card=el('article',undefined,'option'),o=g.options.find(x=>x.id===choices[g.id]);card.append(el('h2',g.name));
      if(!o)card.append(el('p',g.optional&&choices[g.id]==='none'?'Não incluído':'Escolha pendente','supplier-detail'));
      else{
        card.append(el('p',o.name,'supplier-detail'));
        const r=displayPrice(o),u=!quoteId&&g.service==='air'?perPerson(o):null,first=!quoteId&&o.rows.find(x=>x.state==='priced');
        if(u?.valid)card.append(el('p',money(u.total)+' por pessoa · '+u.people+' passageiros','review-unit'));
        else if(first)card.append(el('p',money(cents(first.unitPrice))+(g.service==='hotel'?' por quarto / diária':g.service==='transfer'?' por veículo / trecho':g.service==='food'?' por pessoa / refeição':' por pessoa / período'),'review-unit'));
        card.append(el('p',r.valid?'Total do grupo: '+money(r.total):'Valor a conferir','group-price'));
        const details=el('details',undefined,'option-details');details.append(el('summary','Conferir composição do preço'));displayDetails(details,o,g);card.append(details);
      }
      if(!liveLocked){const change=button('Alterar escolha',()=>{editingChoice=true;move(index);},'link-button');change.setAttribute('aria-label','Alterar escolha de '+g.name);card.append(change);}
      cards.append(card);
    }
    main.append(cards);
    const total=displaySelection(),box=el('section',undefined,'summary');box.append(el('h2',total.complete?'Total das suas escolhas':'Total parcial das escolhas'),el('strong',money(total.total)),el('p','Consolidado dos serviços selecionados. As alternativas não escolhidas ficam fora deste total.'));
    if(!quoteId){
    let services=0,agency=0;for(const g of data.groups){const o=g.options.find(x=>x.id===choices[g.id]);if(o){const r=calculate(o);if(r.valid){services+=r.subtotal;agency+=r.fee;}}}const breakdown=el('dl',undefined,'totals');for(const [label,value]of [['Serviços e taxas dos fornecedores',services],['Taxa da agência',agency],['Total geral',total.total]])breakdown.append(el('dt',label),el('dd',money(value)));box.append(breakdown);
    }
    const feedback=el('p');feedback.setAttribute('role','status');const consent=el('label',undefined,'approval-consent'),check=el('input');check.type='checkbox';consent.append(check,el('span','Li os serviços, valores e condições e aprovo explicitamente a versão '+viewVersion+'.'));
    const confirm=button(confirmed?'Versão aprovada':quoteId?'Aprovar versão '+viewVersion:'Confirmar minhas escolhas',async()=>{if(quoteId){if(liveUser.role!=='client'||!live.canApprove||!check.checked||busy)return;busy=true;confirm.disabled=true;try{const result=await remote('/approve',{version:viewVersion,choices,confirm:true});const accepted=live.versions.find(version=>version.version===viewVersion);
      accepted.approval={approvedAt:result.approvedAt,approvedBy:result.approvedBy,totalCents:result.totalCents,choices:{...choices}};
      confirmed=true;
      liveLocked=true;
      render();}catch(e){feedback.textContent=e.message;confirm.disabled=false;}finally{busy=false;}}else{confirmed=true;render();}},'primary');
    const canDecide=quoteId&&liveUser.role==='client'&&live.canApprove&&!liveLocked&&viewVersion===latestVersion;
    confirm.disabled=quoteId||!total.complete||confirmed;
    if(canDecide){
      check.onchange=()=>confirm.disabled=!check.checked||!total.complete||liveLocked;
      box.append(consent,confirm);
    }else if(!quoteId||confirmed){
      box.append(confirm);
    }else{
      box.append(el('p','Consulte no cabeçalho a situação da versão e a próxima ação.'));
    }
    box.append(feedback);
    if(quoteId&&confirmed)box.append(el('p','Versão '+viewVersion+' aprovada. Total registrado: '+money(total.total)));
    if(quoteId)box.append(el('p','O aceite comercial fica registrado nesta versão. A disponibilidade depende da confirmação dos fornecedores.'));
    main.append(box,button(' Voltar ao último serviço',()=>move(data.groups.length-1),'link-button'));


  }
  function switchView(next){view=next;render();window.scrollTo({top:0,behavior:'instant'});}
  function render(){
    const main=$('#content');
    main.replaceChildren();
    $('#editor-tab').setAttribute('aria-pressed',String(view==='editor'));
    $('#client-tab').setAttribute('aria-pressed',String(view==='client'));
    if(quoteId){
      const banner=el('section',undefined,'live-version-banner');
      const current=live?.versions?.find(version=>version.version===viewVersion);
      banner.append(el('strong',view==='editor'?'Rascunho privado · última publicação: v'+latestVersion:
        'Proposta v'+viewVersion+(current?.approval?' · aprovada':current?.review?' · em revisão':liveLocked?' · versão anterior':'')));
      if(view==='client'&&live?.versions?.length){
        input(banner,'Versão apresentada',viewVersion,value=>{
          const version=live.versions.find(v=>v.version===Number(value));
          if(!version)return;
          loadVersion(version);
          render();
        },'text',live.versions.map(v=>[v.version,'Versão '+v.version+(v.approval?' · aprovada':v.review?' · revisão solicitada':v.version===latestVersion?' · atual':' · substituída')]));
      }
      if(view==='client'&&current?.approval){
        banner.append(el('p','Aprovada por '+current.approval.approvedBy+' em '+new Date(current.approval.approvedAt).toLocaleString('pt-BR')+' · '+money(current.approval.totalCents)));
      }
      if(current?.review)banner.append(el('p','Revisão solicitada por '+current.review.requestedBy+': '+current.review.note));
      if(view==='client'&&!live.canApprove&&!liveLocked&&liveUser.role==='client'){
        banner.append(el('p',live.canReview?'A proposta venceu. Solicite uma versão atualizada.':'A decisão está reservada ao aprovador autorizado da empresa.'));
      }
      main.append(banner);
      if(view==='client'){reviewRequest(main);feedbackPanel(main);}
    }
    (view==='editor'?editor:customer)(main);
  }
  $('#editor-tab').onclick=()=>switchView('editor');$('#client-tab').onclick=()=>switchView('client');
  async function boot(){if(!quoteId){render();return;}const main=$('#content');main.textContent='Carregando a proposta…';try{
    const session=await fetch('/api/session').then(r=>r.json());if(!session.user)throw Error('Entre no portal para acessar esta proposta.');liveUser=session.user;live=await remote('');latestVersion=live.versions[0]?.version||0;draftRevision=live.draft?.revision||0;
    const response=await fetch('/api/quotes/'+encodeURIComponent(quoteId));if(!response.ok)throw Error('Solicitação indisponível.');const q=await response.json();
    if(liveUser.role==='consultant'){
      data=live.draft?.data||live.versions[0]?.data;
      if(!data){data={event:q.form.eventName,people:q.form.totalPassengers||'',validUntil:'',groups:[]};for(const [flag,service,name]of [['svcAereo','air','Aéreo'],['svcHospedagem','hotel','Hospedagem'],['svcEspacoAlimentacao','venue','Salas e alimentação'],['svcTransfers','transfer','Transfer']])if(q.form[flag]){const item=option(service+'-1','Opção 1','',service==='air'?[row('Tarifa aérea','',q.form.totalPassengers||'','1',{category:'fare'}),row('Taxa de embarque','',q.form.totalPassengers||'','1',{category:'boarding'})]:[row('Serviço','',service==='hotel'?'':q.form.totalPassengers||'','1',{unit:service==='hotel'?'quartos':'unidades'})],{conditions:''});data.groups.push({id:service,name,service,optional:false,description:'',options:[item]});}}
      const offerId=new URLSearchParams(location.search).get('offer');
      if(offerId){
        const response=await fetch('/api/quotes/'+encodeURIComponent(quoteId)+'/sourcing');
        if(!response.ok)throw Error('Resposta do fornecedor indisponível.');
        const sourcing=await response.json();
        const request=sourcing.requests.find(item=>item.state==='validated'&&item.offers[0]?.id===offerId);
        if(!request)throw Error('A resposta selecionada não está mais validada.');
        const offer=request.offers[0];
        const sourceOption={...offer.option,sourceOfferId:offerId};
        const existing=data.groups.find(group=>group.service===request.supplier.service);
        if(existing){
          if(!existing.options.some(option=>option.sourceOfferId===offerId)){
            const blank=existing.options.length===1&&!existing.options[0].supplier&&!existing.options[0].rows.some(row=>row.unitPrice);
            if(blank)existing.options=[sourceOption];
            else existing.options.push(sourceOption);
          }
        }else data.groups.push({id:request.supplier.service,service:request.supplier.service,
          name:sourcing.services[request.supplier.service],description:'',optional:false,options:[sourceOption]});
        if(!data.validUntil||data.validUntil>offer.validUntil)data.validUntil=offer.validUntil;
      }
      if(!data.groups.length)throw Error('Não há serviços selecionados no briefing.');
      view='editor';
    }else{if(!latestVersion)throw Error('A proposta ainda está em preparação.');loadVersion(live.versions[0]);view='client';$('#editor-tab').hidden=true;}
    const header=document.querySelector('header');header.querySelector('small').textContent='PROPOSTA DA COTAÇÃO #'+String(q.protocol).padStart(6,'0');header.querySelector('p').textContent='Compare os serviços e confira as condições da versão apresentada.';const back=el('a',' Voltar às cotações','portal-back');back.href='/portal.html';header.prepend(back);render();
   }catch(error){main.textContent=error.message;const back=el('a','Voltar ao portal');back.href='/portal.html';main.append(back);$('#editor-tab').hidden=true;$('#client-tab').hidden=true;}}boot();
})();
