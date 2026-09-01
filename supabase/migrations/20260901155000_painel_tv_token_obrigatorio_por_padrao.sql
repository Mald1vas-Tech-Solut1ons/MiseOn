-- O painel de TV estava PUBLICO por slug.
--
-- `fn_painel_tv_senhas` ja exigia token quando a loja tinha um — mas nenhuma
-- loja tinha, porque nao havia nada na aplicacao que gerasse. Medido em
-- 01/09/2026: as duas lojas com `painel_tv_token` nulo. Na pratica, quem
-- soubesse o slug via numero de pedido e primeiro nome dos clientes.
--
-- A regra "token opcional" existia para nao derrubar TV ja instalada. Nao ha
-- TV instalada em cliente (pre-lancamento), entao o padrao passa a ser o
-- seguro: toda loja nasce com token e as existentes ganham o seu agora.
alter table public.lojas
  alter column painel_tv_token set default gen_random_uuid();

update public.lojas
   set painel_tv_token = gen_random_uuid()
 where painel_tv_token is null;

comment on column public.lojas.painel_tv_token is
  'Credencial do painel de TV. A TV do balcao roda sem login, entao o controle de acesso vai na URL (?token=). Regerar invalida os links antigos.';
