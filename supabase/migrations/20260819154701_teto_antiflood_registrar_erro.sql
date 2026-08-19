-- fn_registrar_erro é chamada com a chave anon (o painel precisa reportar erro
-- de visitante que nunca vai logar), então é a única gravação sem autenticação
-- do sistema. A dedup por (impressao, hora_bucket) já impede que o MESMO defeito
-- vire mil linhas, mas quem varia a mensagem a cada POST gera uma impressão nova
-- por chamada e enche a tabela do painel de observabilidade.
--
-- Teto: dentro de uma hora, aceita no máximo TETO impressões DISTINTAS novas.
-- Erro já conhecido continua somando ocorrência para sempre (o caminho que
-- interessa em produção); o teto corta só a criação de linha inédita.

create index if not exists erros_aplicacao_hora_idx
  on public.erros_aplicacao (hora_bucket);

create or replace function public.fn_registrar_erro(
  p_origem text, p_mensagem text, p_contexto text default null,
  p_stack text default null, p_url text default null,
  p_user_agent text default null, p_loja_id uuid default null
) returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_msg text := left(coalesce(nullif(btrim(p_mensagem), ''), 'erro sem mensagem'), 500);
  v_ctx text := left(coalesce(p_contexto, ''), 200);
  v_org text := left(coalesce(p_origem, 'browser'), 20);
  v_imp text;
  v_hora timestamptz := date_trunc('hour', now());
  v_teto constant integer := 1000;
begin
  -- Impressão digital ignorando uuid e números, para o mesmo defeito não
  -- virar mil linhas distintas só porque o id do pedido muda.
  v_imp := md5(v_org || '|' || v_ctx || '|' ||
            regexp_replace(v_msg,
              '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+', '#', 'gi'));

  -- Impressão inédita nesta hora só entra se ainda houver espaço no teto.
  if not exists (
       select 1 from erros_aplicacao
       where impressao = v_imp and hora_bucket = v_hora
     )
     and (select count(*) from erros_aplicacao where hora_bucket = v_hora) >= v_teto
  then
    return;
  end if;

  insert into erros_aplicacao
    (impressao, hora_bucket, origem, contexto, mensagem, stack, url, user_agent, loja_id, user_id)
  values
    (v_imp, v_hora, v_org, nullif(v_ctx,''), v_msg,
     left(p_stack, 4000), left(p_url, 500), left(p_user_agent, 300), p_loja_id, auth.uid())
  on conflict (impressao, hora_bucket) do update
    set ocorrencias = erros_aplicacao.ocorrencias + 1,
        visto_em    = now();
end;
$function$;
