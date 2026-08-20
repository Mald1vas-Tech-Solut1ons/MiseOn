-- O gatilho que avisa o iFood sobre mudanca de status cobria apenas
-- PREPARANDO, PRONTO e EM_ROTA. CANCELADO ficava de fora, entao o lojista
-- cancelava o pedido no Painel de Pedidos e o cliente continuava vendo o
-- pedido ativo no app do iFood.
--
-- Isto e a etapa 3 da homologacao ("O aplicativo cancela pedidos corretamente").
--
-- O eco e tratado do lado da Edge Function, nao aqui: quando o cancelamento
-- parte do proprio iFood, a ifood-webhook grava o motivo com o prefixo
-- "[iFood]" e a ifood-status ignora esses casos. Filtrar aqui exigiria repetir
-- a regra em dois lugares.

create or replace function public.fn_trg_ifood_status()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare v_token text; v_ligado boolean;
begin
  if NEW.ifood_order_id is null or NEW.status = OLD.status then
    return NEW;
  end if;

  if NEW.status not in ('PREPARANDO', 'PRONTO', 'EM_ROTA', 'CANCELADO') then
    return NEW;
  end if;

  -- Respeita a chave-mestra E a preferência específica. Sem isto, a
  -- integração decide sozinha por um lojista que talvez não queira.
  select (ifood_addon_ativo and ifood_sync_status_pedido) into v_ligado
    from lojas where id = NEW.loja_id;
  if not coalesce(v_ligado, false) then
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
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_token),
    body    := jsonb_build_object('pedido_id', NEW.id),
    timeout_milliseconds := 5000
  );

  return NEW;
end;
$function$;

revoke execute on function public.fn_trg_ifood_status() from public, anon, authenticated;
