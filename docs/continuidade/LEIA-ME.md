# Continuidade do projeto NEXO

## Abrir e testar

1. Clone o repositório e abra a pasta no Codex.
2. Use Node.js 24 ou superior e execute `npm ci`.
3. No Windows, abra `Iniciar-Projeto-Eventos.cmd` e clique em **Iniciar cotação**. Com `npm start`, abra `http://localhost:8000/portal.html`.
4. Selecione **Consultor** para abrir a fila. Os atalhos de login fornecem as credenciais fictícias do protótipo. Para ver uma cotação do início, entre como **Solicitante** e preencha um briefing fictício.

## Estado atual

- Plataforma de cotação de eventos corporativos, em Node.js e SQLite. Nome e marca definitivos seguem em avaliação.
- A fila abre para consultores e distingue ações pendentes de fornecedores em espera. A cobrança pode ser programada por pedido. A navegação retorna à fila com filtros e posição.
- O portal integrado usa a apresentação provisória NEXO, com superfícies claras e verde escuro. O detalhe abre uma área por vez, com Visão geral, Briefing, Fornecedores ou Hotéis, Orçamento, Propostas e Histórico.
- Em Visão geral, até duas ações ficam visíveis. A edição do acompanhamento interno abre sob demanda. Em Fornecedores, pedidos aparecem primeiro, com catálogo e comparativo em áreas separadas.
- A aplicação conserva os fluxos de proposta, aprovação por versão, permissões por empresa e auditoria. O editor integrado recebeu o piloto de organização por serviço, resumo financeiro durante edição e ações constantes de salvar/revisar/publicar. A proposta do cliente conserva versões, comparação, condições e aceite explícito.

## Próxima conversa

Leia [Piloto de proposta — 21/11/2026](PILOTO-PROPOSTA-20261121.md) para retomar a entrega atual, seus testes e limites. A próxima prioridade é o detalhe da cotação e a preparação de pedidos para fornecedores. [Estudo-UX-Qondor-Perk.md](Estudo-UX-Qondor-Perk.md) e [alteracoes.md](alteracoes.md) conservam as referências e decisões anteriores.

As capturas usam dados fictícios. O GitHub contém os arquivos portáveis do projeto. A base SQLite, credenciais, dependências instaladas e backups locais ficam no computador de origem. O banco de demonstração é criado ao iniciar em um novo computador.

[Pesquisa estrutural de Qondor, Perk e Nowadays](PESQUISA-ESTRUTURAL.md).
