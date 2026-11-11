# Revisão de UX — Grupos e Eventos

Revisão heurística de 29/10/2026, baseada no formulário Word, aplicação e Brandbook Paytrack 2026. Não substitui pesquisa com clientes, auditoria completa de acessibilidade ou medição de conversão.

## Ajustes implementados

- Fundo azul institucional; painel, revisão e barra de navegação uniformizados no branco oficial #FFFAEB.
- Tipografia funcional ampliada, destaque da etapa atual e ação principal em amarelo.
- Informação de rascunho salvo no navegador, com estados de gravação e falha. Não promete sincronização entre dispositivos nem recebimento pela Paytrack.
- Indicação da próxima etapa; remoção visual do botão Voltar indisponível na primeira etapa.
- Instrução explícita de seleção de múltiplos serviços; linguagem mais simples para participantes e datas.
- Associação de rótulos aos campos principais; autocomplete de empresa, nome, e-mail e telefone e teclado adequado para telefone e CNPJ.
- Ações finais descrevem abertura do aplicativo; orientação de que o cliente precisa concluir o envio. Ação PDF descreve impressão/salvamento pelo navegador.

## Atualização: piloto local com registro

Implementados: datas indefinidas/flexíveis, quantidade desconhecida/estimada, preferências neutras e orientação por serviço, revisão de pendências com atalhos, validação compartilhada cliente/servidor, limpeza de campos ocultos e registro transacional SQLite com protocolo. O HTML único permanece autônomo para preencher e exportar. A API local usa Node 24 e não envia e-mails. O painel da equipe local permite listar, filtrar, atribuir responsável e atualizar situações com histórico, protegido por uma senha criada no primeiro acesso. A autenticação corporativa continua pendente.

A primeira versão do registro foi verificada com 40 testes automatizados e um percurso no Chromium de pendências → correção → gravação → confirmação, incluindo clique duplo e repetição sem duplicação.

## Prioridades para evoluir o produto

### 1. Recebimento confiável — antes do uso operacional

Há registro e protocolo locais, sem notificação à equipe. Os atalhos mailto e WhatsApp continuam abrindo aplicativos externos. Para atendimento real, publicar o backend em infraestrutura aprovada, integrar notificações e distinguir registro de entrega ao destinatário. O prazo de cotação deve ser contado a partir do recebimento completo, conforme regra validada pela operação.

### 2. Dados mínimos sem bloquear a descoberta

O registro local valida dados mínimos e permite datas e quantidade explicitamente indefinidas. A revisão lista pendências e atalhos; a navegação é livre. A operação ainda precisa confirmar os requisitos definitivos para cotação, incluindo o tratamento de pedidos de orientação e a distribuição de quartos. Não apresentar completude ou prontidão apenas porque o cliente chegou à última etapa.

### 3. Permitir a incerteza do planejamento

Novos clientes podem não ter datas, quantidade de pessoas, padrão de hotel ou orçamento definidos. Avaliar opções explícitas como “Ainda não definido”, “Quantidade estimada” e “Preciso de orientação”. Separar preferências de exigências e evitar que valores pré-selecionados sejam interpretados como escolhas deliberadas. Essas respostas precisam ter tratamento conhecido pela equipe de atendimento.

### 4. Reduzir o esforço de jornadas longas

Testar a separação entre informações essenciais e detalhes avançados, especialmente em aéreo e hospedagem. Mostrar campos condicionais apenas quando relevantes. Investigar se dados cadastrais/faturamento podem ser solicitados em um segundo momento, mantendo no primeiro contato somente o necessário para retornar ao cliente. Não remover dados sem validar a necessidade operacional.

### 5. Privacidade e acessibilidade

Definir política de retenção e limpeza do rascunho para dispositivos compartilhados, opção de apagar dados e informação clara sobre o uso dos dados. Confirmar com responsáveis o texto e o destino da política de privacidade. Completar a auditoria de teclado e leitor de tela, especialmente autocomplete de cidade, mensagens de erro e todos os controles condicionais. Os rótulos principais foram associados; isso não representa conformidade integral com WCAG.

## Piloto recomendado

Convidar 5–8 pessoas representativas de novos clientes, incluindo usuários de celular. Pedir que planejem um caso realista usando o Word e a versão web, alternando a ordem. Observar sem orientar cada clique. Dados fictícios evitam envios indevidos.

Medir tempo para preencher um briefing utilizável, conclusão por etapa, informações ausentes, pedidos de ajuda e tempo de conferência pela equipe. Perguntar ao final o que a pessoa acredita ter acontecido ao acionar e-mail/WhatsApp. Apresentar resultados como piloto, com tamanho e perfil da amostra; não extrapolar ganhos como comprovados antes da medição.
