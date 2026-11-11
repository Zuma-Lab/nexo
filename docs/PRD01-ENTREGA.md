# PRD 01 · Entrega do fluxo local

10/11/2026 · Formulario-Eventos-main

## Testar

1. Encerre a janela anterior do servidor e abra Iniciar-Projeto-Eventos.cmd.
2. Entre no sistema atualizado como Empresa Alpha · solicitante. Crie um evento fictício com hospedagem, datas futuras, participantes e número de quartos. Abra o protocolo, selecione hotéis e solicite o orçamento.
3. Entre como Consultor demo. Confira o briefing. Em Fornecedores, abra o pedido e registre o envio realizado com referência fictícia para este teste. Lance preço NET, quantidade, condições, validade e disponibilidade. Valide a resposta e abra o editor pelo comparativo.
4. Preencha ou revise as condições, confira o preço de venda e publique. A publicação aparece no portal da empresa.
5. Entre como Empresa Alpha · aprovador. Peça revisão da v1. Como consultor, publique a v2. Como aprovador, selecione a opção, confira o total e aprove. O comprovante mostra o nome, a data e a versão. Como solicitante, consulte a proposta e envie observações.
6. Entre como Administração demo para conferir empresas, preferências, usuários, carteiras e permissões. Use Empresa Beta para verificar que os protocolos da Alpha ficam fora da sua conta.

## Requisitos atendidos no ambiente local

| Área | Entrega |
| --- | --- |
| Perfis e empresas | Solicitante, aprovador da empresa, aprovador designado, consultor por carteira e administrador. O consultor vê registros da própria carteira que estejam sem responsável ou atribuídos a ele. |
| Acompanhamento | Visão geral com estado, última atualização e próxima ação. Filtros por pendência, andamento e encerramento, e sinalização interna de prazo vencido e respostas. |
| Briefing | Faixa de investimento opcional, preferências da empresa e complementação no protocolo existente. Antes da publicação, o consultor pode complementar campos operacionais com motivo. |
| Fornecedores | Cadastro por empresa, categoria, localização, foto, capacidade, fonte, verificação e contato interno. Hotéis podem ser selecionados em lote. O mapa por hotel usa as coordenadas do cadastro. |
| Pedidos | Solicitação interna, envio realizado com referência, resposta recebida, validação e cancelamento. O envio preserva o contexto do briefing. Respostas mantêm versões, preços, taxas e condições. |
| Orçamento | Comparação interna por categoria, quantidade, período, capacidade, validade e total em centavos. Uma resposta vigente e validada pode ser usada no rascunho de proposta. |
| Propostas | Valores de venda, condições e versões publicadas preservadas. O servidor entrega ao cliente campos comerciais permitidos. NET, bases de cálculo, contato, respostas internas e rascunhos ficam na equipe. |
| Decisões | Aceite e revisão formal vinculados à versão por aprovador autorizado. Solicitantes podem enviar observações. Uma nova versão preserva as decisões anteriores e exige nova decisão. |
| Histórico | Complementação, status, pedidos, propostas, decisões e administração ficam registrados. O cliente recebe os eventos da própria cotação destinados a ele. |
| Interface | Portal responsivo, navegação entre Visão geral, Fornecedores, Orçamento, Propostas e Histórico, com tema configurável. |

## Regras adotadas

- Uma conta pode solicitar e aprovar quando recebe autorização. Aprovação por empresa vale na própria empresa. Aprovação designada exige vínculo à cotação. O painel administrativo configura a carteira do consultor.
- O solicitante envia observações sobre a versão vigente. A revisão formal bloqueia o aceite daquela versão e fica reservada ao aprovador. A equipe responde publicando uma nova versão.
- O total do cliente é o preço de venda publicado. Os dados usados para compor esse valor são internos. O aceite utiliza o cálculo gravado na versão exibida.
- A equipe mantém o catálogo, indicando fonte e data. Os hotéis iniciais são fictícios. Cadastros reais usam dados e fotos que a equipe tenha verificado e possa utilizar.
- A seleção gera um pedido interno. O consultor registra o encaminhamento já realizado e sua referência. O registro não despacha e-mail. O mapa externo é aberto pelo usuário a partir de coordenadas cadastradas.
- Preferências de contratação são orientações no briefing. A permissão de aprovação é uma regra aplicada pelo servidor.
- A situação do evento é independente da cotação. O aceite comercial registra a decisão sobre uma versão. A operação de reservas, assinatura, pagamentos e portal externo de fornecedores é posterior ao PRD inicial.

## Verificação

A suíte automatizada usa bancos de teste. O percurso no navegador usa contas e propostas fictícias e verifica seleção em lote, registro do envio, validação e importação da resposta, revisão da v1, publicação da v2, aceite autorizado, administração, isolamento e larguras desktop e celular. A consulta ao catálogo e as fotos de hotéis reais dependem do cadastro da equipe. O projeto roda localmente pelo inicializador existente.
