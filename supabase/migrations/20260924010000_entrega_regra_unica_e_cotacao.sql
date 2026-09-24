-- Entrega profissional, etapa 1 (aditiva): regra única + cotação no servidor.
--
-- Medido em 23/09/2026:
--  * O servidor calculava a taxa, mas com lat/lng ENVIADOS PELO NAVEGADOR:
--    mandando a coordenada da própria loja, paga-se só o valor base.
--  * Distância em linha reta: pela rua o caminho é maior e a taxa saía menor.
--  * Pedido mínimo por faixa existia na tabela e ninguém conferia.
--  * Loja sem localização só descobria no último clique do checkout.
--
-- Desenho: UMA regra (`fn_entrega_regra`) usada pelo pedido, pela cotação, pelo
-- chat e pela tela de configuração. A distância vem de uma COTAÇÃO gravada pelo
-- servidor (edge function `entrega-cotar`: endereço → coordenada → rota pela
-- rua). Nesta etapa o pedido ACEITA cotação; a etapa 2 passa a EXIGIR, depois
-- que o checkout novo estiver publicado.
--
-- Modos (valores internos mantidos para não quebrar o que já existe):
--   FIXA      taxa única até o raio máximo                     (novo)
--   HIBRIDO   faixas de distância — "até 3 km R$ 6"            (padrão)
--   DISTANCIA valor base + R$/km até o raio máximo
--   BAIRRO    aposentado: a lista de bairros sai (etapa 2)

-- ── Modo ────────────────────────────────────────────────────────────────
alter table public.lojas drop constraint if exists chk_lojas_entrega_modo;
update public.lojas set entrega_modo = 'HIBRIDO' where entrega_modo = 'BAIRRO' or entrega_modo is null;
alter table public.lojas
  add constraint chk_lojas_entrega_modo check (entrega_modo in ('FIXA', 'HIBRIDO', 'DISTANCIA'));
alter table public.lojas alter column entrega_modo set default 'HIBRIDO';

-- ── Cache de geocodificação ─────────────────────────────────────────────
-- Endereço → coordenada. O provedor aberto (Nominatim) pede no máximo 1
-- requisição por segundo: sem cache, cada ajuste no carrinho repetiria a busca.
create table if not exists public.geocode_cache (
  chave      text primary key,
  lat        numeric not null,
  lng        numeric not null,
  precisao   text not null check (precisao in ('ENDERECO', 'RUA', 'CEP')),
  fonte      text not null,
  criado_em  timestamptz not null default now()
);
alter table public.geocode_cache enable row level security;
revoke all on public.geocode_cache from public, anon, authenticated;

-- ── Cotação ─────────────────────────────────────────────────────────────
create table if not exists public.entrega_cotacoes (
  id              uuid primary key default gen_random_uuid(),
  loja_id         uuid not null references public.lojas(id) on delete cascade,
  chave_endereco  text not null,
  cep             text,
  numero          text,
  lat             numeric not null,
  lng             numeric not null,
  distancia_km    numeric not null check (distancia_km >= 0),
  metodo          text not null check (metodo in ('ROTA', 'ESTIMATIVA')),
  precisao        text not null,
  criado_em       timestamptz not null default now(),
  expira_em       timestamptz not null default now() + interval '2 hours'
);
create index if not exists idx_entrega_cotacoes_reuso
  on public.entrega_cotacoes (loja_id, chave_endereco, criado_em desc);
alter table public.entrega_cotacoes enable row level security;
revoke all on public.entrega_cotacoes from public, anon, authenticated;

comment on table public.entrega_cotacoes is
  'Distância medida pelo SERVIDOR (rota pela rua) para um endereço. O pedido de entrega usa a cotação, nunca coordenada vinda do navegador.';

-- ── A regra ─────────────────────────────────────────────────────────────
create or replace function public.fn_entrega_regra(
  p_loja_id      uuid,
  p_distancia_km numeric,
  p_subtotal     numeric default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l               record;
  v_faixa         record;
  v_tem_faixa     boolean := false;
  v_dist          numeric := round(coalesce(p_distancia_km, 0), 2);
  v_sub           numeric := coalesce(p_subtotal, 0);
  v_raio          numeric;
  v_taxa          numeric;
  v_gratis        boolean;
  v_min_faixa     numeric := 0;
  v_faixa_id      uuid;
  v_faixa_nome    text;
begin
  select lat, lng, aceita_entrega, entrega_modo, entrega_taxa_base, entrega_taxa_km,
         entrega_raio_km, frete_gratis_valor_minimo
    into l
    from public.lojas where id = p_loja_id;

  if not found then
    return jsonb_build_object('atende', false, 'motivo', 'LOJA_INEXISTENTE',
      'mensagem', 'Loja não encontrada.');
  end if;
  if not coalesce(l.aceita_entrega, false) then
    return jsonb_build_object('atende', false, 'motivo', 'SEM_ENTREGA',
      'mensagem', 'Esta loja não faz entrega. Escolha retirar no balcão.');
  end if;
  if l.lat is null or l.lng is null then
    return jsonb_build_object('atende', false, 'motivo', 'ENTREGA_NAO_CONFIGURADA',
      'mensagem', 'A loja ainda não configurou a entrega. Escolha retirar no balcão.');
  end if;

  v_gratis := coalesce(l.frete_gratis_valor_minimo, 0) > 0
              and v_sub >= l.frete_gratis_valor_minimo;

  if l.entrega_modo = 'HIBRIDO' then
    -- Faixas: a última faixa É o raio de cobertura.
    select exists (select 1 from public.faixas_entrega f
                    where f.loja_id = p_loja_id and coalesce(f.ativo, true))
      into v_tem_faixa;
    if not v_tem_faixa then
      return jsonb_build_object('atende', false, 'motivo', 'ENTREGA_NAO_CONFIGURADA',
        'mensagem', 'A loja ainda não configurou a entrega. Escolha retirar no balcão.');
    end if;

    select max(f.km_ate) into v_raio from public.faixas_entrega f
     where f.loja_id = p_loja_id and coalesce(f.ativo, true);

    select f.id, f.nome, f.km_ate, f.taxa_fixa, f.taxa_por_km, f.pedido_minimo
      into v_faixa
      from public.faixas_entrega f
     where f.loja_id = p_loja_id and coalesce(f.ativo, true) and v_dist <= f.km_ate
     order by f.km_ate asc
     limit 1;

    if v_faixa.id is null then
      return jsonb_build_object('atende', false, 'motivo', 'FORA_DA_AREA',
        'mensagem', format('A loja entrega até %s km. Este endereço fica a %s km.',
                           trim(to_char(v_raio, 'FM999990.0')), trim(to_char(v_dist, 'FM999990.0'))),
        'distancia_km', v_dist, 'raio_km', v_raio);
    end if;

    v_taxa := coalesce(v_faixa.taxa_fixa,
                       round(coalesce(l.entrega_taxa_base, 0)
                             + coalesce(v_faixa.taxa_por_km, l.entrega_taxa_km, 0) * v_dist, 2));
    v_min_faixa := coalesce(v_faixa.pedido_minimo, 0);
    v_faixa_id := v_faixa.id;
    v_faixa_nome := v_faixa.nome;
  else
    v_raio := l.entrega_raio_km;
    if v_raio is not null and v_raio > 0 and v_dist > v_raio then
      return jsonb_build_object('atende', false, 'motivo', 'FORA_DA_AREA',
        'mensagem', format('A loja entrega até %s km. Este endereço fica a %s km.',
                           trim(to_char(v_raio, 'FM999990.0')), trim(to_char(v_dist, 'FM999990.0'))),
        'distancia_km', v_dist, 'raio_km', v_raio);
    end if;
    if l.entrega_modo = 'FIXA' then
      v_taxa := coalesce(l.entrega_taxa_base, 0);
    else
      v_taxa := round(coalesce(l.entrega_taxa_base, 0) + coalesce(l.entrega_taxa_km, 0) * v_dist, 2);
    end if;
  end if;

  if v_gratis then v_taxa := 0; end if;

  if v_min_faixa > 0 and v_sub < v_min_faixa then
    return jsonb_build_object('atende', false, 'motivo', 'ABAIXO_DO_MINIMO_DA_FAIXA',
      'mensagem', format('Para esta distância o pedido mínimo é R$ %s.',
                         replace(trim(to_char(v_min_faixa, 'FM999990.00')), '.', ',')),
      'distancia_km', v_dist, 'raio_km', v_raio, 'taxa', v_taxa,
      'pedido_minimo', v_min_faixa, 'faixa_id', v_faixa_id, 'faixa_nome', v_faixa_nome);
  end if;

  return jsonb_build_object(
    'atende', true, 'motivo', null, 'mensagem', null,
    'taxa', v_taxa, 'distancia_km', v_dist, 'raio_km', v_raio,
    'frete_gratis', v_gratis,
    'frete_gratis_acima', nullif(coalesce(l.frete_gratis_valor_minimo, 0), 0),
    'pedido_minimo', v_min_faixa, 'faixa_id', v_faixa_id, 'faixa_nome', v_faixa_nome
  );
end;
$$;

revoke all on function public.fn_entrega_regra(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.fn_entrega_regra(uuid, numeric, numeric) to service_role;

-- Cotações vencidas não servem para nada depois de um dia.
select cron.schedule('limpar-cotacoes-entrega', '40 4 * * *',
  $c$delete from public.entrega_cotacoes where expira_em < now() - interval '1 day'$c$);
