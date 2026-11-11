# Organização do sistema próprio

O produto é um sistema próprio de gestão de grupos e eventos. "Projeto Eventos" é uma identificação provisória. A referência Paytrack foi usada para explorar a aparência; não define o proprietário nem as regras do produto.

## Onde alterar cada parte

| Necessidade | Arquivo |
| --- | --- |
| Nome, logotipos, símbolo e fotografias | system-config.js → brand |
| Cores e fontes | system-config.js → theme |
| Contato e texto do prazo de cotação | system-config.js → operation |
| Organização e aparência dos componentes | design.css e demo.css |
| Etapas e interações do formulário | app.jsx |
| Validação e limpeza do briefing | briefing-rules.js |
| Registro, protocolo, sessão e acesso por empresa | backend/demo.cjs |
| Interface do portal do cliente e da equipe | portal.html e portal.js |

O tema gera propriedades CSS --theme-* e variantes RGB em tempo de execução. As classes pt-* do Tailwind são aliases de compatibilidade para essas propriedades: mudar o tema não exige substituir as classes dos campos. Os arquivos SVG dos logotipos são ativos independentes; para trocar a marca, substitua os ativos e seus caminhos na configuração. As fontes atuais são distribuídas na pasta fonts; uma família nova exige disponibilizar também o arquivo ou sua fonte de carregamento.

Dados comerciais pertencem a operation, não à identidade. Trocar cores e logotipos não deve alterar o prazo nem o atendimento. O prazo de quatro dias úteis foi preservado como configuração existente, e o contato fica "Atendimento pelo portal" até definir o endereço próprio.

## Compatibilidade de dados

Os prefixos legados de armazenamento e o identificador de sessão do servidor foram preservados. Eles são internos e não aparecem ao cliente. Não renomear esses identificadores sem uma migração. O banco e os protocolos existentes não foram alterados nesta rodada. Os dois servidores existentes continuam separados: demo é o fluxo principal, server.cjs é o legado local.

## Prévia tela por tela

assets/preview/index.html apresenta 13 capturas reais, feitas com um evento fictício e banco em memória. É uma galeria de revisão, não uma segunda implementação do sistema. Pode ser aberta diretamente ou servida pelo backend. As imagens são estáticas e precisam ser atualizadas quando as telas mudarem.

Fluxo: entrada, acesso, painel do cliente, evento, aéreo, hospedagem, salas e alimentação, transfers, empresa, revisão, confirmação, acompanhamento e painel interno.

## Limites desta rodada

O tema e a identidade foram separados da lógica existente. Não se trata de um sistema de múltiplas marcas por cliente: existe uma identidade por instalação. As quantidades por serviço continuam sendo a próxima melhoria funcional. A autenticação permanece demonstrativa, com contas fictícias.

Paytrack-Teste.html é uma distribuição histórica, anterior a esta organização. A prévia atual é a aplicação servida por npm start. Não usar esse HTML histórico para avaliar a versão atual.

## Verificação

Compilação concluída; 48 testes passaram, incluindo troca de nome/cor sem alteração de regras e existência dos ativos. Percurso real no navegador com todos os serviços, registro fictício e consulta pelos perfis de cliente e consultor. Backups desta rodada em .local/backup-identidade-20261103/.

## Simplificação do briefing e confirmação de status — 03/11/2026

Removida a faixa de etapas no topo. Navegação por Avançar/Voltar e pelos serviços do resumo lateral; no celular, resumo expansível. Minhas cotações e empresa ficam no resumo lateral, sem faixa duplicada acima do cabeçalho. Layout móvel com resumo inicial mais compacto.

Na confirmação: Ver minhas cotações é a ação principal, Atualizar status é secundária e possui espaçamento próprio.

Empresa e CNPJ são dados da conta. Campo CNPJ adicionado ao cadastro existente por migração não destrutiva, sem inventar valores de demonstração. O servidor usa o CNPJ do cadastro ao gravar novos briefings. Não há gestão de filiais nesta rodada. Centro de custo preservado.

Seleção de status pelo consultor não grava automaticamente. Exibe estado anterior/novo e exige Confirmar alteração; Cancelar restaura a seleção. Falha de rede mantém a alteração pendente, com mensagem e possibilidade de nova tentativa.

Compilação concluída e 51 testes passaram. Verificados no navegador: cancelamento, confirmação e situação vista pelo cliente; formulário sem lista superior; dados da empresa e botões de confirmação.

Editor de proposta comercial aguarda a planilha de referência do usuário para definir campos, valores, cálculos e condições. Fluxo previsto: rascunho do consultor → prévia → publicação explícita → visualização pelo cliente. Ainda não implementado.

Capturas em assets/preview correspondem à rodada anterior e não representam esta simplificação de navegação. Prévia desta rodada: porta 8004, banco em memória e dados fictícios.
