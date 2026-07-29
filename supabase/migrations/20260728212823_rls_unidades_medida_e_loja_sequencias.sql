-- Fecha as duas tabelas que estavam sem RLS (alerta crítico do Supabase:
-- rls_disabled_in_public). Qualquer um com a URL do projeto podia ler, editar
-- e apagar os dados delas.

-- loja_sequencias: contadores de numeração de pedido por loja. Dado de tenant.
-- Ninguém no cliente precisa tocar: quem escreve é fn_proximo_numero, que é
-- SECURITY DEFINER e portanto ignora RLS. RLS ligada SEM policy = nega tudo
-- para anon e authenticated, sem quebrar a numeração.
alter table public.loja_sequencias enable row level security;

-- unidades_medida: catálogo compartilhado (kg, g, ml...). Não é dado sensível e
-- a UI precisa ler para montar ficha técnica, então leitura liberada; escrita
-- fica só para service_role, que também ignora RLS.
alter table public.unidades_medida enable row level security;

drop policy if exists unidades_medida_leitura_publica on public.unidades_medida;
create policy unidades_medida_leitura_publica
  on public.unidades_medida
  for select
  to anon, authenticated
  using (true);
