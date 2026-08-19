-- Agenda o coletor da fila de eventos do iFood.
--
-- A integração só tinha webhook. A Order API do iFood entrega pedido por FILA:
-- o fluxo oficial é events:polling -> processa -> acknowledgment. Webhook é
-- complemento. Um minuto fora do ar — deploy, erro, cold start — e o evento se
-- perde: o pedido nunca chega na cozinha, o cliente espera comida que ninguém
-- está preparando, e a loja leva penalidade do iFood.
--
-- Roda a cada minuto (menor granularidade do pg_cron). O iFood recomenda ~30s;
-- 1 min ainda deixa folga confortável para o SLA de 8 minutos de confirmação
-- do pedido, que a ifood-webhook já cumpre no evento PLC.
--
-- A função sai cedo quando nenhuma loja tem `ifood_merchant_id`, então
-- enquanto ninguém usa a integração isto não gasta chamada de API.
--
-- Usa a mesma mecânica da drenagem de e-mail: pg_net + segredo no Vault, sem
-- nunca colocar a service role key em texto no agendamento.

create or replace function fn_ifood_coletar_eventos()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $fn$
declare v_key text;
begin
  -- Sai antes de qualquer chamada se ninguém integrou o iFood ainda.
  if not exists (select 1 from lojas where ifood_merchant_id is not null) then
    return;
  end if;

  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'service_role_key_ifood';
  if v_key is null then
    raise warning 'service_role_key_ifood ausente no Vault — polling do iFood não executado';
    return;
  end if;

  perform net.http_post(
    url     := 'https://zzuxklwhaoisuuvndtfw.supabase.co/functions/v1/ifood-polling',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_key),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
end;
$fn$;

revoke execute on function fn_ifood_coletar_eventos() from public, anon, authenticated;

select cron.schedule('coletar-eventos-ifood', '* * * * *', $$select public.fn_ifood_coletar_eventos()$$);
