import { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Sparkles, User, CheckCheck } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { Loja } from '../../types';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { getOptimizedImageUrl } from '../../lib/cdn';

import { useI18n } from '../../contexts/I18nContext';
interface ChatInterfaceProps {
  loja: Loja;
  user: SupabaseUser | null;
}

export default function ChatInterface({ loja, user }: ChatInterfaceProps) {
  const { tDynamic } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { messages, sendMessage, activeConversationId, markAsRead } = useChat(loja.id, user?.id);

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      if (activeConversationId) {
        markAsRead(activeConversationId, 'CLIENTE');
      }
    }
  }, [messages, isOpen, activeConversationId, markAsRead]);

  // Se o usuário fechar/abrir
  useEffect(() => {
    if (isOpen && activeConversationId) {
      markAsRead(activeConversationId, 'CLIENTE');
      // Focus on input when opened
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, activeConversationId, markAsRead]);

  // Evento customizado para quando o cliente relatar um problema
  useEffect(() => {
    const handleAbrirProblema = (e: Event) => {
      setIsOpen(true);
      // Focar o input logo em seguida
      setTimeout(() => inputRef.current?.focus(), 300);
      
      // Opcional: pré-preencher uma mensagem para a IA ou atendente
      const customEvent = e as CustomEvent<{ pedidoId: string }>;
      if (customEvent.detail?.pedidoId && !draft) {
        setDraft(`Tive um problema com meu pedido. Pode me ajudar?`);
      }
    };
    window.addEventListener('miseon:abrir_chat_problema', handleAbrirProblema);
    return () => window.removeEventListener('miseon:abrir_chat_problema', handleAbrirProblema);
  }, [draft]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    
    const text = draft;
    setDraft('');
    
    // Simulate typing indicator while AI/Server processes
    setIsTyping(true);
    await sendMessage(text, 'CLIENTE');
    
    // Na vida real a IA responde via webhook. Vamos tirar o typing após 2 segs se a req voltar
    setTimeout(() => setIsTyping(false), 2000);
    
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const hasUnread = messages.some(m => !m.lida && m.remetente_tipo === 'LOJA' || m.remetente_tipo === 'SISTEMA');

  const getBubbleStyle = (isMine: boolean, isSystem: boolean) => {
    if (isSystem) {
      return "bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-sm border border-gray-100 dark:border-gray-700 shadow-sm";
    }
    if (isMine) {
      return "text-white rounded-2xl rounded-tr-sm shadow-sm";
    }
    return "bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-sm border border-gray-100 dark:border-gray-700 shadow-sm";
  };

  return (
    <>
      {/* Botão Flutuante (Floating Action Button) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 flex h-[60px] w-[60px] items-center justify-center rounded-full text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-transform duration-300 hover:scale-105 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] active:scale-95"
        style={{ background: loja.cor_primaria || '#25D366' }} // Whatsapp-like green as fallback
      >
        <div className={`transition-all duration-300 ${isOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'} absolute`}>
          <MessageSquare size={28} className="fill-current opacity-90" />
        </div>
        <div className={`transition-all duration-300 ${isOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'} absolute`}>
          <X size={28} />
        </div>
        
        {!isOpen && hasUnread && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 border-2 border-white text-[10px] font-bold text-white shadow-sm animate-bounce">
            1
          </span>
        )}
      </button>

      {/* Janela do Chat (Premium Design) */}
      <div 
        className={`fixed bottom-[100px] right-4 lg:bottom-[90px] lg:right-6 z-40 flex h-[500px] max-h-[75vh] w-[360px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.2)] dark:bg-gray-900 border border-black/5 dark:border-white/10 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-8 pointer-events-none'}`}
      >
        {/* Header Premium */}
        <div 
          className="flex items-center gap-3 px-5 py-4 text-white shrink-0 relative overflow-hidden"
          style={{ background: loja.cor_primaria || '#075E54' }}
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
          
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/20">
              {loja.logo_url ? (
                <img src={getOptimizedImageUrl(loja.logo_url)} alt="Logo" className="h-full w-full rounded-full object-cover" />
              ) : (
                <User size={22} className="text-white drop-shadow-sm" />
              )}
            </div>
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white/20" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[15px] leading-tight truncate drop-shadow-sm">
              {loja.nome}
            </h3>
            <p className="text-[12px] opacity-90 truncate flex items-center gap-1 font-medium">
              Online — Atendimento Inteligente
            </p>
          </div>
          
          <button 
            onClick={() => setIsOpen(false)} 
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* WhatsApp-like Background Area */}
        <div 
          className="flex-1 overflow-y-auto p-5 space-y-4 relative custom-scrollbar bg-[#E5DDD5] dark:bg-[#0B141A]"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}
        >
          {/* Default Welcome Message */}
          <div className="flex justify-center mb-6">
            <span className="bg-[#FEEFCA] dark:bg-[#1E2A30] text-[#54656F] dark:text-[#8696A0] text-[11px] font-medium px-4 py-1.5 rounded-xl shadow-sm text-center max-w-[85%]">
              {tDynamic('As mensagens são protegidas com criptografia de ponta a ponta. Ninguém fora desta conversa pode lê-las.')}
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-10">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-sm mb-3">
                <MessageSquare size={28} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{tDynamic('Olá! Como podemos ajudar?')}</p>
              <p className="text-xs text-gray-500 text-center mt-1">{tDynamic('Mande sua dúvida ou acompanhe seu pedido.')}</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.remetente_tipo === 'CLIENTE';
              const isSystem = msg.remetente_tipo === 'SISTEMA';

              return (
                <div key={msg.id} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={`max-w-[85%] px-3.5 py-2 text-[14px] leading-relaxed relative ${getBubbleStyle(isMine, isSystem)}`}
                    style={isMine ? { background: loja.cor_primaria || '#005C4B' } : undefined}
                  >
                    {isSystem && (
                      <div className="flex items-center gap-1.5 font-bold mb-1 text-[11px] text-[var(--cor-primaria)] dark:text-blue-400 opacity-90">
                        <Sparkles size={11} /> Assistente Inteligente
                      </div>
                    )}
                    
                    <div className="flex flex-col">
                      <span className="whitespace-pre-wrap break-words pr-2">
                        {msg.conteudo}
                      </span>
                      
                      <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
                        <span className="text-[10px] font-medium leading-none">
                          {new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMine && (
                          <CheckCheck size={12} className={msg.lida ? 'text-blue-200' : 'text-white/60'} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} className="h-1" />
        </div>

        {/* Input Premium */}
        <div className="p-3 bg-[#F0F2F5] dark:bg-[#202C33] border-t border-black/5 dark:border-white/5">
          <form onSubmit={handleSend} className="flex items-end gap-2 bg-white dark:bg-[#2A3942] rounded-[24px] pl-4 pr-1.5 py-1.5 shadow-sm border border-gray-200/50 dark:border-gray-700/50 focus-within:ring-2 focus-within:ring-[var(--cor-primaria)]/20 transition-all">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Mensagem..."
              className="flex-1 max-h-28 min-h-[40px] bg-transparent text-[15px] outline-none resize-none py-2.5 custom-scrollbar text-gray-700 dark:text-gray-200 placeholder:text-gray-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-white transition-all transform hover:scale-105 active:scale-95 disabled:opacity-0 disabled:scale-50 disabled:pointer-events-none"
              style={{ background: loja.cor_primaria || '#00A884' }}
            >
              <Send size={18} className="-ml-0.5 mt-0.5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
