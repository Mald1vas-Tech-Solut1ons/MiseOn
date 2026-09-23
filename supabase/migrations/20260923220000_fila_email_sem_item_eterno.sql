-- Fila de e-mail: nenhum item fica eterno, em nenhum dos dois sentidos.
--
-- Medido em 23/09/2026: quem entrega e-mail é o pg_cron `drenar-fila-email`,
-- de minuto em minuto (mediana de 30 s entre agendar e enviar, pior caso 92 s,
-- zero falhas em 7 dias). O Vercel Cron diário (`/api/cron/email`) virou
-- redundante e sai no mesmo commit.
--
-- Duas brechas que sobravam:
--
-- 1. Item preso em ENVIANDO. A reserva marca ENVIANDO e só o worker tira de
--    lá. Se a edge function morre no meio do lote (timeout, 402 do gateway como
--    em 16/09, deploy), o e-mail fica ENVIANDO para sempre e some sem erro.
--    Agora, reservado há mais de 15 min sem desfecho volta para a fila contando
--    uma tentativa — e com 4 tentativas vira FALHOU, visível.
--
-- 2. Item PENDENTE que nunca pode sair. A reserva segura `pedido-recebido`
--    enquanto o pedido não está em estado operacional, mas o drenador
--    perguntava só "tem PENDENTE?". Um pedido cancelado com confirmação na
--    fila fazia o cron chamar a função a cada minuto, eternamente, para ela
--    reservar zero itens — a mesma classe de consumo que motivou o disjuntor
--    do iFood. Agora o drenador e a reserva usam o MESMO predicado, e o que
--    não pode mais sair (pedido cancelado ou apagado) é SUPRIMIDO com motivo.

-- Predicado único: o item pode ser enviado agora?
create or replace function public.fn_email_pronto_para_envio(q public.email_fila)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select q.status = 'PENDENTE'
     and q.agendado_para <= now()
     and (q.evento <> 'pedido-recebido' or exists (
       select 1 from public.pedidos p
       where p.id = q.referencia_id and p.loja_id = q.loja_id
         and p.status::text in ('NOVO','ACEITO','PREPARANDO','PRONTO','EM_ROTA','FINALIZADO')
     ));
$$;

-- DEFAULT PRIVILEGES do projeto dão EXECUTE a anon/authenticated em toda
-- função nova: fechar nos três.
revoke all on function public.fn_email_pronto_para_envio(public.email_fila) from public, anon, authenticated;
grant execute on function public.fn_email_pronto_para_envio(public.email_fila) to service_role;

create or replace function public.fn_email_reservar(p_limite integer default 20, p_loja uuid default null)
returns setof public.email_fila
language sql
security definer
set search_path = public
as $$
  update public.email_fila f set status = 'ENVIANDO', atualizado_em = now()
  where f.id in (
    select q.id from public.email_fila q
    where q.status = 'PENDENTE'
      and (p_loja is null or q.loja_id = p_loja)
      and public.fn_email_pronto_para_envio(q)
    order by q.criado_em limit p_limite for update of q skip locked
  ) returning f.*;
$$;

-- Arrumação da fila. Separada do drenador para poder ser provada sozinha.
create or replace function public.fn_email_arrumar_fila()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Reserva órfã: o worker não confirmou em 15 min.
  update public.email_fila
     set tentativas    = tentativas + 1,
         status        = case when tentativas + 1 >= 4 then 'FALHOU' else 'PENDENTE' end,
         ultimo_erro   = 'Worker não confirmou o envio (reservado há mais de 15 min)',
         agendado_para = now(),
         atualizado_em = now()
   where status = 'ENVIANDO'
     and atualizado_em < now() - interval '15 minutes';

  -- 2. Confirmação de pedido que não vai mais existir.
  update public.email_fila q
     set status = 'SUPRIMIDO',
         ultimo_erro = 'Pedido cancelado ou removido antes do envio',
         atualizado_em = now()
   where q.status = 'PENDENTE'
     and q.evento = 'pedido-recebido'
     and not exists (
       select 1 from public.pedidos p
       where p.id = q.referencia_id and p.loja_id = q.loja_id
         and p.status::text <> 'CANCELADO'
     );
end;
$$;

revoke all on function public.fn_email_arrumar_fila() from public, anon, authenticated;
grant execute on function public.fn_email_arrumar_fila() to service_role;

create or replace function public.fn_email_drenar_fila()
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare v_token text;
begin
  perform public.fn_email_arrumar_fila();

  -- Só bate na função se houver o que ela CONSEGUE enviar agora — mesmo
  -- predicado da reserva, para as duas nunca discordarem.
  if not exists (
    select 1 from public.email_fila q
    where q.status = 'PENDENTE' and public.fn_email_pronto_para_envio(q)
  ) then
    return;
  end if;

  select decrypted_secret into v_token
    from vault.decrypted_secrets where name = 'email_worker_token_db';
  if v_token is null then
    raise warning 'email_worker_token_db ausente no Vault — drenagem não executada';
    return;
  end if;

  perform net.http_post(
    url     := 'https://zzuxklwhaoisuuvndtfw.supabase.co/functions/v1/send-transactional-email',
    headers := jsonb_build_object('Content-Type','application/json','x-worker-token', v_token),
    body    := jsonb_build_object('acao','processar'),
    timeout_milliseconds := 20000
  );
end;
$$;
