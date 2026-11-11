(() => {
  'use strict';
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
  const date=value=>value?new Date(value.length===10?value+'T12:00:00':value).toLocaleDateString('pt-BR'):'A definir';
  function node(tag,text,className){
    const element=document.createElement(tag);
    if(text!==undefined)element.textContent=text;
    if(className)element.className=className;
    return element;
  }
  function action(text,handler,kind='secondary'){
    const button=node('button',text,kind);
    button.type='button';
    button.onclick=handler;
    return button;
  }
  function field(parent,label,name,{type='text',value='',options,required=false}={}){
    const wrapper=node('label',label);
    const input=node(options?'select':type==='textarea'?'textarea':'input');
    input.name=name;
    input.setAttribute('aria-label',label);
    if(options){
      for(const [key,caption] of options){
        const option=node('option',caption);
        option.value=key;
        input.append(option);
      }
    }else if(type!=='textarea')input.type=type;
    if(type==='number')input.step='any';
    if(type==='checkbox')input.checked=!!value;
    else input.value=value??'';
    input.required=required;
    wrapper.append(input);
    parent.append(wrapper);
    return input;
  }
  function form(parent,caption,submit){
    const element=node('form',undefined,'workflow-form');
    const controls=node('div',undefined,'workflow-fields');
    const button=node('button',caption,'primary');
    const feedback=node('p',undefined,'workflow-feedback');
    feedback.setAttribute('role','status');
    element.append(controls,button,feedback);
    element.onsubmit=async event=>{
      event.preventDefault();
      button.disabled=true;
      feedback.textContent='';
      try{
        await submit(Object.fromEntries(new FormData(element)),element);
        feedback.textContent='Alteração registrada.';
      }catch(error){feedback.textContent=error.message;}
      finally{button.disabled=false;}
    };
    parent.append(element);
    return controls;
  }
  function group(parent,id,title){
    const section=node('section',undefined,'workflow-section');
    section.id=id;
    section.append(node('h2',title));
    parent.append(section);
    return section;
  }
  function disclosure(parent,title){
    const details=node('details',undefined,'workflow-details');
    details.append(node('summary',title));
    parent.append(details);
    return details;
  }
  function offerLabel(offer){
    return offer.option.name+' · '+money(offer.totalCents);
  }
  function catalogEditor(parent,q,api,reload,existing){
    const details=disclosure(parent,existing?'Editar '+existing.name:'Cadastrar fornecedor');
    const fields=form(details,'Salvar fornecedor',async(values,element)=>{
      await api('/api/supplier-catalog/'+q.companyId,'POST',{
        ...values,id:existing?.id,active:element.elements.active.checked
      });
      await reload();
    });
    field(fields,'Categoria','service',{options:Object.entries({
      hotel:'Hospedagem',air:'Aéreo',transfer:'Transfer',venue:'Salas e alimentação',food:'Alimentação',insurance:'Seguro'
    }),value:existing?.service||'hotel'});
    for(const [label,name,type,required] of [
      ['Nome','name','text',true],['Cidade','city','text',true],['Endereço','address'],['Descrição e estrutura','description','textarea'],
      ['Capacidade informada','capacity','number'],['Latitude','latitude','number'],['Longitude','longitude','number'],['Foto pública (HTTPS)','photo','url'],
      ['Fonte do cadastro','source','text',true],['Verificado em','checkedAt','date',true],['Contato interno','contact']
    ])field(fields,label,name,{type,value:existing?.[name],required});
    field(fields,'Disponível para seleção','active',{type:'checkbox',value:existing?.active??true});
  }
  function map(parent,supplier){
    if(supplier.latitude===null||supplier.longitude===null)return;
    const {latitude:lat,longitude:lon}=supplier;
    const show=action('Ver no mapa',()=>{
      const url=new URL('https://www.openstreetmap.org/export/embed.html');
      url.searchParams.set('bbox',[lon-.012,lat-.008,lon+.012,lat+.008].join(','));
      url.searchParams.set('layer','mapnik');
      url.searchParams.set('marker',lat+','+lon);
      const frame=node('iframe');
      frame.title='Mapa de '+supplier.name;
      frame.referrerPolicy='no-referrer';
      frame.loading='lazy';
      frame.src=url.href;
      const link=node('a','Abrir mapa em nova aba');
      link.href='https://www.openstreetmap.org/?mlat='+lat+'&mlon='+lon+'#map=15/'+lat+'/'+lon;
      link.target='_blank';
      link.rel='noopener noreferrer';
      show.replaceWith(frame,link);
    });
    parent.append(show);
  }
  async function sourcing(parent,q,user,api,onChange){
    const internal=user.role==='consultant';
    const root=group(parent,'request-sourcing',internal?'Fornecedores':'Hotéis');
    const url='/api/quotes/'+q.id+'/sourcing';
    const content=node('div');
    const heading=root.firstChild;
    root.append(content);
    const chosen=new Set();
    async function reload(){
      const catalogWasOpen=content.querySelector('.supplier-catalog')?.open;
      content.replaceChildren(node('p','Carregando fornecedores…'));
      try{
        const data=await api(url);
        if(!root.isConnected)return;
        render(data,catalogWasOpen);
        await onChange?.();
      }catch(error){content.replaceChildren(node('p',error.message));}
    }
    function render(data,catalogWasOpen){
      content.replaceChildren();
      const context=data.briefing;
      content.append(node('p',[context.destination,date(context.startDate)+' a '+date(context.endDate),
        (context.people||'A definir')+' participantes',context.rooms+' quartos informados'].join(' · ')));
      if(context.budget||context.hotelPreferences?.length)content.append(node('p',[context.budget?'Investimento deste evento: '+context.budget:'',...(context.hotelPreferences||[])].filter(Boolean).join(' · ')));
      if(data.preferences.budget||data.preferences.criteria){
        content.append(node('p',[data.preferences.budget?'Investimento desejado: '+data.preferences.budget:'',data.preferences.criteria].filter(Boolean).join(' · ')));
      }
      const catalog=disclosure(content,internal?'Catálogo e novas solicitações':'Escolher hotéis');
      catalog.classList.add('supplier-catalog');
      catalog.open=catalogWasOpen??(!internal&&!data.requests.length);
      if(internal)catalogEditor(catalog,q,api,reload);
      if(!internal&&!context.hotel){
        catalog.append(node('p','A seleção de hotéis está disponível para cotações com hospedagem no briefing.'));
      }else if(!data.closed){
        const search=field(catalog,'Filtrar por nome ou cidade','hotelSearch',{type:'search'});
        const list=node('div',undefined,'workflow-grid');
        const basket=node('div',undefined,'workflow-basket');
        const feedback=node('p');
        feedback.setAttribute('role','status');
        const requestButton=action('Solicitar orçamento',async()=>{
          requestButton.disabled=true;
          try{
            await api(url+'/request','POST',{supplierIds:[...chosen]});
            chosen.clear();
            await reload();
          }catch(error){feedback.textContent=error.message;requestButton.disabled=false;}
        },'primary');
        const updateBasket=()=>{
          requestButton.textContent=chosen.size?'Solicitar orçamento de '+chosen.size+' '+(internal?(chosen.size===1?'fornecedor':'fornecedores'):(chosen.size===1?'hotel':'hotéis')):'Solicitar orçamento';
          requestButton.disabled=!chosen.size;
        };
        basket.append(requestButton,feedback);
        catalog.append(list,basket);
        const refreshCatalog=()=>{
          const query=search.value.trim().toLocaleLowerCase('pt-BR');
          list.replaceChildren();
          for(const supplier of data.suppliers.filter(item=>[item.name,item.city,item.address].join(' ').toLocaleLowerCase('pt-BR').includes(query))){
            const card=node('article',undefined,'workflow-card');
            if(supplier.photo){
              const img=node('img');
              img.src=supplier.photo;
              img.alt='Foto de '+supplier.name;
              img.loading='lazy';
              img.referrerPolicy='no-referrer';
              card.append(img);
            }
            card.append(node('h3',supplier.name),node('p',supplier.city+' · '+data.services[supplier.service]));
            if(supplier.demo)card.append(node('p','Cadastro fictício de demonstração.'));
            if(!internal)card.append(node('p','Valores e disponibilidade mediante cotação.'));
            const details=disclosure(card,'Ver estrutura e localização');
            details.append(node('p',supplier.address||'Endereço a confirmar'),node('p',supplier.description||'Estrutura a confirmar'),
              node('p',supplier.capacity?'Capacidade informada: '+supplier.capacity+' pessoas. Confirme a configuração da sala.':'Capacidade a confirmar'),
              node('p','Fonte: '+supplier.source+(supplier.checkedAt?' · '+date(supplier.checkedAt):'')));
            map(details,supplier);
            if(internal){
              if(supplier.contact)details.append(node('p','Contato: '+supplier.contact));
              catalogEditor(details,q,api,reload,supplier);
            }
            const registered=data.requests.find(r=>r.supplier.id===supplier.id);
            if(registered)card.append(node('p',data.states[registered.state]));
            else if(supplier.active!==false){
              const select=field(card,'Selecionar '+supplier.name,'select',{type:'checkbox',value:chosen.has(supplier.id)});
              select.onchange=()=>{
                if(select.checked)chosen.add(supplier.id);
                else chosen.delete(supplier.id);
                updateBasket();
              };
            }
            list.append(card);
          }
          if(!list.children.length)list.append(node('p','Nenhum fornecedor encontrado.'));
        };
        search.oninput=refreshCatalog;
        refreshCatalog();
        updateBasket();
      }
      const tracking=group(content,'supplier-tracking','Pedidos de orçamento');
      content.insertBefore(tracking,catalog);
      if(!data.requests.length)tracking.append(node('p','Nenhum pedido registrado.'));
      for(const request of data.requests){
        const item=disclosure(tracking,request.supplier.name+' · '+data.states[request.state]);
        item.id='supplier-request-'+request.id;
        item.append(node('p','Registrado em '+date(request.requestedAt)));
        if(!internal||data.closed||request.state==='cancelled')continue;
        const call=(kind,body)=>api(url+'/'+kind,'POST',{...body,requestId:request.id,expectedRevision:request.revision});
        if(request.state==='requested'){
          const fields=form(item,'Registrar envio realizado',async values=>{
            await call('send',{...values,confirmSent:values.confirmSent==='on'});
            await reload();
          });
          field(fields,'Comprovante ou referência do envio','evidence',{required:true});
          field(fields,'O pedido já foi encaminhado ao fornecedor','confirmSent',{type:'checkbox',required:true});
          field(fields,'Data interna para cobrar retorno (opcional)','followUpOn',{type:'date'});
        }else{
          item.append(node('p','Referência de envio: '+request.evidence));
          if(request.briefing)item.append(node('p','Briefing encaminhado: '+request.briefing.destination+' · '+date(request.briefing.startDate)+' a '+date(request.briefing.endDate)+' · '+request.briefing.people+' participantes · '+request.briefing.rooms+' quartos'));
          if(request.state==='sent'){
            const followUp=disclosure(item,'Acompanhamento do retorno de '+request.supplier.name);
            followUp.id='supplier-follow-up-'+request.id;
            followUp.append(node('p',request.followUpOn?'Cobrança programada para '+date(request.followUpOn)+'.':'Aguardando resposta. Nenhuma cobrança programada.'));
            const fields=form(followUp,'Salvar data de cobrança',async values=>{
              await call('follow-up',values);
              await reload();
            });
            field(fields,'Data interna para cobrar retorno','followUpOn',{type:'date',value:request.followUpOn,required:true});
            if(request.followUpOn)form(followUp,'Concluir cobrança',async()=>{
              await call('follow-up',{followUpOn:null});
              await reload();
            });
          }
          const entry=disclosure(item,'Registrar resposta do fornecedor');
          const fields=form(entry,'Salvar resposta',async values=>{await call('offer',values);await reload();});
          const hotel=request.supplier.service==='hotel';
          for(const [label,name,type,value] of [
            ['Item cotado','item','text',''],['Preço unitário NET (R$)','unitPrice','text',''],[hotel?'Quartos':'Quantidade','quantity','number',hotel?context.rooms:'1'],
            ['Validade','validUntil','date',''],['Condições de pagamento e cancelamento','conditions','textarea','']
          ])field(fields,label,name,{type,value,required:true});
          if(hotel){
            field(fields,'Check-in','startDate',{type:'date',value:context.startDate,required:true});
            field(fields,'Check-out','endDate',{type:'date',value:context.endDate,required:true});
            field(fields,'Ocupação por quarto','occupancy',{type:'number',required:true});
          }else field(fields,'Ocorrências','units',{type:'number',value:'1',required:true});
          field(fields,'Taxas do fornecedor','taxMode',{options:[['none','Sem taxa adicional'],['included','Inclusas'],['added','Adicionar percentual']],value:'none'});
          field(fields,'Taxa adicional (%)','taxPercent',{type:'number',value:'0'});
          field(fields,'Disponibilidade','availability',{options:[['pending','A confirmar'],['confirmed','Confirmada na resposta'],['unavailable','Indisponível']],value:'pending'});
          field(fields,'Inclusões e ressalvas','inclusions',{type:'textarea'});
          for(const [index,offer] of request.offers.entries()){
            const details=disclosure(item,offerLabel(offer)+(offer.reviewedAt?' · validada':''));
            details.id='supplier-offer-'+offer.id;
            details.append(node('p',offer.option.conditions),node('p',offer.option.description),node('p','Válida até '+date(offer.validUntil)));
            if(index===0&&request.state==='responded'){
              form(details,'Validar esta resposta',async()=>{await call('validate',{offerId:offer.id});await reload();});
            }
          }
        }
        const cancel=disclosure(item,'Cancelar pedido');
        const fields=form(cancel,'Confirmar cancelamento',async values=>{await call('cancel',values);await reload();});
        field(fields,'Motivo','reason',{required:true});
      }
      if(internal)comparison(disclosure(content,'Comparar respostas validadas'),data,q);
    }
    async function load(){
      try{render(await api(url));}
      catch(error){content.replaceChildren(node('p',error.message));}
    }
    await load();
    return heading;
  }
  function comparison(parent,data,q){
    const section=group(parent,'request-budget','Orçamento e comparação');
    const offers=data.requests.filter(r=>r.state==='validated'&&r.offers[0]?.reviewedAt)
      .map(request=>({...request.offers[0],supplier:request.supplier}));
    if(!offers.length){section.append(node('p','As respostas validadas aparecerão aqui.'));return;}
    const type=field(section,'Comparar serviço','compareService',{options:[...new Set(offers.map(o=>o.supplier.service))].map(key=>[key,data.services[key]])});
    const table=node('div',undefined,'workflow-grid');
    const render=()=>{
      table.replaceChildren();
      for(const offer of offers.filter(o=>o.supplier.service===type.value)){
        const card=node('article',undefined,'workflow-card');
        const row=offer.option.rows[0];
        card.append(node('h3',offer.supplier.name),node('strong',money(offer.totalCents)),
          node('p',row.quantity+' unidades × '+offer.units+' períodos · '+(row.occupancy?'ocupação '+row.occupancy:'BRL')),
          node('p','Válida até '+date(offer.validUntil)),node('p',offer.option.description),node('p',offer.option.conditions));
        if(row.startDate){
          card.append(node('p',date(row.startDate)+' a '+date(row.endDate)));
          const differences=[];
          if(row.startDate!==data.briefing.startDate||row.endDate!==data.briefing.endDate)differences.push('período');
          if(data.briefing.rooms&&Number(row.quantity)!==data.briefing.rooms)differences.push('quartos');
          if(data.briefing.people&&Number(row.quantity)*Number(row.occupancy)<Number(data.briefing.people))differences.push('capacidade');
          if(differences.length)card.append(node('p','Diferença em relação ao briefing: '+differences.join(', ')+'.','workflow-feedback'));
        }
        if(offer.validUntil<new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
          card.append(node('p','Resposta vencida. Solicite atualização antes de publicar.'));
          table.append(card);
          continue;
        }
        const link=node('a','Preparar proposta com esta resposta');
        link.href='/assets/proposal/index.html?quote='+encodeURIComponent(q.id)+'&offer='+encodeURIComponent(offer.id);
        card.append(link);
        table.append(card);
      }
    };
    type.value=offers[0].supplier.service;
    type.onchange=render;
    section.append(table);
    render();
  }
  async function administration(parent,api){
    const root=group(parent,'administration','Administração');
    const content=node('div');
    root.append(content);
    async function reload(){
      const data=await api('/api/administration');
      content.replaceChildren();
      const companies=data.companies.map(c=>[c.id,c.name]);
      const companiesArea=group(content,'admin-companies','Empresas e preferências');
      for(const c of [null,...data.companies]){
        const details=disclosure(companiesArea,c?c.name:'Cadastrar empresa');
        const fields=form(details,'Salvar empresa',async values=>{await api('/api/administration/company','POST',{...values,id:c?.id});await reload();});
        for(const [label,name,type] of [['Nome','name','text'],['CNPJ','cnpj','text'],['Faixa de investimento desejada','budget','text'],['Preferências de contratação','criteria','textarea']]){
          field(fields,label,name,{type,value:c?.[name],required:name==='name'});
        }
      }
      const accounts=group(content,'admin-users','Usuários e permissões');
      for(const u of [null,...data.users]){
        const details=disclosure(accounts,u?u.name+' · '+u.email:'Cadastrar usuário');
        const fields=form(details,'Salvar usuário',async (values,element)=>{
          await api('/api/administration/user','POST',{
            ...values,id:u?.id,companyId:Number(values.companyId)||null,
            active:element.elements.active.checked,
            companies:companies.map(([id])=>id).filter(id=>element.elements['company-'+id].checked)
          });
          await reload();
        });
        field(fields,'Nome','name',{value:u?.name,required:true});
        field(fields,'E-mail','email',{type:'email',value:u?.email,required:true});
        field(fields,'Perfil','role',{options:[['client','Cliente'],['consultant','Consultor']],value:u?.role||'client'});
        field(fields,'Empresa do cliente','companyId',{options:[['','Selecione'],...companies],value:u?.company_id});
        field(fields,'Permissão de aprovação','approval',{options:[['none','Solicitante'],['company','Aprovador da empresa'],['assigned','Aprovador designado']],value:u?.approval||'none'});
        field(fields,u?'Nova senha (opcional)':'Senha (mínimo de 12 caracteres)','password',{type:'password',required:!u});
        field(fields,'Usuário ativo','active',{type:'checkbox',value:u?.active??true});
        for(const [id,name] of companies)field(fields,'Carteira do consultor: '+name,'company-'+id,{type:'checkbox',value:u?.companies.includes(id)});
      }
      const grants=group(content,'admin-grants','Responsáveis e aprovadores por cotação');
      if(data.quotes.length){
        const quotes=data.quotes.map(q=>[q.id,'#'+String(q.protocol).padStart(6,'0')+' · '+(data.companies.find(c=>c.id===q.company_id)?.name||'')]);
        const approvers=data.users.filter(u=>u.role==='client'&&u.approval==='assigned').map(u=>[u.id,u.name]);
        if(approvers.length){
          const fields=form(grants,'Salvar vínculo de aprovação',async values=>{
            await api('/api/administration/grant','POST',{quoteId:values.quoteId,userId:Number(values.userId),granted:values.granted==='on'});
            await reload();
          });
          field(fields,'Cotação','quoteId',{options:quotes,value:quotes[0][0]});
          field(fields,'Aprovador designado','userId',{options:approvers,value:approvers[0][0]});
          field(fields,'Autorizar aprovação','granted',{type:'checkbox',value:true});
        }
        const assignees=data.users.filter(u=>u.role==='consultant'&&u.active).map(u=>[u.id,u.name]);
        const fields=form(grants,'Salvar responsável',async values=>{
          await api('/api/administration/assign','POST',{quoteId:values.quoteId,userId:Number(values.userId)||null});
          await reload();
        });
        field(fields,'Cotação','quoteId',{options:quotes,value:quotes[0][0]});
        field(fields,'Responsável','userId',{options:[['','Sem responsável'],...assignees]});
        for(const grant of data.grants){
          const q=quotes.find(([id])=>id===grant.quote_id)?.[1];
          const u=data.users.find(x=>x.id===grant.user_id);
          if(q&&u)grants.append(node('p',q+' · '+u.name));
        }
      }else grants.append(node('p','Atribuições ficam disponíveis quando houver cotações.'));
      const audit=disclosure(content,'Histórico de administração');
      const actions={company:'Empresa atualizada',user:'Usuário atualizado',grant:'Permissão por cotação alterada',assign:'Responsável atualizado'};
      for(const item of data.audit)audit.append(node('p',date(item.created_at)+' · '+item.name+' · '+actions[item.action]));
    }
    try{await reload();}catch(error){content.append(node('p',error.message));}
  }
  function progress(parent,q,user,api,reload){
    const root=group(parent,'request-progress','Visão geral');
    root.append(node('strong',q.progress.label),node('p',q.progress.nextAction,'progress-next-action'));
    if(q.progress.lastUpdated)root.append(node('p','Última atualização: '+date(q.progress.lastUpdated)));
    const url='/api/quotes/'+q.id+'/workflow';
    const complement=q.progress.complement;
    if(complement){
      root.append(node('p',complement.prompt));
      if(user.role==='client'){
        const fields=form(root,'Enviar complementação',async values=>{
          const {answer,...extras}=values;
          const changes=Object.fromEntries(Object.entries(extras).filter(([,value])=>value!==''));
          await api(url+'/answer','POST',{complementId:complement.id,answer,fields:changes});
          await reload();
        });
        field(fields,'Resposta à equipe','answer',{type:'textarea',required:true});
        const extra=disclosure(fields,'Atualizar dados do briefing');
        for(const [label,key,type] of [
          ['Destino','destination','text'],['Início','departureDate','date'],['Término','returnDate','date'],['Participantes','totalPassengers','number'],
          ['Quartos single','roomsSingle','number'],['Quartos duplos twin','roomsDoubleTwin','number'],['Quartos casal','roomsDoubleCasal','number'],['Quartos triplos','roomsTriple','number']
        ])field(extra,label,key,{type});
      }
    }else if(user.role==='consultant'&&['received','analysis','quoting','consolidating'].includes(q.status)){
      const detail=disclosure(root,'Pedir complementação');
      const fields=form(detail,'Solicitar ao cliente',async values=>{await api(url+'/complement','POST',values);await reload();});
      field(fields,'Informação necessária','prompt',{type:'textarea',required:true});
      const edit=disclosure(root,'Complementar briefing pela equipe');
      const editFields=form(edit,'Salvar complemento',async values=>{
        const {reason,...changes}=values;
        const fields=Object.fromEntries(Object.entries(changes).filter(([,value])=>value!==''));
        await api(url+'/amend','POST',{reason,fields,expectedLastUpdated:q.progress.lastUpdated});
        await reload();
      });
      field(editFields,'Motivo do complemento','reason',{required:true});
      for(const [label,name,type] of [
        ['Destino','destination','text'],['Início','departureDate','date'],['Término','returnDate','date'],
        ['Participantes','totalPassengers','number'],['Quartos single','roomsSingle','number'],
        ['Quartos duplos twin','roomsDoubleTwin','number'],['Quartos casal','roomsDoubleCasal','number'],['Quartos triplos','roomsTriple','number']
      ])field(editFields,label,name,{type});

    }
  }
  function proposalFeedback(parent,entries,resolve){
    if(!entries?.length)return;
    const list=disclosure(parent,'Observações do cliente');
    list.id='request-proposal-feedback';
    for(const entry of entries){
      const block=node('div',undefined,'workflow-card');
      block.id='request-proposal-feedback-'+entry.id;
      block.append(node('h3','Versão '+entry.version+' · '+entry.name),
        node('p',entry.note),node('p',entry.resolved_at?'Analisada pela equipe':'Aguardando análise'));
      if(!entry.resolved_at)form(block,'Marcar observação como analisada',async()=>{
        await resolve(entry.id);
        block.querySelector('form').remove();
        block.querySelector('p:last-of-type').textContent='Analisada pela equipe';
        const title=block.querySelector('h3');
        title.tabIndex=-1;
        title.focus({preventScroll:true});
      });
      list.append(block);
    }
  }
  function attention(parent,tasks,onNavigate){
    parent.replaceChildren();
    parent.hidden=!tasks?.length;
    if(parent.hidden)return;
    const title=node('h2','Próximas ações');
    title.tabIndex=-1;
    parent.append(title);
    const list=node('ul',undefined,'attention-list');
    parent.append(list);
    const rest=tasks.length>2?disclosure(parent,'Ver outras pendências ('+(tasks.length-2)+')'):null;
    const restList=node('ul',undefined,'attention-list');
    if(rest)rest.append(restList);
    for(const [index,task] of tasks.entries()){
      const item=node('li');
      const copy=node('div');
      copy.append(node('strong',task.label));
      if(task.date)copy.append(node('span',(task.dateType==='received'?'Recebimento: ':'Prazo: ')+date(task.date),'cell-secondary'));
      const caption=({review:'Abrir revisão',feedback:'Ler observação','supplier-response':'Ver resposta',
        'supplier-follow-up':'Abrir cobrança','supplier-deadline':'Ver condições','supplier-request':'Ver pedido',
        operation:'Ver acompanhamento',return:'Ver acompanhamento'})[task.kind]||'Abrir tarefa';
      const button=action(caption,()=>onNavigate(task.target),index===0?'primary attention-link':'attention-link');
      button.setAttribute('aria-label',caption+' — '+task.label);
      if(task.priority<=2)button.dataset.urgent='true';
      item.append(copy,button);
      (index<2?list:restList).append(item);
    }
  }

  window.QuoteWorkflow={sourcing,administration,progress,group,date,proposalFeedback,attention};
})();
