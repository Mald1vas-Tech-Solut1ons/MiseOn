-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Tamanho da embalagem: cascata de origem, e a correção do lojista manda.  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- O PROBLEMA, EM UMA FRASE
--
-- O tamanho da embalagem é o número que decide o custo de tudo. Errado, ele
-- transforma uma porção de batata em R$ 87,68 (era o que a tela mostrava hoje
-- de manhã). Ele chega por vários caminhos de confiabilidade muito diferente,
-- e o sistema tratava todos como se fossem o mesmo — ou seja, nenhum.
--
-- A CASCATA
--
-- Mesma ideia que `classificacao_origem` já usa para classificar insumo, agora
-- aplicada ao tamanho da embalagem. Da mais confiável para a menos:
--
--   USUARIO    o lojista digitou ou corrigiu. NUNCA é sobrescrito por nada.
--   CATALOGO   veio do catálogo interno por GTIN/referência. Determinístico.
--   DESCRICAO  lido da descrição da própria nota ("...TEIXEIRA 40G"). É fato
--              conferível: o lojista abre a nota e vê a mesma coisa.
--   IA         o modelo leu a nota e inferiu. Sempre revisável.
--   (nulo)     ninguém sabe. É resposta válida, e o custo se declara incerto.
--
-- POR QUE A ORIGEM IMPORTA MAIS QUE O NÚMERO
--
-- Sem registrar a origem, uma releitura automática sobrescreve a correção que
-- o lojista fez na mão — e ele perde a confiança no sistema de uma vez. Com a
-- origem, a regra fica trivial de aplicar e de explicar: releitura automática
-- só preenche o que está vazio ou o que ela mesma preencheu antes.
--
-- E É ISSO QUE TORNA A IA ÚTIL
--
-- Se a leitura automática acerta 90%, o lojista trabalha nos 10%. Para isso
-- ele precisa saber QUAIS 10% — daí `vw_insumos_custo_suspeito`, que lista só
-- o que o sistema não assina embaixo, ordenado por quantas fichas cada insumo
-- contamina. O trabalho vira uma fila curta, não uma revisão de tudo.

-- ── 1. A origem passa a existir ─────────────────────────────────────────────
alter table public.insumos
  add column if not exists qtd_embalagem_origem text;

alter table public.insumos
  drop constraint if exists insumos_qtd_embalagem_origem_check;
alter table public.insumos
  add constraint insumos_qtd_embalagem_origem_check
  check (qtd_embalagem_origem is null or qtd_embalagem_origem in
         ('USUARIO','CATALOGO','DESCRICAO','IA'));

comment on column public.insumos.qtd_embalagem_origem is
  'De onde veio qtd_embalagem. USUARIO nunca é sobrescrito por leitura '
  'automática. Ver fn_definir_embalagem_insumo.';

-- ── 2. O limiar de suspeita estava punindo embalagem legítima ───────────────
-- Sachê de parmesão de 40 g é embalagem real e estava sendo marcada como
-- suspeita só por ser menor que 50. Quem pega o caso quebrado de verdade é a
-- faixa de custo (R$/g), não o tamanho: o defeito clássico é `qtd_embalagem`
-- ficar em 1 por nunca ter sido preenchida.
create or replace function public.fn_custo_unitario_insumo(p_insumo_id uuid)
returns table(custo numeric, confiavel boolean, motivo text)
language plpgsql stable security definer set search_path to ''
as $$
declare
  v_ins     record;
  v_lote    numeric;
  v_custo   numeric;
  v_pequena boolean;
begin
  select i.unidade_medida, i.preco_embalagem, i.qtd_embalagem, i.loja_id
    into v_ins
  from public.insumos i where i.id = p_insumo_id;
  if not found then
    return query select null::numeric, false, 'insumo não encontrado'; return;
  end if;

  select l.custo_unitario into v_lote
  from public.lotes_estoque l
  where l.insumo_id = p_insumo_id and l.loja_id = v_ins.loja_id
    and l.quantidade_restante > 0
  order by l.criado_em, l.id limit 1;

  v_custo   := coalesce(v_lote, v_ins.preco_embalagem / nullif(v_ins.qtd_embalagem, 0));
  v_pequena := lower(coalesce(v_ins.unidade_medida,'')) in ('g','ml');

  if v_custo is null or v_custo <= 0 then
    return query select null::numeric, false,
      'sem custo cadastrado: informe o preço e o tamanho da embalagem'; return;
  end if;

  -- Embalagem de 1 a 4 g/ml não existe: é o campo que nunca foi preenchido.
  if v_lote is null and v_pequena and coalesce(v_ins.qtd_embalagem, 0) < 5 then
    return query select v_custo, false,
      format('embalagem declarada com %s %s: confira o tamanho real (ex.: 900 para uma garrafa de 900 ml)',
             trim(to_char(v_ins.qtd_embalagem,'FM999999990.####')), v_ins.unidade_medida);
    return;
  end if;

  -- R$ 1,00 por grama é R$ 1.000,00 o quilo. Existe (açafrão), mas é raro o
  -- bastante para conferir antes de virar custo de prato.
  if v_pequena and v_custo > 1 then
    return query select v_custo, false,
      format('custo de R$ %s por %s (R$ %s por %s) está fora da faixa usual: confira a embalagem',
             trim(to_char(v_custo,'FM999990.0000')), v_ins.unidade_medida,
             trim(to_char(v_custo*1000,'FM999999990.00')),
             case when lower(v_ins.unidade_medida)='g' then 'kg' else 'l' end);
    return;
  end if;

  return query select v_custo, true, null::text;
end $$;

-- ── 3. Gravar o tamanho respeitando a cascata ───────────────────────────────
-- Ponto único de escrita. Qualquer caminho — importação, IA, tela, backfill —
-- passa por aqui, e a regra de precedência mora em um lugar só.
create or replace function public.fn_definir_embalagem_insumo(
  p_insumo_id uuid,
  p_qtd       numeric,
  p_origem    text
) returns boolean
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_origem_atual text;
  v_qtd_atual    numeric;
  v_rank_novo    int;
  v_rank_atual   int;
begin
  if p_qtd is null or p_qtd <= 0 then return false; end if;
  if p_origem not in ('USUARIO','CATALOGO','DESCRICAO','IA') then
    raise exception 'Origem inválida para tamanho de embalagem: %', p_origem;
  end if;

  select qtd_embalagem_origem, qtd_embalagem into v_origem_atual, v_qtd_atual
  from insumos where id = p_insumo_id;
  if not found then return false; end if;

  v_rank_novo  := case p_origem when 'USUARIO' then 4 when 'CATALOGO' then 3
                                when 'DESCRICAO' then 2 else 1 end;
  v_rank_atual := case v_origem_atual when 'USUARIO' then 4 when 'CATALOGO' then 3
                                      when 'DESCRICAO' then 2 when 'IA' then 1 else 0 end;

  -- O lojista escreve sempre. Automático só melhora o que está vazio, o que é
  -- menos confiável, ou o que ele mesmo já havia escrito antes.
  if p_origem <> 'USUARIO' and v_rank_atual > v_rank_novo then return false; end if;

  update insumos
     set qtd_embalagem = p_qtd, qtd_embalagem_origem = p_origem
   where id = p_insumo_id
     and (qtd_embalagem is distinct from p_qtd
          or qtd_embalagem_origem is distinct from p_origem);

  return found;
end $$;

comment on function public.fn_definir_embalagem_insumo(uuid, numeric, text) is
  'Único ponto de escrita de qtd_embalagem. Aplica a cascata de origem: '
  'USUARIO > CATALOGO > DESCRICAO > IA. Devolve true se gravou.';

grant execute on function public.fn_definir_embalagem_insumo(uuid, numeric, text)
  to authenticated, service_role;

-- ── 4. O que já foi lido da descrição ganha a origem correspondente ─────────
update public.insumos i
   set qtd_embalagem_origem = 'DESCRICAO'
 where i.qtd_embalagem_origem is null
   and coalesce(i.qtd_embalagem,0) >= 5
   and public.fn_embalagem_lida_do_insumo(i.id) = i.qtd_embalagem;

-- ── 5. O gatilho da importação passa pela cascata ───────────────────────────
create or replace function public.fn_trg_embalagem_da_descricao()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_un   text;
  v_prep boolean;
  v_lido numeric;
begin
  if NEW.insumo_id is null or NEW.descricao_nota is null then return NEW; end if;

  select unidade_medida, coalesce(is_preparo,false) into v_un, v_prep
  from insumos where id = NEW.insumo_id;
  if v_prep or lower(coalesce(v_un,'')) not in ('g','ml') then return NEW; end if;

  v_lido := fn_tamanho_embalagem_da_descricao(NEW.descricao_nota, v_un);
  if v_lido is not null then
    -- A cascata decide se grava. Correção do lojista não é tocada.
    perform fn_definir_embalagem_insumo(NEW.insumo_id, v_lido, 'DESCRICAO');
  end if;
  return NEW;
end $function$;
