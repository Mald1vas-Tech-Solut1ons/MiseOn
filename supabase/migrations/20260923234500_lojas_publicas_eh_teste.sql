-- Foto ilustrativa só em loja de demonstração.
--
-- Produto sem foto recebia foto de banco de imagens como se fosse o prato. Em
-- 23/09/2026 a "Baguete de salame" do Natureba aparecia com um HAMBÚRGUER.
-- Em loja real isso é oferta que não corresponde ao produto (CDC) e queima a
-- primeira impressão. A vitrine precisa saber se a loja é de demonstração:
-- `eh_teste` entra no FIM da view (CREATE OR REPLACE só acrescenta coluna no
-- final). Definição base lida de produção com pg_get_viewdef.
-- A escrita continua revogada: o CREATE VIEW dispara trg_view_nasce_somente_leitura.

create or replace view public.lojas_publicas as
SELECT id,
    slug,
    nome,
    descricao,
    logo_url,
    banner_url,
    cor_primaria,
    cor_secundaria,
    cor_texto,
    cor_fundo_claro,
    cor_fundo_escuro,
    fonte,
    tema_cardapio,
    telefone,
    whatsapp,
    endereco,
    lat,
    lng,
    aberto_manual,
    ativo,
    pedido_minimo,
    aceita_agendamento,
    agendamento_antecedencia_min,
    aceita_online,
    aceita_entrega,
    antecipacao_cartao,
    taxa_servico_padrao_pct,
    cashback_pct,
    meta_preparo_min,
    chat_ia_ativo,
    segmento_negocio,
    modulos_ativos,
    entrega_modo,
    entrega_taxa_base,
    entrega_taxa_km,
    entrega_raio_km,
    entrega_taxa_padrao,
    frete_gratis_valor_minimo,
    meta_pixel_id,
    ga4_measurement_id,
    NULLIF(btrim(COALESCE(efi_payee_code, ''::text)), ''::text) IS NOT NULL AND cartao_online_bloqueado_em IS NULL AS efi_configurado,
    banner_pos_y,
    nutricao_ativo,
    nutricao_exibicao,
    nutricao_selos_atributo,
    nutricao_disclaimer,
    instagram,
    tiktok,
    facebook,
    -- Loja de demonstração/provas: só nela o cardápio pode usar foto
    -- ilustrativa em produto sem foto própria (fotoProduto.tsx).
    eh_teste
   FROM lojas l
  WHERE ativo;
