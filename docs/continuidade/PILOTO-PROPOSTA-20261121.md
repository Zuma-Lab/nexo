# Piloto: editor do consultor e proposta do cliente — 21/11/2026

## Entrega

O editor vinculado à cotação conserva os serviços do briefing, alternativas, campos financeiros e condições. A navegação por etapas passa à lateral; evento, protocolo, participantes e validade ficam no cabeçalho. Salvar e revisar/publicar ocupam posições constantes. O resumo ao lado da edição acompanha valores, quantidades, datas, taxas e agenciamento durante a digitação, usando as regras financeiras existentes. Alternativas não são somadas entre si.

A proposta do cliente apresenta opções lado a lado, serviços navegáveis, totais do grupo e condições expansíveis. Versões, pedidos de revisão, observações e aceite explícito continuam disponíveis. As conversas ficam após a área de decisão. A validade aparece no contexto da proposta.

A prévia do consultor é identificada como rascunho e conserva a edição. Ela não oferece seleção de versões publicadas nem permite aprovar em nome do cliente. O rascunho mostra alterações não salvas e o navegador alerta ao sair com mudanças. O salvamento continua manual; publicar exige revisão e confirmação.

Os estilos da proposta foram retirados dos blocos inline e das regras específicas no CSS compartilhado e reunidos em `assets/proposal/proposal.css`. Os tokens continuam compartilhados. Os rótulos dos controles têm nomes acessíveis explícitos, incluindo os seletores.

## Preservação e limites

- Nenhuma migração, alteração de banco de demonstração ou mudança na API comercial.
- Cálculos, publicação, concorrência por revisão, autorização e aprovação permanecem validados pelo servidor existente.
- A identidade NEXO atual continua provisória. Esta entrega não aprova um brandbook.
- O endereço da proposta deve ser aberto a partir da cotação no portal, com `?quote=...`. Abrir `/assets/proposal/index.html` diretamente continua sendo uma demonstração independente, com valores fictícios e salvamento no navegador.
- Este é o piloto prioritário. A fila do consultor, o briefing, fornecedores e administração ainda precisam de suas respectivas rodadas de refinamento.

## Validação

`npm test`: 79 testes aprovados. Abrangem regras financeiras, segregação por empresa, permissões, versões e demais regressões existentes.

`npm run test:proposal-ui`: teste novo com Chrome e banco SQLite exclusivamente em memória. Verifica preço atualizado durante digitação, pendência distinta de cortesia, preservação da edição ao visualizar, salvar/publicar, aprovação dependente de consentimento, versão aceita imutável após nova publicação, acesso por ID de outra empresa negado, custos internos ausentes da resposta do cliente e responsividade em 320/375 px. Requer dependências instaladas com `npm ci` e Google Chrome disponível.

Também foram exercitados os serviços do editor independente (aéreo, hospedagem e transfer), manutenção de condições entre etapas e as áreas de cliente, consultor, briefing, fornecedores, orçamento e administração. Não houve erros JavaScript nesses percursos.

As capturas em `evidencias/piloto-proposta-20261121/antes` e `depois` usam dados fictícios. `depois/consultor-valores.png` e `depois/cliente-comparacao.png` mostram o fluxo integrado. `editor-etapas-aereo.png` mostra o editor independente e não deve ser apresentado como cotação do banco do usuário.

## Como conferir

Abra `Iniciar-Projeto-Eventos.cmd`, entre como Consultor, abra uma cotação com serviços e clique em **Preparar proposta** na visão geral ou em **Orçamento**. Edite os valores e confira o resumo; salve; use **Revisar proposta** e **Publicar nova versão**. No perfil do cliente, acesse a proposta publicada. A aprovação exige um usuário com permissão de aprovador da empresa.

## Próxima prioridade

Aplicar a organização validada ao detalhe da cotação e à preparação de pedidos para fornecedores. Preservar os campos do briefing completo e o comparativo existente. A validação visual do piloto pelo usuário orienta essa próxima rodada.
