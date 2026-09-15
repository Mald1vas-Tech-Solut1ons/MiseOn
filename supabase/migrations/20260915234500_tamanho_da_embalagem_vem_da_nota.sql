-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ O tamanho da embalagem sai da descrição da nota, não de um chute.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- CONTEXTO
--
-- A migration 20260915200000 fez o custo parar de mentir: quando `qtd_embalagem`
-- é implausível para a unidade (óleo em `ml` com embalagem de 1), a margem vem
-- nula com o motivo em vez de publicar -387%. Isso resolveu a mentira, mas não
-- devolveu o número certo — e sem número certo não há demonstração de margem,
-- que é a tese de venda do produto.
--
-- O DADO NUNCA ESTEVE PERDIDO
--
-- `compras_depara_itens.descricao_nota` guarda a descrição original do item na
-- nota, e o tamanho está escrito nela:
--
--   OLEO CANOLA SOYA 900ml              → 900 ml
--   LEITE INTEGRAL PIRACANJUBA CT 1L    → 1000 ml
--   APP1 CEBOLA kg                      → 1000 g
--   QUEIJO RALADO PARMESAO TEIXEIRA 40G →  40 g
--   IOG NATURAL INTEGRAL JAMAVA 150g    → 150 g
--   AGUA SANIT SELECT 2L                → 2000 ml
--
-- Extrair daí é leitura de fato. Inventar "deve ser 900" seria chute. A
-- diferença importa: um lojista confere a descrição da própria nota e concorda
-- ou corrige; ele não tem como conferir um palpite do sistema.
--
-- REGRA GERAL, NÃO REMENDO
--
-- Corrigir os 8 insumos do Lanche do Paulista com UPDATE resolveria hoje e
-- deixaria o próximo lojista com o mesmo problema na primeira nota importada.
-- Por isso a extração vira função, o backfill usa a função, e a importação
-- passa a chamá-la para o insumo nascer com a embalagem certa.

-- ── 1. Ler o tamanho da embalagem de uma descrição de nota ──────────────────
create or replace function public.fn_tamanho_embalagem_da_descricao(
  p_descricao text,
  p_unidade   text
) returns numeric
language plpgsql immutable
as $$
declare
  m        text[];
  v_qtd    numeric;
  v_un     text;
  v_alvo   text := lower(coalesce(p_unidade, ''));
  v_melhor numeric := null;
  v_txt    text;
begin
  if p_descricao is null or v_alvo not in ('g','ml') then return null; end if;
  v_txt := lower(p_descricao);

  -- Classes POSIX, nenhuma barra invertida: o escape se perde no caminho ate o
  -- banco e "\d" chegava como "d" literal — nada casava e o backfill nao fazia
  -- absolutamente nada, em silencio.
  --
  -- Varre TODOS os "<numero><unidade>" e fica com o ultimo: a descricao da nota
  -- poe o tamanho no fim ("QUEIJO RALADO PARMESAO TEIXEIRA 40G"), e um numero
  -- solto no meio do nome ("BISCOITO 3 UNIDADES 200g") nao deve vencer.
  for m in
    select regexp_matches(v_txt, '([0-9]+(?:[.,][0-9]+)?)[[:space:]]*(kg|ml|g|l)(?:[^a-z0-9]|$)', 'g')
  loop
    v_qtd := replace(m[1], ',', '.')::numeric;
    v_un  := m[2];
    if    v_alvo = 'g'  and v_un = 'kg' then v_melhor := v_qtd * 1000;
    elsif v_alvo = 'g'  and v_un = 'g'  then v_melhor := v_qtd;
    elsif v_alvo = 'ml' and v_un = 'l'  then v_melhor := v_qtd * 1000;
    elsif v_alvo = 'ml' and v_un = 'ml' then v_melhor := v_qtd;
    end if;
  end loop;

  -- "APP1 CEBOLA kg": granel vendido por quilo, sem numero antes da unidade.
  if v_melhor is null then
    if v_alvo = 'g'  and v_txt ~ '(^|[^a-z])kg([^a-z]|$)' then v_melhor := 1000; end if;
    if v_alvo = 'ml' and v_txt ~ '(^|[^a-z])l([^a-z]|$)'  then v_melhor := 1000; end if;
  end if;

  -- Embalagem menor que 5 g/ml nao existe no varejo: o que foi lido era outra
  -- coisa (teor, percentual, codigo). Melhor devolver nada.
  if v_melhor is not null and v_melhor < 5 then return null; end if;
  return v_melhor;
end $$;

comment on function public.fn_tamanho_embalagem_da_descricao(text, text) is
  'Lê o tamanho da embalagem na descrição da nota e converte para a unidade de '
  'estoque (kg→g, L→ml). NULL quando a descrição não diz — e NULL é resposta '
  'válida: melhor não saber do que chutar.';

-- ── 2. Backfill: tenta TODAS as descricoes do insumo ───────────────────────
-- A NFC-e trunca a descricao e o de-para guarda as duas versoes do mesmo item
-- ("QUEIJO RALADO PARMESAO TEI" e "...TEIXEIRA 40G"). Pegar so a mais recente
-- pegava a truncada e o tamanho se perdia.
create or replace function public.fn_embalagem_lida_do_insumo(p_insumo_id uuid)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select public.fn_tamanho_embalagem_da_descricao(d.descricao_nota, i.unidade_medida)
  from public.compras_depara_itens d
  join public.insumos i on i.id = d.insumo_id
  where d.insumo_id = p_insumo_id and d.descricao_nota is not null
    and public.fn_tamanho_embalagem_da_descricao(d.descricao_nota, i.unidade_medida) is not null
  order by public.fn_tamanho_embalagem_da_descricao(d.descricao_nota, i.unidade_medida) desc
  limit 1;
$$;

update public.insumos i
   set qtd_embalagem = public.fn_embalagem_lida_do_insumo(i.id)
 where i.ativo
   and lower(i.unidade_medida) in ('g','ml')
   and coalesce(i.qtd_embalagem,0) < 5
   and coalesce(i.is_preparo,false) = false
   and public.fn_embalagem_lida_do_insumo(i.id) is not null;

-- ── 3. Novo insumo nasce com a embalagem lida da nota ───────────────────────
-- A importação grava o de-para com a descrição original; este gatilho lê dali
-- assim que o vínculo existe. Sem isto, todo lojista repete o problema na
-- primeira nota que importar.
create or replace function public.fn_trg_embalagem_da_descricao()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_un    text;
  v_qtd   numeric;
  v_lido  numeric;
  v_prep  boolean;
begin
  if NEW.insumo_id is null or NEW.descricao_nota is null then return NEW; end if;

  select unidade_medida, qtd_embalagem, coalesce(is_preparo, false)
    into v_un, v_qtd, v_prep
  from insumos where id = NEW.insumo_id;

  -- Só preenche o que está em branco ou implausível. Embalagem que o lojista
  -- já conferiu não é sobrescrita por leitura automática — mesma regra da
  -- classificação de insumo, onde a decisão do usuário vence a do sistema.
  if v_prep or lower(coalesce(v_un,'')) not in ('g','ml') then return NEW; end if;
  if coalesce(v_qtd, 0) >= 50 then return NEW; end if;

  v_lido := fn_tamanho_embalagem_da_descricao(NEW.descricao_nota, v_un);
  if v_lido is not null then
    update insumos set qtd_embalagem = v_lido where id = NEW.insumo_id;
  end if;
  return NEW;
end $function$;

drop trigger if exists trg_embalagem_da_descricao on public.compras_depara_itens;
create trigger trg_embalagem_da_descricao
  after insert or update of descricao_nota, insumo_id on public.compras_depara_itens
  for each row execute function public.fn_trg_embalagem_da_descricao();
