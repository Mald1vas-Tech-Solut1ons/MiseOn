-- Policies "always true" em tabelas que NENHUMA tela do app consulta pelo
-- cliente Supabase — só edge functions (service_role) tocam nelas, e service_role
-- ignora RLS. Remover a policy pública nega o acesso anônimo sem quebrar nada.

-- conversas/mensagens: SELECT true deixava qualquer um ler conversa de cliente.
-- As policies legítimas (adm_conversas / adm_mensagens, escopadas por
-- fn_meu_acesso) permanecem — o lojista continua lendo as conversas dele.
drop policy if exists pub_conversa_sel on public.conversas;
drop policy if exists pub_conversa_ins on public.conversas;
drop policy if exists pub_msg_sel      on public.mensagens;
drop policy if exists pub_msg_ins      on public.mensagens;

-- garcom_push_subscriptions: FOR ALL true/true expunha os endpoints de push da
-- equipe — dava para ler, disparar notificação e apagar as inscrições.
-- Fica sem policy: RLS ligada + zero policy = só service_role entra.
drop policy if exists "Permitir leitura/escrita garcom_push_subscriptions por loja"
  on public.garcom_push_subscriptions;
