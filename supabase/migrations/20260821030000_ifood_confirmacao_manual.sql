-- O interruptor "Confirmar pedido automaticamente" nao existia no codigo
--
-- A coluna `ifood_confirmar_automatico` nasceu na migration de preferencias e
-- NENHUMA linha a lia. A webhook confirmava todo pedido, sempre. O lojista
-- desligava o interruptor na tela e o MiseOn continuava aceitando pedido por
-- ele — inclusive com a loja sem condicao de produzir.
--
-- A webhook passa a respeitar a preferencia. Isso, sozinho, abriria um buraco
-- pior: com a confirmacao manual ligada, o lojista clica "Aceitar pedido" no
-- Painel, o status vai para ACEITO... e ninguem avisa o iFood. O pedido morre
-- no SLA de 8 minutos deles e o cliente leva um cancelamento que a loja nao
-- pediu.
--
-- ACEITO entra na lista de status que disparam o gatilho, mapeado para
-- /confirm. Quando a confirmacao automatica esta ligada, a ifood-status
-- detecta que a webhook ja confirmou e nao repete.

create or replace function fn_trg_ifood_status()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $fn$
declare v_token text; v_ligado boolean;
begin
  if NEW.ifood_order_id is null or NEW.status = OLD.status then
    return NEW;
  end if;

  -- ACEITO cobre a confirmacao manual; os demais, o ciclo de vida do pedido.
  if NEW.status not in ('ACEITO', 'PREPARANDO', 'PRONTO', 'EM_ROTA', 'CANCELADO') then
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
$fn$;
