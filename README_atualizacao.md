# Paytrack — Planejamento de Grupos & Eventos

## Abrir
Abra index.html no navegador. As bibliotecas React, Tailwind, Babel e Lucide são carregadas da internet.

## Fluxo
Abertura → Evento → Serviços selecionados → Empresa e solicitante → Revisão.
A animação de abertura inicia a cotação em aproximadamente 1 segundo: 300ms para reduzir/reposicionar o símbolo, 600ms para a saída diagonal e 100ms para a troca de tela.

## Experiência de planejamento
- Evento como primeira etapa: nome, destino, período, participantes e serviços.
- Resumo lateral atualizado durante o preenchimento, com atalhos de edição.
- Resumo recolhível em telas pequenas.
- Empresa, contato e faturamento ao final, antes da revisão.
- Briefing por serviço com botão Editar. Concluir edição retorna diretamente à revisão.
- Painel claro com raio de 14px, campos com raio de 10px, seletores curtos em cápsula.
- Conteúdo com transição breve de saída e deslizamento suave de entrada.
- Preferência por movimento reduzido respeitada.
- Obrigatoriedade permanece temporariamente desativada.
- Rascunho armazenado no navegador.

## Referências
As imagens originais estão em ../referencias-visuais/.
A foto aplicada à abertura está em assets/evento-auditorio.png.
DIRECAO-VISUAL.md descreve o acabamento atual.

## Limites atuais
WhatsApp e e-mail continuam sendo simulações da versão original: as mensagens de sucesso não comprovam transmissão. Copiar resumo e imprimir usam os recursos do navegador. Não há backend ou registro central de solicitações.

## Verificação desta alteração
Sintaxe JSX analisada com Babel. Conferidas as 16 combinações de serviços, retorno à revisão após editar/remover serviços e preservação do resumo textual.
Não houve validação visual no navegador nesta rodada.
