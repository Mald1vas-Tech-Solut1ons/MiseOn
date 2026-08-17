-- ============================================================================
-- HARDENING CRÍTICO PRÉ-IFOOD — Achados 01, 04 e correção de bug funcional
-- ============================================================================
--
-- 01 (CRÍTICO) A policy `pub_lojas` liberava SELECT na tabela `lojas` inteira
--    para qualquer um (`USING (ativo)`, sem recorte de coluna) e o papel `anon`
--    tinha grant nas 69 colunas. Como a chave anônima está no bundle do
--    frontend por design, isso significa internet aberta lendo
--    ifood_refresh_token, nfe_csc, nfe_token_focus, efi_conta,
--    efi_titular_documento e cnpj de todas as lojas ativas.
--    Provado com `set local role anon; select ... from lojas;`.
--
-- 04 (CRÍTICO) `pub_cria_item` tinha WITH CHECK (true): qualquer pessoa
--    inseria item em pedido de qualquer loja.
--
-- BUG   `frete_gratis_valor_minimo` é lido e gravado por src/pages/admin/Loja.tsx
--    e por src/lib/geo.ts, mas a coluna nunca foi criada. Hoje o UPDATE inteiro
--    da tela de configuração da loja falha (PGRST204) — o lojista não consegue
--    salvar NENHUM ajuste. Corrigido aqui junto porque a view pública depende
--    da coluna existir.
-- ============================================================================

-- ── 0. Coluna faltante (destrava o salvamento da tela de Loja) ──────────────
alter table public.lojas
  add column if not exists frete_gratis_valor_minimo numeric(10,2) not null default 0;

comment on column public.lojas.frete_gratis_valor_minimo is
  'Subtotal a partir do qual a entrega é gratuita. 0 = desligado.';

-- ── 1. Projeção pública da loja ────────────────────────────────────────────
-- A view É a fronteira de segurança: lista fixa de colunas + WHERE ativo.
-- Deliberadamente SECURITY DEFINER (security_invoker = false, o padrão) para
-- que a vitrine funcione para anon e para cliente logado sem precisar de
-- nenhuma policy permissiva na tabela base. Não adicione coluna aqui sem
-- perguntar "isso pode aparecer no HTML de um site público?".
drop view if exists public.lojas_publicas;

create view public.lojas_publicas as
select
  l.id,
  l.slug,
  l.nome,
  l.descricao,
  l.logo_url,
  l.banner_url,
  -- identidade visual
  l.cor_primaria,
  l.cor_secundaria,
  l.cor_texto,
  l.cor_fundo_claro,
  l.cor_fundo_escuro,
  l.fonte,
  l.tema_cardapio,
  -- contato e localização (dados que a loja já publica na vitrine)
  l.telefone,
  l.whatsapp,
  l.endereco,
  l.lat,
  l.lng,
  -- regras de operação que o checkout precisa
  l.aberto_manual,
  l.ativo,
  l.pedido_minimo,
  l.aceita_agendamento,
  l.agendamento_antecedencia_min,
  l.aceita_online,
  l.aceita_entrega,
  l.antecipacao_cartao,
  l.taxa_servico_padrao_pct,
  l.cashback_pct,
  l.meta_preparo_min,
  l.chat_ia_ativo,
  l.segmento_negocio,
  l.modulos_ativos,
  -- entrega
  l.entrega_modo,
  l.entrega_taxa_base,
  l.entrega_taxa_km,
  l.entrega_raio_km,
  l.entrega_taxa_padrao,
  l.frete_gratis_valor_minimo,
  -- rastreamento (vira tag no HTML de qualquer forma)
  l.meta_pixel_id,
  l.ga4_measurement_id,
  -- NUNCA expor o código em si: o front só precisa saber se dá pra pagar online
  (nullif(btrim(coalesce(l.efi_payee_code, '')), '') is not null) as efi_configurado
from public.lojas l
where l.ativo;

comment on view public.lojas_publicas is
  'Projeção segura de `lojas` para a vitrine. Fronteira de segurança do achado 01 '
  'da auditoria pré-iFood: colunas fiscais (nfe_csc, nfe_token_focus), de pagamento '
  '(efi_conta, efi_titular_documento, pix_chave), de integração (ifood_refresh_token) '
  'e de contrato (plano, status_assinatura) ficam de fora por construção.';

grant select on public.lojas_publicas to anon, authenticated;

-- ── 2. Fechar a tabela base ────────────────────────────────────────────────
-- Sem `pub_lojas`, a leitura de `lojas` passa a exigir vínculo com a loja
-- (lojas_le = fn_meu_acesso) ou superadmin. A vitrine usa a view acima.
drop policy if exists pub_lojas on public.lojas;

-- `anon` não tem mais nenhum motivo para tocar na tabela base. Isso também
-- remove os grants de INSERT/UPDATE que existiam nas 69 colunas (hoje a RLS
-- bloqueava a escrita, mas era rede única).
revoke all on public.lojas from anon;

-- ── 3. itens_pedido: amarrar o insert ao dono do pedido ────────────────────
-- Espelha a policy de leitura `cliente_le_item`, e mantém o caminho de
-- PDV/mesa/garçom funcionando via fn_meu_acesso.
drop policy if exists pub_cria_item on public.itens_pedido;

create policy cria_item_do_proprio_pedido on public.itens_pedido
  for insert
  with check (
    exists (
      select 1 from public.pedidos p
      where p.id = itens_pedido.pedido_id
        and (
          -- cliente inserindo no próprio pedido
          p.cliente_user_id = auth.uid()
          -- ou operador/garçom/PDV agindo dentro da loja dele
          or public.fn_meu_acesso(p.loja_id)
        )
    )
  );

comment on policy cria_item_do_proprio_pedido on public.itens_pedido is
  'Achado 04: substitui `pub_cria_item` (WITH CHECK true), que permitia injetar '
  'itens em pedido ao vivo de qualquer tenant.';
