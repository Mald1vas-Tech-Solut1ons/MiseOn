-- ============================================================================
-- CARTÃO SALVO — sem o número do cartão passar por nós
--
-- ─── O PROBLEMA ────────────────────────────────────────────────────────────
-- Hoje o cliente digita número, nome, validade, CVV e CPF a CADA compra. Num
-- delivery isso é a diferença entre o segundo pedido acontecer ou não: quem já
-- comeu ali uma vez quer repetir em dois toques, não preencher um formulário
-- de cinco campos com o celular na mão.
--
-- O que impedia: `EfiPay.CreditCard...setCreditCardData({ reuse: false })`. Com
-- `reuse` desligado o token vale para UMA cobrança e é descartado. Não havia o
-- que guardar — e guardar o número do cartão nós não podemos nem queremos.
--
-- ─── COMO FICA ─────────────────────────────────────────────────────────────
-- Com `reuse: true` a Efí devolve um token PERMANENTE e a máscara do cartão.
-- Guardamos só isso: o token (que sozinho não revela o número) e o que o
-- cliente precisa para reconhecer o cartão na tela — bandeira, últimos
-- dígitos, validade, nome do titular. Número completo e CVV nunca chegam aqui,
-- nem no navegador depois da digitação.
--
-- ─── POR QUE O TOKEN NÃO É LEGÍVEL PELO CLIENTE ────────────────────────────
-- O token reutilizável COBRA o cartão. Se a vitrine pudesse lê-lo, um XSS ou
-- uma extensão maliciosa no navegador do cliente sairia cobrando. Então:
--   • a tabela fica FECHADA para anon e authenticated;
--   • o cliente enxerga os cartões por uma VIEW que não expõe o token;
--   • quem usa o token é a Edge Function, com service role, recebendo apenas o
--     ID do cartão escolhido.
-- O navegador nunca vê o token depois de criá-lo.
-- ============================================================================

create table if not exists public.cartoes_salvos (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references public.clientes(id) on delete cascade,
  loja_id        uuid not null references public.lojas(id)    on delete cascade,

  -- Token reutilizável da Efí. NUNCA sai daqui para o navegador.
  payment_token  text not null,

  -- O que o cliente vê para reconhecer o cartão.
  bandeira       text,
  ultimos_digitos text not null check (ultimos_digitos ~ '^[0-9]{4}$'),
  titular_nome   text not null,
  validade_mes   smallint check (validade_mes between 1 and 12),
  validade_ano   smallint check (validade_ano between 2000 and 2100),

  -- O documento do pagador acompanha o cartão: é do MESMO titular, e sem ele a
  -- cobrança seguinte teria de perguntar o CPF de novo — que é justamente o
  -- atrito que esta tabela existe para remover.
  titular_documento text not null,

  apelido        text,
  ativo          boolean not null default true,
  ultimo_uso_em  timestamptz,
  criado_em      timestamptz not null default now(),

  -- Mesmo cartão, mesmo cliente, mesma loja: uma linha só.
  unique (cliente_id, loja_id, payment_token)
);

comment on table public.cartoes_salvos is
  'Cartoes reutilizaveis do cliente. Guarda o token da Efi e a mascara; numero completo e CVV nunca passam por aqui.';
comment on column public.cartoes_salvos.payment_token is
  'Token reutilizavel da Efi: COBRA o cartao. Fechado para anon/authenticated de proposito — so a Edge Function le, com service role.';

create index if not exists idx_cartoes_salvos_cliente
  on public.cartoes_salvos (cliente_id, loja_id) where ativo;

alter table public.cartoes_salvos enable row level security;

-- Nenhuma policy de SELECT: o cliente não lê a tabela, lê a view abaixo.
-- Ele pode apagar o próprio cartão — tirar um cartão da carteira é direito de
-- quem é dono dele, e apagar não expõe o token.
drop policy if exists cartoes_salvos_dono_apaga on public.cartoes_salvos;
create policy cartoes_salvos_dono_apaga
  on public.cartoes_salvos for delete
  using (
    exists (
      select 1 from public.clientes c
      where c.id = cartoes_salvos.cliente_id
        and c.user_id = auth.uid()
    )
  );

revoke all on public.cartoes_salvos from anon, authenticated;
grant delete on public.cartoes_salvos to authenticated;

-- ── O que o cliente enxerga ─────────────────────────────────────────────────
-- Sem `payment_token`. `security_invoker` faz a view respeitar a identidade de
-- quem consulta, entao cada cliente so ve os proprios cartoes.
create or replace view public.meus_cartoes
with (security_invoker = true) as
  select
    cs.id,
    cs.loja_id,
    cs.bandeira,
    cs.ultimos_digitos,
    cs.titular_nome,
    cs.validade_mes,
    cs.validade_ano,
    cs.apelido,
    cs.ultimo_uso_em,
    cs.criado_em
  from public.cartoes_salvos cs
  join public.clientes c on c.id = cs.cliente_id
  where cs.ativo
    and c.user_id = auth.uid();

comment on view public.meus_cartoes is
  'Cartoes salvos do cliente logado, sem o token. E por aqui que a vitrine lista a carteira.';

grant select on public.meus_cartoes to authenticated;
