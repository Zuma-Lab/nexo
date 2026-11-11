const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../portal.js'),'utf8');
function setup(fail=false){
 const calls=[];let reloads=0;const workspace={};
 const el=(tag,cl,text)=>({tag,cl,textContent:text,children:[],append(...nodes){this.children.push(...nodes)},setAttribute(){},focus(){this.focused=true}});
 const scope={el,STATUSES:{received:'Recebida',quoting:'Em cotação'},qs:()=>workspace,api:async(...args)=>{calls.push(args);if(fail)throw Error('Sem conexão')},loadQuotes:async()=>{reloads++}};
 const fn=vm.runInNewContext('('+source.slice(source.indexOf(' function statusEditor(q){'),source.indexOf(' function showView('))+')',scope);
 const section=fn({id:'sample',protocol:'1',status:'received'});
 const [,select,panel]=section.children,[message,actions,feedback]=panel.children,[confirm,cancel]=actions.children;
 return {calls,select,panel,message,feedback,confirm,cancel,reloads:()=>reloads};
}
test('selecting and cancelling a status never publishes it; only confirmation sends PATCH',async()=>{
 const x=setup();x.select.value='quoting';x.select.onchange();assert.equal(x.calls.length,0);assert.equal(x.panel.hidden,false);assert.match(x.message.textContent,/Recebida.*Em cotação/);
 x.cancel.onclick();assert.equal(x.select.value,'received');assert.equal(x.panel.hidden,true);assert.equal(x.calls.length,0);
 x.select.value='quoting';x.select.onchange();await x.confirm.onclick();assert.equal(x.calls.length,1);assert.equal(x.calls[0][1],'PATCH');assert.equal(x.calls[0][2].status,'quoting');assert.equal(x.reloads(),1);
});
test('a failed status publication remains pending and available to retry',async()=>{
 const x=setup(true);x.select.value='quoting';x.select.onchange();await x.confirm.onclick();assert.equal(x.reloads(),0);assert.equal(x.feedback.textContent,'Sem conexão');assert.equal(x.panel.hidden,false);assert.equal(x.select.disabled,false);
});
