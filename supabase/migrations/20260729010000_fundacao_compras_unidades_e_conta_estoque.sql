-- ============================================================================
-- Fundação do módulo de Compras — parte 1: consertar o que já estava torto
-- ============================================================================
-- Duas dívidas antigas que bloqueiam o módulo novo:
--
--  (1) insumos.unidade_medida tem FK para unidades_medida(codigo), mas a UI
--      oferece unidades que nunca foram inseridas lá (dente, cabeça, maço...).
--      Cadastrar alho em "dente" hoje estoura violação de chave estrangeira.
--
--  (2) fn_lancar_custo_estoque credita a conta '1.1.01' ao baixar CMV — que no
--      plano de contas é CAIXA, não Estoque. Ou seja: vender um lanche reduzia
--      o caixa contábil sem que um centavo saísse. Não existia conta de
--      estoque para creditar.
-- ============================================================================

-- ─── (1) Unidades que faltavam ──────────────────────────────────────────────
-- Semânticas: quebras sem massa universal — o rendimento é declaração humana.
-- Agrupadores: embalagens comerciais cujo conteúdo o lojista declara.
INSERT INTO public.unidades_medida (codigo, rotulo, grandeza, fator_base) VALUES
  -- quebras de manipulação (as que a UI já oferecia e o banco recusava)
  ('dente',     'Dente (ex: alho)',            'semantico',  NULL),
  ('maço',      'Maço (ex: couve, cebolinha)', 'semantico',  NULL),
  ('cabeça',    'Cabeça (ex: alho, cebola)',   'semantico',  NULL),
  ('folha',     'Folha (ex: alface, louro)',   'semantico',  NULL),
  ('rodela',    'Rodela (ex: tomate, cebola)', 'semantico',  NULL),
  -- quebras de açougue e hortifruti (food service de verdade)
  ('posta',     'Posta (ex: peixe)',           'semantico',  NULL),
  ('filé',      'Filé',                        'semantico',  NULL),
  ('ramo',      'Ramo (ex: salsa, alecrim)',   'semantico',  NULL),
  ('cubo',      'Cubo / Dado',                 'semantico',  NULL),
  -- embalagens de fornecedor
  ('dz',        'Dúzia (dz)',                  'agrupador',  NULL),
  ('bdj',       'Bandeja',                     'agrupador',  NULL),
  ('sc',        'Saco / Saca',                 'agrupador',  NULL),
  ('gl',        'Galão',                       'agrupador',  NULL),
  ('balde',     'Balde',                       'agrupador',  NULL),
  ('pote',      'Pote / Vidro',                'agrupador',  NULL),
  ('engradado', 'Engradado',                   'agrupador',  NULL),
  ('bombona',   'Bombona',                     'agrupador',  NULL)
ON CONFLICT (codigo) DO NOTHING;

-- ─── (1b) Número legível no histórico ───────────────────────────────────────
-- to_char(3, 'FM999999990.999') devolve "3." — o FM tira os zeros à direita e
-- deixa o separador órfão. Os motivos de movimentação são lidos pelo lojista
-- todo dia; "3. cabeça" é ruído gratuito.
CREATE OR REPLACE FUNCTION public.fn_num_txt(p_valor NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT rtrim(rtrim(to_char(p_valor, 'FM999999990.999'), '0'), '.');
$function$;

REVOKE ALL ON FUNCTION public.fn_num_txt(NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_num_txt(NUMERIC) TO authenticated;

-- ─── (2) Conta de Estoque no plano de contas ────────────────────────────────
INSERT INTO public.contas (codigo, nome, tipo, loja_id)
SELECT '1.1.03', 'Estoque de Insumos', 'ATIVO', l.id
FROM   public.lojas l
WHERE  NOT EXISTS (
  SELECT 1 FROM public.contas c WHERE c.loja_id = l.id AND c.codigo = '1.1.03'
);

-- Lojas novas já nascem com ela.
CREATE OR REPLACE FUNCTION public.fn_criar_contas_padrao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.contas (codigo, nome, tipo, loja_id) VALUES
    ('1.1.01', 'Caixa', 'ATIVO', NEW.id),
    ('1.1.02', 'Banco Efí', 'ATIVO', NEW.id),
    ('1.1.03', 'Estoque de Insumos', 'ATIVO', NEW.id),
    ('2.1.01', 'Fornecedores', 'PASSIVO', NEW.id),
    ('3.1.01', 'Receita Vendas', 'RECEITA', NEW.id),
    ('3.1.02', 'Receita iFood', 'RECEITA', NEW.id),
    ('4.1.01', 'Custo Mercadoria Vendida', 'CUSTO', NEW.id),
    ('4.1.02', 'Taxa iFood Retida', 'CUSTO', NEW.id),
    ('5.1.01', 'Resultado do Exercício', 'RESULTADO', NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ─── (3) CMV passa a creditar Estoque, não Caixa ────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_lancar_custo_estoque()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_conta_estoque UUID;
  v_conta_cmv     UUID;
BEGIN
  IF COALESCE(NEW.custo_total, 0) <= 0 THEN RETURN NEW; END IF;

  -- 1.1.03 = Estoque de Insumos. Antes era 1.1.01 (Caixa), o que fazia a baixa
  -- de estoque parecer saída de dinheiro no razão.
  SELECT id INTO v_conta_estoque FROM public.contas
    WHERE codigo = '1.1.03' AND loja_id = NEW.loja_id LIMIT 1;
  SELECT id INTO v_conta_cmv FROM public.contas
    WHERE codigo = '4.1.01' AND loja_id = NEW.loja_id LIMIT 1;

  IF v_conta_estoque IS NULL OR v_conta_cmv IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.lancamentos_financeiros (
    loja_id, historico, valor, conta_debitada, conta_creditada,
    referencia_tipo, referencia_id
  ) VALUES (
    NEW.loja_id,
    'CMV pedido ' || NEW.pedido_id || ' — ' ||
      (SELECT nome FROM public.insumos WHERE id = NEW.insumo_id),
    NEW.custo_total, v_conta_cmv, v_conta_estoque, 'PEDIDO', NEW.pedido_id
  );

  RETURN NEW;
END; $function$;
