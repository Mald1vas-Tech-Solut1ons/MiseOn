-- ============================================================================
-- ERP — ONDA 0: A ESPINHA
-- ============================================================================
-- O que esta migração faz: ensina o sistema que nem tudo que entra pela porta
-- dos fundos é comida. Detergente, marmitex, papel A4, uniforme e freezer
-- também são comprados, também têm custo, e hoje somem do resultado porque só
-- existe `insumos` — uma tabela que assume ficha técnica, validade e CMV.
--
-- ─── A DECISÃO DE MODELO ───────────────────────────────────────────────────
-- O plano original previa renomear `insumos` para `itens` e deixar `insumos`
-- como view de compatibilidade. Auditoria antes de escrever mostrou 12 chaves
-- estrangeiras apontando para insumos(id) — de compras_itens a lotes_estoque,
-- passando por fichas_tecnicas, opcoes e movimentacoes_estoque. Renomear
-- preserva as FKs (elas seguem o OID, não o nome), mas o PostgREST passaria a
-- resolver os embeds aninhados (`.select('*, insumos(*)')`) contra uma view, e
-- isso é risco real espalhado por dezenas de queries do front — em troca de
-- um ganho puramente cosmético de nomenclatura.
--
-- Decisão: a tabela continua `insumos`. O que importa é o DISCRIMINADOR, não o
-- nome. Nenhuma query existente muda de comportamento, porque o backfill deixa
-- todo mundo como já era. `itens` existe como VIEW nova para o código novo ler,
-- e a nomenclatura converge sem nenhum big bang.
--
-- ─── A PONTE DE COMPATIBILIDADE ────────────────────────────────────────────
-- `is_preparo` continua funcionando. Um trigger mantém is_preparo e tipo_item
-- sincronizados nos dois sentidos, então a tela de Preparos, que insere
-- { is_preparo: true } sem saber que tipo_item existe, continua correta — e o
-- código novo, que insere tipo_item, também. Nenhum lado precisa saber do outro.
-- ============================================================================

-- ── 1. Catálogo de tipos de item ────────────────────────────────────────────
-- Cada tipo declara seu COMPORTAMENTO, não só seu nome. É isto que faz
-- "adicionar material de escritório" ser uma linha nesta tabela e não um módulo.

create table if not exists public.tipos_item (
  codigo               text primary key,
  rotulo               text not null,
  descricao            text,
  -- pode ser ingrediente de uma receita? (governa o seletor da ficha técnica)
  entra_ficha_tecnica  boolean not null default false,
  -- ESTOQUE_CMV  : vira custo do prato vendido
  -- ALMOXARIFADO : vira despesa operacional no consumo, não no prato
  -- IMOBILIZADO  : não entra no resultado; deprecia ao longo da vida útil
  natureza             text not null check (natureza in ('ESTOQUE_CMV', 'ALMOXARIFADO', 'IMOBILIZADO')),
  conta_estoque        text not null,   -- onde o saldo fica no ativo
  conta_consumo        text not null,   -- para onde o consumo é lançado
  controla_validade    boolean not null default false,
  icone                text,
  ordem                int not null default 0,
  ativo                boolean not null default true
);

comment on table public.tipos_item is
  'Catálogo de plataforma. Cada tipo declara o comportamento contábil e operacional do item — não é só rótulo.';

insert into public.tipos_item
  (codigo, rotulo, descricao, entra_ficha_tecnica, natureza, conta_estoque, conta_consumo, controla_validade, icone, ordem) values
  ('INGREDIENTE',       'Ingrediente',            'Entra na receita e vira custo do prato',                    true,  'ESTOQUE_CMV',  '1.1.03', '4.1.01', true,  'carrot',    10),
  ('PREPARO',           'Preparo',                'Item composto, produzido na cozinha a partir de outros',    true,  'ESTOQUE_CMV',  '1.1.03', '4.1.01', true,  'chef-hat',  20),
  ('REVENDA',           'Revenda direta',         'Comprado pronto e vendido sem transformação',               true,  'ESTOQUE_CMV',  '1.1.03', '4.1.01', true,  'package',   30),
  ('EMBALAGEM',         'Embalagem',              'Acompanha o produto vendido (marmitex, saco, tampa)',       true,  'ESTOQUE_CMV',  '1.1.03', '4.1.01', false, 'box',       40),
  ('DESCARTAVEL',       'Descartável',            'Guardanapo, canudo, talher plástico',                       true,  'ALMOXARIFADO', '1.1.04', '4.2.01', false, 'utensils',  50),
  ('LIMPEZA',           'Material de limpeza',    'Detergente, desinfetante, vassoura — produto químico',      false, 'ALMOXARIFADO', '1.1.04', '4.2.02', true,  'spray-can', 60),
  ('ESCRITORIO',        'Material de escritório', 'Papel, caneta, bobina de impressora',                       false, 'ALMOXARIFADO', '1.1.04', '4.2.03', false, 'printer',   70),
  ('MANUTENCAO',        'Manutenção',             'Peça de reposição, ferramenta, insumo de conserto',         false, 'ALMOXARIFADO', '1.1.04', '4.2.04', false, 'wrench',    80),
  ('UNIFORME_EPI',      'Uniforme e EPI',         'Entregue nominalmente ao colaborador; EPI tem CA e prazo',  false, 'ALMOXARIFADO', '1.1.04', '4.2.05', true,  'shirt',     90),
  ('ATIVO_IMOBILIZADO', 'Ativo imobilizado',      'Freezer, fogão, mobiliário — deprecia, não vira despesa',   false, 'IMOBILIZADO',  '1.2.01', '4.2.06', false, 'refrigerator', 100)
on conflict (codigo) do nothing;

-- Catálogo compartilhado: leitura liberada (a UI monta seletor com isto),
-- escrita só para service_role, que ignora RLS. Mesmo padrão de unidades_medida.
alter table public.tipos_item enable row level security;

drop policy if exists tipos_item_leitura_publica on public.tipos_item;
create policy tipos_item_leitura_publica
  on public.tipos_item for select
  to anon, authenticated
  using (true);

-- ── 2. Plano de contas: o almoxarifado e o imobilizado ──────────────────────
-- Sem estas contas, comprar detergente debitava estoque de INSUMO e o CMV saía
-- errado — ou pior, saía do Caixa direto, como já aconteceu com o 1.1.03 antes
-- da migração de compras (ver PLANO-PRODUTO, dívida antiga nº 2).

do $$
declare
  v_loja record;
begin
  for v_loja in select id from public.lojas loop
    insert into public.contas (codigo, nome, tipo, loja_id) values
      ('1.1.04', 'Almoxarifado',                'ATIVO',  v_loja.id),
      ('1.2.01', 'Imobilizado',                 'ATIVO',  v_loja.id),
      ('1.2.09', '(-) Depreciação Acumulada',   'ATIVO',  v_loja.id),
      ('4.2.01', 'Descartáveis',                'CUSTO',  v_loja.id),
      ('4.2.02', 'Material de Limpeza',         'CUSTO',  v_loja.id),
      ('4.2.03', 'Material de Escritório',      'CUSTO',  v_loja.id),
      ('4.2.04', 'Manutenção e Reparos',        'CUSTO',  v_loja.id),
      ('4.2.05', 'Uniformes e EPI',             'CUSTO',  v_loja.id),
      ('4.2.06', 'Depreciação',                 'CUSTO',  v_loja.id)
    on conflict (codigo, loja_id) do nothing;
  end loop;
end;
$$;

-- Loja nova nasce com o plano completo. Reescreve a função existente somando as
-- contas novas às antigas — manter as duas listas em sincronia é obrigação de
-- quem mexer aqui depois.
create or replace function public.fn_criar_contas_padrao() returns trigger as $$
begin
  insert into public.contas (codigo, nome, tipo, loja_id) values
    ('1.1.01', 'Caixa',                      'ATIVO',     new.id),
    ('1.1.02', 'Banco Efí',                  'ATIVO',     new.id),
    ('1.1.03', 'Estoque de Insumos',         'ATIVO',     new.id),
    ('1.1.04', 'Almoxarifado',               'ATIVO',     new.id),
    ('1.2.01', 'Imobilizado',                'ATIVO',     new.id),
    ('1.2.09', '(-) Depreciação Acumulada',  'ATIVO',     new.id),
    ('2.1.01', 'Fornecedores',               'PASSIVO',   new.id),
    ('3.1.01', 'Receita Vendas',             'RECEITA',   new.id),
    ('3.1.02', 'Receita iFood',              'RECEITA',   new.id),
    ('4.1.01', 'Custo Mercadoria Vendida',   'CUSTO',     new.id),
    ('4.1.02', 'Taxa iFood Retida',          'CUSTO',     new.id),
    ('4.2.01', 'Descartáveis',               'CUSTO',     new.id),
    ('4.2.02', 'Material de Limpeza',        'CUSTO',     new.id),
    ('4.2.03', 'Material de Escritório',     'CUSTO',     new.id),
    ('4.2.04', 'Manutenção e Reparos',       'CUSTO',     new.id),
    ('4.2.05', 'Uniformes e EPI',            'CUSTO',     new.id),
    ('4.2.06', 'Depreciação',                'CUSTO',     new.id),
    ('5.1.01', 'Resultado do Exercício',     'RESULTADO', new.id)
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- ── 3. O discriminador em insumos ───────────────────────────────────────────

alter table public.insumos
  add column if not exists tipo_item text not null default 'INGREDIENTE';

-- gtin e ncm chegam agora porque a Onda 1 (ingestão de NF-e) depende deles, e
-- porque adicionar coluna depois em tabela com 12 dependentes é mais caro.
-- gtin: código de barras — chave forte do de-para fornecedor→item, e a porta de
-- entrada da nutrição via Open Food Facts (ver PLANO-NUTRICIONAL §5.1 ①).
-- ncm: classificação fiscal — o classificador determinístico de tipo_item.
alter table public.insumos
  add column if not exists gtin text,
  add column if not exists ncm  text;

-- ── 4. Backfill: ninguém muda de comportamento ──────────────────────────────
-- A ordem importa: preparo antes de categoria, porque um preparo com
-- categoria_insumo='Ingrediente' é preparo, não ingrediente.
update public.insumos set tipo_item = 'PREPARO'
  where coalesce(is_preparo, false) = true;

update public.insumos set tipo_item = 'REVENDA'
  where coalesce(is_preparo, false) = false
    and categoria_insumo = 'Revenda Direta';

update public.insumos set tipo_item = 'LIMPEZA'
  where coalesce(is_preparo, false) = false
    and categoria_insumo = 'Limpeza';

-- O resto permanece INGREDIENTE pelo default. Nada de adivinhação por nome:
-- classificar por heurística de texto é justamente o que a Onda 1 vai fazer com
-- NCM e revisão humana. Aqui, o silêncio é a resposta correta.

-- FK só depois do backfill, senão a linha existente viola a chave.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'insumos_tipo_item_fkey'
  ) then
    alter table public.insumos
      add constraint insumos_tipo_item_fkey
      foreign key (tipo_item) references public.tipos_item(codigo);
  end if;
end;
$$;

create index if not exists idx_insumos_tipo_item on public.insumos (loja_id, tipo_item) where ativo;
create index if not exists idx_insumos_gtin      on public.insumos (gtin) where gtin is not null;

-- ── 5. A ponte de compatibilidade ───────────────────────────────────────────
-- Código antigo escreve is_preparo e não sabe de tipo_item.
-- Código novo escreve tipo_item e não deveria precisar saber de is_preparo.
-- Este trigger faz os dois conviverem sem nenhum dos lados ceder.

create or replace function public.fn_sync_tipo_item_is_preparo() returns trigger as $$
begin
  if tg_op = 'INSERT' then
    -- quem passou is_preparo=true sem tipo_item explícito (ficou no default)
    if coalesce(new.is_preparo, false) and new.tipo_item = 'INGREDIENTE' then
      new.tipo_item := 'PREPARO';
    end if;
    if new.tipo_item = 'PREPARO' then
      new.is_preparo := true;
    end if;

  elsif tg_op = 'UPDATE' then
    -- alterou is_preparo e não mexeu em tipo_item → is_preparo manda
    if coalesce(new.is_preparo, false) is distinct from coalesce(old.is_preparo, false)
       and new.tipo_item is not distinct from old.tipo_item then
      new.tipo_item := case when coalesce(new.is_preparo, false) then 'PREPARO' else 'INGREDIENTE' end;
    end if;
    -- alterou tipo_item → tipo_item manda
    if new.tipo_item is distinct from old.tipo_item then
      new.is_preparo := (new.tipo_item = 'PREPARO');
    end if;
  end if;

  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_sync_tipo_item_is_preparo on public.insumos;
create trigger trg_sync_tipo_item_is_preparo
  before insert or update on public.insumos
  for each row execute function public.fn_sync_tipo_item_is_preparo();

-- ── 6. Views para o código novo ─────────────────────────────────────────────
-- security_invoker=true: a view aplica a RLS de quem consulta, não a do dono.
-- Sem isso, view em public vira vazamento entre tenants (ver migração
-- 20260728212942).

-- `itens` é a leitura canônica do catálogo completo, já com o comportamento
-- do tipo resolvido. É o que o código novo deve usar.
create or replace view public.itens as
select
  i.*,
  t.rotulo              as tipo_rotulo,
  t.natureza            as tipo_natureza,
  t.entra_ficha_tecnica as tipo_entra_ficha,
  t.conta_estoque       as tipo_conta_estoque,
  t.conta_consumo       as tipo_conta_consumo,
  t.controla_validade   as tipo_controla_validade,
  t.icone               as tipo_icone
from public.insumos i
join public.tipos_item t on t.codigo = i.tipo_item;

alter view public.itens set (security_invoker = true);

-- O seletor da ficha técnica lê daqui. Detergente nunca aparece como
-- ingrediente de lanche porque o dado, e não a tela, decide isso.
create or replace view public.vw_itens_ficha_tecnica as
select i.* from public.itens i where i.tipo_entra_ficha and i.ativo;

alter view public.vw_itens_ficha_tecnica set (security_invoker = true);

-- Consumo que não é CMV: o que a Onda 2 vai controlar por requisição de setor.
create or replace view public.vw_itens_almoxarifado as
select i.* from public.itens i where i.tipo_natureza = 'ALMOXARIFADO' and i.ativo;

alter view public.vw_itens_almoxarifado set (security_invoker = true);

comment on view public.itens is
  'Leitura canônica do catálogo de itens com o comportamento do tipo resolvido. Código novo usa esta view; insumos continua sendo a tabela física por causa das 12 FKs que apontam para ela.';
