# Etapa 3 — proposta persistida, versão, aceite e ciclo do evento

## Resultado e limites

Implementada a primeira etapa da sequência autorizada pelo usuário: base comercial no servidor e ligação com o editor e o cliente. Esta entrega não conclui todas as mudanças do produto. Fornecedores, comparação completa, NET/margem/descontos/políticas fiscais, edição estruturada de contatos, comentários/revisões e administração permanecem no roteiro abaixo.

O tema provisório foi preservado. O editor/proposta ganhou títulos mais compactos, superfícies neutras, indicação de versão, confirmação explícita e navegação no fluxo da página. Corrigida a sobreposição do rodapé. Não houve cópia de interface privada ou ativos da Qondor; são refinamentos próprios coerentes com o critério já estabelecido de clareza e organização.

## Implementado

- Novo backend/commercial.cjs com tabelas aditivas: commercial_drafts, commercial_versions, commercial_approvals, event_lifecycle e commercial_audit.
- Rascunho comercial exclusivo da equipe, com revisão obrigatória contra sobrescrita simultânea. O cliente não recebe seu conteúdo nem seu histórico privado.
- Publicação explícita de snapshot persistido. Validação de forma, IDs únicos/seguros, limites de itens, condições, fornecedor, validade e preços. Valores pendentes, negativos, em moeda diferente de BRL e hospedagem sem datas/ocupação impedem publicar.
- Cálculo no servidor reutiliza proposal-rules.js: centavos/BigInt, arredondamento por linha, quantidades/diárias, taxa adicional ou inclusa e base de agenciamento. Totais enviados pelo cliente são descartados.
- Nova versão mantém versões e aceites anteriores. A aprovação é vinculada à última versão e às alternativas escolhidas, com usuário/data/total em centavos. Exige confirmação explícita, validade vigente e escolhas completas. Aceite desatualizado é rejeitado; repetir exatamente o mesmo aceite não duplica o registro.
- Publicação atualiza a cotação para proposta disponível e registra histórico na mesma transação. Aprovação permanece um registro comercial separado da situação da cotação.
- Evento separado: previsto, em andamento, concluído ou cancelado. A equipe confirma manualmente com motivo/revisão/histórico. Avançar para em andamento/concluído exige algum aceite comercial registrado. Uma revisão pendente não apaga o aceite anterior nem muda automaticamente o evento. Datas não avançam a situação automaticamente.
- Correção informativa pode ser registrada como anotação interna, sem modificar o snapshot aprovado. Não é ainda um editor estruturado de contato/passageiro: informar uma correção no histórico não altera um cadastro nem confirma uma troca junto ao fornecedor. Mudanças comerciais usam nova versão e novo aceite.
- Motivos de evento, notas informativas e alterações de rascunho ficam no histórico interno. Cliente vê versões/aceites e estado do evento; os detalhes desses registros internos não são retornados.
- Editor vinculado à cotação começa somente com serviços selecionados no briefing, valores em branco e fornecedor/condições a preencher. Não importa automaticamente rascunhos fictícios do navegador. A demonstração sem parâmetro quote continua identificada como amostra local.
- Cliente acessa versões publicadas pelo portal, escolhe opções, confirma a leitura das condições e aprova a versão. Versões substituídas/aprovadas são de leitura. O consultor pode simular a visão do cliente, mas não aprovar por ele.
- Portal mostra link de proposta e indicação de versão/aprovação. Rótulo legado Finalizada passou a Encerrada, distinguindo encerramento da cotação de conclusão do evento; o código closed e os registros antigos foram preservados.
- Corrigido o foco do editor: mudança de campo de texto/número não recria o formulário no blur e não descarta a edição do campo seguinte. Os totais da tela são atualizados ao navegar/alternar seções; validação e cálculo finais sempre ocorrem no servidor.

## Backup e migrações

Antes das alterações, código e cópia consistente do SQLite foram preservados em .local/backup-etapa3-base. Dados do backup não foram usados como massa de teste nem copiados para outputs. As novas tabelas são criadas ao iniciar o backend atualizado. Nesta sessão, o banco original não foi iniciado com o código novo; os testes executaram migrações somente em bancos fictícios. Nenhum protocolo antigo foi renumerado.

Para visualizar no fluxo habitual, reiniciar o servidor pelo inicializador existente. Caso haja uma janela antiga do servidor aberta, ela continua executando o código anterior até reiniciar. Restaurar código anterior é possível pelo backup; não restaurar SQLite antigo por cima de novas gravações sem conciliação.

## Testes e evidências

- 73/73 testes aprovados; build concluído. Permanece aviso não bloqueante de Browserslist desatualizado; não foram atualizadas dependências.
- Casos novos: sessão/papel/empresa, privacidade do rascunho, consentimento, cálculo de aceite ignorando total adulterado, preservação de snapshot aprovado, versão desatualizada, preço pendente/negativo/moeda inválida, IDs duplicados, escolhas adulteradas/incompletas, validade expirada, evento independente, histórico interno e rollback de publicação/histórico.
- Persistência comercial verificada reabrindo uma cópia de teste do banco: versões, aceite e auditoria permanecem.
- Conferência financeira: 100,01 × 5 quartos × 2 noites = 1.000,10; 5% adicionais arredondados = 50,01; base 1.050,11; agenciamento 10% arredondado = 105,01; total = 1.155,12. O primeiro valor esperado no teste estava um centavo abaixo e foi corrigido após conferir cada etapa; o algoritmo não foi alterado.
- Percurso Chrome isolado com banco em memória: cliente fictício envia briefing, consultor preenche valores/condições, publica v1, cliente escolhe/confirma/aprova, recarrega preservando leitura, consultor registra evento em andamento, empresa Beta recebe 404 para proposta Alpha. Resultado: outputs/etapa3/checks.json.
- Capturas: editor de contexto/publicação, opções do cliente, aceite desktop/mobile e acompanhamento de evento desktop/mobile. Conferência visual de publicação desktop e aceite mobile. Medição de largura de conteúdo versus viewport nos cenários capturados sem excedente. Não equivale a auditoria integral de acessibilidade ou uso produtivo.

## Sequência de trabalho — todas as mudanças continuam no escopo

1. **Base comercial e primeira revisão do layout — entregue nesta etapa**, com os limites acima.
2. **Fornecedores e pedidos de cotação:** cadastro por escopo autorizado, hotéis/serviços, briefing estruturado, respostas e histórico. Portal de fornecedor em etapa própria. Sem envio real de mensagens por padrão.
3. **Comparação e regras comerciais:** alternativas padronizadas de hotéis/serviços, NET, preço de venda, margem/comissão com bases explícitas, impostos, descontos e capacidades; cálculos determinísticos e auditáveis. Não assumir percentuais da planilha de referência.
4. **Revisão e ajustes após aceite:** comentários por versão, revisão do cliente, alterações informativas estruturadas com antes/depois, pedidos de mudanças comerciais e nova aprovação. Troca de passageiro/serviço com efeito comercial exige tratamento de fornecedor; não basta editar um nome.
5. **Fluxo e administração:** formalizar transições de cotação, carteira/permissões de consultor, gestão nominal de usuários/empresas, prazos/retenção de rascunhos e auditoria geral. O acesso consultor global e a autenticação demo continuam limitações conhecidas.
6. **Layout de ponta a ponta:** consolidar navegação e componentes, aprimorar tabela/comparação para operação densa e manter simplicidade no cliente; testar teclado, leitor de tela, contrastes, aparelhos reais e estados vazios/erro/carregamento.

Cada etapa deve preservar o banco, ter testes de isolamento por ID e percursos reais, capturas e relatório. Branding/naming continuam pausados; execução integral de eventos e financeiro pós-evento permanecem fora do escopo.
