-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Tirar da API o que nunca deveria ter estado nela.                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- Item 4 da fila: auditar o que ficou de fora. Os advisors do banco listam 154
-- achados em 7 tipos; os dois maiores são
--
--   45  anon_security_definer_function_executable
--   88  authenticated_security_definer_function_executable
--
-- Revogar os 133 em bloco seria irresponsável: a maioria é o cardápio público
-- funcionando como projetado — `fn_acompanhar_pedido`, `fn_validar_cupom`,
-- `fn_loja_aberta`, `fn_taxa_entrega_calculada`. O advisor não sabe a
-- intenção; quem sabe é quem leu o código.
--
-- COMO A LISTA FOI FEITA, EM VEZ DE ADIVINHADA
--
-- Cruzei as 88 funções SECURITY DEFINER expostas via `/rest/v1/rpc/` contra
-- todo o código de `src/` e `supabase/functions/`. Trinta e três não são
-- citadas por NENHUM arquivo do app. Dessas, ficam aqui as que também não são
-- usadas por política de RLS — porque função usada em policy PRECISA de
-- EXECUTE para o papel que consulta, e revogar derrubaria o acesso inteiro.
--
-- O que sobra são funções internas que o PostgREST publicava de graça.
--
-- O QUE SAI E POR QUÊ
--
-- Corpos de gatilho (`fn_trg_*`). Chamar o corpo de um gatilho por HTTP não
-- tem significado legítimo e tem significado ilegítimo de sobra. O gatilho
-- continua disparando: o Postgres não exige EXECUTE do usuário para rodar
-- trigger, exige TRIGGER na tabela.
--
-- `fn_semear_natureba` e `fn_semear_opcoes_segmento`. Funções de semeadura
-- expostas a qualquer usuário logado. A primeira escreve no cadastro que o
-- CLAUDE.md manda não tocar — o que vai ser mostrado na visita comercial.
--
-- `fn_proxima_senha`. Só `fn_trg_numero_pedido` chama. Exposta, um lojista
-- adiantava a senha do balcão de outra loja: o cliente de lá é chamado por um
-- número que não existe.
--
-- `fn_revalidar_desconto_pedido`. É o servidor decidindo desconto, chamada
-- pelo gatilho diferido. Os pagamentos usam `fn_recalcular_pedido` com
-- service_role — conferido nos dois arquivos — então nada de cobrança depende
-- deste grant.
--
-- `fn_baixar_estoque`. Escreve estoque a partir de um id de pedido, e nenhum
-- arquivo do app a chama por nome.
--
-- `fn_usar_cashback` fica como está, de propósito: também não aparece no
-- código, mas mexe em saldo de cliente e já está fora do `anon`. Mudar o grant
-- de uma função de dinheiro sem rastrear o chamador é o tipo de "limpeza" que
-- derruba checkout em produção. Fica anotada para quando o chamador for
-- localizado, não revogada no escuro.
--
-- `fn_definir_embalagem_insumo`. O CLAUDE.md a define como PONTO ÚNICO DE
-- ESCRITA de `qtd_embalagem` — o número que decide o custo de tudo. Estava
-- executável pelo `anon`: qualquer visitante com a chave do bundle podia
-- reescrever a base de custo de qualquer loja. Sai do anônimo; o lojista
-- autenticado continua podendo corrigir, que é a regra do domínio.
--
-- `fn_custo_unitario_insumo` e `fn_embalagem_*`. Devolvem custo de insumo.
-- Saem do anônimo e ficam com o lojista, que é quem tem o que fazer com isso.
--
-- O QUE FICA DE PROPÓSITO
--
-- `fn_meu_acesso`, `fn_tem_papel`, `fn_sou_admin`, `fn_pode_operar_loja`,
-- `fn_meu_papel`, `fn_sou_superadmin`, `fn_participa_do_pedido`,
-- `fn_privilegios_de_escrita_estoque`: são chamadas DENTRO de políticas de
-- RLS. A política roda no papel de quem consulta, então o `anon` precisa de
-- EXECUTE nelas ou o cardápio público para de carregar. Elas não devolvem
-- dado, devolvem um booleano sobre quem está perguntando.
--
-- REVOGAR DE `public` NÃO BASTA
--
-- Este projeto tem DEFAULT PRIVILEGES concedendo EXECUTE ao `anon` e ao
-- `authenticated` DIRETAMENTE em toda função nova de `public`
-- (`pg_default_acl`, defaclobjtype='f'). Tirar de PUBLIC deixa as linhas
-- `anon=X/postgres` e `authenticated=X/postgres` intactas. Cada revogação
-- abaixo nomeia o papel.

-- ATENÇÃO AO `public` NA LISTA DE CADA REVOKE
--
-- Medido aplicando a primeira versão desta migração: revogar só de
-- `anon, authenticated` NÃO surtiu efeito em metade das funções, em silêncio.
-- Causa: elas carregam também o grant de PUBLIC — o `=X/postgres` inicial do
-- `proacl` — e PUBLIC alcança todo papel. É a armadilha que o CLAUDE.md já
-- anota, e ela morde nas duas direções: com DEFAULT PRIVILEGES o `anon` ganha
-- o grant direto, e com PUBLIC ele ganha por herança. Só tirar dos três
-- fecha.

begin;

-- ── Corpos de gatilho: nunca por HTTP ─────────────────────────────────────

revoke execute on function public.fn_trg_criado_em_do_servidor()   from public, anon, authenticated;
revoke execute on function public.fn_trg_embalagem_da_descricao()  from public, anon, authenticated;
revoke execute on function public.fn_trg_kiosk_contratado()        from public, anon, authenticated;
revoke execute on function public.fn_trg_revalidar_desconto()      from public, anon, authenticated;

-- ── Semeadura: não é operação de usuário ──────────────────────────────────

revoke execute on function public.fn_semear_natureba(uuid)              from public, anon, authenticated;
revoke execute on function public.fn_semear_opcoes_segmento(uuid, text) from public, anon, authenticated;

-- ── Internas, chamadas só por gatilho ou por service_role ─────────────────

revoke execute on function public.fn_proxima_senha(uuid, smallint)   from public, anon, authenticated;
revoke execute on function public.fn_revalidar_desconto_pedido(uuid) from public, anon, authenticated;
revoke execute on function public.fn_baixar_estoque(uuid)            from public, anon, authenticated;

-- ── Custo: sai do anônimo, fica com o lojista ─────────────────────────────
--
-- O GRANT de volta ao `authenticated` não é decoração: o revoke de PUBLIC
-- tiraria o lojista junto, e `vw_custo_produto` é security_invoker — ela roda
-- no papel de quem consulta e precisa executar a função de custo.

revoke execute on function public.fn_custo_unitario_insumo(uuid, int)              from public, anon;
revoke execute on function public.fn_definir_embalagem_insumo(uuid, numeric, text) from public, anon;
revoke execute on function public.fn_embalagem_do_rendimento(uuid)                 from public, anon;
revoke execute on function public.fn_embalagem_lida_do_insumo(uuid)                from public, anon;

grant execute on function public.fn_custo_unitario_insumo(uuid, int)              to authenticated, service_role;
grant execute on function public.fn_definir_embalagem_insumo(uuid, numeric, text) to authenticated, service_role;
grant execute on function public.fn_embalagem_do_rendimento(uuid)                 to authenticated, service_role;
grant execute on function public.fn_embalagem_lida_do_insumo(uuid)                to authenticated, service_role;

commit;
