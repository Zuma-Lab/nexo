# Experiência da proposta por etapas — 03/11/2026

## Escopo e conclusão

Avaliação heurística e percurso funcional no navegador; ainda não é pesquisa com clientes. A direção é uma decisão por tela, duas alternativas comparáveis e preços com unidade explícita. O protótipo está em /assets/proposal/index.html. Não publica propostas, não envia escolhas ao servidor e não confirma reservas.

## Ajustes implementados

- Cliente: aéreo → hospedagem → transfer → alimentação → seguro opcional → revisão.
- Duas opções no aéreo (LATAM/GOL), hospedagem (Transamérica X/Comfort Y) e transfer (A/B). Valores fictícios, exclusivamente em reais.
- Aéreo: total por pessoa, tarifa por pessoa e taxa de embarque por pessoa, com total do grupo secundário. Não repete uma linha para cada passageiro.
- Hotel: diária por quarto, taxa por unidade, quantidade de quartos, ocupação, datas e noites. Café incluso sem cobrança duplicada.
- Transfer: valor por veículo e trecho; capacidade e quantidade de veículos explicitadas nos exemplos. Não confundir preço do veículo com preço individual.
- Quantidades independentes: evento com 50 participantes; 30 viajantes; hotel com 15 quartos duplos por duas noites; alimentação para 50 pessoas.
- Detalhes extensos sob expansão; revisão compacta, com composição do preço disponível para conferência.
- Avanço bloqueado enquanto faltar escolha válida. Serviço opcional tem ação explícita de continuar sem inclusão.
- Alteração a partir do resumo retorna diretamente à revisão, sem refazer todas as telas seguintes.
- Seleção mantém nome acessível estável e foco no controle escolhido. Mudança de tela foca o título.
- Consultor: uma alternativa por vez; detalhes, valores e condições separados. Digitação preservada ao trocar de aba.
- Cardápios e outras moedas seguem adiados.

## O que os testes mostraram

No computador (1280 × 900), as duas alternativas ficam lado a lado. No celular (390 × 844), ficam empilhadas, mantendo somente o serviço atual. Aéreo e hospedagem não apresentaram transbordamento horizontal: largura do conteúdo igual à área disponível (375 px, descontada a barra vertical). Voltar/continuar ficam em faixa inferior aderente. Há rolagem dentro do serviço no celular; a página não reúne todos os serviços de uma vez.

Percurso GOL + Comfort Y + Transfer A + almoço, sem seguro: R$ 41.970,00. A alteração do aéreo para LATAM manteve hotel, transfer, alimentação e exclusão do seguro, atualizando o total para R$ 44.970,00. A confirmação demonstrativa exibiu que nenhuma reserva foi realizada.

No editor, alterar tarifa LATAM de R$ 900 para R$ 950 e trocar de aba preservou a edição: total por pessoa R$ 1.050 e grupo R$ 31.500. Essa edição não foi salva como oferta real.

59 testes automatizados passaram, incluindo oito de cálculo de proposta. Cálculo em centavos evita erros comuns de somas decimais. Valores pendentes não são tratados como gratuitos. A biblioteca rejeita seleção com preço incompleto e rateio aéreo entre quantidades incompatíveis.

## Gargalos ainda existentes e prioridades

| Prioridade | Risco para o cliente | Próximo ajuste necessário |
|---|---|---|
| Antes do uso real | Perder escolhas ao atualizar ou trocar de dispositivo | Salvar no servidor por empresa, solicitação, cliente e versão da proposta; rascunho local atual é do consultor, escolhas ficam na sessão da página. |
| Antes do uso real | Consultor mudar preço depois de o cliente escolher | Publicação explícita de versão imutável, histórico e reconfirmação quando uma versão substituir a anterior. |
| Antes do uso real | Escolher um voo sem perceber restrição de horário ou bagagem | Trechos estruturados com origem/destino, datas, horários, conexão e bagagem; resumo essencial sempre visível, regras extensas recolhidas. Exemplos atuais ainda usam texto livre e horários a confirmar. |
| Antes do uso real | Escolher hotel/transfer que não atende o grupo | Validar ocupação por categoria, grupos de hóspedes, capacidade e bagagem por veículo. Hoje os exemplos são coerentes, mas a edição não valida automaticamente toda essa compatibilidade. |
| Antes do uso real | Interpretar escolha como contratação ou disponibilidade garantida | Estados separados de escolha, aceite e reserva; validade obrigatória para publicar e disponibilidade revisada. |
| Próxima rodada | Formulário do consultor ainda denso na aba de valores | Reduzir campos repetidos com padrões por serviço e recolher taxas especiais. Não omitir encargos do cliente. |
| Próxima rodada | Voltar e avançar ainda exigir esforço em casos complexos | Atalhos aos serviços já visitados e retorno direto à revisão; manter indicação de pendências. |
| Validação com usuários | Duas alternativas no celular exigem lembrar a primeira | Teste curto com clientes: escolher opção, explicar tarifa/taxa, trocar hotel e conferir total; avaliar uma comparação compacta se houver dificuldade. |

Publicação, autorização de acesso e recálculo no servidor continuam necessários. O botão de alternar entre consultor e cliente pertence à demonstração; no produto cada perfil deve ver somente as ações autorizadas. Nenhuma taxa dos exemplos é política comercial fixa.

## Evidências locais

- .local/proposta-aereo-etapas.png
- .local/proposta-hotel-etapas.png
- .local/proposta-revisao-etapas.png
- Backup anterior desta rodada: .local/backup-proposta-etapas/
