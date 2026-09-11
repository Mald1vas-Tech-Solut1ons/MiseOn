-- ============================================================================
-- A CONTA DA PLATAFORMA PASSA A SER DECLARADA, NÃO DEDUZIDA
--
-- ─── O QUE QUEBROU ─────────────────────────────────────────────────────────
-- O cartão tem três pontas que precisam apontar para a MESMA conta Efí:
--
--   1. o navegador emite o token com `setAccount(<identificador da conta>)`;
--   2. a edge function autentica com um par CLIENT_ID/SECRET;
--   3. a Efí credita a conta que autenticou (a doc do split é explícita: o
--      restante do repasse "será automaticamente transferido para a conta do
--      integrador" — ou seja, quem autentica é SEMPRE recebedor).
--
-- Essas três pontas viviam em lugares diferentes: a (1) num campo do banco, a
-- (2) num nome de secret escolhido por ordem de precedência no código, e a (3)
-- em lugar nenhum. Em 09/09/2026 uma secret nova apareceu, o `envFirst` passou
-- a escolher outro par, e a cobrança migrou de conta SEM NENHUMA MUDANÇA DE
-- CÓDIGO. O sintoma foi "payment_token não existe" para todos os clientes —
-- token emitido numa conta, cobrado em outra.
--
-- ─── COMO FICA ─────────────────────────────────────────────────────────────
-- A conta da plataforma passa a ser declarada aqui, com o `key_id` que a Efí
-- devolve dentro do próprio access_token. A função compara o que autenticou
-- com o que está declarado e RECUSA antes de falar com a Efí quando diverge.
--
-- Isso não é validação decorativa: é a diferença entre um erro explícito no
-- deploy e meses de recusa inexplicável no checkout de todo mundo.
--
-- Nada aqui restringe o tipo de conta do lojista. Tenant pessoa física e
-- tenant pessoa jurídica são, para a Efí, os dois apenas um `payee_code` de
-- 32 caracteres — a documentação do split não distingue. O que precisa ser
-- único e estável é a conta DA PLATAFORMA, que é a que cobra.
-- ============================================================================

alter table public.configuracoes_fiscais_plataforma
  add column if not exists efi_key_id integer;

comment on column public.configuracoes_fiscais_plataforma.efi_key_id is
  'key_id da conta Efi da plataforma (vem dentro do access_token). A funcao de cartao recusa a cobranca se a credencial autenticar noutra conta.';

-- Conta atual da plataforma: PJ 950009, key_id 3102801, identificador
-- baf9ef35…1e16 — a mesma que emite o token no navegador.
update public.configuracoes_fiscais_plataforma
   set efi_key_id = 3102801
 where id = true
   and efi_payee_code = 'baf9ef359faf83a61705cdbe32a21e16';
