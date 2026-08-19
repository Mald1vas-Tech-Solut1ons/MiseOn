-- ═══════════════════════════════════════════════════════════════════════════
-- As policies do chat da vitrine eram apenas `canal = 'VITRINE'` — sem
-- nenhum recorte por visitante. Na prática, qualquer anônimo lia TODA conversa
-- e TODA mensagem de TODAS as lojas, e escrevia em qualquer uma delas.
-- Confirmado por requisição anônima real (conteúdo de mensagens devolvido).
--
-- O recorte por `session_id` já existia — mas só no front, em useChat.ts, que
-- é escolha do cliente e não garantia. Agora o banco confere.
--
-- O session_id vai no cabeçalho `x-chat-session` (ver src/lib/supabase.ts) e
-- passou a ser UUID v4: antes era Math.random().toString(36) com 11 chars,
-- adivinhável e sem entropia criptográfica — fraco demais para virar
-- credencial.
--
-- Conversa de WhatsApp (`canal = 'WHATSAPP'`, que é onde ficam telefone e
-- nome) nunca esteve nestas policies e continua acessível só pela loja.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function fn_sessao_chat()
returns text
language sql
stable
as $fn$
  select nullif(
    current_setting('request.headers', true)::json ->> 'x-chat-session',
    ''
  );
$fn$;

drop policy if exists chat_conversations_cliente_select on chat_conversations;
drop policy if exists chat_conversations_cliente_insert on chat_conversations;
drop policy if exists chat_messages_cliente_select      on chat_messages;
drop policy if exists chat_messages_cliente_insert      on chat_messages;

-- Visitante enxerga a própria conversa (ou, se logado, as do seu cadastro).
create policy chat_conv_do_visitante on chat_conversations
  for select using (
    canal = 'VITRINE' and (
      (fn_sessao_chat() is not null and session_id = fn_sessao_chat())
      or (auth.uid() is not null and cliente_id in (
            select c.id from clientes c where c.user_id = auth.uid()))
    )
  );

create policy chat_conv_abre_visitante on chat_conversations
  for insert with check (
    canal = 'VITRINE'
    and fn_sessao_chat() is not null
    and session_id = fn_sessao_chat()
  );

create policy chat_msg_do_visitante on chat_messages
  for select using (
    exists (
      select 1 from chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.canal = 'VITRINE'
        and (
          (fn_sessao_chat() is not null and c.session_id = fn_sessao_chat())
          or (auth.uid() is not null and c.cliente_id in (
                select cl.id from clientes cl where cl.user_id = auth.uid()))
        )
    )
  );

create policy chat_msg_envia_visitante on chat_messages
  for insert with check (
    remetente_tipo = 'CLIENTE'
    and exists (
      select 1 from chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.canal = 'VITRINE'
        and fn_sessao_chat() is not null
        and c.session_id = fn_sessao_chat()
    )
  );
