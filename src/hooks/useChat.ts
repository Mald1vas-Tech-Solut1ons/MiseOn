import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { ChatConversation, ChatMessage } from '../types';

export function useChat(lojaId: string | null, clienteId?: string | null, modoAdmin = false) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  
  // Recupera ou cria um session_id anônimo de forma síncrona se no navegador
  const [sessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      let stored = localStorage.getItem('miseon_chat_session');
      // O session_id passou a ser a credencial da conversa anonima: a RLS
      // exige que ele venha no cabecalho x-chat-session para liberar a
      // leitura. Math.random com 11 chars de base36 nao serve para isso —
      // e adivinhavel e nao tem entropia criptografica. UUID v4 resolve.
      // Sessao antiga (formato 'sess_...') e migrada na primeira visita.
      if (!stored || stored.startsWith('sess_')) {
        stored = crypto.randomUUID();
        localStorage.setItem('miseon_chat_session', stored);
      }
      return stored;
    }
    return null;
  });
  
  const sessionIdRef = useRef<string | null>(sessionId);

  const loadConversations = useCallback(async () => {
    if (!lojaId) return;
    
    // Se não tiver clienteId, carrega por sessionId.
    // Modo admin: carrega TODAS as conversas da loja (RLS fn_meu_acesso
    // já garante que só o dono da loja lê) — sem isso o ChatAdmin só
    // enxerga conversas iniciadas no próprio navegador do admin.
    let query = supabase.from('chat_conversations')
      .select('*')
      .eq('loja_id', lojaId)
      .order('criado_em', { ascending: false });

    if (modoAdmin) {
      // sem filtro adicional: caixa de entrada unificada da loja
    } else if (clienteId && sessionId) {
      query = query.or(`cliente_id.eq.${clienteId},session_id.eq.${sessionId}`);
    } else if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    } else if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else {
      return;
    }
    
    const { data, error } = await query;
    if (!error && data) {
      setConversations(data as ChatConversation[]);
      if (data.length > 0 && !activeConversationId) {
        setActiveConversationId(data[0].id);
      }
    }
  }, [lojaId, clienteId, activeConversationId, sessionId, modoAdmin]);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('criado_em', { ascending: true });
      
    if (!error && data) {
      setMessages(prev => ({ ...prev, [conversationId]: data as ChatMessage[] }));
    }
  }, []);

  // Inicializa conversas
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Inicializa mensagens da conversa ativa e assina o Realtime
  useEffect(() => {
    if (!activeConversationId) return;
    // Previne warning de chamadas de estado síncronas no effect
    setTimeout(() => {
      loadMessages(activeConversationId);
    }, 0);
    
    const channel = supabase.channel(`chat_${activeConversationId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `conversation_id=eq.${activeConversationId}` 
      }, (payload) => {
        const newMessage = payload.new as ChatMessage;
        setMessages(prev => {
          const current = prev[activeConversationId] || [];
          // Previne duplicatas
          if (current.find(m => m.id === newMessage.id)) return prev;
          return { ...prev, [activeConversationId]: [...current, newMessage] };
        });
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, loadMessages]);

  const sendMessage = async (content: string, remetenteTipo: 'CLIENTE' | 'LOJA' = 'CLIENTE') => {
    if (!lojaId) return null;
    
    let convId = activeConversationId;
    if (!convId && conversations.length > 0) {
      convId = conversations[0].id;
      setActiveConversationId(convId);
    }
    
    // Se não tiver conversa ativa, cria uma nova
    if (!convId) {
      let insertPayload = {
        loja_id: lojaId,
        cliente_id: clienteId || null,
        session_id: clienteId ? null : sessionIdRef.current
      };
      
      let { data: convData, error: convError } = await supabase
        .from('chat_conversations')
        .insert(insertPayload)
        .select()
        .single();
        
      // Fallback para administradores testando a própria vitrine (o ID não existe na tabela clientes)
      if (convError && convError.code === '23503' && clienteId) {
        insertPayload = {
          loja_id: lojaId,
          cliente_id: null,
          session_id: sessionIdRef.current
        };
        const retry = await supabase.from('chat_conversations').insert(insertPayload).select().single();
        convData = retry.data;
        convError = retry.error;
      }
      
      if (convError || !convData) {
        console.error('Erro ao criar conversa no banco:', convError);
        alert('Erro ao iniciar chat. Tente novamente mais tarde.');
        return null;
      }
      
      convId = convData.id;
      setConversations(prev => [...prev, convData as ChatConversation]);
      setActiveConversationId(convId);
    }
    
    const { data, error } = await supabase.from('chat_messages').insert({
      conversation_id: convId,
      remetente_tipo: remetenteTipo,
      conteudo: content
    }).select().single();
    
    if (error || !data) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Falha ao enviar mensagem.');
      return null;
    }
    
    // Otimistic UI
    setMessages(prev => {
      const current = prev[convId as string] || [];
      if (current.find(m => m.id === data.id)) return prev;
      return { ...prev, [convId as string]: [...current, data as ChatMessage] };
    });
    
    // Dispara a triagem da IA (Groq) no backend se o remetente for o CLIENTE
    if (remetenteTipo === 'CLIENTE') {
      supabase.functions.invoke('chat-ai-reception', {
        body: { conversation_id: convId }
      }).catch(err => console.error('Falha ao acionar IA de triagem:', err));
    }
    
    return data;
  };
  
  const markAsRead = async (conversationId: string, tipoIgnorado: 'CLIENTE' | 'LOJA') => {
    // Marca como lida as mensagens que NÃO são do tipoIgnorado
    await supabase.from('chat_messages')
      .update({ lida: true })
      .eq('conversation_id', conversationId)
      .neq('remetente_tipo', tipoIgnorado)
      .eq('lida', false);
  };

  return {
    conversations,
    activeConversationId,
    setActiveConversationId,
    messages: activeConversationId ? (messages[activeConversationId] || []) : [],
    sendMessage,
    markAsRead
  };
}
