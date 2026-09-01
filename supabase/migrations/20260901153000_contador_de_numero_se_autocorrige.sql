-- O contador da loja passa a nunca ficar atras da realidade.
--
-- A deriva medida em 01/09/2026: o Natureba tinha contador em 6 e pedidos com
-- numero ate 9279, porque `fn_ifood_criar_pedido` gravava o displayId do iFood
-- direto em `numero`, sem passar pela sequencia. Com o indice unico
-- (loja_id, numero), a proxima venda de balcao tentaria emitir 7 — numero que
-- ja existia — e o INSERT seria REJEITADO. Venda travada no caixa.
--
-- A causa foi corrigida na migracao anterior, mas o gatilho ainda aceita
-- `numero` explicito de quem inserir, entao a deriva pode voltar por outro
-- caminho. Em vez de confiar, a propria funcao reconcilia. O max() usa o
-- indice (loja_id, numero), entao custa uma leitura de indice por pedido.
create or replace function public.fn_proximo_numero(p_loja_id uuid)
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v_num integer; v_piso integer;
begin
  select coalesce(max(numero), 0) into v_piso
  from public.pedidos where loja_id = p_loja_id;

  insert into public.loja_sequencias (loja_id, ultimo_numero)
  values (p_loja_id, v_piso + 1)
  on conflict (loja_id) do update
    set ultimo_numero = greatest(loja_sequencias.ultimo_numero, v_piso) + 1
  returning ultimo_numero into v_num;

  return v_num;
end;
$function$;
