-- Confirmação é consequência da entrada operacional, nunca da criação do checkout.
-- Restaura a expressão de e-mail do fonte: produção continha escapes duplicados.
create or replace function public.fn_email_enfileirar(
  p_loja          uuid,
  p_evento        text,
  p_destinatario  text,
  p_payload       jsonb default '{}'::jsonb,
  p_referencia_id uuid default null,
  p_classe        text default 'TRANSACIONAL'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_agendado timestamptz := now();
begin
  -- A fila também protege chamadas diretas e webhooks antigos.
  if p_evento = 'pedido-recebido' and not exists (
    select 1 from public.pedidos p
    where p.id = p_referencia_id and p.loja_id = p_loja
      and p.status::text in ('NOVO','ACEITO','PREPARANDO','PRONTO','EM_ROTA','FINALIZADO')
  ) then return null; end if;
  if p_destinatario is null or p_destinatario !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return null;
  end if;

  if p_classe = 'MARKETING' then
    if not public.fn_email_pode_marketing(p_loja, p_destinatario) then
      return null;
    end if;
    v_agendado := public.fn_email_proxima_janela();
  end if;

  insert into public.email_fila (loja_id, evento, referencia_id, destinatario, classe, payload, agendado_para)
  values (p_loja, p_evento, p_referencia_id, lower(p_destinatario), p_classe, coalesce(p_payload, '{}'::jsonb), v_agendado)
  on conflict do nothing
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.fn_trg_email_pedido_criado()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_email text;
begin
  if new.status::text not in ('NOVO','ACEITO','PREPARANDO') then return null; end if;
  if tg_op = 'UPDATE' then
    if old.status::text <> 'AGUARDANDO_PAGAMENTO' then return null; end if;
    -- Só a confirmação integral pode liberar a intenção de compra online.
    if not exists (select 1 from public.pagamentos where pedido_id = new.id and status = 'PAGO')
      or (select coalesce(sum(valor_pago),0) from public.pagamentos
          where pedido_id = new.id and status = 'PAGO') < new.valor_total
    then return null; end if;
  end if;
  v_email := public.fn_email_do_pedido(new);
  if v_email is not null then
    perform public.fn_email_enfileirar(new.loja_id, 'pedido-recebido', v_email,
      '{}'::jsonb, new.id, 'TRANSACIONAL');
  end if;
  return null;
exception when others then
  raise warning 'fn_trg_email_pedido_criado: %', sqlerrm;
  return null;
end;
$$;

drop trigger if exists trg_email_pedido_criado on public.pedidos;
create trigger trg_email_pedido_criado after insert or update of status on public.pedidos
for each row execute function public.fn_trg_email_pedido_criado();

-- Filas antigas também ficam retidas enquanto aguardam pagamento.
-- Não apagamos o histórico nem reenviamos mensagens já processadas.
create or replace function public.fn_email_reservar(p_limite int default 20, p_loja uuid default null)
returns setof public.email_fila language sql security definer set search_path = public
as $$
  update public.email_fila f set status = 'ENVIANDO', atualizado_em = now()
  where f.id in (
    select q.id from public.email_fila q
    where q.status = 'PENDENTE' and q.agendado_para <= now()
      and (p_loja is null or q.loja_id = p_loja)
      and (q.evento <> 'pedido-recebido' or exists (
        select 1 from public.pedidos p where p.id = q.referencia_id and p.loja_id = q.loja_id
          and p.status::text in ('NOVO','ACEITO','PREPARANDO','PRONTO','EM_ROTA','FINALIZADO')
      ))
    order by q.criado_em limit p_limite for update of q skip locked
  ) returning f.*;
$$;

-- Funções internas: gatilhos/worker. Mantém a fronteira de privilégio.
revoke all on function public.fn_trg_email_pedido_criado() from public, anon, authenticated;
revoke all on function public.fn_email_enfileirar(uuid,text,text,jsonb,uuid,text) from public, anon, authenticated;
revoke all on function public.fn_email_reservar(int,uuid) from public, anon, authenticated;
grant execute on function public.fn_email_enfileirar(uuid,text,text,jsonb,uuid,text) to service_role;
grant execute on function public.fn_email_reservar(int,uuid) to service_role;
