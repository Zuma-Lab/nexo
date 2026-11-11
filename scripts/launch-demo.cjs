'use strict';
const {spawn}=require('node:child_process');
const {createApp}=require('../backend/demo.cjs');

function launch({port=Number(process.env.PORT||8000),database=process.env.PAYTRACK_DEMO_DB_PATH,open=true}={}) {
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Porta inválida.');
  const app=createApp({database});
  let alternate=false;
  app.server.on('error',error=>{
    if(error.code==='EADDRINUSE'&&!alternate){
      alternate=true;
      console.log('A porta habitual está ocupada. Abrindo este projeto em outra porta local.');
      app.server.listen(0,'127.0.0.1');
    }else{console.error('Não foi possível iniciar o teste:',error.message);app.db.close();process.exitCode=1;}
  });
  app.server.once('listening',()=>{
    const url='http://127.0.0.1:'+app.server.address().port+'/';
    console.log('Portal do Projeto Eventos: '+url);
    console.log('Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.');
    if(open)spawn('cmd.exe',['/c','start','',url],{stdio:'ignore',windowsHide:true}).unref();
  });
  app.server.listen(port,'127.0.0.1');
  const stop=()=>app.server.close(()=>{app.db.close();process.exit(0);});
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  return app;
}
if(require.main===module)launch({open:!process.argv.includes('--no-open')});
module.exports={launch};
