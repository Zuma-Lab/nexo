# Auditoria e primeira rodada — 04/11/2026

## Fonte e preservação

Projeto cadastrado: Formulario-Eventos-main, na Área de Trabalho do usuário. Inspeção da versão com arquivos de 03/11 e madrugada de 04/11, incluindo relatório do Bloco A. Não foi utilizado ZIP antigo. Cópia isolada em work/Formulario-Eventos-main; snapshot Git 553c07b nesta cópia. A pasta original não possuía Git. Banco original não foi aberto, copiado, consultado ou modificado; esquema e migrações examinados no código, execução e testes com banco em memória/temporário. Isso limita qualquer conclusão sobre conteúdo e integridade do banco em uso.

A conversa referenciada foi consultada. O serviço retornou apenas os últimos cinco turnos e não forneceu cursor anterior. Não há como atestar recuperação integral do dia. As instruções consolidadas fornecidas nesta solicitação são a referência principal. Branding e naming permanecem em pausa; tema existente preservado. Tokens semânticos adicionados como aliases, sem alterar os valores atuais. A cor primária encontrada é #12254F, diferente da referência #1D2946; sua normalização visual fica pendente, sem iniciar nova exploração de paleta.

## Estado real

| Área | Estado | Evidência e limites |
|---|---|---|
| Stack | Existente | Node HTTP + node:sqlite; React 18 no briefing via Babel, portal em JavaScript; Tailwind compilado. Sem justificativa para reescrita. |
| Login e empresas | Parcial | Contas fictícias sem administração; sessões com token aleatório, hash no banco, cookie HttpOnly/SameSite Strict, expiração. Não é autenticação de produção. |
| Isolamento | Existente na demo | Empresa derivada da sessão para criar/listar/consultar/repetir. Acesso por ID alheio retorna 404. Consultor global vê todas as empresas vinculadas; não existe escopo por carteira/agência. |
| Briefing | Existente/parcial | Etapas, revisão, validação compartilhada navegador/servidor, limpeza de campos inativos, empresa/CNPJ da conta. Rascunho local por empresa; sem sincronização/recuperação no servidor. |
| Protocolo e histórico | Existente | Sequência transacional, idempotência por empresa/chave, histórico na mesma transação; registros sem empresa não são expostos. Protocolo é número no banco, formatado com seis dígitos na UI. |
| Painel consultor | Parcial | Busca/filtro, detalhes e confirmação de status; agora contagens. Sem prazos, responsáveis ou pendências estruturadas no fluxo principal. |
| Fornecedores | Ausente como módulo persistente | Exemplos na prévia de proposta não constituem cadastro, solicitações ou respostas de fornecedores. |
| Orçamento | Parcial, protótipo | Biblioteca isolada usa BigInt/centavos, diárias, taxas e agenciamento com base explícita; oito testes financeiros. Nenhum endpoint comercial recalcula ou persiste orçamento. NET, margem e políticas completas ainda ausentes. |
| Propostas e aprovação | Parcial, protótipo | Editor local, alternativas e escolhas simuladas. Sem publicação versionada, comentários, aprovação persistente ou vínculo comercial no banco. |
| Administração | Ausente | Sem cadastro/gestão de empresas, usuários e matriz de permissões. |
| Rastreabilidade | Parcial | Histórico de status; faltam auditoria de alterações de briefing, propostas e administração. |
| Tema/componentes | Parcial | system-config centraliza identidade e tokens; 106 tokens de cores legadas dificultam manutenção. Aliases semânticos iniciados; ainda há CSS duplicado/inline. |

## Achados priorizados

**P0 — antes de qualquer uso real**

1. Demo inclui credenciais fictícias e provisionamento automático. Conservar execução local. Autenticação produtiva requer provisionamento controlado, política de sessão, recuperação, limitação robusta de tentativas e implantação HTTPS. Não foi feita avaliação de infraestrutura nem pentest.
2. Situação “Proposta disponível” apontava para amostra comercial fictícia. Corrigido o caminho do cliente: link removido, mensagem de orientação e bloqueio no boot da prévia associada à cotação. Consultor continua com simulação identificada. A prévia pública sem cotação continua demonstrativa; isto não equivale a autorização de um futuro endpoint comercial.
3. Confirmação de status podia sobrescrever alteração de outra sessão. Portal agora envia expectedStatus e servidor rejeita divergência com 409 sem alterar histórico. Compatibilidade mantida para consumidores antigos sem expectedStatus: a proteção não é obrigatória para esses consumidores. Evoluir para revisão obrigatória quando houver API versionada.
4. O servidor guarda payload validado e summary fornecido pelo navegador; resumo não é reconstruído do payload. Pode haver divergência textual no detalhe. Priorizar apresentação derivada de campos estruturados, mantendo resumo histórico. Não foi alterado nesta rodada.
5. Login usa scrypt síncrono e mapa de tentativas por e-mail sem limite global/limpeza periódica. Aceitável apenas no ambiente local de demonstração; endurecer antes de exposição. Não há gestão de permissões por carteira; definir se consultor global é regra desejada.

**P1 — próxima implementação funcional**

- Persistir rascunhos com autorização por empresa; definir conflitos e retenção.
- Acrescentar responsáveis/prazos e pendências reais ao fluxo principal. Não reutilizar automaticamente o banco legado, que tem outro modelo de autenticação/status.
- Modelo de fornecedor e pedido de cotação com histórico e resposta estruturada.
- Orçamento no servidor usando biblioteca de centavos já testada; snapshots imutáveis, cálculo e validação antes de publicar.
- Separar rascunho privado, versão publicada e aceite explícito da versão pelo cliente. Rejeitar aceite desatualizado e preço pendente. Toda rota com filtro de empresa e papel.
- Estados de status precisam de regras de transição e condições reais: hoje consultor pode saltar ou retroceder entre situações. Não inventar transições de negócio.
- Portal faz nova consulta a cada busca; introduzir estado de carregamento/erro e proteção contra respostas fora de ordem. Listagem traz briefing completo sem paginação; reduzir payload conforme volume.

**P2 — consolidação**

- Completar componentes reutilizáveis e substituir gradualmente tokens legados por nomes semânticos.
- Comparativo denso de hotéis/serviços, filtros, teclado e detalhes expansíveis.
- Cobrir leitor de tela, foco após navegação, contraste de todas as combinações, textos longos e aparelhos reais. Capturas e medição de largura não certificam acessibilidade.
- Revisar dependências/avisos de build com acesso ao registro e controle de versões; não foi executada auditoria online de vulnerabilidades. Node usado nos testes: 26.13.0; requisito do projeto >=24, compatibilidade em 24 não executada aqui.

## Alterações entregues

- backend/demo.cjs: comparação otimista de status quando expectedStatus é enviado.
- portal.js: confirmação envia estado anterior, contagens do consultor e identificação explícita da simulação; cliente sem link para amostras comerciais.
- assets/proposal/proposal-demo.js: acesso de cliente à prévia vinculada à cotação mostra orientação e não renderiza opções fictícias.
- system-config.js: aliases --colorPrimary, --surface, --surfacePage, --textPrimary, --colorAccent derivados do tema.
- demo.css: métricas responsivas e status com superfície neutra no portal.
- backend/demo-integration.test.cjs: regressão de acesso cruzado por ID/retry, permissão de status e conflito entre sessões sem novo histórico.

Nenhuma alteração em esquema, banco, protocolos, prefixos de rascunho ou regras financeiras. Build executado sem mudanças funcionais nos artefatos compilados.

## Verificação

Antes: 59/59 testes. Depois: 60/60 testes. Build concluído; aviso de base Browserslist desatualizada não bloqueante. Primeira execução dos testes ficou impedida pela conexão local restrita; repetição autorizada passou.

Capturas reais antes/depois com contas fictícias, banco em memória, Chrome headless, larguras 375/768/1280 e altura 900. Medição: largura de conteúdo igual à viewport nas três larguras; conferência visual em 375 e 1280. Artefatos em outputs/antes e outputs/depois desta conversa. Percursos adicionais e resultado estão em outputs/depois/functional.json quando concluídos. Sem envio de e-mail real.

## Decisões ainda necessárias

Escopo dos consultores, transições de status/reabertura, responsáveis e prazos, bases de margem/comissão/impostos, validade/cancelamento e efeito do aceite comercial. MAPEAMENTO-PROPOSTA.md já contém análise anterior de referências; não se deve solicitar novamente a planilha só porque um documento antigo diz que ela estava pendente. Nesta rodada a planilha não foi aberta nem seus dados utilizados.

O escopo continua cotação corporativa/MICE: briefing → análise → fornecedores → comparação/orçamento → proposta → revisão/aceite com histórico. Brandbook, nomes finais, execução integral de eventos e financeiro pós-evento ficam fora desta rodada.
