-- Prova da entrega profissional: regra única + pedido com cotação do servidor.
-- Tenant lanchepaulista; tudo desfeito no fim (rollback interno).
do $$
declare
  v_loja uuid;
  v_user uuid;
  v_prod uuid;
  v_preco numeric;
  r jsonb;
  v_cot uuid;
  v_cot_velha uuid;
  v_pedido jsonb;
  v_taxa numeric;
  v_falhou boolean;
  v_msg text;
begin
  select id into strict v_loja from public.lojas where slug = 'lanchepaulista';
  select id, preco into v_prod, v_preco from public.produtos
   where loja_id = v_loja and disponivel and preco > 0 and tipo_venda is distinct from 'POR_PESO'
   order by preco limit 1;
  select user_id into v_user from public.usuarios_loja where loja_id = v_loja limit 1;

  begin
    update public.lojas set aceita_entrega = true, lat = -23.5617, lng = -46.6560,
      entrega_taxa_base = 5, entrega_taxa_km = 2, entrega_raio_km = 6, frete_gratis_valor_minimo = 0,
      aberto_manual = true
     where id = v_loja;
    delete from public.faixas_entrega where loja_id = v_loja;

    -- POR KM: 5 + 2 × 3 = 11
    update public.lojas set entrega_modo = 'DISTANCIA' where id = v_loja;
    r := public.fn_entrega_regra(v_loja, 3, 50);
    if (r->>'taxa')::numeric <> 11 then raise exception 'POR_KM: esperado 11, veio %', r; end if;
    r := public.fn_entrega_regra(v_loja, 7, 50);
    if (r->>'atende')::boolean or r->>'motivo' <> 'FORA_DA_AREA' then raise exception 'POR_KM fora do raio: %', r; end if;

    -- TAXA ÚNICA: 5 em qualquer distância até o raio
    update public.lojas set entrega_modo = 'FIXA' where id = v_loja;
    r := public.fn_entrega_regra(v_loja, 5.9, 50);
    if (r->>'taxa')::numeric <> 5 then raise exception 'FIXA: esperado 5, veio %', r; end if;

    -- FAIXAS sem faixa cadastrada = entrega não configurada (nunca grátis)
    update public.lojas set entrega_modo = 'HIBRIDO' where id = v_loja;
    r := public.fn_entrega_regra(v_loja, 1, 50);
    if r->>'motivo' <> 'ENTREGA_NAO_CONFIGURADA' then raise exception 'FAIXAS vazias: %', r; end if;

    insert into public.faixas_entrega (loja_id, nome, km_ate, taxa_fixa, taxa_por_km, pedido_minimo, ordem, ativo) values
      (v_loja, 'Perto', 2, 6, null, 0, 1, true),
      (v_loja, 'Médio', 4, 9, null, 30, 2, true),
      (v_loja, 'Longe', 6, null, 3, 0, 3, true);

    r := public.fn_entrega_regra(v_loja, 1.5, 50);
    if (r->>'taxa')::numeric <> 6 then raise exception 'FAIXA 1: %', r; end if;
    r := public.fn_entrega_regra(v_loja, 3, 20);
    if r->>'motivo' <> 'ABAIXO_DO_MINIMO_DA_FAIXA' then raise exception 'mínimo da faixa não conferido: %', r; end if;
    r := public.fn_entrega_regra(v_loja, 3, 30);
    if (r->>'taxa')::numeric <> 9 then raise exception 'FAIXA 2: %', r; end if;
    r := public.fn_entrega_regra(v_loja, 5, 50);          -- 5 + 3 × 5 = 20
    if (r->>'taxa')::numeric <> 20 then raise exception 'FAIXA 3 por km: %', r; end if;
    r := public.fn_entrega_regra(v_loja, 6.5, 50);
    if r->>'motivo' <> 'FORA_DA_AREA' then raise exception 'FAIXAS fora: %', r; end if;

    -- Frete grátis acima de R$ 40
    update public.lojas set frete_gratis_valor_minimo = 40 where id = v_loja;
    r := public.fn_entrega_regra(v_loja, 1.5, 45);
    if (r->>'taxa')::numeric <> 0 or not (r->>'frete_gratis')::boolean then raise exception 'frete grátis: %', r; end if;
    update public.lojas set frete_gratis_valor_minimo = 0 where id = v_loja;

    -- Loja sem localização: não entrega
    update public.lojas set lat = null where id = v_loja;
    r := public.fn_entrega_regra(v_loja, 1, 50);
    if r->>'motivo' <> 'ENTREGA_NAO_CONFIGURADA' then raise exception 'sem localização: %', r; end if;
    update public.lojas set lat = -23.5617 where id = v_loja;

    -- ── Pedido com cotação ──────────────────────────────────────────────
    if v_user is not null and v_prod is not null then
      insert into public.entrega_cotacoes (loja_id, chave_endereco, cep, numero, lat, lng, distancia_km, metodo, precisao)
      values (v_loja, 'prova', '01310100', '1000', -23.5650, -46.6520, 1.5, 'ROTA', 'ENDERECO')
      returning id into v_cot;
      insert into public.entrega_cotacoes (loja_id, chave_endereco, cep, numero, lat, lng, distancia_km, metodo, precisao, expira_em)
      values (v_loja, 'prova', '01310100', '1000', -23.5650, -46.6520, 1.5, 'ROTA', 'ENDERECO', now() - interval '1 minute')
      returning id into v_cot_velha;

      perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

      v_pedido := public.fn_criar_pedido_completo(jsonb_build_object(
        'loja_id', v_loja, 'tipo_pedido', 'DELIVERY', 'metodo', 'DINHEIRO',
        'nome', 'Prova entrega', 'telefone', '11999990000',
        'cotacao_id', v_cot,
        'lat', -23.5617, 'lng', -46.6560,   -- coordenada da LOJA: tem que ser ignorada
        'endereco', jsonb_build_object('cep', '01310-100', 'logradouro', 'Av. Paulista', 'numero', '1000',
                                       'bairro', 'Bela Vista', 'cidade', 'São Paulo', 'uf', 'SP'),
        'itens', jsonb_build_array(jsonb_build_object('produto_id', v_prod, 'quantidade', 20))));
      select taxa_entrega into v_taxa from public.pedidos where id = (v_pedido->>'pedido_id')::uuid;
      if v_taxa <> 6 then raise exception 'pedido: taxa esperada 6 (faixa 1 pela cotação), veio %', v_taxa; end if;

      -- Endereço trocado depois de cotar
      begin
        perform public.fn_criar_pedido_completo(jsonb_build_object(
          'loja_id', v_loja, 'tipo_pedido', 'DELIVERY', 'metodo', 'DINHEIRO',
          'nome', 'Prova entrega', 'telefone', '11999990000', 'cotacao_id', v_cot,
          'endereco', jsonb_build_object('cep', '08000-000', 'logradouro', 'Outra', 'numero', '1',
                                         'bairro', 'X', 'cidade', 'São Paulo', 'uf', 'SP'),
          'itens', jsonb_build_array(jsonb_build_object('produto_id', v_prod, 'quantidade', 20))));
        v_falhou := false;
      exception when others then v_falhou := true; v_msg := sqlerrm;
      end;
      if not v_falhou or v_msg not ilike '%endereco mudou%' then raise exception 'troca de endereço passou: %', v_msg; end if;

      -- Cotação vencida
      begin
        perform public.fn_criar_pedido_completo(jsonb_build_object(
          'loja_id', v_loja, 'tipo_pedido', 'DELIVERY', 'metodo', 'DINHEIRO',
          'nome', 'Prova entrega', 'telefone', '11999990000', 'cotacao_id', v_cot_velha,
          'endereco', jsonb_build_object('cep', '01310100', 'numero', '1000', 'logradouro', 'Av. Paulista',
                                         'bairro', 'Bela Vista', 'cidade', 'São Paulo', 'uf', 'SP'),
          'itens', jsonb_build_array(jsonb_build_object('produto_id', v_prod, 'quantidade', 20))));
        v_falhou := false;
      exception when others then v_falhou := true; v_msg := sqlerrm;
      end;
      if not v_falhou or v_msg not ilike '%expirou%' then raise exception 'cotação vencida passou: %', v_msg; end if;

      -- Sem cotação (checkout antigo mandando só lat/lng): recusado
      begin
        perform public.fn_criar_pedido_completo(jsonb_build_object(
          'loja_id', v_loja, 'tipo_pedido', 'DELIVERY', 'metodo', 'DINHEIRO',
          'nome', 'Prova entrega', 'telefone', '11999990000',
          'lat', -23.5617, 'lng', -46.6560,
          'endereco', jsonb_build_object('cep', '01310100', 'numero', '1000', 'logradouro', 'Av. Paulista',
                                         'bairro', 'Bela Vista', 'cidade', 'São Paulo', 'uf', 'SP'),
          'itens', jsonb_build_array(jsonb_build_object('produto_id', v_prod, 'quantidade', 20))));
        v_falhou := false;
      exception when others then v_falhou := true; v_msg := sqlerrm;
      end;
      if not v_falhou or v_msg not ilike '%Atualize a pagina%' then raise exception 'entrega sem cotação passou: %', v_msg; end if;

      -- Retirada continua sem cotação nenhuma
      v_pedido := public.fn_criar_pedido_completo(jsonb_build_object(
        'loja_id', v_loja, 'tipo_pedido', 'RETIRADA_BALCAO', 'metodo', 'DINHEIRO',
        'nome', 'Prova entrega', 'telefone', '11999990000',
        'itens', jsonb_build_array(jsonb_build_object('produto_id', v_prod, 'quantidade', 1))));
      if (v_pedido->>'pedido_id') is null then raise exception 'retirada deixou de funcionar'; end if;
    else
      raise notice 'AVISO: sem usuário/produto na loja de provas — prova do pedido pulada';
    end if;

    raise exception using errcode = 'ZT001', message = 'reverter';
  exception when sqlstate 'ZT001' then null;
  end;
  raise notice 'PASS: por km, taxa única, faixas (fixa, por km, mínimo), fora da área, frete grátis, sem localização, pedido usa cotação e ignora coordenada do navegador, troca de endereço e cotação vencida recusadas';
end $$;
