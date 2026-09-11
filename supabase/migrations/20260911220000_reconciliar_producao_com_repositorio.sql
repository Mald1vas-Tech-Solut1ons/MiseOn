-- ============================================================================
-- RECONCILIAÇÃO: o que foi aplicado em produção e não tinha arquivo aqui
--
-- ─── POR QUE ESTE ARQUIVO EXISTE ───────────────────────────────────────────
-- Em 11/09/2026 eu apliquei seis mudanças direto na produção pela Management
-- API e não versionei nenhuma. O CI monta o banco A PARTIR DAS MIGRAÇÕES, então
-- lá esses objetos não existiam — e a suíte de estações do KDS quebrou com
--
--     permission denied for function fn_nome_etapa_kds_reservado
--
-- passando no meu banco e falhando no CI. É exatamente a armadilha que este
-- projeto já tinha catalogado ("RPC de produção diverge da migração") e que eu
-- reabri.
--
-- Um arquivo só, idempotente, em vez de seis reconstruídos de memória: o que
-- importa é o ESTADO FINAL bater nos dois lados, e reconstruir passo a passo
-- pelo histórico é onde se erra.
--
-- Aplicado em produção sem arquivo, e agora coberto aqui:
--   telefone_do_titular_da_conta_efi        (cartão: causa do 4600222)
--   nutricao_motivos_com_acento             (texto sem acento na tela)
--   lojista_pode_validar_etapa_kds          (o GRANT que quebrou o CI)
--   totem_cria_pedido_sem_login             (MiseOn Kiosk)
--   kiosk_e_produto_contratado_nao_padrao   (as duas chaves)
--   totem_identifica_cliente_para_cashback  (telefone → cashback)
-- ============================================================================

-- ── 1. CARTÃO: o telefone do titular da conta Efí ───────────────────────────
-- A Efí casa pagador e recebedor pelo TELEFONE, não só pelo CPF. Sem declarar
-- qual é o número da conta que cobra, a função de cartão não tem como impedir
-- que ele vá no payload como se fosse o do comprador — que era a causa do
-- 4600222 em toda tentativa.
alter table public.configuracoes_fiscais_plataforma
  add column if not exists efi_titular_telefone text;

comment on column public.configuracoes_fiscais_plataforma.efi_titular_telefone is
  'Telefone cadastrado na conta Efi que processa o cartao. A Efi casa pagador e recebedor por este campo: se ele for enviado como telefone do pagador, a cobranca volta 4600222.';

-- ── 2. NUTRIÇÃO: motivo sem acento na tela do lojista ───────────────────────
-- A migração 20260901120000 declara 'aguardando revisão' com acento; produção
-- tinha 'aguardando revisao'. Foi aplicada de um arquivo que perdeu o encoding,
-- e desde então a tela de nutrição mostrava português sem acento. Reescreve só
-- os literais sobre o corpo vigente — reaplicar a função inteira poderia
-- reverter ajuste posterior não versionado.
do $$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='fn_calcular_nutricao_receita';

  if def is null then
    raise notice 'fn_calcular_nutricao_receita ainda nao existe neste banco; nada a corrigir.';
    return;
  end if;

  def := replace(def, 'peso medio nao informado', 'peso médio não informado');
  def := replace(def, 'densidade nao informada (conversao de volume para massa)',
                      'densidade não informada (conversão de volume para massa)');
  def := replace(def, 'aguardando revisao', 'aguardando revisão');
  execute def;
end $$;

-- ── 3. O LOJISTA PODE CRIAR FLUXO DE KDS ───────────────────────────────────
-- `trg_workflow_sem_ponto_carne` valida que ninguém crie etapa chamada "ponto
-- da carne" (é modificador do item, não etapa). A função do gatilho é SECURITY
-- INVOKER, então a chamada interna roda com o papel de quem escreve — e
-- `authenticated` não tinha EXECUTE. Resultado: TODO insert de fluxo pelo
-- lojista falhava, e a tabela era gravável só por service role. É por isso que
-- as 8 lojas em produção tinham exatamente os mesmos fluxos vindos do seed.
--
-- A função é IMMUTABLE e pura (texto entra, booleano sai), não lê tabela: o
-- GRANT não abre superfície nenhuma.
do $$
begin
  if to_regprocedure('public.fn_nome_etapa_kds_reservado(text)') is not null then
    execute 'grant execute on function public.fn_nome_etapa_kds_reservado(text) to authenticated';
  end if;
end $$;

-- ── 4. MISEON KIOSK ────────────────────────────────────────────────────────
-- `fn_criar_pedido_completo` abre com `if v_user is null then raise exception`.
-- Cliente de totem é ANÔNIMO: sem esta função não existe caminho para um totem
-- gravar pedido, por mais bonita que a tela seja.
--
-- DUAS chaves, e nenhuma sozinha abre a porta:
--   totem_ativo -> contrato. Kiosk é produto separado do plano de balcão, então
--                  nasce FALSE para toda loja, presente e futura.
--   totem_token -> o aparelho, no mesmo padrão do painel de TV.
alter table public.lojas add column if not exists totem_token uuid;
alter table public.lojas add column if not exists totem_ativo boolean not null default false;

comment on column public.lojas.totem_token is
  'Credencial do TOTEM da loja. O aparelho a envia em fn_totem_criar_pedido; sem ela nenhum pedido e criado. Mesmo padrao de painel_tv_token.';
comment on column public.lojas.totem_ativo is
  'MiseOn Kiosk contratado por esta loja. Produto separado do plano de balcao: nasce FALSE e so a plataforma liga. Sem ele, fn_totem_criar_pedido recusa mesmo com token valido.';

create or replace function public.fn_totem_criar_pedido(p_token uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $fn$
declare
  v_loja uuid; v_metodo text := coalesce(p_payload->>'metodo','PIX');
  v_pedido uuid; v_numero integer; v_total numeric;
  v_item jsonb; v_item_id uuid; v_status status_pedido;
  v_email text := nullif(lower(btrim(p_payload->>'email')),'');
  v_tel   text := nullif(regexp_replace(coalesce(p_payload->>'telefone',''), '\D', '', 'g'),'');
  v_doc   text := nullif(regexp_replace(coalesce(p_payload->>'documento',''), '\D', '', 'g'),'');
  v_cliente uuid;
begin
  select id into v_loja from lojas
   where totem_ativo is true and totem_token is not null and totem_token = p_token;
  if v_loja is null then
    raise exception 'Totem nao autorizado: verifique se o MiseOn Kiosk esta contratado para esta loja e se o aparelho foi vinculado.';
  end if;
  if jsonb_array_length(coalesce(p_payload->'itens','[]'::jsonb)) = 0 then
    raise exception 'Pedido sem itens.';
  end if;

  -- Identificacao OPCIONAL: e o que permite o cashback acumular, porque
  -- fn_creditar_cashback le pedidos.cliente_id. `clientes` nao tem CPF —
  -- identifica por telefone (chave da tabela) ou e-mail; o CPF informado vai
  -- para documento_cliente, que e o campo da nota.
  if v_email is not null or v_tel is not null then
    select id into v_cliente from clientes
     where loja_id = v_loja
       and ((v_email is not null and lower(email) = v_email) or (v_tel is not null and telefone = v_tel))
     limit 1;
    if v_cliente is null then
      insert into clientes (loja_id, telefone, nome, email)
      values (v_loja, coalesce(v_tel, 'totem-' || substr(md5(coalesce(v_email,'')),1,11)),
              nullif(btrim(p_payload->>'nome'),''), v_email)
      returning id into v_cliente;
    elsif v_email is not null then
      update clientes set email = coalesce(email, v_email) where id = v_cliente;
    end if;
  end if;

  -- Mesma regra do checkout online: pagamento com confirmacao de gateway nasce
  -- como carrinho. Sem isso a cozinha comeca a preparar comida que ninguem pagou.
  v_status := case when v_metodo in ('PIX','CREDITO')
                   then 'AGUARDANDO_PAGAMENTO'::status_pedido
                   else 'NOVO'::status_pedido end;

  insert into pedidos (loja_id, tipo_pedido, origem, status, identificador_cliente,
                       observacao, cliente_id, documento_cliente)
  values (v_loja, 'RETIRADA_BALCAO', 'totem', v_status,
          coalesce(nullif(btrim(p_payload->>'nome'),''), 'Totem'),
          nullif(p_payload->>'observacao',''), v_cliente, v_doc)
  returning id, numero into v_pedido, v_numero;

  for v_item in select * from jsonb_array_elements(p_payload->'itens') loop
    -- Preco e nome vem do BANCO, nunca do payload: o totem fica na rua, e
    -- confiar no preco que o aparelho manda e convidar a fraude.
    insert into itens_pedido (pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacao)
    select v_pedido, pr.id, pr.nome, pr.preco,
           coalesce(nullif(v_item->>'quantidade','')::numeric,1),
           nullif(v_item->>'observacao','')
      from produtos pr
     where pr.id = nullif(v_item->>'produto_id','')::uuid and pr.loja_id = v_loja
    returning id into v_item_id;

    if v_item_id is null then
      raise exception 'Produto % nao pertence a esta loja.', v_item->>'produto_id';
    end if;

    insert into itens_pedido_opcoes (item_id, opcao_id, nome_opcao, preco_adicional)
    select v_item_id, o.id, o.nome, o.preco_adicional
      from jsonb_array_elements(coalesce(v_item->'opcoes','[]'::jsonb)) sel
      join opcoes o on o.id = nullif(sel->>'id','')::uuid;
  end loop;

  v_total := fn_recalcular_pedido(v_pedido);

  insert into pagamentos (pedido_id, metodo, valor_pago)
  values (v_pedido, v_metodo::metodo_pgto, coalesce(v_total,0));

  return jsonb_build_object(
    'pedido_id', v_pedido, 'numero', v_numero,
    'senha', (select senha from pedidos where id = v_pedido),
    'valor_total', coalesce(v_total,0), 'status', v_status::text,
    'identificado', v_cliente is not null,
    'cashback_pct', (select coalesce(cashback_pct,0) from lojas where id = v_loja));
end;
$fn$;

revoke all on function public.fn_totem_criar_pedido(uuid, jsonb) from public;
grant execute on function public.fn_totem_criar_pedido(uuid, jsonb) to anon, authenticated;

-- ── 5. O TOTEM PRECISA PODER DESISTIR ──────────────────────────────────────
-- Situação real de fila: a pessoa chega no Pix e descobre que não tem saldo.
-- Sem este caminho o pedido fica AGUARDANDO_PAGAMENTO para sempre — lixo no
-- painel do lojista — e o próximo da fila espera o totem se soltar sozinho.
create or replace function public.fn_totem_cancelar_pedido(p_token uuid, p_pedido_id uuid)
returns jsonb language plpgsql security definer
set search_path to 'public','pg_temp' as $fn$
declare v_loja uuid; v_status status_pedido;
begin
  select id into v_loja from lojas
   where totem_ativo is true and totem_token is not null and totem_token = p_token;
  if v_loja is null then raise exception 'Totem nao autorizado.'; end if;

  select status into v_status from pedidos
   where id = p_pedido_id and loja_id = v_loja and origem = 'totem';
  if v_status is null then raise exception 'Pedido nao pertence a este totem.'; end if;

  -- Já saiu do carrinho (pago, aceito, cancelado antes): não mexe, e diz por
  -- quê. Silenciar esconderia a corrida entre o webhook do Pix e o dedo da
  -- pessoa no botão.
  if v_status <> 'AGUARDANDO_PAGAMENTO' then
    return jsonb_build_object('cancelado', false, 'motivo', 'ja_saiu_do_carrinho', 'status', v_status::text);
  end if;

  update pedidos set status = 'CANCELADO' where id = p_pedido_id;
  update pagamentos set status = 'CANCELADO' where pedido_id = p_pedido_id and status <> 'PAGO';
  return jsonb_build_object('cancelado', true);
end; $fn$;

revoke all on function public.fn_totem_cancelar_pedido(uuid, uuid) from public;
grant execute on function public.fn_totem_cancelar_pedido(uuid, uuid) to anon, authenticated;

-- ── 6. LIBERAR O KIOSK ENTREGA A CREDENCIAL ────────────────────────────────
-- Ligar o contrato era metade do trabalho: o lojista ficava sabendo por fora e
-- ainda tinha de achar um botão para gerar a credencial. Produto recém-comprado
-- não deveria exigir caça ao tesouro.
create or replace function public.fn_trg_kiosk_contratado()
returns trigger language plpgsql security definer
set search_path to 'public','pg_temp' as $fn$
declare v_dest text; v_link text;
begin
  -- Só na virada para LIGADO. Desligar não manda nada, e religar não troca a
  -- credencial — o totem já instalado continua valendo.
  if coalesce(old.totem_ativo,false) or not coalesce(new.totem_ativo,false) then
    return new;
  end if;

  if new.totem_token is null then
    new.totem_token := gen_random_uuid();
  end if;

  select u.email into v_dest
    from usuarios_loja ul join auth.users u on u.id = ul.user_id
   where ul.loja_id = new.id and ul.papel = 'admin'
   order by ul.criado_em nulls last limit 1;

  -- Loja sem admin cadastrado não impede a liberação: o link continua no painel.
  if v_dest is null then return new; end if;

  v_link := 'https://miseon.app.br/' || new.slug || '/totem?k=' || new.totem_token::text;

  insert into email_fila (loja_id, evento, referencia_id, destinatario, classe, payload, status)
  values (new.id, 'kiosk-credencial', new.id, v_dest, 'TRANSACIONAL',
          jsonb_build_object('totem_url', v_link, 'loja_nome', new.nome,
                             'painel_url', 'https://miseon.app.br/admin/loja'),
          'PENDENTE');
  return new;
end; $fn$;

drop trigger if exists trg_kiosk_contratado on public.lojas;
create trigger trg_kiosk_contratado
  before update of totem_ativo on public.lojas
  for each row execute function public.fn_trg_kiosk_contratado();
