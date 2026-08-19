-- Preferências da integração iFood, por loja.
--
-- Sincronização que o lojista não controla é imposição, não integração. Cada
-- restaurante opera de um jeito: tem quem queira o cardápio inteiro espelhado,
-- tem quem mantenha preço diferente no iFood (por causa da comissão) e queira
-- só a disponibilidade sincronizada, e tem quem prefira empurrar na mão.
--
-- Todas as chaves nascem CONSERVADORAS (false): integração existente não muda
-- de comportamento sozinha só porque a coluna passou a existir. Quem liga é o
-- lojista, na tela.
--
-- `ifood_addon_ativo` já existia como chave-mestra e as funções que escrevi
-- estavam ignorando — passa a valer como interruptor geral.

alter table lojas
  add column if not exists ifood_sync_cardapio          boolean not null default false,
  add column if not exists ifood_sync_preco_auto        boolean not null default false,
  add column if not exists ifood_sync_disponibilidade   boolean not null default false,
  add column if not exists ifood_sync_status_pedido     boolean not null default false,
  add column if not exists ifood_pausar_sem_estoque     boolean not null default false,
  add column if not exists ifood_confirmar_automatico   boolean not null default true;

comment on column lojas.ifood_sync_cardapio is
  'Permite o envio do cardápio (categorias/itens) para o iFood. Desligado, a função de sync recusa a execução.';
comment on column lojas.ifood_sync_preco_auto is
  'Preço alterado no MiseOn é empurrado sozinho para o iFood. Desligado, o lojista mantém preço próprio lá (comum, por causa da comissão).';
comment on column lojas.ifood_sync_disponibilidade is
  'Pausar/despausar item no MiseOn reflete no iFood.';
comment on column lojas.ifood_sync_status_pedido is
  'Avança o pedido no iFood (startPreparation/readyToPickup/dispatch) conforme o status muda aqui.';
comment on column lojas.ifood_pausar_sem_estoque is
  'Quando o insumo acaba e o produto fica sem estoque, pausa o item no iFood automaticamente.';
comment on column lojas.ifood_confirmar_automatico is
  'Confirma o pedido no iFood assim que chega (SLA de 8 min). Desligado, o lojista confirma na mão pelo painel.';

-- O gatilho de status passa a respeitar a preferência. Antes disparava para
-- qualquer pedido com ifood_order_id, sem perguntar.
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

  if NEW.status not in ('PREPARANDO', 'PRONTO', 'EM_ROTA') then
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
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_token),
    body    := jsonb_build_object('pedido_id', NEW.id),
    timeout_milliseconds := 15000
  );

  return NEW;
end;
$fn$;
