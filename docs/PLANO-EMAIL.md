# E-mail no MiseOn — regra de negócio, arquitetura e backlog

Status: **E1 concluída e em produção** (2026-07-22)
Projeto Supabase: `zzuxklwhaoisuuvndtfw` · Domínio: `https://miseon.vercel.app`

---

## 1. Princípios

**E-mail é consequência de evento, nunca de clique.** Não existe botão "enviar
e-mail". O banco observa transições de estado e enfileira. Isso vale igual
para pedido vindo do PDV, do cardápio, do webhook da Efí ou do iFood — a regra
não mora no frontend, então não tem caminho que escape dela.

**A fila é a única porta de entrada.** Tudo passa por `fn_email_enfileirar`,
que valida endereço, aplica consentimento, aplica janela de silêncio e
deduplica. Nenhum código envia e-mail direto.

**Idempotência por `(loja_id, evento, referencia_id)`.** O webhook da Efí
repete notificação — e repete mesmo. Sem essa chave única o cliente receberia
sete confirmações do mesmo pagamento.

**Consentimento é por endereço, não por conta.** O cliente final do restaurante
não tem login no MiseOn. Amarrar preferência em `auth.users` deixaria ele sem
como se descadastrar, o que é problema de LGPD antes de ser de UX.

**Link em e-mail não tem desfazer.** Depois de enviado, um link errado é
permanente. Por isso o domínio vive no secret `SITE_URL` e toda URL é derivada
de id real no momento do envio — nunca escrita à mão no payload.

---

## 2. Matriz de eventos

| Evento | Gatilho | Classe | Referência (dedup) |
|---|---|---|---|
| `pedido-recebido` | `AFTER INSERT ON pedidos` | Transacional | `pedido.id` |
| `pagamento-confirmado` | `pagamentos.status → PAGO` | Transacional | `pedido.id` |
| `pedido-a-caminho` | `pedidos.status → EM_ROTA` | Transacional | `pedido.id` |
| `pedido-entregue` | `pedidos.status → FINALIZADO` | Transacional | `pedido.id` |
| `carrinho-abandonado` | varredura, 45 min parado | **Marketing** | `carrinho.id` |
| `cupom-disponivel` | campanha do lojista | **Marketing** | `cupom`/campanha |
| `acesso-equipe` | criação de login | Transacional | `user_id` |

Pedido de **salão não gera** aviso de entrega: o cliente está na mesa.
Pagamento dividido gera **um** e-mail, porque a referência é o pedido.

### Transacional vs Marketing

**Transacional** é legítimo interesse: confirma pagamento, entrega, acesso.
Não exige opt-in e **não pode ser desligado** — sem ele o cliente não sabe se
o dinheiro dele foi capturado.

**Marketing** exige opt-in explícito em `email_consentimentos`, tem link de
descadastro obrigatório no rodapé, respeita **janela de 8h–22h** e no máximo
**1 envio por endereço por loja a cada 7 dias**. Essas regras estão no Postgres,
não na aplicação, para valerem mesmo se o disparo vier de fora do app.

---

## 3. Arquitetura

```
evento de negócio
   │
   ├─ trigger no Postgres  ──►  fn_email_enfileirar()
   │                              ├─ valida e-mail
   │                              ├─ consentimento (marketing)
   │                              ├─ janela de silêncio (marketing)
   │                              └─ dedup por referência
   │                                    │
   │                              email_fila (PENDENTE)
   │                                    │
   └─ worker (edge function) ──► fn_email_reservar()  ← FOR UPDATE SKIP LOCKED
                                        │
                                  hidrata do banco  ← itens só existem depois do INSERT
                                  monta URL a partir de SITE_URL + id
                                  renderiza Handlebars
                                  envia SMTP
                                        │
                                  email_log + status ENVIADO
```

**Por que hidratar no envio e não no gatilho:** no `AFTER INSERT` do pedido os
registros de `itens_pedido` ainda não existem — entram na transação seguinte.
Montar o payload cedo produziria e-mail sem os itens. `fn_email_pedido_payload`
roda no momento do despacho, quando o pedido está completo.

**Retry:** backoff de 2min / 8min / 32min, 4 tentativas, depois `FALHOU` com o
erro registrado em `email_log`.

### Objetos criados

| Objeto | Papel |
|---|---|
| `email_fila` | fila com dedup, status, tentativas, agendamento |
| `email_consentimentos` | opt-in por `(loja_id, email)` + token de descadastro |
| `email_log` | histórico de envio, com `loja_id`, `evento`, `classe` |
| `fn_email_enfileirar` | porta de entrada única |
| `fn_email_reservar` | reserva atômica do lote (`SKIP LOCKED`) |
| `fn_email_pedido_payload` | dados do pedido no instante do envio |
| `fn_email_pode_marketing` | opt-in + limite de 7 dias |
| `fn_email_proxima_janela` | adia marketing para 8h |
| `fn_email_varrer_carrinhos` | detecta carrinho parado há 45 min |
| `fn_email_descadastrar` | descadastro por token, sem login |

Migrations: `20260722050000_email_fila.sql`, `20260722060000_email_gatilhos.sql`.
Function: `supabase/functions/send-transactional-email/`.
Página pública de descadastro: `/email/descadastro?t=<token>`.

---

## 4. Segurança — decisões e porquês

**A service role key não circula.** A drenagem da fila deve ser autenticada por
um token dedicado (`EMAIL_WORKER_TOKEN`), não pela service key. Se o token
vazar, o atacante drena uma fila de e-mails já aprovados; se a service key
vazar, ele é dono do banco. Menor privilégio.

**`pg_cron` + `pg_net` foram descartados de propósito.** Fariam o Postgres
chamar a edge function, mas exigiriam guardar a service key dentro do próprio
banco (Vault) — uma segunda cópia do segredo mais crítico, dentro do sistema
que ele protege. O agendamento fica externo.

**Senha nunca vai por e-mail.** O template `acesso-equipe` entrega login e URL
de acesso; a senha é repassada presencialmente. E-mail fica em texto na caixa
do destinatário para sempre, é encaminhável e cairia no `email_log`.

**O token de descadastro é opaco.** A URL carrega um UUID, nunca o e-mail —
endereço em query string vaza em log de servidor, histórico e `Referer`.

**RLS:** `email_fila`, `email_consentimentos` e `email_log` são legíveis só
pelo admin da loja; escrita apenas por service role e funções `SECURITY
DEFINER`. `email_log` estava **sem RLS** antes desta entrega.

---

## 5. Pendências para produção

| # | Pendência | Por que importa |
|---|---|---|
| P1 | **Definir os segredos do agendador** (ver 5.1) | O código está pronto e no ar, mas sem os segredos a drenagem agendada responde 401 |
| P2 | **Revogar a App Password do Gmail** exposta no histórico do Git e gerar outra | Credencial comprometida em repositório |
| P3 | **Migrar para Resend com domínio próprio** (SPF/DKIM/DMARC) | Gmail limita ~500/dia e o remetente aparece como conta pessoal; sem DKIM o volume vai para spam |
| P4 | **Capturar e-mail no checkout** | `clientes.email` é opcional e o fluxo é telefone-first: hoje a maioria dos clientes não tem e-mail, e a fila descarta em silêncio |
| P5 | Trocar `acesso-equipe` por **link de senha de uso único** (`generateLink`) | Elimina a senha em trânsito e a senha fixa versionada no seed |

### 5.1 Como a fila é drenada

**Atualizado em 23/09/2026.** Quem entrega é o `pg_cron` `drenar-fila-email`,
de minuto em minuto, dentro do banco (`fn_email_drenar_fila`). Medido: mediana
de 30 s entre agendar e enviar, pior caso 92 s. O antigo Vercel Cron diário
(`/api/cron/email`, 08:00 BRT, limite do plano Hobby) foi removido por
redundância.

| Camada | Quando | Autenticação | Alcance |
|---|---|---|---|
| `pg_cron` | a cada minuto, só se há item pronto | `EMAIL_WORKER_TOKEN_DB` (Vault) | todas as lojas |
| Manual | sob demanda | `EMAIL_WORKER_TOKEN` | todas as lojas |

O drenador só chama a edge function se existir item que ela **consegue**
enviar agora (`fn_email_pronto_para_envio`, o mesmo predicado da reserva).
Antes de olhar, arruma a fila (`fn_email_arrumar_fila`): reserva órfã
(`ENVIANDO` há mais de 15 min) volta contando tentativa e, na 4ª, vira
`FALHOU`; confirmação de pedido cancelado ou apagado vira `SUPRIMIDO`. Nenhum
item fica eterno. Prova: `supabase/tests/email_fila_sem_item_eterno.sql`.

> O restante desta seção descreve o desenho original com o Vercel Cron. O
> modelo de tokens continua valendo; `CRON_SECRET` e `SUPABASE_FUNCTIONS_URL`
> na Vercel não são mais usados por nada.

O horário do cron coincide com a abertura da janela de silêncio, então o
marketing represado durante a madrugada sai na primeira execução do dia.

**A service role key não circula.** O agendador usa `EMAIL_WORKER_TOKEN`, que
só sabe drenar a fila. Se vazar, o estrago é disparar e-mails já aprovados; a
service key daria o banco inteiro.

A edge function roda com `verify_jwt: false` — obrigatório para o agendador
autenticar por token próprio. Em troca, **cada ação autentica a si mesma**:
`processar` exige o token do worker, `drenar` exige JWT com vínculo na loja,
`teste` exige JWT de admin da loja, e qualquer outra ação é rejeitada.
Token ausente e token errado devolvem o mesmo 401, para não revelar o estado
do serviço a quem sonda de fora.

#### Segredos a definir (uma vez)

Gere um valor aleatório forte, por exemplo:

```bash
openssl rand -base64 32
```

| Onde | Nome | Valor |
|---|---|---|
| Supabase → Edge Functions → Secrets | `EMAIL_WORKER_TOKEN` | o valor gerado |
| Vercel → Environment Variables | `EMAIL_WORKER_TOKEN` | **o mesmo** valor |
| Vercel → Environment Variables | `CRON_SECRET` | outro valor aleatório |
| Vercel → Environment Variables | `SUPABASE_FUNCTIONS_URL` | `https://zzuxklwhaoisuuvndtfw.supabase.co/functions/v1` |

O `CRON_SECRET` é enviado automaticamente pela Vercel como `Bearer` no header
das execuções agendadas — não precisa de código para isso.

Conferir depois de configurar:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST https://zzuxklwhaoisuuvndtfw.supabase.co/functions/v1/send-transactional-email \
  -H 'Content-Type: application/json' -H "x-worker-token: $EMAIL_WORKER_TOKEN" \
  -d '{"acao":"processar"}'
```

`200` = drenando. `401` = token divergente entre os dois cofres.

---

## 6. Backlog — Campanhas de e-mail para o lojista

Objetivo: o lojista cria campanhas na aba **Marketing**, com banner e narrativa
próprios, e vê **quanta receita a campanha gerou**.

### E2 — Construtor de campanhas
Aba `campanhas` em `src/pages/admin/Marketing.tsx`.

- Tabela `email_campanhas`: `titulo`, `assunto`, `previa`, `banner_url`,
  `story` (texto do lojista), `cta_texto`, `cta_url`, `cupom_id`, `publico`,
  `status` (RASCUNHO/AGENDADA/ENVIANDO/ENVIADA), `agendada_para`.
- Template `campanha.hbs`: banner no topo, story, cupom opcional, CTA — mesma
  moldura MiseOn + card da loja dos demais.
- Banner via `ImageUpload` (bucket `loja-assets`), proporção 2:1.
- Público: `todos com opt-in`, `compraram nos últimos 30/90 dias`,
  `nunca compraram`, `ticket acima de X`.
- Pré-visualização real usando a ação `teste` da function (`somente_html`).
- Disparo: `fn_email_campanha_disparar(campanha_id)` enfileira como MARKETING —
  herda opt-in, janela e limite de 7 dias sem código novo.

**Depende de P1 e P4.** Sem agendamento a campanha não sai; sem e-mail no
cadastro o público é pequeno demais para valer a pena.

### E3 — Resultado da campanha (receita atribuída)
A pergunta que decide se o lojista continua usando: *quanto isso me deu?*

- `email_log` ganha `campanha_id`; cupom da campanha vira o elo de atribuição.
- Atribuição direta: pedidos com `cupom_id` da campanha.
- Atribuição por janela: pedidos de destinatários da campanha em até 72h do
  envio, mesmo sem cupom (marcar como "assistida", não creditar igual).
- Painel: enviados · entregues · **pedidos gerados** · **receita** · ticket
  médio · custo zero → ROI.
- Requer tracking de abertura/clique (`opened_at`/`clicked_at` já existem em
  `email_log`, hoje não populados) — pixel + redirect assinado.

### E4 — Cashback no e-mail
- `pedido-entregue` já tem o bloco de cashback pronto no template; falta ligar
  em `cashback_movimentos` na hidratação.
- Campanha "seu cashback expira em 7 dias" — alto retorno, baixo custo.

### E5 — Recuperador de carrinho com IA
- Hoje a varredura de 45 min é regra fixa. Evoluir para o agente já existente
  (Groq, ver `docs/PLANO-WHATSAPP.md`) escolher **quando** e **com qual oferta**
  abordar, a partir do histórico do cliente.
- Cupom dinâmico: só oferece desconto quando o carrinho não converteria sozinho,
  para não queimar margem com quem já ia comprar.
- Canal escolhido pelo próprio agente: WhatsApp se houver sessão ativa, e-mail
  como fallback.

**Ordem sugerida:** P1 → P4 → E2 → E3 → E4 → E5. E3 é o que transforma a
funcionalidade em argumento de venda; E5 só faz sentido com E3 medindo.
