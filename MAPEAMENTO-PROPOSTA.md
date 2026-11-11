# Mapeamento da proposta comercial — referência recebida

## Decisão de produto confirmada

O consultor apresenta alternativas de companhia aérea/hotel. O cliente escolhe no sistema. Alternativas do mesmo grupo são mutuamente exclusivas: não somar todas as opções. Grupos distintos podem representar origens diferentes do grupo, hospedagem, alimentação e serviços adicionais.

## Fontes lidas

- Planilha de referência com modelos de aéreo, hospedagem, transfer, eventos, ônibus, fechamento e regras.
- Três imagens fornecidas na conversa com proposta de aéreo, alternativas por companhia, seguro opcional, agenciamento e câmbio.

Os documentos são referência de conteúdo. Textos de contratação, percentuais, destinatários, nomes de clientes e valores não foram transformados em regras permanentes nem importados para o banco.

## Campos da proposta

| Bloco | Dados |
| --- | --- |
| Cabeçalho | Solicitação, evento, empresa, contato, período, participantes do evento, participantes por serviço, emissão, versão e validade |
| Grupo de alternativas | Serviço, grupo/origem, quantidade atendida, obrigatório ou opcional e opções apresentadas |
| Opção | Fornecedor, nome, endereço/itinerário, descrição, moeda, condições e itens |
| Hospedagem | Categoria, regime, check-in/out, quartos, ocupação, pessoas atendidas, noites, diária, taxas e subtotal |
| Aéreo | Companhia, bagagem, trechos, aeroportos, datas/horários, tarifa, taxa de embarque, passageiros e total por alternativa |
| Transfer/ônibus | Rota, data/horários, veículo/classe, passageiros, veículos, períodos, tarifa, extras e seguro |
| Espaços/equipamentos | Local, período, montagem, capacidade, itens, unidades de cobrança e taxas |
| Alimentação | Refeição, data/horário, descrição/cardápio, pessoas, ocorrências e valor por pessoa |
| Seguro opcional | Cobertura, moeda, unidade de cobrança, período, viajantes, valor e inclusão explícita |
| Financeiro | Subtotal de serviços, taxas do fornecedor, base e percentual de agenciamento, total por moeda, câmbio e data, equivalente em BRL |
| Condições | Pagamento, cancelamento, disponibilidade, itens inclusos/exclusos, cortesias e pendências |

## Cuidados identificados nas fontes

1. Quantidade: quando o cabeçalho divergir da soma dos tipos de quarto ou das condições, confirmar o número com a equipe responsável.
2. Quantidade de refeições: cada serviço deve usar a quantidade do grupo atendido.
3. Noites e quartos: diária unitária × apartamentos × noites. Pessoas é uma medida diferente; não multiplicar quartos por pessoas novamente.
4. Alimentação: calcular com a quantidade de refeições e o valor unitário por pessoa. Conferir se a quantidade já inclui todos os participantes.
5. Taxas: fornecedor e cliente podem ter percentuais diferentes. Diferenciar taxa adicional de taxa já inclusa.
6. Transfer: existem exemplos de taxa na linha e agenciamento no fechamento. Especificar bases e escopos para não aplicar o mesmo encargo duas vezes.
7. Cortesia pendente: sala aguardando confirmação não equivale a serviço gratuito confirmado. Mostrar pendência e subtotal conhecido, sem confirmar um preço final incompleto.
8. Café da manhã incluso: descrever no serviço e não cobrar de novo na alimentação.
9. Condições: revisar se as cláusulas de pagamento e faturamento são compatíveis antes de publicar.
10. Fórmulas: conferir referências inválidas em modelos antes de adotar qualquer regra de cálculo.
11. Nas imagens, seguro está identificado em BRL e o consolidado do aéreo em USD. Não somar moedas sem conversão explícita e não incluir seguro opcional por padrão.
12. Informações de viagem nas imagens são conteúdo de referência, não validação atual de requisitos migratórios. Uma futura funcionalidade desse tipo exige fonte e data de revisão próprias.
13. Data/versão: a emissão não pode mudar retroativamente com TODAY(). Publicações devem guardar uma versão imutável com data e escolhas vinculadas àquela versão.

## Prévia implementada nesta rodada

assets/proposal/index.html: editor e visão do cliente, com dados fictícios. Jornada por telas, com um serviço por vez. Editor dividido em detalhes, valores e condições, com uma alternativa em edição. Cliente compara LATAM/GOL, Hotel Transamérica X/Hotel Comfort Y e Transfer A/B. Permite adicionar itens/alternativas, editar condições, salvar rascunho local e simular escolhas exclusivas por grupo. Seguros opcionais são incluídos apenas por decisão do cliente. A revisão usa cartões compactos e permite alterar um serviço e retornar diretamente ao resumo.

assets/proposal/proposal-rules.js: cálculo isolado da apresentação. Valores em centavos; arredondamento por linha; percentuais com duas casas. Nesta fase somente BRL é aceito; outras moedas e câmbio ficam para o futuro. Taxa inclusa não adiciona cobrança; item pendente mantém total desconhecido; total consolidado usa somente alternativas selecionadas. Aéreo discrimina tarifa e embarque por pessoa. Rateios com frações de centavo são indicados como aproximados, preservando o total exato do grupo. Rascunhos antigos de outras moedas ficam em chaves separadas, sem reinterpretar os valores em reais.

Os cálculos básicos estão implementados e testados. A prévia ainda não possui desconto, upload de fotos, itinerário estruturado por trecho, cadastro de novos grupos, validação de ocupação por categoria, PDF comercial, publicação no servidor, controle de concorrência ou aceite persistente. Itinerário e detalhes são texto livre nesta etapa. Essas funções não devem ser consideradas prontas só porque há um protótipo visual.

## Integração necessária antes de uso real

- Vincular a proposta à solicitação e à empresa, com edição exclusiva por consultor.
- Separar rascunho privado de versão publicada. Cliente só lê a versão publicada.
- Recalcular e validar no servidor usando a mesma biblioteca de regras; valores do navegador não são fonte de verdade.
- Guardar escolha de uma opção por grupo, opcionais, versão e data. Rejeitar escolha de versão desatualizada.
- Distinguir escolha de alternativas, aceite comercial e reserva confirmada.
- Guardar condições revisadas e histórico imutável das versões publicadas.
- Desenvolver desconto com base explícita e evitar dupla aplicação de taxas de fornecedor/agência.

## Verificação

59 testes passaram, dos quais oito verificam as regras da proposta: quartos/noites, taxas, bases de agenciamento, incluso/pendente, alternativas exclusivas, opcionais, restrição a BRL, valores por pessoa e arredondamento. Percurso real no navegador: GOL + Comfort Y + Transfer A + almoço, sem seguro = 27.000 + 10.395 + 900 + 3.675 = 41.970 BRL. Troca para LATAM, mantendo os demais serviços = 44.970 BRL. Nenhum valor real da planilha foi publicado ou alterado. A avaliação de experiência está em UX-PROPOSTA-ETAPAS.md.
