-- Plataforma de Negociacao do iFood: o dinheiro que sai sem ninguem ver
--
-- Quando o cliente abre uma disputa pos-entrega ("chegou frio", "faltou item"),
-- o iFood NAO cancela sozinho: ele manda o evento HANDSHAKE_DISPUTE e da a loja
-- um prazo (`expiresAt`, tipicamente 7 minutos) para aceitar, rejeitar ou fazer
-- contraproposta. Sem resposta ate o prazo, o `timeoutAction` executa — e em
-- cancelamento pos-entrega o padrao costuma ser ACCEPT_CANCELLATION.
--
-- Ate agora o evento `HSD` caia no ramo "evento nao tratado" da ifood-webhook.
-- Ninguem respondia, o prazo estourava e o iFood aceitava o cancelamento em
-- nome da loja. Resultado pratico: o lojista PERDE o valor do pedido sem nunca
-- ter visto a reclamacao. Nao e falha de tela, e dinheiro saindo por omissao.
--
-- Tambem e criterio de homologacao do modulo Order ("Processe corretamente
-- eventos da Plataforma de Negociacao").
--
-- Esta tabela guarda a disputa porque o evento tem PRAZO: o lojista pode estar
-- com as duas maos ocupadas quando ele chega, e precisa encontrar a negociacao
-- aberta ao voltar para o painel — nao um alerta que passou.

create table if not exists public.ifood_disputas (
  id              uuid primary key default gen_random_uuid(),
  loja_id         uuid not null references public.lojas (id) on delete cascade,
  -- Pode ser nulo: a disputa chega por orderId e, em tese, pode referenciar um
  -- pedido que nunca entrou aqui. Guardar mesmo assim e melhor que descartar.
  pedido_id       uuid references public.pedidos (id) on delete set null,

  dispute_id      text not null unique,
  ifood_order_id  text not null,

  acao            text,
  tipo            text,
  grupo           text,
  mensagem        text,

  expira_em       timestamptz,
  acao_no_prazo   text,

  alternativas    jsonb,
  metadados       jsonb,

  -- ABERTA · ACEITA · REJEITADA · ALTERNATIVA · EXPIRADA
  situacao        text not null default 'ABERTA',
  resposta_em     timestamptz,
  respondida_por  uuid references auth.users (id) on delete set null,
  resposta_motivo text,
  resposta_erro   text,

  criado_em       timestamptz not null default now()
);

comment on table public.ifood_disputas is
  'Negociacoes pos-entrega abertas pelo cliente no iFood (evento HANDSHAKE_DISPUTE). Tem prazo: sem resposta ate expira_em, o iFood executa acao_no_prazo sozinho.';
comment on column public.ifood_disputas.acao_no_prazo is
  'timeoutAction do iFood. ACCEPT_CANCELLATION significa que o silencio da loja vale como aceite do cancelamento.';

-- A consulta quente e "o que esta aberto nesta loja, por prazo".
create index if not exists idx_ifood_disputas_abertas
  on public.ifood_disputas (loja_id, expira_em)
  where situacao = 'ABERTA';

create index if not exists idx_ifood_disputas_pedido
  on public.ifood_disputas (pedido_id);

alter table public.ifood_disputas enable row level security;

-- Mesma regra do resto do painel: quem e da equipe da loja enxerga.
drop policy if exists "equipe da loja le disputas" on public.ifood_disputas;
create policy "equipe da loja le disputas"
  on public.ifood_disputas for select
  using (
    exists (
      select 1 from public.usuarios_loja ul
       where ul.loja_id = ifood_disputas.loja_id
         and ul.user_id = auth.uid()
    )
  );

-- Escrita e so do servidor (webhook e Edge Function respondendo ao iFood).
-- Nao existe caso de uso de o navegador gravar disputa direto: a verdade mora
-- no iFood, e gravar aqui sem falar com eles criaria a mesma divergencia
-- silenciosa que o cancelamento tinha.
