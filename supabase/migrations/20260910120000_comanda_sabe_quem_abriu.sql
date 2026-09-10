-- ============================================================================
-- Sprint 18 — "quem está com esta comanda?"
--
-- PROBLEMA MEDIDO: a tabela `comandas` guarda mesa, taxa, cliente e cartão,
-- mas NÃO guarda quem abriu. `pedidos` também não tem autor (não existe
-- `criado_por`, `garcom_id` nem nada equivalente — conferido no information_schema
-- de produção em 10/09/2026). Consequência prática no salão: o caixa vê a mesa
-- ocupada e o valor, mas não sabe qual garçom está atendendo, e o garçom não
-- consegue provar que a rodada foi dele. Numa discussão de conta ("esse item
-- não é meu", "eu não pedi isso") não há a quem perguntar.
--
-- Esta migration fecha só o buraco de dados: passa a registrar quem abriu a
-- comanda. Quem abre pode ser (a) um membro da equipe — garçom/operador/admin
-- lançando pela primeira rodada no PDV, ou (b) o próprio cliente, pelo QR da
-- mesa. Os dois casos ficam distinguíveis: `aberta_por_nome` só é preenchido
-- quando o autor tem papel em `usuarios_loja` desta loja; cliente pelo QR fica
-- com nome nulo e a interface mostra "pelo cliente (QR)".
--
-- Comandas antigas continuam com autor nulo — não há como inferir o autor
-- retroativamente e inventar um seria pior do que admitir que não se sabe.
-- ============================================================================

alter table public.comandas
  add column if not exists aberta_por uuid references auth.users(id) on delete set null,
  add column if not exists aberta_por_nome text;

comment on column public.comandas.aberta_por is
  'Quem abriu a comanda (auth.users). Nulo em comandas anteriores a 10/09/2026.';
comment on column public.comandas.aberta_por_nome is
  'Nome do membro da equipe que abriu, copiado de usuarios_loja no momento da abertura. Nulo quando quem abriu foi o cliente pelo QR da mesa (ou comanda antiga).';

-- O caixa lista comandas ABERTAS da loja a cada refresh do PDV: índice parcial
-- para essa leitura não varrer o histórico inteiro de comandas fechadas.
create index if not exists idx_comandas_loja_abertas
  on public.comandas (loja_id, aberta_em desc)
  where status = 'ABERTA';

-- ── RPC de abertura/reuso da comanda ─────────────────────────────────────────
-- Base: definição vigente em produção (pg_get_functiondef em 10/09/2026).
-- Única mudança: o INSERT passa a gravar o autor. O caminho de REUSO continua
-- idêntico — quem abriu continua sendo quem abriu, não é sobrescrito pela
-- rodada seguinte de outro garçom.
create or replace function public.fn_comanda_aberta_mesa(p_loja_id uuid, p_mesa_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_comanda uuid;
  v_taxa    numeric;
  v_autor   uuid := auth.uid();
  v_nome    text;
begin
  if not exists (
    select 1 from mesas
    where id = p_mesa_id and loja_id = p_loja_id and ativo
  ) then
    raise exception 'Mesa inválida ou inativa para esta loja';
  end if;

  select c.id into v_comanda
  from comandas c
  where c.mesa_id = p_mesa_id
    and c.loja_id = p_loja_id
    and c.status = 'ABERTA'
  order by c.aberta_em desc
  limit 1;

  if v_comanda is not null then
    return v_comanda;
  end if;

  select coalesce(l.taxa_servico_padrao_pct, 0) into v_taxa
  from lojas l where l.id = p_loja_id;

  -- Nome só sai daqui se o autor for equipe DESTA loja. Cliente pelo QR (ou
  -- sessão anônima) cai no nulo de propósito.
  if v_autor is not null then
    select ul.nome into v_nome
    from usuarios_loja ul
    where ul.user_id = v_autor and ul.loja_id = p_loja_id;
  end if;

  insert into comandas (loja_id, mesa_id, taxa_servico_pct, aberta_por, aberta_por_nome)
  values (p_loja_id, p_mesa_id, coalesce(v_taxa, 0), v_autor, v_nome)
  returning id into v_comanda;

  return v_comanda;
end;
$function$;
