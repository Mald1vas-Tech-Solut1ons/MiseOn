-- A integração recebia pedido do iFood e nunca respondia de volta.
--
-- O lojista marcava PREPARANDO no KDS, PRONTO no balcão, despachava com o
-- entregador — e o cliente no app do iFood seguia vendo "pedido confirmado",
-- parado. Os endpoints de ciclo de vida (startPreparation, readyToPickup,
-- dispatch) fazem parte dos critérios de homologação do iFood; sem eles a
-- integração não passa e o pedido não avança do lado deles.
--
-- O gatilho fica no banco, e não em cada tela, porque o status muda em três
-- lugares diferentes (KDS, Painel de Pedidos, app do entregador). Preso à
-- tabela, nenhum deles precisa lembrar de avisar o iFood.
--
-- AFTER UPDATE, nunca BEFORE: pg_net dentro de trigger BEFORE na mesma linha é
-- a armadilha do 27000 que já derrubou o fluxo de estoque nesta base.
-- Falha de rede não pode derrubar a venda: o net.http_post é assíncrono e o
-- resultado fica em net._http_response para diagnóstico.

create or replace function fn_trg_ifood_status()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $fn$
declare v_token text;
begin
  -- Só pedido vindo do iFood, e só quando o status realmente muda.
  if NEW.ifood_order_id is null or NEW.status = OLD.status then
    return NEW;
  end if;

  -- Estes são os únicos status com callback. FINALIZADO e CANCELADO vêm DO
  -- iFood (CON/CAN) para nós, não o contrário.
  if NEW.status not in ('PREPARANDO', 'PRONTO', 'EM_ROTA') then
    return NEW;
  end if;

  select decrypted_secret into v_token
    from vault.decrypted_secrets where name = 'ifood_polling_token';
  if v_token is null then
    raise warning 'ifood_polling_token ausente — status do pedido % não avisado ao iFood', NEW.id;
    return NEW;
  end if;

  perform net.http_post(
    url     := 'https://zzuxklwhaoisuuvndtfw.supabase.co/functions/v1/ifood-status',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_token),
    body    := jsonb_build_object('pedido_id', NEW.id),
    timeout_milliseconds := 15000
  );

  return NEW;
end;
$fn$;

drop trigger if exists trg_ifood_status on pedidos;
create trigger trg_ifood_status
  after update of status on pedidos
  for each row execute function fn_trg_ifood_status();
