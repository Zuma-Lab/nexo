'use strict';
// Isolated browser regression: never opens or mutates the demonstration database.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const {createApp}=require('../backend/demo.cjs');
const {calculate}=require('../assets/proposal/proposal-rules.js');
const out=path.resolve(process.argv[2]||'evidencias/piloto-proposta-20261121/depois');
const fixture=()=>({event:'Encontro corporativo fictício',people:'10',validUntil:'2099-12-31',groups:[{
  id:'hotel',service:'hotel',name:'Hospedagem',optional:false,description:'Compare as opções de hospedagem.',options:['A','B'].map((name,index)=>({
    id:'hotel-'+name,name:'Opção '+name,supplier:'Hotel fictício '+name,currency:'BRL',feePercent:'10',feeBase:'withTaxes',
    description:'Café da manhã incluído. Dados exclusivamente fictícios.',conditions:'Pagamento e cancelamento conforme oferta fictícia.',
    rows:[{name:'Quarto duplo',state:'priced',unitPrice:index?'150.00':'100.01',quantity:'5',units:'2',startDate:'2099-12-20',endDate:'2099-12-22',occupancy:'2',taxMode:'added',taxPercent:'5'}]
  }))
}]});
async function run(){
  fs.mkdirSync(out,{recursive:true});
  const app=createApp({database:':memory:'});
  let browser;
  try{
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+app.server.address().port;
    browser=await chromium.launch({channel:'chrome',headless:true});
    const client=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const consultant=await browser.newContext({baseURL:origin,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const beta=await browser.newContext({baseURL:origin});
    for(const [context,email]of [[client,'maria@alpha.demo'],[consultant,'consultor@paytrack.demo'],[beta,'joao@beta.demo']]){
      const response=await context.request.post('/api/login',{data:{email,password:'Demo@2026!'}});assert.equal(response.status(),200);
    }
    const created=await client.request.post('/api/quotes',{data:{key:crypto.randomUUID(),summary:'Teste isolado',form:{eventName:'Encontro corporativo fictício',companyName:'Empresa Alpha Demo',requesterName:'Pessoa fictícia',email:'teste@example.test',destination:'São Paulo - SP',datesUnknown:true,participantsUnknown:true,svcHospedagem:true}}});
    assert.equal(created.status(),200);
    const quote=(await created.json()).id,route='/api/quotes/'+quote+'/commercial',url='/assets/proposal/index.html?quote='+quote;
    const seed=await consultant.request.post(route+'/draft',{data:{data:fixture(),expectedRevision:0}});assert.equal(seed.status(),200);
    const page=await consultant.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);
    await page.getByRole('button',{name:'Etapa 2: Hospedagem',exact:true}).click();
    await page.getByRole('button',{name:'Valores',exact:true}).click();
    await page.getByLabel('Diária por quarto (R$)',{exact:true}).fill('120.01');
    const draft=fixture();draft.groups[0].options[0].rows[0].unitPrice='120.01';
    const expected=calculate(draft.groups[0].options[0]).total;
    assert.equal(expected,138612);
    await page.waitForFunction(()=>document.querySelector('.editor-summary-total strong')?.textContent.replace(/\s/g,'')==='R$1.386,12');
    assert.match(await page.locator('#save-state').innerText(),/não salvas/);
    // A pending value must remain pending instead of becoming a free service.
    await page.getByLabel('Cobrança',{exact:true}).selectOption('pending');
    assert.match(await page.locator('#editor-price-summary').innerText(),/Subtotal conhecido/);
    assert.match(await page.locator('#editor-price-summary').innerText(),/não são consideradas gratuitas/);
    await page.getByLabel('Cobrança',{exact:true}).selectOption('priced');
    for(const width of [375,320]){
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:path.join(out,'consultor-valores.png'),fullPage:true});
    await page.getByRole('button',{name:'Visão do cliente',exact:true}).click();
    assert.equal(await page.getByText('Prévia do rascunho',{exact:true}).count(),1);
    assert.equal(await page.getByLabel('Versão apresentada',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Voltar à edição',exact:true}).click();
    assert.equal(await page.getByLabel('Diária por quarto (R$)',{exact:true}).inputValue(),'120.01');
    await page.getByRole('button',{name:'Salvar rascunho na conta',exact:true}).click();
    await page.getByText('Rascunho salvo na conta.',{exact:true}).waitFor();
    await page.locator('#proposal-actions').getByRole('button',{name:'Revisar proposta',exact:true}).click();
    page.on('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'Publicar nova versão',exact:true}).click();
    await page.getByText('Versão 1 publicada para o cliente.',{exact:true}).waitFor();
    const customer=await client.newPage();customer.on('pageerror',error=>errors.push(error.message));
    await customer.goto(url);
    await customer.locator('.choices-grid').waitFor();
    assert.equal(await customer.getByRole('button',{name:'Preencher proposta',exact:true}).isVisible(),false);
    assert.equal(await customer.locator('.proposal-actions button').count(),0);
    await customer.screenshot({path:path.join(out,'cliente-comparacao.png'),fullPage:true});
    const visible=await (await client.request.get(route)).json();
    assert.equal(visible.draft,null);
    assert.equal(visible.versions[0].data.groups[0].options[0].saleTotalCents,expected);
    assert.equal(Object.hasOwn(visible.versions[0].data.groups[0].options[0].rows[0],'unitPrice'),false);
    assert.equal((await beta.request.get(route)).status(),404);
    assert.equal((await beta.request.get('/api/quotes/'+quote)).status(),404);
    assert.equal((await client.request.post(route+'/draft',{data:{data:fixture(),expectedRevision:2}})).status(),403);
    await customer.getByRole('radio',{name:'Escolher Opção A',exact:true}).check();
    await customer.locator('.screen-footer').getByRole('button',{name:'Revisar escolhas',exact:true}).click();
    const approval=customer.getByRole('button',{name:'Aprovar versão 1',exact:true});assert.equal(await approval.isDisabled(),true);
    await customer.getByLabel('Li os serviços, valores e condições e aprovo explicitamente a versão 1.',{exact:true}).check();
    await approval.click();
    await customer.getByText('Versão 1 aprovada. Total registrado:',{exact:false}).waitFor();
    await customer.screenshot({path:path.join(out,'cliente-aprovacao.png'),fullPage:true});
    // A later draft never rewrites a previously accepted commercial version.
    const state=await (await consultant.request.get(route)).json();
    draft.groups[0].options[0].rows[0].unitPrice='140.01';
    const revised=await consultant.request.post(route+'/draft',{data:{expectedRevision:state.draft.revision,data:draft}});assert.equal(revised.status(),200);
    const published=await consultant.request.post(route+'/publish',{data:{expectedRevision:(await revised.json()).revision,expectedVersion:1}});assert.equal(published.status(),200);
    await customer.reload();
    await customer.getByLabel('Versão apresentada',{exact:true}).selectOption('1');
    const after=await (await client.request.get(route)).json();
    assert.equal(after.versions.find(v=>v.version===1).approval.totalCents,expected);
    assert.equal(after.versions.find(v=>v.version===1).data.groups[0].options[0].saleTotalCents,expected);
    for(const width of [375,320]){
      await customer.setViewportSize({width,height:900});
      assert.equal(await customer.evaluate(()=>document.documentElement.scrollWidth),width);
    }
    await customer.screenshot({path:path.join(out,'cliente-celular.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: cálculo durante edição, pendências, prévia, salvar/publicar, aprovação explícita, versões imutáveis, permissões, segregação por ID e responsividade 320/375px.');
  }finally{
    if(browser)await browser.close();
    if(app.server.listening)await new Promise(resolve=>app.server.close(resolve));app.db.close();
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
