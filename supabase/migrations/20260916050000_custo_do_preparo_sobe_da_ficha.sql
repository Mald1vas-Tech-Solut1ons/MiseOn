-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ O custo do preparo sobe da ficha dele, não espera um lote ser produzido. ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- ACHADO
--
-- Depois da seed de vitrine, os preparos ganharam ficha própria — o Smash Fit
-- de Patinho passou a declarar 80 g de patinho moído e 1 g de sal. Mesmo
-- assim, todo produto que usa preparo continuava com "sem custo cadastrado":
--
--   BURGER FIT DE FRANGO · SMASH FIT DE PATINHO · SMASH DUPLO
--   BOWL FIT DE FRANGO   · SALADA CAESAR FIT
--
-- `fn_custo_unitario_insumo` só sabia dois caminhos: o custo do lote PEPS, ou
-- `preco_embalagem / qtd_embalagem`. Preparo da casa não tem nenhum dos dois
-- antes de alguém produzir um lote. O custo dele é a soma da ficha.
--
-- POR QUE ISSO IMPORTA PARA VENDER
--
-- É a cadeia inteira que o restaurante quer ver:
--
--   Patinho moído R$ 42,90/kg
--     → Smash Fit de Patinho 80 g   (80 g × R$ 0,0429 = R$ 3,43)
--       → SMASH FIT DE PATINHO      (+ pão, queijo, molho…)
--         → margem
--
-- Sem este elo, metade do cardápio fica sem margem e a demonstração morre no
-- meio. Com ele, o dono muda o preço do patinho na nota e vê a margem do
-- lanche mexer — que é o momento em que ele entende para que serve o sistema.
--
-- RECURSÃO COM FREIO
--
-- Preparo pode usar preparo (molho dentro de bowl). A função desce até 5
-- níveis; passou disso, devolve incerteza em vez de girar. Ciclo de cadastro
-- (A usa B, B usa A) não trava o banco.

-- A versao de 1 argumento TEM que sair. Criar a de (uuid, int default 0) ao
-- lado dela nao substitui nada: o Postgres resolve `fn(x)` pela assinatura
-- exata, entao as views continuariam chamando a antiga — sem a recursao de
-- preparo — e a correcao nao surtiria efeito nenhum, em silencio.
drop function if exists public.fn_custo_unitario_insumo(uuid) cascade;

create or replace function public.fn_custo_unitario_insumo(
  p_insumo_id uuid,
  p_nivel     int default 0
)
returns table(custo numeric, confiavel boolean, motivo text)
language plpgsql stable security definer set search_path to ''
as $$
declare
  v_ins     record;
  v_lote    numeric;
  v_custo   numeric;
  v_pequena boolean;
  v_soma    numeric;
  v_todos   boolean;
  v_rend    numeric;
  v_falta   text;
begin
  if p_nivel > 5 then
    return query select null::numeric, false,
      'cadeia de preparos fundo demais: verifique se um preparo usa a si mesmo';
    return;
  end if;

  select i.unidade_medida, i.preco_embalagem, i.qtd_embalagem, i.loja_id,
         coalesce(i.is_preparo, false) as preparo,
         coalesce(nullif(i.rendimento_porcoes, 0), 1) as rendimento
    into v_ins
  from public.insumos i where i.id = p_insumo_id;
  if not found then
    return query select null::numeric, false, 'insumo não encontrado'; return;
  end if;

  -- Lote PEPS é a melhor verdade: é o que a casa pagou de fato.
  select l.custo_unitario into v_lote
  from public.lotes_estoque l
  where l.insumo_id = p_insumo_id and l.loja_id = v_ins.loja_id
    and l.quantidade_restante > 0
  order by l.criado_em, l.id limit 1;

  v_pequena := lower(coalesce(v_ins.unidade_medida,'')) in ('g','ml');

  -- ...MAS só quando o custo dele é possível. Há lotes gravados com a
  -- quantidade em EMBALAGENS e o custo POR EMBALAGEM, enquanto a unidade de
  -- estoque é g/ml: "1 garrafa a R$ 6,89" vira "1 ml a R$ 6,89", e o iogurte
  -- passa a custar R$ 1.850 o quilo. É o mesmo defeito de conversão que já
  -- apareceu na embalagem, propagado para o histórico.
  --
  -- Nesse caso o cadastro é mais confiável que o lote, porque o tamanho da
  -- embalagem veio conferido da descrição da nota. O lote fica de fora do
  -- custo; a divergência de saldo que ele representa é problema de estoque e
  -- se resolve em outro lugar, não escondendo o número aqui.
  if v_lote is not null and v_pequena and v_lote > 1
     and coalesce(v_ins.preco_embalagem / nullif(v_ins.qtd_embalagem, 0), 0) between 0.000001 and 1
  then
    v_lote := null;
  end if;

  -- ── Preparo sem lote: o custo é a ficha dele, dividida pelo rendimento ────
  if v_lote is null and v_ins.preparo then
    select sum(fp.quantidade * c.custo),
           bool_and(c.confiavel),
           min(c.motivo) filter (where not c.confiavel)
      into v_soma, v_todos, v_falta
    from public.fichas_preparos fp
    cross join lateral public.fn_custo_unitario_insumo(fp.insumo_id, p_nivel + 1) c
    where fp.preparo_id = p_insumo_id;

    if v_soma is null then
      return query select null::numeric, false,
        'preparo sem ficha técnica: cadastre os insumos que entram nele'; return;
    end if;

    v_rend  := v_ins.rendimento;
    v_custo := v_soma / nullif(v_rend, 0);

    if not coalesce(v_todos, false) then
      return query select v_custo, false,
        coalesce(v_falta, 'um insumo do preparo está sem custo confiável');
      return;
    end if;
    return query select v_custo, true, null::text;
    return;
  end if;

  v_custo := coalesce(v_lote, v_ins.preco_embalagem / nullif(v_ins.qtd_embalagem, 0));

  if v_custo is null or v_custo <= 0 then
    return query select null::numeric, false,
      'sem custo cadastrado: informe o preço e o tamanho da embalagem'; return;
  end if;

  if v_lote is null and v_pequena and coalesce(v_ins.qtd_embalagem, 0) < 5 then
    return query select v_custo, false,
      format('embalagem declarada com %s %s: confira o tamanho real (ex.: 900 para uma garrafa de 900 ml)',
             trim(to_char(v_ins.qtd_embalagem,'FM999999990.####')), v_ins.unidade_medida);
    return;
  end if;

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

comment on function public.fn_custo_unitario_insumo(uuid, int) is
  'Custo por unidade de estoque, com veredito de confiança. Ordem: lote PEPS; '
  'se for preparo sem lote, a soma da própria ficha dividida pelo rendimento '
  '(recursivo, teto de 5 níveis); senão preço/embalagem.';
