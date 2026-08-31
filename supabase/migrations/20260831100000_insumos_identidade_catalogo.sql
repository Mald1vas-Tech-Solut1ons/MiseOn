-- Identidade do insumo: gênero universal, variedade e marca.
--
-- ─── O PROBLEMA ───────────────────────────────────────────────────────────
-- O cadastro tinha um campo só: `nome`, texto livre. Então "Tomate Italiano",
-- "TOM DEBORA" e "tomate salada" viravam três itens sem nenhuma relação entre
-- si. Cada um com seu saldo — correto, são compras diferentes — mas também sem
-- nenhuma forma de responder "quanto eu gastei de tomate no mês", que é a
-- pergunta que o dono realmente faz. Somar na mão três linhas que ele nem sabe
-- que são a mesma coisa não é relatório, é adivinhação.
--
-- ─── A DECISÃO ────────────────────────────────────────────────────────────
-- Três colunas, com papéis distintos:
--
--   catalogo_ref  o gênero ('tomate'). É o que AGRUPA. Vem do catálogo
--                 universal (src/lib/catalogoInsumos.ts) e é o mesmo para
--                 todas as variedades. NULL para item fora do catálogo, que
--                 continua sendo cadastro livre — o catálogo é atalho, não
--                 cerca.
--   variedade     'Italiano', 'Débora', 'Asterix', 'Pera'. É o que DISTINGUE
--                 dentro do gênero.
--   marca         fabricante. Distingue no eixo comercial: o mesmo arroz
--                 branco de duas marcas tem preço e rendimento diferentes.
--
-- `nome` continua sendo a identidade única (loja, nome) e passa a ser montado
-- a partir dos três — "Tomate Italiano", "Arroz Branco tipo 1 Tio João". Nada
-- do que já existe muda de forma: ficha técnica, PDV, custeio e importação
-- seguem lendo `nome` como sempre leram. Por isso não há backfill aqui: um
-- UPDATE adivinhando o gênero de cada nome gravado erraria em silêncio, e
-- errar em silêncio no que agrupa custo é pior do que não agrupar. O vínculo é
-- preenchido quando o lojista salva o item, com a sugestão já na tela.
ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS catalogo_ref TEXT,
  ADD COLUMN IF NOT EXISTS variedade    TEXT,
  ADD COLUMN IF NOT EXISTS marca        TEXT;

COMMENT ON COLUMN public.insumos.catalogo_ref IS
  'Slug do gênero no catálogo universal (ex.: tomate). Agrupa variedades do mesmo item para custo e compras. NULL = item fora do catálogo.';
COMMENT ON COLUMN public.insumos.variedade IS
  'Variedade, tipo ou corte dentro do gênero (Italiano, Débora, Asterix).';
COMMENT ON COLUMN public.insumos.marca IS
  'Marca ou fabricante. Participa do nome porque distingue preço e rendimento.';

-- O agrupamento por gênero é a consulta que nasce com estas colunas
-- ("meus tomates", "quanto gastei de queijo"), sempre dentro de uma loja.
CREATE INDEX IF NOT EXISTS idx_insumos_catalogo_ref
  ON public.insumos (loja_id, catalogo_ref)
  WHERE catalogo_ref IS NOT NULL;
