-- Cancelamento que chega DE FORA nao pode esbarrar em regra de papel
--
-- fn_valida_transicao_pedido exige papel 'admin' para cancelar depois que a
-- cozinha comecou. A regra e certa para gente: evita atendente derrubando
-- pedido em preparo. Mas ela vale para QUALQUER update, inclusive os que a
-- ifood-webhook faz com a service role — e ali nao existe auth.uid(), entao
-- `eh_admin` da false e a excecao sobe.
--
-- Consequencia real: cliente cancela no app do iFood enquanto o pedido esta na
-- chapa, o iFood manda o evento CAN, a webhook tenta gravar CANCELADO e leva
-- "só um admin pode cancelar agora". O erro morre num warn, o pedido continua
-- vivo no MiseOn e a cozinha termina uma comida que ninguem vai buscar.
--
-- Cancelamento vindo do iFood nao e opiniao da loja: ja aconteceu la. Quem
-- escreve sem usuario autenticado e a service role — que so a plataforma tem, e
-- que ja passa por RLS em todo o resto. Entao: sem auth.uid(), a transicao para
-- CANCELADO passa.
create or replace function public.fn_valida_transicao_pedido()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  eh_admin boolean;
begin
  if NEW.status = OLD.status then
    return NEW;
  end if;

  if OLD.status = 'NOVO' and NEW.status = 'ACEITO' then
    return NEW;
  end if;

  if OLD.status = 'ACEITO' and NEW.status = 'PREPARANDO' then
    if OLD.estacao_atual <> 'COZINHA' then
      raise exception 'Pedido #% ainda não foi enviado para a cozinha.', OLD.numero;
    end if;
    return NEW;
  end if;

  if OLD.status = 'ACEITO' and NEW.status = 'PRONTO' then
    if OLD.requer_cozinha then
      raise exception 'Pedido #% tem item de preparo — envie para a cozinha antes de marcar pronto.', OLD.numero;
    end if;
    return NEW;
  end if;

  if OLD.status = 'PREPARANDO' and NEW.status = 'PRONTO' then
    if OLD.estacao_atual <> 'COZINHA' then
      raise exception 'Pedido #% não está com a cozinha no momento.', OLD.numero;
    end if;
    NEW.estacao_atual := 'BALCAO';
    NEW.devolvido_balcao_em := now();
    return NEW;
  end if;

  if OLD.status = 'PRONTO' and NEW.status in ('EM_ROTA','FINALIZADO') then
    if OLD.estacao_atual <> 'BALCAO' then
      raise exception 'Pedido #% ainda está com a cozinha.', OLD.numero;
    end if;
    if NEW.status = 'EM_ROTA' and OLD.tipo_pedido <> 'DELIVERY' then
      raise exception 'Só pedidos de entrega saem para rota.';
    end if;
    if NEW.status = 'FINALIZADO' and OLD.tipo_pedido = 'DELIVERY' then
      raise exception 'Pedido de entrega precisa sair para rota antes de finalizar.';
    end if;
    NEW.conferido_em := coalesce(OLD.conferido_em, now());
    return NEW;
  end if;

  if OLD.status = 'EM_ROTA' and NEW.status = 'FINALIZADO' then
    return NEW;
  end if;

  if NEW.status = 'FINALIZADO' and OLD.tipo_pedido = 'SALAO' and OLD.status not in ('FINALIZADO','CANCELADO') then
    return NEW;
  end if;

  -- Cancelamento.
  if NEW.status = 'CANCELADO' then
    if OLD.status in ('FINALIZADO','CANCELADO') then
      raise exception 'Pedido #% já foi encerrado.', OLD.numero;
    end if;
    if OLD.status in ('NOVO','ACEITO') and OLD.estacao_atual = 'BALCAO' then
      return NEW; -- livre: a cozinha nem começou
    end if;
    -- Sem usuário na sessão = escrita da própria plataforma (service role):
    -- webhook do iFood, rotina de suporte. Ver cabeçalho desta migração.
    if auth.uid() is null then
      return NEW;
    end if;
    eh_admin := exists (
      select 1 from usuarios_loja
      where user_id = auth.uid() and loja_id = OLD.loja_id and papel = 'admin'
    );
    if not eh_admin then
      raise exception 'A cozinha já iniciou este pedido — só um admin pode cancelar agora.';
    end if;
    return NEW;
  end if;

  raise exception 'Transição de status inválida: % → % (pedido #%).', OLD.status, NEW.status, OLD.numero;
end;
$function$;
