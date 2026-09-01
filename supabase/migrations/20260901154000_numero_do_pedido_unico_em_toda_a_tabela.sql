-- `uq_pedidos_loja_numero` era PARCIAL: valia so para pedidos a partir de
-- 22/07/2026, porque quando o indice foi criado ja existiam linhas com numero
-- repetido dentro da mesma loja e o indice total nao subiria.
--
-- Indice parcial protege o futuro e deixa o passado mentindo: duas comandas com
-- o mesmo numero na mesma loja, e busca por numero devolvendo mais de um
-- pedido. Medido em 01/09/2026: 24 linhas no Lanche do Paulista e 6 no
-- Natureba. Como e tudo dado de teste pre-lancamento, a correcao certa e limpar
-- o passado e fazer a regra valer para a tabela inteira.
--
-- Renumera em vez de apagar: pedido tem lancamento no ledger, pagamento e
-- historico pendurados. A linha mais antiga de cada grupo fica com o numero
-- original; as demais recebem numeros acima do maior da loja.
with dupes as (
  select p.id, p.loja_id,
         row_number() over (partition by p.loja_id, p.numero order by p.criado_em, p.id) as pos
  from pedidos p
  where exists (
    select 1 from pedidos q
    where q.loja_id = p.loja_id and q.numero = p.numero and q.id <> p.id
  )
),
renumerar as (
  select d.id, d.loja_id,
         row_number() over (partition by d.loja_id order by d.id) as ordem
  from dupes d where d.pos > 1
),
teto as (select loja_id, max(numero) as maior from pedidos group by loja_id)
update pedidos p
   set numero = t.maior + r.ordem
  from renumerar r join teto t on t.loja_id = r.loja_id
 where p.id = r.id;

update loja_sequencias s
   set ultimo_numero = greatest(s.ultimo_numero, m.maior)
  from (select loja_id, max(numero) as maior from pedidos group by loja_id) m
 where m.loja_id = s.loja_id;

-- Trava: se sobrou colisao, a migracao para aqui em vez de deixar o indice
-- cair silenciosamente de volta para parcial.
do $do$
declare v_restantes integer;
begin
  select count(*) into v_restantes from pedidos p
  where exists (select 1 from pedidos q
                where q.loja_id = p.loja_id and q.numero = p.numero and q.id <> p.id);
  if v_restantes > 0 then
    raise exception 'ainda ha % linha(s) com numero repetido', v_restantes;
  end if;
end
$do$;

drop index if exists public.uq_pedidos_loja_numero;
create unique index uq_pedidos_loja_numero on public.pedidos (loja_id, numero);
