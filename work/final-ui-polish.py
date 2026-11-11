from pathlib import Path
p=Path('assets/proposal/proposal-demo.js');s=p.read_text(encoding='utf-8').replace("live=await remote('');feedback.textContent='Versão '","live=await remote('');$('#content .live-version-banner strong').textContent='Rascunho privado · última publicação: v'+latestVersion;feedback.textContent='Versão '")
s=s.replace("confirmed=true;liveLocked=true;feedback.textContent=", "confirmed=true;liveLocked=true;check.disabled=true;main.querySelectorAll('.review-grid button').forEach(b=>b.disabled=true);$('#content .live-version-banner strong').textContent='Proposta v'+viewVersion+' · aprovada';feedback.textContent=")
s=s.replace("data.people+' participantes no evento", "(data.people||'Quantidade a definir')+' participantes no evento")
p.write_text(s,encoding='utf-8')
p=Path('assets/proposal/index.html');s=p.read_text(encoding='utf-8');extra=s[s.rfind('<style>'):];s=s[:s.rfind('<style>')];s=s.replace('</head>',extra+'\n</head>');s=s.replace('</head>','<style>.screen-footer{position:static;inset:auto;width:auto;max-width:none;margin:24px 0 0;padding:20px 0;background:var(--theme-surface);box-shadow:none}</style></head>');p.write_text(s,encoding='utf-8')
