# Continuidade do projeto NEXO

## Abrir e testar

1. Clone o repositório e abra a pasta no Codex.
2. Use Node.js 24 ou superior e execute `npm ci`.
3. No Windows, abra `Iniciar-Projeto-Eventos.cmd` para entrar direto no portal. Com `npm start`, abra `http://localhost:8000/portal.html`.
4. Selecione **Consultor demo** para abrir a fila. Os atalhos de login fornecem as credenciais fictícias do protótipo. Para ver uma cotação do início, entre como **Empresa Alpha · solicitante** e preencha um briefing fictício.

## Estado atual

- Plataforma de cotação de eventos corporativos, em Node.js e SQLite. Nome e marca definitivos seguem em avaliação.
- A fila abre para consultores e distingue ações pendentes de fornecedores em espera. A cobrança pode ser programada por pedido. A navegação retorna à fila com filtros e posição.
- O portal integrado usa azul-marinho escuro, superfícies discretas e ação principal amarela. O detalhe abre uma área por vez, com Visão geral, Briefing, Fornecedores ou Hotéis, Propostas e Histórico.
- Em Visão geral, até duas ações ficam visíveis. A edição do acompanhamento interno abre sob demanda. Em Fornecedores, pedidos aparecem primeiro, com catálogo e comparativo em áreas separadas.
- A aplicação conserva os fluxos de proposta, aprovação por versão, permissões por empresa e auditoria. O formulário de entrada e o editor de propostas independente usam suas apresentações próprias.

## Próxima conversa

Abra [Estudo-UX-Qondor-Perk.md](Estudo-UX-Qondor-Perk.md) para recuperar as referências e [alteracoes.md](alteracoes.md) para recuperar as decisões da fila. O próximo piloto pode aprofundar a comparação de escopo de hotéis e testar o caminho de aprovação com cliente e consultor.

As capturas usam dados fictícios. O GitHub contém os arquivos portáveis do projeto. A base SQLite, credenciais, dependências instaladas e backups locais ficam no computador de origem. O banco de demonstração é criado ao iniciar em um novo computador.
