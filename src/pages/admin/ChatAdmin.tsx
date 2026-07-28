import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Send, User, MessageSquare, Search, Globe,
  Wifi, WifiOff, RefreshCw, BotMessageSquare, PhoneCall,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { tocarSom } from '../../lib/som';
import type { CtxLoja } from './AdminLayout';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Conversa {
  id: string;
  canal: 'WHATSAPP' | 'SITE';
  telefone?: string | null;
  cliente_nome?: string | null;
  ia_ativa: boolean;
  wa_janela_expira_em?: string | null;
  ultima_msg?: string | null;
  ultima_msg_em?: string | null;
  nao_lidas: number;
}

interface Mensagem {
  id: string;
  conversation_id: string;
  remetente_tipo: 'CLIENTE' | 'LOJA' | 'SISTEMA';
  conteudo: string;
  criado_em: string;
}

// ─── Utilitários ─────────────────────────────────────────────────────────────────

function fone(tel?: string | null) {
  if (!tel) return '';
  const d = tel.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55'))
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  return `+${d}`;
}

function nomeContato(c: Conversa) {
  if (c.cliente_nome) return c.cliente_nome;
  if (c.canal === 'WHATSAPP') return fone(c.telefone) || 'WhatsApp';
  return 'Visitante do Site';
}

function tempoRelativo(iso?: string | null) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ─── Badge Canal ─────────────────────────────────────────────────────────────────

function BadgeCanal({ canal }: { canal: string }) {
  if (canal === 'WHATSAPP')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
        <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-current">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.83 9.83 0 0 0 12.04 2m0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23m4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28" />
        </svg>
        WhatsApp
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
      <Globe className="h-2.5 w-2.5" /> Site
    </span>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────────

export default function ChatAdmin() {
  const ctx = useOutletContext<CtxLoja>();
  const lojaId = ctx.lojaId;

  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busca, setBusca] = useState('');
  const [chatIaAtivo, setChatIaAtivo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [online, setOnline] = useState(true);
  const [carregando, setCarregando] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const ativaRef = useRef<string | null>(null);
  ativaRef.current = ativa;

  // ── Carrega estado da IA da loja ──────────────────────────────────────────────
  useEffect(() => {
    supabase.from('lojas').select('chat_ia_ativo').eq('id', lojaId).single()
      .then(({ data }) => { if (data) setChatIaAtivo(data.chat_ia_ativo ?? false); });
  }, [lojaId]);

  // ── Carrega lista de conversas com contagem de não lidas ──────────────────────
  const carregarConversas = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select(`
        id, canal, telefone, cliente_nome, ia_ativa, wa_janela_expira_em,
        chat_messages (
          id, remetente_tipo, conteudo, criado_em, lida
        )
      `)
      .eq('loja_id', lojaId)
      .order('criado_em', { ascending: false });

    if (error || !data) return;

    const lista: Conversa[] = data.map((conv: any) => {
      const msgs: any[] = conv.chat_messages || [];
      const ordenadas = [...msgs].sort(
        (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
      );
      const ultima = ordenadas[0];
      const naoLidas = msgs.filter(
        (m) => !m.lida && m.remetente_tipo === 'CLIENTE'
      ).length;

      return {
        id: conv.id,
        canal: conv.canal,
        telefone: conv.telefone,
        cliente_nome: conv.cliente_nome,
        ia_ativa: conv.ia_ativa,
        wa_janela_expira_em: conv.wa_janela_expira_em,
        ultima_msg: ultima?.conteudo ?? null,
        ultima_msg_em: ultima?.criado_em ?? null,
        nao_lidas: naoLidas,
      };
    }).sort((a, b) => {
      const ta = a.ultima_msg_em ? new Date(a.ultima_msg_em).getTime() : 0;
      const tb = b.ultima_msg_em ? new Date(b.ultima_msg_em).getTime() : 0;
      return tb - ta;
    });

    setConversas(lista);
    setCarregando(false);

    // Auto-select: abre a mais recente se nenhuma selecionada
    if (!ativaRef.current && lista.length > 0) {
      setAtiva(lista[0].id);
    }
  }, [lojaId]);

  useEffect(() => { carregarConversas(); }, [carregarConversas]);

  // ── Carrega mensagens da conversa ativa ────────────────────────────────────────
  const carregarMensagens = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('criado_em', { ascending: true });

    if (data) {
      setMensagens(data as Mensagem[]);
      // Marca como lidas no banco
      supabase.from('chat_messages')
        .update({ lida: true })
        .eq('conversation_id', convId)
        .eq('remetente_tipo', 'CLIENTE')
        .eq('lida', false)
        .then(() => {
          setConversas(prev =>
            prev.map(c => c.id === convId ? { ...c, nao_lidas: 0 } : c)
          );
        });
    }
  }, []);

  useEffect(() => {
    if (!ativa) return;
    carregarMensagens(ativa);
  }, [ativa, carregarMensagens]);

  // Scroll automático ao receber nova mensagem
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [mensagens.length]);

  // ── Realtime: novas mensagens da conversa ativa ────────────────────────────────
  useEffect(() => {
    if (!ativa) return;

    const ch = supabase.channel(`chat-msgs-${ativa}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${ativa}`,
      }, (payload) => {
        const nova = payload.new as Mensagem;
        setMensagens(prev => {
          if (prev.find(m => m.id === nova.id)) return prev;
          return [...prev, nova];
        });
        // Marca como lida imediatamente se a conversa está aberta
        if (nova.remetente_tipo === 'CLIENTE') {
          supabase.from('chat_messages').update({ lida: true }).eq('id', nova.id);
        }
      })
      .subscribe((status) => setOnline(status === 'SUBSCRIBED'));

    return () => { supabase.removeChannel(ch); };
  }, [ativa]);

  // ── Realtime: nova mensagem em QUALQUER conversa (atualiza sidebar) ──────────────
  useEffect(() => {
    const ch = supabase.channel(`chat-sidebar-${lojaId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=neq.null`,
      }, async (payload) => {
        const nova = payload.new as Mensagem;
        // Atualiza preview na sidebar
        setConversas(prev => prev.map(c => {
          if (c.id !== nova.conversation_id) return c;
          const naoLidas = nova.remetente_tipo === 'CLIENTE' && ativaRef.current !== c.id
            ? c.nao_lidas + 1
            : c.nao_lidas;
          return {
            ...c,
            ultima_msg: nova.conteudo,
            ultima_msg_em: nova.criado_em,
            nao_lidas: naoLidas,
          };
        }));
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_conversations',
        filter: `loja_id=eq.${lojaId}`,
      }, async () => {
        // Nova conversa chegou: recarrega a lista inteira
        await carregarConversas();
        tocarSom();
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [lojaId, carregarConversas]);

  // ── Realtime: broadcast do worker WhatsApp ──────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`admin-alerts-${lojaId}`)
      .on('broadcast', { event: 'new_chat_message' }, async () => {
        tocarSom();
        await carregarConversas();
      })
      .on('broadcast', { event: 'chat_ia_answered' }, async () => {
        await carregarConversas();
      })
      .on('broadcast', { event: 'chat_handoff' }, async () => {
        tocarSom();
        await carregarConversas();
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [lojaId, carregarConversas]);

  // ── Toggle IA ─────────────────────────────────────────────────────────────────
  const toggleIa = async () => {
    const novo = !chatIaAtivo;
    setChatIaAtivo(novo);
    await supabase.from('lojas').update({ chat_ia_ativo: novo }).eq('id', lojaId);
  };

  const toggleIaConversa = async (convId: string, atual: boolean) => {
    const novo = !atual;
    await supabase.from('chat_conversations').update({ ia_ativa: novo }).eq('id', convId);
    setConversas(prev => prev.map(c => c.id === convId ? { ...c, ia_ativa: novo } : c));
  };

  // ── Envio de mensagem ─────────────────────────────────────────────────────────
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !ativa || enviando) return;

    setEnviando(true);
    const texto = draft.trim();
    setDraft('');

    const convAtiva = conversas.find(c => c.id === ativa);

    // Insere no banco
    const { data } = await supabase.from('chat_messages').insert({
      conversation_id: ativa,
      remetente_tipo: 'LOJA',
      conteudo: texto,
    }).select().single();

    if (data) {
      setMensagens(prev => {
        if (prev.find(m => m.id === data.id)) return prev;
        return [...prev, data as Mensagem];
      });
    }

    // Envia pelo WhatsApp se for canal WA
    if (convAtiva?.canal === 'WHATSAPP' && convAtiva.telefone) {
      await supabase.functions.invoke('whatsapp-send', {
        body: {
          loja_id: lojaId,
          telefone: convAtiva.telefone,
          texto,
          conversation_id: ativa,
        },
      });
      // Humano assumiu — silencia IA nesta conversa
      if (convAtiva.ia_ativa) {
        await supabase.from('chat_conversations')
          .update({ ia_ativa: false })
          .eq('id', ativa);
        setConversas(prev =>
          prev.map(c => c.id === ativa ? { ...c, ia_ativa: false } : c)
        );
      }
    }

    setEnviando(false);
  };

  // ── Filtro de busca ────────────────────────────────────────────────────────────
  const conversasFiltradas = conversas.filter(c => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      nomeContato(c).toLowerCase().includes(q) ||
      (c.telefone?.includes(busca.replace(/\D/g, '')) ?? false)
    );
  });

  const convAtiva = conversas.find(c => c.id === ativa);

  // ── Janela WhatsApp ────────────────────────────────────────────────────────────
  const janelaRestante = convAtiva?.wa_janela_expira_em
    ? new Date(convAtiva.wa_janela_expira_em).getTime() - Date.now()
    : null;
  const janelaExpirando = janelaRestante !== null && janelaRestante < 2 * 3600 * 1000;

  // ── UI ────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-gray-900">

      {/* ═══ Sidebar ══════════════════════════════════════════════════════════ */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">

        {/* Header Sidebar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base">Conversas</h2>
              <span title={online ? 'Tempo real ativo' : 'Desconectado'} className="inline-flex">
                {online
                  ? <Wifi size={14} className="text-green-500" />
                  : <WifiOff size={14} className="text-red-400" />}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={carregarConversas}
                title="Recarregar conversas"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={toggleIa}
                title={chatIaAtivo ? 'Desativar IA Geral' : 'Ativar IA Geral'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                  chatIaAtivo
                    ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                }`}
              >
                <div className={`h-2 w-2 rounded-full ${chatIaAtivo ? 'bg-purple-500 animate-pulse' : 'bg-gray-400'}`} />
                IA {chatIaAtivo ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm outline-none focus:ring-2 focus:ring-[#004198] transition"
            />
          </div>
        </div>

        {/* Lista de Conversas */}
        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" /> Carregando...
            </div>
          ) : conversasFiltradas.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
              {busca ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa ainda.'}
            </div>
          ) : (
            conversasFiltradas.map(conv => (
              <button
                key={conv.id}
                onClick={() => setAtiva(conv.id)}
                className={`w-full flex items-start gap-3 p-4 text-left border-b border-gray-100 dark:border-gray-800/60 transition-colors ${
                  ativa === conv.id
                    ? 'bg-white dark:bg-gray-800 shadow-sm'
                    : 'hover:bg-white/80 dark:hover:bg-gray-900/80'
                }`}
              >
                {/* Avatar */}
                <div className={`relative h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  conv.canal === 'WHATSAPP' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-200 dark:bg-gray-700'
                }`}>
                  <User size={16} className={conv.canal === 'WHATSAPP' ? 'text-green-600 dark:text-green-400' : 'text-gray-500'} />
                  {conv.ia_ativa && (
                    <div className="absolute -bottom-0.5 -right-0.5 bg-purple-500 rounded-full h-3 w-3 border border-white dark:border-gray-800 flex items-center justify-center">
                      <BotMessageSquare size={8} className="text-white" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className="font-semibold text-sm truncate text-gray-900 dark:text-white">
                      {nomeContato(conv)}
                    </p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {tempoRelativo(conv.ultima_msg_em)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {conv.ultima_msg
                        ? (conv.ultima_msg.length > 38
                          ? conv.ultima_msg.slice(0, 38) + '…'
                          : conv.ultima_msg)
                        : <span className="italic">Sem mensagens</span>}
                    </p>
                    {conv.nao_lidas > 0 && (
                      <span className="flex-shrink-0 bg-green-500 text-white rounded-full text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {conv.nao_lidas}
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <BadgeCanal canal={conv.canal} />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ═══ Área de Chat ══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">

        {!ativa ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
            <MessageSquare size={48} className="opacity-30" />
            <p className="font-medium text-gray-600 dark:text-gray-300">Selecione uma conversa</p>
            <p className="text-sm text-center max-w-xs">As conversas do WhatsApp e do chat do site aparecem aqui em tempo real.</p>
          </div>
        ) : (
          <>
            {/* Header do Chat */}
            <div className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center px-5 gap-3 flex-shrink-0 bg-white dark:bg-gray-900">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                convAtiva?.canal === 'WHATSAPP' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                <User size={16} className={convAtiva?.canal === 'WHATSAPP' ? 'text-green-600' : 'text-gray-500'} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm truncate">
                    {convAtiva ? nomeContato(convAtiva) : 'Atendimento'}
                  </h3>
                  {convAtiva && <BadgeCanal canal={convAtiva.canal} />}
                  {convAtiva && (
                    <button
                      onClick={() => toggleIaConversa(convAtiva.id, convAtiva.ia_ativa)}
                      title={convAtiva.ia_ativa ? 'IA respondendo — clique para assumir' : 'Você está no controle — clique para reativar IA'}
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition ${
                        convAtiva.ia_ativa
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 hover:bg-orange-200'
                      }`}
                    >
                      {convAtiva.ia_ativa ? <><BotMessageSquare size={10} /> IA Respondendo</> : <><PhoneCall size={10} /> Você Assumiu</>}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                  {convAtiva?.canal === 'WHATSAPP' && (
                    <span>{fone(convAtiva.telefone)}</span>
                  )}
                  {janelaRestante !== null && (
                    <span className={janelaExpirando ? 'text-red-500 font-semibold' : ''}>
                      {janelaExpirando ? '⚠️ ' : ''}
                      Janela expira: {new Date(convAtiva!.wa_janela_expira_em!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/60 dark:bg-gray-950/60">
              {mensagens.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  Aguardando mensagens...
                </div>
              ) : (
                mensagens.map(msg => {
                  const isLoja = msg.remetente_tipo === 'LOJA';
                  const isSistema = msg.remetente_tipo === 'SISTEMA';

                  if (isSistema) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1.5 max-w-[80%] text-center">
                          <BotMessageSquare size={11} className="flex-shrink-0" />
                          {msg.conteudo}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex ${isLoja ? 'justify-end' : 'justify-start'} gap-2`}>
                      {!isLoja && (
                        <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-auto">
                          <User size={12} className="text-gray-500" />
                        </div>
                      )}
                      <div className={`max-w-[72%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                        isLoja
                          ? 'bg-[#004198] text-white rounded-br-sm'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-bl-sm'
                      }`}>
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.conteudo}</p>
                        <p className={`text-[9px] font-medium text-right mt-1 opacity-60 ${isLoja ? 'text-blue-100' : 'text-gray-500'}`}>
                          {new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={enviar}
              className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-end gap-3"
            >
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={
                  convAtiva?.ia_ativa
                    ? 'A IA está respondendo. Digite aqui para assumir o atendimento...'
                    : 'Digite sua resposta para o cliente...'
                }
                rows={1}
                className="flex-1 min-h-[44px] max-h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#004198] resize-none transition"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    enviar(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!draft.trim() || enviando}
                className="h-[44px] px-6 rounded-xl bg-[#004198] hover:bg-[#00337A] text-white font-bold flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {enviando ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
                Enviar
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
