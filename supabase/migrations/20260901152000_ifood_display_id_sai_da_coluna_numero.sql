-- O displayId do iFood era gravado em `pedidos.numero` — e isso PERDIA PEDIDO.
--
-- `numero` tem indice unico (loja_id, numero) para pedidos a partir de
-- 22/07/2026. O displayId e a numeracao do iFood, independente da nossa: basta
-- um pedido chegar com displayId igual a um numero que a loja ja emitiu para o
-- INSERT ser rejeitado. `fn_ifood_criar_pedido` levanta excecao, o webhook nao
-- confirma, e o iFood reentrega o mesmo evento — que falha de novo, para
-- sempre. Pedido que nunca chega na cozinha, sem ninguem perceber.
--
-- Nao e hipotese distante: o contador do Lanche do Paulista ja estava em 240 e
-- displayId do iFood costuma ter tres ou quatro digitos. Reproduzido em
-- 01/09/2026 com displayId 26 contra um pedido 26 existente.
--
-- A cirurgia e feita sobre a definicao viva da funcao, com ancoras conferidas,
-- porque `fn_ifood_criar_pedido` e grande e reescreve-la inteira aqui faria a
-- migracao divergir do que esta em producao no resto do corpo.
do $do$
declare d text;
begin
  select pg_get_functiondef(oid) into d from pg_proc where proname = 'fn_ifood_criar_pedido';
  if d is null then raise exception 'fn_ifood_criar_pedido nao encontrada'; end if;

  if position('ifood_display_id' in d) > 0 then
    return; -- ja aplicada
  end if;

  if position('observacao, numero, identificador_cliente' in d) = 0 then
    raise exception 'ancora da lista de colunas nao encontrada';
  end if;
  d := replace(d, 'observacao, numero, identificador_cliente',
                  'observacao, numero, ifood_display_id, identificador_cliente');

  if position('else fn_proximo_numero(v_loja_id) end,' in d) = 0 then
    raise exception 'ancora do else nao encontrada';
  end if;
  d := replace(d, 'else fn_proximo_numero(v_loja_id) end,', 'else null end,');

  if position('case when coalesce(p_order->>''displayId''' in d) = 0 then
    raise exception 'ancora do case nao encontrada';
  end if;
  d := replace(d, 'case when coalesce(p_order->>''displayId''',
                  'fn_proximo_numero(v_loja_id),
    case when coalesce(p_order->>''displayId''');

  execute d;
end
$do$;

-- Historico: pedidos do iFood que ainda carregam o displayId em `numero`
-- ganham numeracao propria da loja, sequencial por data, e o displayId vai
-- para a coluna certa. Sem isto o contador da loja um dia alcanca a faixa do
-- iFood (8000-9300 no Natureba) e volta a colidir.
with alvo as (
  select p.id, p.loja_id, p.numero as numero_antigo,
         row_number() over (partition by p.loja_id order by p.criado_em) as ordem
  from pedidos p
  where p.ifood_order_id is not null and p.ifood_display_id is null
),
base as (
  select a.loja_id,
         coalesce(max(p2.numero) filter (where p2.ifood_order_id is null), 0) as maior_proprio
  from alvo a join pedidos p2 on p2.loja_id = a.loja_id
  group by a.loja_id
)
update pedidos p
   set ifood_display_id = a.numero_antigo,
       numero = b.maior_proprio + a.ordem
  from alvo a join base b on b.loja_id = a.loja_id
 where p.id = a.id;

-- Contador nunca pode ficar atras do maior numero emitido, senao a proxima
-- venda tenta reemitir um numero que ja existe e o caixa trava.
update loja_sequencias s
   set ultimo_numero = greatest(s.ultimo_numero, m.maior)
  from (select loja_id, max(numero) as maior from pedidos group by loja_id) m
 where m.loja_id = s.loja_id;

insert into loja_sequencias (loja_id, ultimo_numero)
select m.loja_id, m.maior from (select loja_id, max(numero) as maior from pedidos group by loja_id) m
on conflict (loja_id) do nothing;
