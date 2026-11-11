# Backend local — recebimento de briefings

Requer Node.js 24 (testado em 24.19.0, SQLite nativo 3.53.3). Não usa contas, provedores externos ou credenciais de e-mail.

## Executar e validar

Na raiz do repositório:

```sh
node backend/server.cjs
node --test backend/server.test.cjs
```

O servidor entrega o frontend e a API na mesma origem, em `http://127.0.0.1:8000`. A porta pode ser definida por `PORT`. `HOST` aceita apenas `127.0.0.1`, `localhost` ou `::1`: esta versão é para teste local.

Dados ficam em `.local/requests.sqlite`, com arquivo de chave `.local/requests.sqlite.token-key`. Preserve ambos para retomar a instalação: a chave permite reproduzir os tokens de recibo após uma nova tentativa e um reinício. Removê-la invalida os tokens existentes. Não compartilhe esse diretório nem o inclua em commits. `PAYTRACK_DB_PATH` permite selecionar outro caminho local.

## API

- `GET /api/health`: informa `mode: "local"`, `registration: true` e `notificationStatus: "pending_configuration"`.
- `POST /api/requests`: JSON com os mesmos campos do formulário e cabeçalho `Idempotency-Key` único por intenção de envio, de 16 a 128 caracteres (`A–Z`, `a–z`, dígitos, ponto, hífen, sublinhado ou dois-pontos).
- Criação retorna **201** e `{protocol,status,createdAt,accessToken,notificationStatus,replayed}`. Mesmo conteúdo e chave retornam **200**, o mesmo protocolo/token e `replayed: true`. Reutilizar a chave com outro conteúdo retorna **409**.
- Validação retorna **422** e `{error: "validation_error", errors: {campo: "mensagem"}}`. JSON inválido e chave ausente retornam **400**; corpo acima de 128 KiB, **413**; tipo de conteúdo incorreto, **415**.
- `GET /api/requests/:protocol`: exige `Authorization: Bearer <accessToken>` e retorna somente protocolo, estado, data e situação da notificação. Sem token correto, retorna **404**, assim como protocolos inexistentes. O token é um segredo do cliente; não o coloque em URLs, logs ou rastreamento analítico. No SQLite fica somente seu hash.
- As rotas de listagem e gestão ficam em `/api/team` e exigem sessão autenticada. Arquivos do banco, backend, scripts, Git e dependências não são servidos ao navegador.

Os mínimos são definidos em `briefing-rules.js` e verificados no servidor: identificação do evento/destino, participantes ou desconhecimento explícito, datas válidas ou desconhecimento explícito, empresa, solicitante, e-mail e ao menos um serviço. Datas flexíveis ainda exigem um período. Campos opcionais fornecidos passam pelas verificações de formato. Preferências de serviços desmarcados e de campos condicionais ocultos são removidas antes da gravação e comparação de idempotência.

Um recebimento local significa que o registro e a intenção de notificação foram gravados na mesma transação SQLite. Não significa que um consultor recebeu ou avaliou o briefing nem que o prazo de cotação começou.

## Notificações e evolução

A tabela `notification_outbox` registra uma intenção de e-mail por solicitação com estado `pending_configuration` e zero tentativas. Esta versão não envia mensagens, não interpreta variáveis de credencial e nunca relata e-mail entregue. Para integrar um provedor homologado posteriormente, um worker deverá consumir a outbox, ter autenticação configurada fora do código, distinguir enfileiramento de entrega e registrar tentativas/erros sem expor dados pessoais. Repetições do POST não criam novas notificações.

Publicação, SSO corporativo, perfis individuais de acesso, backups, política de retenção, limites operacionais e provedor de notificação precisam ser definidos antes de disponibilizar o serviço à operação. O painel abaixo utiliza uma única conta de equipe local para testes; não substitui esses controles de produção.


## Painel local da equipe

Abra `/team.html` no servidor local. A primeira visita permite configurar uma senha de equipe com 12 a 128 caracteres. A senha é derivada com scrypt e salt aleatório; o SQLite guarda apenas salt/hash. Não há senha padrão, senha gerada automaticamente nem conta criada pelo comando de instalação. Os testes criam apenas contas fictícias em bancos temporários.

- `GET /api/team/setup-status` → `{configured}`.
- `POST /api/team/setup` com `{password}` → 201 e sessão autenticada; configuração já existente → 409.
- `POST /api/team/login` com `{password}` → 200 e sessão autenticada; senha incorreta → 401.
- `GET /api/team/session` → `{authenticated:true}` quando autenticado; sem sessão → 401.
- `POST /api/team/logout` → `{authenticated:false}` e invalidação da sessão.
- `GET /api/team/requests` → `{requests:[{protocol,eventName,companyName,status,assignedTo,createdAt,updatedAt}]}`.
- `GET /api/team/requests/:protocol` → `{request:{...resumo,payload},history:[{status,assignedTo,note,actor,createdAt}]}`.
- `PATCH /api/team/requests/:protocol` aceita um ou mais campos `{status,assignedTo,note}` e retorna o detalhe atualizado. Estados: `received`, `needs_information`, `quoting`, `proposal_sent`, `completed`. Responsável aceita até 120 caracteres; observação, até 2.000. Atualização e histórico são gravados juntos. Uma atualização sem alteração e sem observação não cria histórico redundante.

A sessão usa token aleatório forte em cookie `paytrack_team`, `HttpOnly`, `SameSite=Strict`, `Path=/api/team`, com prazo fixo de oito horas. Não usa `Secure` exclusivamente porque este servidor só aceita HTTP em loopback. Sessões ficam em memória, portanto reiniciar o servidor exige novo login. Login e configuração compartilham limite de cinco tentativas por minuto por endereço local; novas tentativas retornam 429 com `Retry-After`.

A tabela original `requests` é preservada: `request_workflow` mantém a situação/responsável e `request_history` registra alterações pela identidade fixa “Equipe local”. Solicitações já existentes recebem metadados adicionais ao abrir o banco, sem redefinir registros ou destruir o histórico. A consulta do cliente com token acompanha a situação atual do workflow sem expor responsáveis, notas, contatos ou dados do briefing.

Validação completa local:

```sh
node --test backend/server.test.cjs backend/team.test.cjs
```
