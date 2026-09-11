-- ============================================================================
-- SAÚDE DA INTEGRAÇÃO COM O iFOOD
--
-- ─── O QUE ESTAVA ERRADO ───────────────────────────────────────────────────
-- O painel mostrava "Conectado", com bolinha verde, sempre que a loja tivesse
-- `ifood_merchant_id` preenchido:
--
--     const conectado = !!loja.ifood_merchant_id;   // Ifood.tsx:171
--
-- Isso responde "alguém digitou um id", não "o canal funciona". Medido em
-- 11/09/2026, com a tela dizendo Conectado o dia inteiro:
--
--     POST /authentication/v1.0/oauth/token -> HTTP 403
--     {"code":"Forbidden","message":"No permissions granted to client c448…"}
--
-- Falha no próprio endpoint de token — o aplicativo existe, mas nenhum módulo
-- foi concedido no portal do iFood. Nenhum pedido pode entrar. E o lojista via
-- verde.
--
-- Um painel que mostra verde enquanto o canal está morto é pior do que não ter
-- painel: ele gasta a confiança de quem depende dele para decidir.
--
-- ─── E O BARULHO ───────────────────────────────────────────────────────────
-- O cron `coletar-eventos-ifood` roda a cada minuto. Com o app sem permissão,
-- são ~1.440 chamadas por dia que não podem dar certo, enchendo o log de
-- warning idêntico — que é justamente onde um erro de verdade se esconde.
--
-- ─── COMO FICA ─────────────────────────────────────────────────────────────
-- Uma linha só, escrita pelo polling a cada tentativa. Ela serve a dois donos:
--   • o painel, que passa a mostrar o estado MEDIDO em vez de deduzido;
--   • o próprio polling, que consulta `proxima_tentativa_em` e para de bater
--     de minuto em minuto quando o que falta é configuração no portal.
--
-- Não guarda segredo: o client_id do aplicativo não é credencial (a secret é
-- o client_secret, que não passa por aqui) e já aparece na própria mensagem
-- de erro do iFood.
-- ============================================================================

create table if not exists public.integracao_ifood_saude (
  id                  boolean primary key default true check (id),

  -- OK              -> autenticou e a coleta rodou
  -- SEM_PERMISSAO   -> 403: app sem módulos concedidos no portal
  -- CREDENCIAL      -> 401: client_id/secret errados ou app desativado
  -- ERRO            -> qualquer outra falha (rede, 5xx do iFood)
  estado              text not null default 'DESCONHECIDO'
                      check (estado in ('OK','SEM_PERMISSAO','CREDENCIAL','ERRO','DESCONHECIDO')),
  http_status         integer,
  mensagem            text,
  verificado_em       timestamptz not null default now(),

  -- Freio do polling. Enquanto for futuro, a função sai cedo sem chamar o
  -- iFood: o que falta é ação humana no portal, e insistir a cada minuto só
  -- produz log.
  proxima_tentativa_em timestamptz,

  -- Quantas vezes seguidas falhou pelo mesmo motivo. Serve para o painel dizer
  -- "há quanto tempo" sem precisar varrer log.
  falhas_seguidas     integer not null default 0
);

comment on table public.integracao_ifood_saude is
  'Estado MEDIDO da integracao com o iFood, escrito pelo polling. O painel le daqui em vez de deduzir "conectado" da existencia de um merchant_id.';
comment on column public.integracao_ifood_saude.proxima_tentativa_em is
  'Enquanto for futuro, o polling sai cedo. Evita ~1.440 chamadas/dia contra um app sem permissao.';

insert into public.integracao_ifood_saude (id) values (true) on conflict (id) do nothing;

alter table public.integracao_ifood_saude enable row level security;

-- Quem opera uma loja precisa ver por que o canal do iFood não está entregando
-- pedido. Não há dado de cliente nem segredo aqui — é estado de integração.
drop policy if exists ifood_saude_equipe_le on public.integracao_ifood_saude;
create policy ifood_saude_equipe_le
  on public.integracao_ifood_saude for select
  using (exists (select 1 from public.usuarios_loja ul where ul.user_id = auth.uid()));

revoke all on public.integracao_ifood_saude from anon, authenticated;
grant select on public.integracao_ifood_saude to authenticated;
