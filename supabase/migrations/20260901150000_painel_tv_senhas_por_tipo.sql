-- Painel de senhas da TV: só balcão e mesa, configurável por loja.
--
-- ─── O QUE ESTAVA ERRADO ────────────────────────────────────────────────────
--
-- 1. SEM FILTRO DE TIPO. `fn_painel_tv_senhas` devolvia TODO pedido ativo da
--    loja, inclusive DELIVERY. Medido em 01/09/2026: o Natureba tem 27 pedidos
--    de iFood, todos DELIVERY. Cada um deles apareceria no painel do balcão e
--    seria ANUNCIADO POR VOZ — "Senha 9279, por favor retirar no balcão" —
--    para um cliente que está em casa esperando o entregador. Senha de balcão
--    é para quem está no balcão.
--
-- 2. O "DIA" ERA O DIA UTC. O filtro era `criado_em >= date_trunc('day', now())`
--    e o banco roda em UTC, então a janela virava às 00:00 UTC = 21:00 de
--    Brasília. Ou seja: às 21h, no meio do jantar, o painel apagava tudo que
--    tinha sido feito naquela noite. Pior que sumir da tela — um pedido feito
--    às 20:45 e pronto às 21:10 deixava de ser retornado pela consulta, então
--    NUNCA era anunciado. O cliente não era chamado.
--
--    A correção não troca UTC por Brasília: troca o "dia" por uma JANELA
--    MÓVEL de 12 horas. Dia do calendário tem virada, e virada no meio de um
--    serviço derruba pedido aberto — inclusive à meia-noite local, que é
--    horário de pico para hamburgueria. 12h cobre qualquer serviço único e
--    não tem penhasco.
--
-- ─── O QUE FICA CONFIGURÁVEL ────────────────────────────────────────────────
--
-- `lojas.painel_tv_tipos` decide quais tipos alimentam o painel. O padrão é
-- balcão + mesa. Uma loja que só faz retirada tira o SALAO; uma que quer
-- anunciar delivery (raro, mas é escolha dela) pode incluir. DELIVERY fica
-- fora por padrão de propósito.

alter table public.lojas
  add column if not exists painel_tv_tipos public.tipo_pedido[]
    not null
    default array['RETIRADA_BALCAO', 'SALAO']::public.tipo_pedido[];

comment on column public.lojas.painel_tv_tipos is
  'Tipos de pedido que aparecem no painel de senhas da TV. Padrão: balcão e mesa. '
  'DELIVERY fica fora porque o cliente não está no balcão para ser chamado.';

-- Loja não pode zerar a lista: painel sem tipo nenhum é painel que nunca
-- mostra nada, e o lojista descobriria isso no meio do serviço.
alter table public.lojas
  drop constraint if exists ck_lojas_painel_tv_tipos_nao_vazio;
alter table public.lojas
  add constraint ck_lojas_painel_tv_tipos_nao_vazio
    check (array_length(painel_tv_tipos, 1) >= 1);

create or replace function public.fn_painel_tv_senhas(p_slug text, p_token uuid default null)
returns table(numero integer, status text, primeiro_nome text, criado_em timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_loja  uuid;
  v_token uuid;
  v_tipos public.tipo_pedido[];
begin
  select l.id, l.painel_tv_token, l.painel_tv_tipos
    into v_loja, v_token, v_tipos
  from lojas l
  where l.slug = p_slug and l.ativo;

  if v_loja is null then
    return;
  end if;

  -- Token configurado passa a ser obrigatório. Sem token configurado, mantém
  -- o comportamento antigo para não derrubar TV já em operação.
  if v_token is not null and (p_token is null or p_token <> v_token) then
    raise exception 'Painel de TV desta loja exige token na URL.';
  end if;

  return query
  select p.numero,
         p.status::text,
         nullif(split_part(btrim(coalesce(p.identificador_cliente, '')), ' ', 1), '') as primeiro_nome,
         p.criado_em
  from pedidos p
  where p.loja_id = v_loja
    -- Janela móvel, não dia de calendário: ver comentário no topo.
    and p.criado_em >= now() - interval '12 hours'
    and p.status in ('NOVO', 'ACEITO', 'PREPARANDO', 'PRONTO', 'EM_ROTA')
    -- Só os tipos que a loja escolheu chamar no balcão.
    and p.tipo_pedido = any(
          coalesce(v_tipos, array['RETIRADA_BALCAO', 'SALAO']::public.tipo_pedido[]))
  order by p.criado_em desc
  limit 100;
end;
$function$;
