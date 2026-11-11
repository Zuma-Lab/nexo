# Projeto Eventos — sistema próprio (nome provisório)

Sistema de planejamento e acompanhamento de grupos e eventos. A aparência atual é um tema provisório; identidade e informações operacionais estão centralizadas em system-config.js. Veja ORGANIZACAO-DO-SISTEMA.md para entender o que alterar.

## Executar

Requer Node.js 24 ou superior. Execute `Iniciar-Projeto-Eventos.cmd` para abrir a página inicial no navegador. O atalho `Iniciar-Paytrack.cmd` continua compatível. Se a porta 8000 estiver ocupada, o inicializador usa uma porta local livre e abre o endereço correspondente. Mantenha a janela aberta durante o teste. Com `npm start`, acesse `http://localhost:8000/portal.html`. O fluxo principal usa `backend/demo.cjs`, com contas fictícias de cliente e consultor, separação por empresa, protocolo sequencial e histórico de status. A demonstração funciona sem envio real de e-mails e usa autenticação de teste.

Os dados desse fluxo são persistidos em data/quotes.sqlite. Não substituir esse banco por um banco temporário nem reiniciar sua numeração. O servidor legado, acionado por npm run start:legacy, usa outro banco (.local/requests.sqlite) e outro modelo de acesso.

## Ver as telas

Abra /assets/preview/index.html no servidor para a galeria das 13 telas da rodada atual. As capturas contêm somente dados fictícios e são estáticas.

A página `/assets/test/index.html` reúne os acessos ao portal e à demonstração da proposta por etapas.

O portal integrado permite registrar briefings, selecionar hotéis, acompanhar pedidos, publicar versões e registrar o aceite do aprovador. Abra uma solicitação pelo portal para acessar o editor vinculado ao protocolo. A página /assets/proposal/index.html, quando aberta diretamente, apresenta exemplos fictícios.

O roteiro de teste, os perfis e os limites de integração estão em docs/PRD01-ENTREGA.md.


## Desenvolver

npm ci
npm run build
npm test
npm start

app.jsx contém o formulário; briefing-rules.js concentra validação/normalização; portal.html e portal.js compõem o portal; design.css e demo.css definem apresentação; system-config.js define identidade, tema e textos operacionais. assets/runtime contém os arquivos compilados.

## Continuar em outro computador

Clone o repositório, abra a pasta no Codex e execute `npm ci` com Node.js 24 ou superior. No Windows, abra `Iniciar-Projeto-Eventos.cmd` e clique em **Iniciar cotação**. Em outros sistemas, execute `npm start` e abra `http://localhost:8000/portal.html`. O primeiro início cria a base local de demonstração.

Leia [Continuidade do projeto](docs/continuidade/LEIA-ME.md) para retomar do ponto atual.

## Referências históricas

README_atualizacao.md, partes antigas de UX-REVIEW.md e o HTML Paytrack-Teste.html descrevem versões anteriores. O HTML histórico não reflete a integração atual com o portal. A direção atual está em ORGANIZACAO-DO-SISTEMA.md e no final de DIRECAO-VISUAL.md.

## Revisão de UX — Bloco A (04/11/2026)

Relatório por requisito em docs/UX-BLOCO-A-20261104.md. Galeria atual em /assets/preview/ux-20261104/index.html, com 36 capturas em 375/768/1280px. Backup e resultados antes/depois em .local/backup-ux-20261104/. Blocos B/C aguardam autorização. A galeria antiga de 13 telas é histórica.
