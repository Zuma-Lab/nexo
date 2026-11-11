# Direção visual — Grupos & Eventos

Público principal: pessoas que organizam eventos regularmente, com orientação discreta para quem organiza ocasionalmente.

## Princípio
O evento é o centro da experiência. O produto reúne decisões e mantém contexto, evitando repetir conteúdo institucional ao longo do preenchimento.

## Estrutura
Abertura com foto do evento e CTA. Primeira etapa dedicada ao evento. Depois, serviços selecionados; dados da organização; briefing final.
Durante o planejamento, a lateral resume destino, datas, participantes, serviços e organização. Cada informação oferece edição. Em celular, o resumo é recolhível.
Na revisão, as seções possuem edição direta e retorno à revisão ao concluir.

## Identidade
Azul profundo na estrutura, branco no conteúdo e amarelo nas ações principais. Painel com raio de 14px; campos de texto com raio de 10px; texto longo com raio de 12px. Opções curtas em cápsulas; serviços em cartões. Bordas internas discretas e espaço entre assuntos.

## Movimento
Símbolo Paytrack ampliado à direita na abertura. Ao iniciar, reduz e se reposiciona em 300ms; percorre a diagonal que cruza a quina superior direita em 600ms; a cotação abre aos 1000ms.
No formulário, o painel fica estável. Saída do conteúdo em 160ms e entrada horizontal de 18px em 460ms. Movimento reduzido respeitado.

## Referências
../referencias-visuais/ contém as imagens fornecidas na conversa.
Abertura: assets/evento-auditorio.png.
Referências de identidade: paytrack-site-inicio.png e paytrack-site-institucional.png.
Referência de acabamento: referencia-campos-translucidos.png, adaptada à composição clara para garantir contraste.

Ajuste de navegação: atalhos do resumo localizam o campo específico, inclusive na mesma tela; rolagem centralizada, foco para edição e destaque amarelo discreto por 2,4s. Nome do serviço simplificado para Aéreo. Símbolo inicial ampliado até 380px no desktop; saída diagonal de 650ms e abertura da cotação aos 750ms.

Abertura: símbolo branco/amarelo (symbol-paytrack-yellow.png); movimento até o centro, seguido de expansão rápida e desaparecimento em 700ms. Substitui a saída diagonal. Serviços do resumo apenas navegam/rolam até a seção, sem destaque no título nem foco automático no primeiro controle. Atalhos de campos específicos preservam foco e destaque. Cor branca do painel mantida nesta rodada.

## Ajustes de visual e navegação — 03/11/2026

Aplicados ao Formulario-Eventos-main a partir da comparação com projeto sistema de eventos v1/Projeto EVENTOS v1. Esta seção substitui as descrições anteriores sobre o fundo uniforme do formulário.

- Painel #F4F6FA com campos brancos, rótulos de 13px, preenchimento de 15px e 16px no celular.
- Blocos de aéreo, salas e transfers com menos molduras; cartões de seleção preservados.
- Serviço ativo destacado no resumo por fundo discreto, traço amarelo e aria-current.
- Lápis para editar dados; chevron para abrir serviços; estado Rascunho durante o preenchimento.
- Etapas superiores clicáveis, numeradas sem indicar conclusão de campos ainda não validados. Ao navegar por elas, foco no título da etapa.
- Edição iniciada na revisão mantém Concluir edição e retorno à revisão.
- Prazo com relógio estático, preservando a regra atual de 4 dias úteis após briefing completo.

A comparação também identificou campos por serviço, orçamento, origens, CSV e histórico na referência v1. Esses itens pertencem a outras rodadas; a prioridade escolhida para esta rodada foi visual e navegação.

Verificação: compilação concluída; 46 testes existentes passaram; verificadas as 16 combinações de serviços e a lógica de retorno à revisão. Conferência visual no navegador em desktop nas etapas Evento e Aéreo. Layout móvel ainda sem conferência visual. Prévia isolada com banco em memória e conta fictícia, sem registros no banco do projeto.

Backup anterior à edição: .local/backup-visual-20261103/.

## Azul oficial conferido no brandbook — 03/11/2026

Fonte histórica: brandbook Paytrack 2026, seção Cores.
Azul 01 (primário): HEX #12254F, Pantone 2757 C. Azuis secundários: #010F4A, #012E72 e #263A99.
O fundo da referência v1 combinava #0B1932 e #213C68; esses códigos não aparecem na paleta oficial.
Para preservar a aparência sóbria com fidelidade à marca, o fundo e o cabeçalho do formulário passam a usar #12254F uniforme. Painel claro, campos e navegação desta rodada mantidos.
O PDF apresenta diferenças entre alguns valores RGB e seus HEX; para esta aplicação web foi seguido o HEX explicitamente publicado, sem conversão de Pantone.

## Sistema próprio com identidade configurável — 03/11/2026

O projeto não pertence à Paytrack. Nome provisório: Projeto Eventos. O azul-marinho e o amarelo são mantidos como tema de exploração, configurado em system-config.js. Logotipos provisórios sem marca de terceiros, imagens, tipografia e textos operacionais passam pela configuração central. Não há escolha de nome definitivo nesta rodada.

Ver ORGANIZACAO-DO-SISTEMA.md. A galeria assets/preview/index.html apresenta 13 telas reais com dados fictícios. Regras de participantes por serviço permanecem para a próxima rodada.
