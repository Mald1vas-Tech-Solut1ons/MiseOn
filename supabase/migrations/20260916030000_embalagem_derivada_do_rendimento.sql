-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ A embalagem também se deduz do rendimento que o insumo já declara.       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ACHADO (15/09/2026, medido no tenant de provas)
--
-- O X-SALADA aparecia com margem de -10% e o X-BACON com -1,5%. A causa:
--
--   Tomate · unidade_medida = 'fatias' · qtd_embalagem = 1 · R$ 6,99
--
-- O sistema lia "a embalagem rende 1 fatia e custa R$ 6,99" e cobrava R$ 6,99
-- POR FATIA. Duas fatias no lanche = R$ 13,98 num produto de R$ 26,00.
--
-- Só que o próprio insumo JÁ DECLARA a conversão, em `detalhes_rendimento`:
--
--   Tomate: 1 kg → 8 un,  1 un → 5 fatias   ⇒  1 kg rende 40 fatias
--   Alface: 1 maço → 30 porções             ⇒  1 maço rende 30 porções
--
-- R$ 6,99 o quilo dividido por 40 fatias dá R$ 0,175 por fatia — que é o
-- número que o dono do restaurante reconhece. O dado sempre esteve lá; o custo
-- é que não olhava para ele.
--
-- Nem todo insumo estava errado, e isso importa: Batata congelada (1 kg → 5
-- porções, qtd_embalagem = 5), Cebolinha (5), Pão brioche (10) e Queijo
-- cheddar (50) já estavam coerentes. A correção é cirúrgica, só onde a
-- embalagem declarada contradiz o rendimento declarado.
--
-- POR QUE ISSO VIRA REGRA E NÃO UPDATE
--
-- É a terceira vez hoje que o mesmo defeito aparece com outra roupa: óleo em
-- ml, tomate em fatias, alface em porção. A raiz é sempre a mesma —
-- `qtd_embalagem` ficou em 1 porque ninguém preencheu, e nada no sistema
-- percebia a contradição com o resto do cadastro do próprio insumo.
--
-- Entra como mais uma origem na cascata de qtd_embalagem:
--
--   USUARIO > CATALOGO > RENDIMENTO > DESCRICAO > IA
--
-- RENDIMENTO fica acima de DESCRICAO porque é uma regra que alguém declarou
-- sobre ESTE item, não um texto de nota que foi interpretado.

-- ── 1. Quantas unidades de estoque saem de uma embalagem comprada ──────────
create or replace function public.fn_embalagem_do_rendimento(p_insumo_id uuid)
returns numeric
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_un      text;
  v_regras  jsonb;
  r         jsonb;
  v_fator   numeric := 1;
  v_atual   text;
  v_achou   boolean;
  v_voltas  int := 0;
begin
  select lower(unidade_medida), detalhes_rendimento->'regras'
    into v_un, v_regras
  from insumos where id = p_insumo_id;

  if v_regras is null or jsonb_typeof(v_regras) <> 'array'
     or jsonb_array_length(v_regras) = 0 then
    return null;
  end if;

  -- Começa na unidade de COMPRA: a de origem da primeira regra.
  v_atual := lower(v_regras->0->>'de_unidade');
  if v_atual is null then return null; end if;

  -- Encadeia as regras até chegar na unidade em que o estoque é controlado.
  -- O teto de voltas evita laço infinito num cadastro circular.
  while lower(v_atual) <> v_un and v_voltas < 8 loop
    v_achou := false;
    for r in select * from jsonb_array_elements(v_regras) loop
      if lower(r->>'de_unidade') = v_atual then
        v_fator := v_fator * ((r->>'para_qtd')::numeric / nullif((r->>'de_qtd')::numeric, 0));
        v_atual := lower(r->>'para_unidade');
        v_achou := true;
        exit;
      end if;
    end loop;
    if not v_achou then return null; end if;   -- cadeia não chega na unidade
    v_voltas := v_voltas + 1;
  end loop;

  if lower(v_atual) <> v_un then return null; end if;
  if v_fator is null or v_fator <= 0 then return null; end if;
  return v_fator;
end $$;

comment on function public.fn_embalagem_do_rendimento(uuid) is
  'Quantas unidades de estoque uma embalagem comprada rende, encadeando as '
  'regras de detalhes_rendimento (kg→un→fatias). NULL quando a cadeia não '
  'alcança a unidade de estoque — e NULL é resposta válida.';

-- ── 2. RENDIMENTO entra na cascata de origem ────────────────────────────────
alter table public.insumos
  drop constraint if exists insumos_qtd_embalagem_origem_check;
alter table public.insumos
  add constraint insumos_qtd_embalagem_origem_check
  check (qtd_embalagem_origem is null or qtd_embalagem_origem in
         ('USUARIO','CATALOGO','RENDIMENTO','DESCRICAO','IA'));

create or replace function public.fn_definir_embalagem_insumo(
  p_insumo_id uuid, p_qtd numeric, p_origem text
) returns boolean
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_origem_atual text;
  v_rank_novo    int;
  v_rank_atual   int;
begin
  if p_qtd is null or p_qtd <= 0 then return false; end if;
  if p_origem not in ('USUARIO','CATALOGO','RENDIMENTO','DESCRICAO','IA') then
    raise exception 'Origem inválida para tamanho de embalagem: %', p_origem;
  end if;

  select qtd_embalagem_origem into v_origem_atual from insumos where id = p_insumo_id;
  if not found then return false; end if;

  v_rank_novo  := case p_origem when 'USUARIO' then 5 when 'CATALOGO' then 4
                                when 'RENDIMENTO' then 3 when 'DESCRICAO' then 2 else 1 end;
  v_rank_atual := case v_origem_atual when 'USUARIO' then 5 when 'CATALOGO' then 4
                                      when 'RENDIMENTO' then 3 when 'DESCRICAO' then 2
                                      when 'IA' then 1 else 0 end;

  if p_origem <> 'USUARIO' and v_rank_atual > v_rank_novo then return false; end if;

  update insumos
     set qtd_embalagem = p_qtd, qtd_embalagem_origem = p_origem
   where id = p_insumo_id
     and (qtd_embalagem is distinct from p_qtd
          or qtd_embalagem_origem is distinct from p_origem);
  return found;
end $$;

-- ── 3. Corrige só onde a embalagem contradiz o rendimento declarado ─────────
-- Não toca em quem já está coerente (Batata congelada, Pão brioche, Cebolinha,
-- Queijo cheddar) nem em preparo da casa.
do $backfill$
declare
  r        record;
  v_deduz  numeric;
begin
  for r in
    select i.id, i.nome, i.qtd_embalagem
    from public.insumos i
    where i.ativo
      and coalesce(i.is_preparo, false) = false
      and i.detalhes_rendimento is not null
      and coalesce(i.qtd_embalagem_origem, '') <> 'USUARIO'
  loop
    v_deduz := public.fn_embalagem_do_rendimento(r.id);
    if v_deduz is not null and v_deduz <> r.qtd_embalagem then
      perform public.fn_definir_embalagem_insumo(r.id, v_deduz, 'RENDIMENTO');
      raise notice 'embalagem de % : % -> %', r.nome, r.qtd_embalagem, v_deduz;
    end if;
  end loop;
end
$backfill$;
