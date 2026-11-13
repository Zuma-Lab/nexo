# Organização estrutural · Qondor, Perk e Nowadays

Pesquisa de 11/11/2026. Foram consultadas páginas oficiais e documentação pública. As observações sobre fluxos autenticados abaixo se limitam ao que essas fontes demonstram. A comparação orienta a interface original do projeto.

| Referência | Unidade de trabalho | Navegação e decisão | Aplicação ao projeto |
| --- | --- | --- | --- |
| Qondor | Projeto | Busca leva a um registro com identidade, responsável, cliente, datas e acessos a ofertas. Observações aparecem conforme conteúdo. | Cotação com cabeçalho estável e abas por assunto. Edição interna sob demanda. |
| Perk | Viagem e aprovação | Pedidos pendentes ficam em Needs action. O aprovador consulta os detalhes antes de decidir. | Fila de tarefas com destino explícito e contexto de versão. |
| Nowadays | Evento e contratação de locais | Etapas organizam a barra lateral. Busca, solicitações, propostas e conversas são superfícies relacionadas ao evento. | Fornecedores agrupados por pedido, catálogo recolhido e comparação próxima das respostas. |

## Qondor

A documentação descreve cada solicitação como projeto pesquisável. O detalhe reúne nome, número, status, responsáveis, cliente e período, com acesso às ofertas. Observações vazias ficam fora da apresentação. A tela comercial informa publicação e acompanhamento da oferta. A interpretação para o nosso produto é manter identidade e contexto visíveis, usando uma área por assunto para o trabalho mais detalhado. A colaboração e o isolamento seguem as permissões próprias da nossa aplicação.

Fontes. [Gestão de projetos](https://help.qondor.com/en/articles/2026960-project-management-in-qondor) · [Detalhe do projeto](https://help.qondor.com/en/articles/4689246-project-details).

## Perk

O fluxo documentado coloca aprovações pendentes na aba Needs action. Ao revisar, o usuário consulta os detalhes, decide ou explica a recusa. O site também apresenta regras, preferências e acompanhamento dentro da plataforma. Para o projeto, a fila atende à pergunta “o que preciso resolver?”, enquanto Cotações atende à consulta do registro. A ação do cliente continua vinculada a uma versão explícita da proposta.

Fontes. [Aprovar uma viagem](https://support.perk.com/hc/en-us/articles/21926029957276-Approve-a-trip) · [Visão da plataforma](https://www.perk.com/platform/).

## Nowadays

O changelog de agosto a outubro de 2026 descreve criação de evento em etapas, navegação contextual, busca com lista e mapa, conversas por local, múltiplas ofertas por fornecedor e comparação em tabela. As propostas destacam diferenças entre pedido e resposta, mudanças negociadas e informações ainda pendentes. A interface comercial também apresenta valores por categoria. Para o nosso sistema, a oportunidade está na sequência pedido → resposta → comparação → proposta, com o escopo ao lado do preço.

Fontes. [Histórico de alterações](https://render.nowadays.ai/changelog) · [Apresentação do produto](https://www.nowadays.ai/).

## Estrutura da experiência

1. Página inicial com imagem do grupo e Iniciar cotação.
2. Acesso integrado com formulário de credenciais e três atalhos de demonstração, Consultor, Solicitante e Administrador.
3. Solicitante com suas cotações e entrada para o briefing.
4. Briefing em etapas, com rótulos visíveis, revisão e envio.
5. Consultor com Pendências e Cotações.
6. Cotação com Visão geral, Briefing, Fornecedores, Propostas e Histórico.
7. Fornecedores com pedidos existentes antes do catálogo. Cadastro, nova solicitação e comparativo abrem quando necessários.
8. Proposta com identidade da versão, opções, condições e ação correspondente à permissão.
9. Administração com seus controles exclusivos.

## Critérios visuais

O tema escuro aprovado permanece no portal. Fundo, superfície e borda usam contraste discreto. Amarelo identifica a ação principal. Títulos usam a mesma família sem serifa, pesos moderados e escala curta. Botões usam palavras que descrevem a operação. Símbolos decorativos de direção e atualização foram retirados. Controles que dependem de um ícone para serem reconhecidos conservam o ícone e o nome acessível.

A página inicial mantém a fotografia do grupo. O login adota duas colunas no desktop e uma no celular. Os três perfis executam o mesmo fluxo de autenticação do formulário. O atalho Solicitante usa o perfil solicitante existente, mantendo sua autorização real.

O briefing mantém campos legíveis e agrupados. A proposta mantém densidade suficiente para preços e quantidades. A folha compartilhada consolida raio, foco, espaçamento e botões entre as superfícies. Histórico de decisões e informações financeiras continuam disponíveis no contexto correspondente.

## Continuidade

A pesquisa pública fundamenta a estrutura proposta. A validação com pessoas reais deve verificar se elas identificam a próxima ação, encontram condições da proposta e retornam à tarefa de origem.

## Sourcing corporativo e decisão comercial

O Cvent Global Planner Sourcing Report de 2026 pesquisou 1.650 profissionais em seis regiões, incluindo a América Latina. Na amostra global, 72% esperavam aumento de custos e 35% apontaram manter o orçamento como principal preocupação. A especificação das salas, imagens e plantas também influenciam a seleção inicial. Esses percentuais descrevem a amostra global. [Pesquisa da Cvent](https://www.cvent.com/en/blog/events/venue-sourcing-trends) · [Comportamento de busca e seleção](https://www.cvent.com/en/blog/hospitality/inside-planner-behavior-what-data-reveals-about-group-hotel-bookings)

Para o consultor, a decisão operacional é comparar a última resposta por fornecedor e serviço. A tabela apresenta total, base, taxas, quantidade, período, validade e condições. O servidor identifica diferenças de período, quartos e capacidade para hospedagem. Uma resposta recebida fica visível antes da validação, com acesso ao registro. O filtro de prontidão deixa apenas as respostas aptas para levar à proposta. Diferenças de escopo permanecem visíveis mesmo após validação.

O preço exibido é o total da resposta para o escopo cotado. Itens opcionais, montagem da proposta e aprovação seguem em suas respectivas etapas. Essa comparação é interna e usa os dados estruturados que o fornecedor já informou.
