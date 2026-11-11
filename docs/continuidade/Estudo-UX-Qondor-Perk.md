# Estudo de layout da central de cotações

11 de novembro de 2026 · Formulario-Eventos-main

## O que foi observado

A análise cruzou as telas públicas do produto e a documentação oficial de Qondor e Perk com a lista e o detalhe no código local. Foram observadas a home de projetos da Qondor e as duas telas do fluxo de aprovação da Perk. Os detalhes de projeto, a publicação de propostas e a organização de aprovações foram analisados pela documentação. O recorte cobre desktop e a divisão do trabalho por papel. A pesquisa foi feita com material público e sem contas autenticadas, entrevistas ou medição de tempo com usuários.

A comparação percorreu quatro tarefas equivalentes ao nosso trabalho: encontrar uma cotação, reconhecer o que exige ação, localizar as informações para decidir e retomar o trabalho depois de consultar um detalhe. As duas plataformas têm escopos diferentes. O recorte da Perk foi a operação de viagens e aprovações. O da Qondor foi a operação de projetos, orçamentos e propostas.

## Qondor · o projeto como ponto de partida

| Superfície | O que foi observado | Aplicação à cotação corporativa |
| --- | --- | --- |
| Home e busca | A navegação global e as opções de busca ficam acima de uma tabela de projetos recentes. A tabela usa linhas finas, nome clicável e um selo pequeno de status. Cada linha reúne número, projeto, cliente e outros dados de contexto. A busca avançada fica disponível sob demanda. A última aba da home é lembrada. | Usar uma lista única com evento e protocolo na mesma célula, empresa, etapa e prazo. Exibir a busca e os filtros essenciais. Preservar o contexto ao abrir uma cotação e voltar. |
| Detalhe do projeto | Número, status, responsável, cliente, datas e local ancoram o registro. Ofertas, fornecedores e informações financeiras têm acessos próprios. As observações internas aparecem quando preenchidas. | Manter identidade e etapa no cabeçalho. Abrir uma seção por vez. Exibir observações e prazos internos onde a equipe toma decisões. |
| Ofertas | A edição, o acompanhamento de envio e a visão publicada têm superfícies próprias. A publicação cria um ponto de referência para consultar a oferta apresentada ao cliente. | Separar montagem interna e proposta publicada. Identificar a versão ao abrir, revisar ou aprovar. Manter o histórico ligado à versão correspondente. |

Fontes oficiais. [Captura da home e visão do produto](https://qondor.com/solutions) · [Home](https://help.qondor.com/en/articles/100238-your-qondor-homepage) · [Busca de projetos](https://help.qondor.com/en/articles/1047429-search-for-projects-in-qondor) · [Detalhe do projeto](https://help.qondor.com/en/articles/4689246-project-details) · [Fluxo de ofertas](https://help.qondor.com/en/articles/100190-work-with-offers-step-by-step).

A aplicação que vale preservar é a densidade da lista. O espaço em branco deve agrupar navegação e seções, enquanto as linhas da tabela mantêm informações suficientes para reconhecer o evento rapidamente.

## Perk · a ação pendente como ponto de partida

| Superfície | O que foi observado | Aplicação à cotação corporativa |
| --- | --- | --- |
| Minhas viagens e viagens da equipe | As duas áreas delimitam o escopo antes dos filtros. A visão “Needs action” apresenta a viagem, o motivo da aprovação, os dados para reconhecer o registro e a ação “Review trip”. Os contornos vermelhos da imagem são anotações do artigo de ajuda. | Criar uma fila em que cada linha nomeia um trabalho concreto. Exibir evento, protocolo e prazo ou data de entrada. Abrir o comentário da versão, a resposta do hotel ou o complemento em questão. |
| Tela de decisão | A captura apresenta dados de cobrança antes dos controles de recusa e aprovação. O usuário chega à ação pelo contexto da viagem. Nesse fluxo a aprovação pode envolver pagamento. | Mostrar a versão e o conteúdo decisório antes do botão. A ação no nosso portal deve deixar explícita a aprovação da versão da proposta, com a consequência já prevista pelo produto. |
| Aprovações e relatórios | A documentação apresenta aprovações pendentes e histórico de decisões como superfícies próprias. As métricas da equipe vivem em outra área. | Dar à fila um lugar próprio. Deixar contagens de acompanhamento para quem precisa consultar indicadores. |

Fontes oficiais. [Aprovar uma viagem e capturas](https://support.perk.com/hc/en-us/articles/21926029957276-Approve-a-trip) · [Aprovações e histórico](https://support.perk.com/hc/en-us/articles/26079182734364-Seamless-approvals-from-Yokoy-to-Perk) · [Indicadores da equipe](https://support.perk.com/hc/en-us/articles/27958140901020-How-Team-insights-works).

A aplicação ao nosso produto é a clareza entre “existe uma cotação” e “há uma tarefa que alguém pode executar agora”. Uma mesma cotação pode gerar duas pendências diferentes. Uma resposta de fornecedor ainda aguardada só entra na fila quando houver um acompanhamento acionável, como um prazo de retorno vencido ou um lembrete já atribuído.

## Diagnóstico da versão local

| Área | Comportamento atual | Efeito no uso |
| --- | --- | --- |
| Central | O painel do consultor gera 15 botões entre atalhos e etapas. O seletor da lista volta a representar parte do mesmo recorte. | O usuário precisa comparar contadores e reaprender o mesmo filtro em dois formatos. A busca e a lista perdem protagonismo. |
| Detalhe | A navegação lateral aponta para âncoras. Pendências, operação interna, propostas, fornecedores, orçamento, seções do briefing e histórico continuam montados no mesmo documento. | A âncora desloca a página, mas a tela segue oferecendo todos os assuntos e controles na mesma hierarquia. |
| Próxima ação | A lista de pendências, a visão de progresso e os próprios módulos podem apontar para trabalhos relacionados. Já existe abertura direta de itens. | O acesso rápido é útil. Seu destino precisa ser uma seção dedicada, com o item visível e foco consistente. |
| Fornecedores | Catálogo, solicitações, respostas e comparação pertencem ao mesmo fluxo visual. | Iniciar uma solicitação e avaliar uma resposta competem por atenção. O escopo de cada oferta pode desaparecer no meio dos controles. |
| Estados | O cabeçalho apresenta a situação da cotação e a situação do evento. A versão e sua decisão ficam em propostas. | Os rótulos precisam esclarecer o que está em análise, o que foi aprovado e se o evento está ocorrendo. Cada estado muda por uma razão distinta. |

Base da leitura local. `portal.js`, funções `renderOverview`, `renderQuotes` e `openRequest`. `assets/workflow/portal-workflow.js`, renderização de progresso, pendências e fornecedores.

## Organização proposta

Recomendo usar **Cotações** e **Pendências** como entradas complementares. A primeira responde a “qual evento preciso consultar?”. A segunda responde a “o que preciso fazer agora?”. As duas levam ao mesmo registro, com a aba e o item corretos quando houver um destino específico.

| Lugar | Conteúdo principal | Ação e contexto |
| --- | --- | --- |
| Cotações | Evento e protocolo, empresa, etapa, prazo interno e responsável se houver espaço. Busca por nome ou protocolo. | Abrir a cotação pelo nome. Manter busca, filtros, ordenação, posição e foco ao voltar. Em celular, cada linha vira uma unidade empilhada. |
| Pendências | Tarefa, cotação, prazo ou data da ocorrência. Mostrar “Minhas” e permitir a visão da equipe conforme a permissão. | Ordenar urgências por regras explícitas já disponíveis, com desempate estável. Cada linha abre a resposta, o comentário ou a versão que causou a pendência. |
| Visão geral | Evento, protocolo, empresa, etapa e datas. Até duas ações concretas e resumo do acompanhamento interno. | Destacar uma ação principal por contexto. Responsável e prazo manual ficam visíveis à equipe. A edição abre apenas quando acionada. |
| Briefing | Respostas por assunto e complementos identificados por data. | Solicitar ou ler complementos no contexto da pergunta. Preservar acesso aos registros antigos. |
| Fornecedores | Solicitações já criadas, suas respostas e uma visão de comparação. | Colocar “Solicitar orçamento” junto às opções elegíveis do catálogo. Catálogo e formulários abrem quando necessários. O comparativo tem escopo e validade além do total. |
| Propostas | Versão atual, decisão correspondente e histórico de versões. A última aprovada ganha contexto quando difere da versão atual. | Consultor revisa e publica. Cliente autorizado revisa, pede ajuste ou aprova a versão exibida. O portal aplica as permissões de cada papel. |
| Histórico | Eventos cronológicos com autor, data, ação e vínculo à entidade quando houver. | Consultar o que mudou. Alterações internas permanecem no escopo permitido. |

O comparativo interno deve expor datas, diárias, ocupação, quantidade, alimentação, taxas e impostos, cancelamento, validade e total. Uma diferença de escopo deve ficar ao lado dos totais para orientar a comparação. Catálogo público mostra características e a ação de solicitar orçamento. Valores NET, margens e contatos internos permanecem restritos às superfícies autorizadas.

A etapa da cotação pertence à lista e ao cabeçalho. A decisão do cliente pertence à versão. “Evento em andamento” pertence ao acompanhamento da operação, com a data do evento como contexto. Uma alteração operacional, como corrigir um nome durante a realização, deve gerar registro de quem alterou e quando. Se a alteração muda condições comerciais da oferta, a versão aprovada continua consultável e a mudança segue o fluxo de revisão. O alcance exato das alterações durante o evento depende da regra de negócio a validar.

## Caminhos para testar

**Consultor.** Abre “Pendências”, escolhe a resposta do Hotel Parque e cai em Fornecedores com a resposta visível. Consulta condições e validade, volta ao mesmo item da fila e abre o pedido de ajuste da v1 em Propostas. Uma cotação com hotel apenas aguardando resposta continua visível na lista e no registro.

**Cliente.** Abre sua cotação, identifica a versão disponível e lê as opções publicadas. Se tiver permissão, solicita ajuste ou aprova a versão explícita. Se uma nova versão entrar durante a leitura, o sistema atualiza o contexto antes de aceitar uma decisão sobre outra versão. A confirmação registra versão, pessoa e data.

## Sequência de entrega e verificação

1. **Central do consultor.** Substituir o conjunto de contadores por lista e fila. Reutilizar as pendências e os atalhos já calculados. Manter os filtros existentes disponíveis e reorganizar a apresentação.
2. **Detalhe por assunto.** Trocar a navegação por âncoras por seções com URLs ou estado navegável. As seções inativas saem da área de leitura e do teclado. Reutilizar operações, permissões e destinos já suportados. Revisar carregamento, vazio e erro por seção.
3. **Fornecedores e propostas.** Separar respostas, catálogo e comparação. Dar à versão e à decisão uma hierarquia própria. Aplicar a mesma estrutura de navegação ao cliente com seu conjunto reduzido de ações.
4. **Refino visual.** Manter o tema provisório. Concentrar navy na estrutura, off-white no entorno e amarelo nas ações principais. Usar separadores, espaçamento, peso tipográfico e texto de status para dar significado. Conferir contraste, foco e estados de interação.

O teste do piloto deve usar a mesma massa fictícia no fluxo atual e no proposto. Medir tempo até identificar a próxima ação, cliques até o item correto, retorno à mesma posição, erros de versão e conclusão no primeiro percurso. Conferir teclado, telas a partir de 320 px e uma cotação com mais de uma pendência. Na implementação, os testes de autorização devem cobrir acesso direto ao ID por outra empresa, escopo de consultores e diferença entre cliente leitor e aprovador. Aprovação concorrente com publicação deve preservar o vínculo explícito com a versão.

**Escopo desta entrega.** Estudo comparativo e protótipo de navegação com dados fictícios. A aplicação local permanece na versão atual. O protótipo explora o detalhe por cotação e uma fila com leitura contextual da pendência. As medições e as verificações funcionais da aplicação ficam para a entrega do piloto.
