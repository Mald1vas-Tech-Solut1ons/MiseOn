-- Módulo Catalog do iFood: cardápio único.
--
-- Hoje o lojista mantém o cardápio DUAS vezes — no MiseOn e no portal do
-- iFood. Preço, disponibilidade, foto, complemento: tudo em dobro, e qualquer
-- divergência vira pedido errado ou item vendido que acabou.
--
-- Para sincronizar de forma idempotente é preciso guardar o id que o iFood
-- devolve. `externalCode` leva o id do MiseOn na ida (o iFood usa para casar),
-- mas os PATCH de preço e status pedem o `productId`/`itemId` DELES — sem
-- guardar, cada sync viraria item duplicado no cardápio do iFood.

alter table categorias add column if not exists ifood_category_id text;
alter table produtos   add column if not exists ifood_item_id    text;
alter table produtos   add column if not exists ifood_product_id text;

create index if not exists idx_categorias_ifood on categorias (ifood_category_id)
  where ifood_category_id is not null;
create index if not exists idx_produtos_ifood on produtos (ifood_item_id)
  where ifood_item_id is not null;

comment on column produtos.ifood_item_id is
  'id do item no catálogo do iFood. Necessário para PATCH de status; sem ele o sync duplicaria o item.';
comment on column produtos.ifood_product_id is
  'id do produto no iFood. É o que o PATCH /items/price exige.';

-- Log de sincronização: sem isto, sync que falha no meio some sem deixar
-- rastro e o lojista descobre pelo cliente reclamando de preço errado.
create table if not exists ifood_catalog_sync (
  id           uuid primary key default gen_random_uuid(),
  loja_id      uuid not null references lojas(id) on delete cascade,
  iniciado_em  timestamptz not null default now(),
  concluido_em timestamptz,
  situacao     text not null default 'rodando'
                 check (situacao in ('rodando','concluido','erro','parcial')),
  categorias_enviadas integer not null default 0,
  itens_enviados      integer not null default 0,
  falhas              integer not null default 0,
  detalhe      jsonb,
  erro         text
);

create index if not exists idx_ifood_sync_loja on ifood_catalog_sync (loja_id, iniciado_em desc);

alter table ifood_catalog_sync enable row level security;

create policy sync_catalogo_da_loja on ifood_catalog_sync
  for select using (fn_meu_acesso(loja_id));

comment on table ifood_catalog_sync is
  'Histórico de sincronização do cardápio com o iFood. Escrita só por service role (edge function).';
