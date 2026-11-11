# Fila de pendências do consultor

A central abre em **Pendências** para consultores. **Cotações** reúne as solicitações em uma tabela com evento, empresa, etapa, responsável e prazo interno. As duas áreas mantêm os respectivos filtros ao alternar.

- A fila reúne tarefas individuais e permite filtrar por responsável e urgência. A ordenação considera prioridade, data e protocolo.
- Cada tarefa abre o registro correspondente. Respostas de hotéis, observações do cliente e pedidos de revisão levam ao item exato. O detalhe mostra o contexto da tarefa e oferece **Ver cotação completa**.
- Ao voltar, a central preserva os filtros e a posição. O foco retorna à tarefa original ou à tarefa mais próxima quando a primeira foi concluída.
- Pedidos enviados podem ter uma data interna de cobrança. O pedido aguardando resposta entra na fila a partir dessa data, no horário de São Paulo. Ao receber a resposta, cancelar o pedido ou concluir a cobrança, o lembrete correspondente sai da fila. A ação **Concluir cobrança** registra a ação internamente. O contato com o fornecedor continua sendo feito pela equipe.
- A data de cobrança fica no acompanhamento de cada pedido e é visível apenas à equipe autorizada. A coluna nova é criada ao iniciar o servidor com um banco de versão anterior. Pedidos anteriores começam sem data de cobrança.

## Arquivos alterados

| Arquivo | Alteração |
| --- | --- |
| `portal.html` e `portal.js` | Entradas Pendências e Cotações, filtros, tabela, destino e retorno ao item. |
| `assets/workflow/portal-workflow.js` e `workflow.css` | Acompanhamento do fornecedor, âncoras das observações e layout responsivo. |
| `backend/demo.cjs`, `workflow.cjs` e `sourcing.cjs` | Rotas, cálculo das tarefas, armazenamento e trilha interna da cobrança. |
| `backend/prd01.test.cjs` | Teste de datas, conclusão, revisão concorrente e permissões de acesso. |

## Verificação

A suíte automatizada usa bases de teste. O cenário no Chrome usa uma base fictícia em memória com revisão de proposta, resposta de hotel e cobrança de fornecedor. Foram conferidos o filtro, a abertura por teclado, o foco de retorno, a retirada da tarefa da fila, a separação do portal do cliente e a largura de 320 px.

Capturas da verificação. [Central anterior](./antes.png) · [Fila no desktop](./fila-desktop.png) · [Resposta do hotel](./resposta-exata.png) · [Fila no celular](./fila-celular.png).
