-- O classificador precisa APRENDER, nao so acertar uma vez.
--
-- Hoje a IA le "DET LIQ YPE CLEAR NEUTRO" e entende detergente. Na proxima
-- nota do mesmo fornecedor, le tudo de novo e paga de novo. Pior: se um dia a
-- IA errar, ninguem sabe por que aquele item ficou daquele jeito.
--
-- A partir daqui, o que a IA descobre sobre um item que NAO e comida vira
-- termo no lexico. Da segunda nota em diante a classificacao e deterministica,
-- instantanea, de graca e auditavel -- e o lojista pode remover o termo se
-- discordar. A IA deixa de ser um oraculo e vira uma fonte de aprendizado.

alter table public.classificacao_lexico
  add column if not exists fonte text not null default 'SEED';

alter table public.classificacao_lexico
  drop constraint if exists classificacao_lexico_fonte_valida;
alter table public.classificacao_lexico
  add constraint classificacao_lexico_fonte_valida
  check (fonte in ('SEED', 'IA_APRENDIDO', 'USUARIO'));

alter table public.classificacao_lexico
  add column if not exists aprendido_de text,
  add column if not exists loja_id uuid references public.lojas(id) on delete set null;

comment on column public.classificacao_lexico.fonte is
  'SEED = referencia embarcada. IA_APRENDIDO = a IA classificou uma nota e o termo foi promovido. USUARIO = alguem cadastrou na mao.';
comment on column public.classificacao_lexico.aprendido_de is
  'Descricao original da nota que gerou o termo. Serve para auditar um aprendizado errado.';

-- Quais categorias podem ser aprendidas. Comida NUNCA entra: o custo de errar
-- e assimetrico -- classificar limpeza como alimento e um risco sanitario,
-- classificar alimento como limpeza so tira o item da ficha ate alguem
-- corrigir. Aprender so o que nao e materia-prima mantem o erro barato.
create or replace function public.fn_categoria_aprendivel(p_categoria text)
returns boolean
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select p_categoria in (
    'Limpeza', 'Higiene', 'Embalagem', 'Descartáveis', 'Manutenção', 'Utensílios'
  );
$function$;

/**
 * Promove um termo aprendido pela IA ao lexico.
 *
 * Recusa em silencio (devolvendo o motivo) em vez de lancar: isso roda dentro
 * do fluxo de importacao da nota, e um termo malformado nao pode derrubar a
 * importacao inteira.
 */
create or replace function public.fn_aprender_termo_lexico(
  p_termo text,
  p_categoria text,
  p_descricao_origem text default null,
  p_loja_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_termo text := public.fn_normalizar_para_lexico(btrim(coalesce(p_termo, '')));
  v_existente public.classificacao_lexico%rowtype;
begin
  if p_loja_id is not null and not public.fn_tem_papel(p_loja_id, array['admin', 'operador']) then
    return jsonb_build_object('aprendido', false, 'motivo', 'sem_permissao');
  end if;

  -- Termo curto demais vira falso positivo em todo nome ("sal" casaria com
  -- "salsinha" se nao houvesse borda, e mesmo com borda o risco nao compensa).
  if length(v_termo) < 4 then
    return jsonb_build_object('aprendido', false, 'motivo', 'termo_curto');
  end if;
  -- Numero e medida nao identificam genero nenhum.
  if v_termo ~ '[0-9]' then
    return jsonb_build_object('aprendido', false, 'motivo', 'termo_com_numero');
  end if;
  if not exists (select 1 from public.classificacao_categorias where categoria = p_categoria) then
    return jsonb_build_object('aprendido', false, 'motivo', 'categoria_desconhecida');
  end if;
  if not public.fn_categoria_aprendivel(p_categoria) then
    return jsonb_build_object('aprendido', false, 'motivo', 'categoria_nao_aprendivel');
  end if;

  select * into v_existente from public.classificacao_lexico where termo = v_termo;
  if v_existente.termo is not null then
    -- Termo ja conhecido nunca e sobrescrito por IA: o que veio do SEED ou do
    -- usuario e mais confiavel que um palpite novo.
    return jsonb_build_object(
      'aprendido', false, 'motivo', 'ja_existe',
      'categoria_atual', v_existente.categoria, 'fonte_atual', v_existente.fonte
    );
  end if;

  insert into public.classificacao_lexico (termo, categoria, prioridade, fonte, aprendido_de, loja_id)
  values (v_termo, p_categoria, 2, 'IA_APRENDIDO', left(coalesce(p_descricao_origem, ''), 200), p_loja_id);

  return jsonb_build_object('aprendido', true, 'termo', v_termo, 'categoria', p_categoria);
end;
$function$;

revoke all on function public.fn_aprender_termo_lexico(text, text, text, uuid) from public, anon;
grant execute on function public.fn_aprender_termo_lexico(text, text, text, uuid) to authenticated, service_role;

comment on function public.fn_aprender_termo_lexico(text, text, text, uuid) is
  'Promove ao lexico um termo que a IA classificou, apenas para categorias que nao sao materia-prima. Nunca sobrescreve termo existente.';

-- A tela precisa saber quais categorias existem de verdade para montar o
-- prompt e os filtros -- nada de lista fixa duplicada no codigo.
create or replace function public.fn_categorias_classificacao()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'categoria', c.categoria,
    'tipo_item', c.tipo_item,
    'natureza', c.natureza,
    'entra_ficha_tecnica', c.entra_ficha_tecnica,
    'entra_nutricao', c.entra_nutricao,
    'aprendivel', public.fn_categoria_aprendivel(c.categoria)
  ) order by c.categoria), '[]'::jsonb)
  from public.classificacao_categorias c;
$function$;

revoke all on function public.fn_categorias_classificacao() from public, anon;
grant execute on function public.fn_categorias_classificacao() to authenticated, service_role;

-- Visao de auditoria: o que a IA ensinou ao sistema, para o suporte revisar.
create or replace view public.vw_lexico_aprendido with (security_invoker = true) as
  select l.termo, l.categoria, l.fonte, l.aprendido_de, l.loja_id, l.criado_em,
         c.tipo_item, c.entra_ficha_tecnica,
         (select count(*) from public.insumos i
           where public.fn_normalizar_para_lexico(i.nome)
                 ~ ('(^|[^a-z0-9])' || l.termo || '($|[^a-z0-9])')) as itens_afetados
    from public.classificacao_lexico l
    join public.classificacao_categorias c on c.categoria = l.categoria
   where l.fonte <> 'SEED';

grant select on public.vw_lexico_aprendido to authenticated, service_role;

comment on view public.vw_lexico_aprendido is
  'O que o sistema aprendeu depois do seed, com a descricao de origem e quantos itens cada termo alcanca. Base para revisar ou remover um aprendizado errado.';
