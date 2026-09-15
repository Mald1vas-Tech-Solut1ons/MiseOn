-- Suíte de precisão da leitura do tamanho da embalagem na descrição da nota.
--
-- Por que existe: "a IA acerta 90%" só é afirmação se houver medição. Sem esta
-- suíte, qualquer mudança no parser é uma aposta — e o tamanho da embalagem é
-- o número que decide o custo de TODOS os pratos que usam aquele insumo.
--
-- Os casos abaixo são descrições reais de NFC-e (as truncadas inclusive, que é
-- como a SEFAZ devolve), mais os casos-limite que já quebraram alguma coisa.
--
-- Como rodar: cole no SQL Editor do Supabase ou mande pela Management API.
-- Só leitura: não grava nada.

with casos(descricao, unidade, esperado, porque) as (values
  -- ── Casos reais colhidos do tenant de provas ──────────────────────────────
  ('OLEO CANOLA SOYA 900ml',               'ml', 900::numeric, 'número colado na unidade'),
  ('OLEO SOJA VITALIV 900ml',              'ml', 900,           'idem, outra marca'),
  ('QUEIJO RALADO PARMESAO TEIXEIRA 40G',  'g',   40,           'maiúscula no fim'),
  ('IOG NATURAL INTEGRAL JAMAVA 150g',     'g',  150,           'minúscula no fim'),
  ('AGUA SANIT SELECT 2L',                 'ml', 2000,          'litro vira ml'),
  ('LEITE INTEGRAL PIRACANJUBA CT 1L',     'ml', 1000,          'idem, 1 L'),
  ('APP1 CEBOLA kg',                       'g',  1000,          'granel: kg sem número'),
  ('APP1 CENOURA kg',                      'g',  1000,          'idem'),
  ('CANELA EM CASCA KITANO 20g',           'g',   20,           'sachê pequeno legítimo'),

  -- ── O que NÃO pode ser lido: truncado ou ausente ──────────────────────────
  ('QUEIJO RALADO PARMESAO TEI',           'g',  null,          'truncada pela SEFAZ: não inventar'),
  ('LEITE INTE  AL PIRACANJUBA CT',        'g',  null,          'truncada e corrompida'),
  ('IOG NATURAL INTEGRAL JAMAVA 15',       'g',  null,          'cortou no meio do número: sem unidade'),
  ('PAO DE FORMA',                         'g',  null,          'sem tamanho nenhum'),

  -- ── Casos-limite que já causaram erro ─────────────────────────────────────
  ('REFRIGERANTE COLA 2L GARRAFA',         'ml', 2000,          'tamanho no meio da frase'),
  ('BISCOITO 3 UNIDADES 200g',             'g',  200,           'número solto antes não vence'),
  ('SABAO EM PO 1,5kg',                    'g',  1500,          'decimal com vírgula'),
  ('DETERGENTE 500 ML',                    'ml', 500,           'espaço entre número e unidade'),
  ('TEMPERO 2g',                           'g',  null,          'menor que 5: não existe no varejo'),
  ('OLEO 900ml',                           'g',  null,          'ml não converte para g'),
  ('ARROZ 5kg',                            'g',  5000,          'saco grande'),
  ('CAFE 500g PACOTE',                     'g',  500,           'unidade seguida de palavra')
)
select
  c.descricao,
  c.unidade,
  c.esperado,
  public.fn_tamanho_embalagem_da_descricao(c.descricao, c.unidade) as lido,
  (public.fn_tamanho_embalagem_da_descricao(c.descricao, c.unidade)
     is not distinct from c.esperado) as ok,
  c.porque
from casos c
order by ok, c.descricao;

-- Placar: a taxa de acerto que o produto pode AFIRMAR.
with casos(descricao, unidade, esperado) as (values
  ('OLEO CANOLA SOYA 900ml','ml',900::numeric), ('OLEO SOJA VITALIV 900ml','ml',900),
  ('QUEIJO RALADO PARMESAO TEIXEIRA 40G','g',40), ('IOG NATURAL INTEGRAL JAMAVA 150g','g',150),
  ('AGUA SANIT SELECT 2L','ml',2000), ('LEITE INTEGRAL PIRACANJUBA CT 1L','ml',1000),
  ('APP1 CEBOLA kg','g',1000), ('APP1 CENOURA kg','g',1000), ('CANELA EM CASCA KITANO 20g','g',20),
  ('QUEIJO RALADO PARMESAO TEI','g',null), ('LEITE INTE  AL PIRACANJUBA CT','g',null),
  ('IOG NATURAL INTEGRAL JAMAVA 15','g',null), ('PAO DE FORMA','g',null),
  ('REFRIGERANTE COLA 2L GARRAFA','ml',2000), ('BISCOITO 3 UNIDADES 200g','g',200),
  ('SABAO EM PO 1,5kg','g',1500), ('DETERGENTE 500 ML','ml',500), ('TEMPERO 2g','g',null),
  ('OLEO 900ml','g',null), ('ARROZ 5kg','g',5000), ('CAFE 500g PACOTE','g',500)
)
select count(*) as casos,
       count(*) filter (where public.fn_tamanho_embalagem_da_descricao(descricao,unidade)
                              is not distinct from esperado) as acertos,
       round(100.0 * count(*) filter (where public.fn_tamanho_embalagem_da_descricao(descricao,unidade)
                                            is not distinct from esperado) / count(*), 1) as pct_acerto
from casos;
