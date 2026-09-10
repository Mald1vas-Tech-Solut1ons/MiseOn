-- ============================================================================
-- AS REDES SOCIAIS CHEGAM NA VITRINE (defeito meu, do commit 63298e2)
--
-- Eu adicionei instagram/tiktok/facebook na tabela `lojas`, escrevi o botão na
-- vitrine e cadastrei o @naturebalojas — e nada apareceu na tela. A causa: a
-- vitrine NÃO lê a tabela. Ela lê a view `lojas_publicas`
-- (src/pages/Cardapio.tsx: `from('lojas_publicas').select('*')`), que é uma
-- lista explícita de colunas. Coluna que não está na view não existe para o
-- cliente, por mais preenchida que esteja no banco.
--
-- Essa view é a fronteira de exposição pública da loja: ela existe justamente
-- para que campos internos (chave Pix, código do recebedor, documento do
-- titular) nunca vazem no cardápio. Por isso ela lista coluna a coluna em vez
-- de `select *` — e por isso adicionar campo público é um passo consciente,
-- não automático. O passo que faltou foi meu.
--
-- Os três campos são públicos por natureza: são o perfil que a loja divulga.
-- ============================================================================

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
    -- Perfis que a loja divulga: publicos por natureza.
    instagram,
    tiktok,
    facebook
   FROM lojas l
  WHERE ativo;
