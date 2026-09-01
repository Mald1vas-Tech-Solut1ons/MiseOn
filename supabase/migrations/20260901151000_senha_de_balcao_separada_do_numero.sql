-- Senha de balcao deixa de ser o numero do pedido.
--
-- Numero do pedido e IDENTIDADE: unico, imutavel, cresce para sempre, e o que
-- o fiscal, o financeiro e o suporte usam. Senha e CHAMADA: curta, legivel a
-- dez metros, falada em voz alta, e zera a cada dia de operacao.
--
-- Usar o mesmo numero para as duas coisas produzia "Senha 9279" no painel do
-- balcao. Medido em 01/09/2026: o contador do Lanche do Paulista estava em 240
-- com 26 pedidos reais (ele avanca ate em insert que falha), e o Natureba tinha
-- pedidos numerados ate 9279 porque o displayId do iFood ia para a mesma coluna.
--
-- A virada do dia e as 4h locais, nao a meia-noite: bar e hamburgueria faturam
-- depois da meia-noite e aquele pedido pertence ao servico da vespera. E como a
-- casa conta o proprio dia, e e configuravel por loja.

alter table public.lojas
  add column if not exists senha_virada_hora smallint not null default 4;

comment on column public.lojas.senha_virada_hora is
  'Hora local em que vira o dia de operacao para a numeracao de senha. Padrao 4h: pedido feito 01:30 pertence ao servico da noite anterior.';

alter table public.lojas drop constraint if exists ck_lojas_senha_virada_hora;
alter table public.lojas add constraint ck_lojas_senha_virada_hora
  check (senha_virada_hora between 0 and 12);

alter table public.pedidos add column if not exists senha integer;
comment on column public.pedidos.senha is
  'Senha de chamada no balcao (1..999, zera por dia de operacao). NULL quando o tipo do pedido nao e chamado no balcao (delivery).';

alter table public.pedidos add column if not exists ifood_display_id integer;
comment on column public.pedidos.ifood_display_id is
  'Numero que o cliente ve no app do iFood. Mora aqui, e NAO em `numero`: gravar o displayId em `numero` colidia com o indice unico (loja_id, numero) e o pedido do iFood era REJEITADO no insert.';

create table if not exists public.loja_senhas (
  loja_id     uuid    not null references public.lojas(id) on delete cascade,
  dia_servico date    not null,
  ultima      integer not null default 0,
  primary key (loja_id, dia_servico)
);
alter table public.loja_senhas enable row level security;

create or replace function public.fn_dia_servico(p_virada smallint default 4)
returns date language sql stable as $function$
  select (((now() at time zone 'America/Sao_Paulo')
           - make_interval(hours => coalesce(p_virada, 4)::int))::date);
$function$;

-- Volta para 1 depois de 999: senha e para ser lida de longe, entao nao pode
-- virar numero de quatro digitos. Casa que passa de 999 chamadas de balcao num
-- unico dia reusa o 1 — a essa altura a senha 1 daquele dia ja foi retirada.
create or replace function public.fn_proxima_senha(p_loja uuid, p_virada smallint default 4)
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v_dia date; v_nova integer;
begin
  v_dia := public.fn_dia_servico(p_virada);
  insert into public.loja_senhas (loja_id, dia_servico, ultima)
  values (p_loja, v_dia, 1)
  on conflict (loja_id, dia_servico) do update
    set ultima = case when loja_senhas.ultima >= 999 then 1 else loja_senhas.ultima + 1 end
  returning ultima into v_nova;
  return v_nova;
end;
$function$;

-- O BEFORE INSERT cuida da identidade INTEIRA do pedido: numero sempre, senha
-- so quando o tipo e um dos que a loja chama no balcao.
create or replace function public.fn_trg_numero_pedido()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_tipos public.tipo_pedido[]; v_virada smallint;
begin
  if NEW.numero is null or NEW.numero = 0 then
    NEW.numero := public.fn_proximo_numero(NEW.loja_id);
  end if;

  if NEW.senha is null then
    select l.painel_tv_tipos, l.senha_virada_hora into v_tipos, v_virada
    from public.lojas l where l.id = NEW.loja_id;

    if NEW.tipo_pedido = any(
         coalesce(v_tipos, array['RETIRADA_BALCAO','SALAO']::public.tipo_pedido[])) then
      NEW.senha := public.fn_proxima_senha(NEW.loja_id, coalesce(v_virada, 4::smallint));
    end if;
  end if;

  return NEW;
end;
$function$;

-- O painel devolve a SENHA. `numero` fica de reserva para pedido antigo,
-- gravado antes desta migracao, que nunca teve senha.
create or replace function public.fn_painel_tv_senhas(p_slug text, p_token uuid default null)
returns table(numero integer, status text, primeiro_nome text, criado_em timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_loja uuid; v_token uuid; v_tipos public.tipo_pedido[];
begin
  select l.id, l.painel_tv_token, l.painel_tv_tipos into v_loja, v_token, v_tipos
  from lojas l where l.slug = p_slug and l.ativo;

  if v_loja is null then return; end if;

  if v_token is not null and (p_token is null or p_token <> v_token) then
    raise exception 'Painel de TV desta loja exige token na URL.';
  end if;

  return query
  select coalesce(p.senha, p.numero) as numero,
         p.status::text,
         nullif(split_part(btrim(coalesce(p.identificador_cliente, '')), ' ', 1), '') as primeiro_nome,
         p.criado_em
  from pedidos p
  where p.loja_id = v_loja
    and p.criado_em >= now() - interval '12 hours'
    and p.status in ('NOVO','ACEITO','PREPARANDO','PRONTO','EM_ROTA')
    and p.tipo_pedido = any(
          coalesce(v_tipos, array['RETIRADA_BALCAO','SALAO']::public.tipo_pedido[]))
  order by p.criado_em desc
  limit 100;
end;
$function$;
