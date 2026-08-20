import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../types';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Users, DollarSign, Activity, TrendingUp } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
interface Loja {
  id: string; slug: string; nome: string; ativo: boolean;
  plano: string; status_assinatura: string; trial_termina_em: string | null; observacao_admin: string | null;
}
interface Metrica { loja_id: string; pedidos_30d: number; gmv_30d: number; ultimo_pedido: string | null }

export default function Tenants() {
  const { tDynamic } = useI18n();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [metricas, setMetricas] = useState<Record<string, Metrica>>({});
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  
  // Modais State
  const [lojaEditando, setLojaEditando] = useState<Loja | null>(null);
  
  // Faturas State
  const [lojaFaturas, setLojaFaturas] = useState<Loja | null>(null);
  const [faturas, setFaturas] = useState<any[]>([]);
  const [carregandoFaturas, setCarregandoFaturas] = useState(false);

  // Perfil de negócio (cadastro do onboarding self-service)
  const [lojaPerfil, setLojaPerfil] = useState<Loja | null>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);

  // Chat State
  const [lojaSuporte, setLojaSuporte] = useState<Loja | null>(null);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [meuId, setMeuId] = useState<string>('');
  
  // Form de Edição
  const [editForm, setEditForm] = useState({ nome: '', slug: '' });

  const carregar = async () => {
    setCarregando(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setMeuId(user.id);

    const [{ data: l }, { data: m }] = await Promise.all([
      supabase.from('lojas').select('id, slug, nome, ativo, plano, status_assinatura, trial_termina_em, observacao_admin').order('nome'),
      supabase.functions.invoke('superadmin-metricas'),
    ]);
    setLojas((l as Loja[]) ?? []);
    const dict: Record<string, Metrica> = {};
    (m?.data?.metricas ?? []).forEach((x: Metrica) => { dict[x.loja_id] = x; });
    setMetricas(dict);
    setCarregando(false);
  };
  useEffect(() => { setTimeout(carregar, 0); }, []);

  // Lógica Faturas Reais (assinatura SaaS do lojista, com status da NFS-e)
  useEffect(() => {
    if (!lojaFaturas) return;
    setTimeout(() => setCarregandoFaturas(true), 0);
    supabase.from('faturas_assinatura').select('*').eq('loja_id', lojaFaturas.id).order('created_at', { ascending: false })
      .then(({ data }) => { setFaturas(data || []); setCarregandoFaturas(false); });
  }, [lojaFaturas]);

  // Perfil de negócio capturado no onboarding self-service
  useEffect(() => {
    if (!lojaPerfil) return;
    setTimeout(() => setCarregandoPerfil(true), 0);
    supabase.from('assinatura_dados_cadastro').select('*').eq('loja_id', lojaPerfil.id).maybeSingle()
      .then(({ data }) => { setPerfil(data); setCarregandoPerfil(false); });
  }, [lojaPerfil]);

  // Lógica Chat Real-time
  useEffect(() => {
    if (!lojaSuporte) {
      setTimeout(() => {
        setMensagens([]);
        setChatId(null);
      }, 0);
      return;
    }

    let sub: any;
    const loadChat = async () => {
      let { data: chat } = await supabase.from('suporte_chats').select('id').eq('loja_id', lojaSuporte.id).maybeSingle();
      if (!chat) {
        const { data: newChat } = await supabase.from('suporte_chats').insert({ loja_id: lojaSuporte.id }).select('id').single();
        chat = newChat;
      }
      if (!chat) return;
      setChatId(chat.id);

      const { data: msgs } = await supabase.from('suporte_mensagens').select('*').eq('chat_id', chat.id).order('criado_em', { ascending: true });
      setMensagens(msgs || []);

      sub = supabase.channel(`chat_${chat.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'suporte_mensagens', filter: `chat_id=eq.${chat.id}` }, (payload) => {
          setMensagens((prev) => [...prev, payload.new]);
        })
        .subscribe();
    };
    loadChat();

    return () => { if (sub) supabase.removeChannel(sub); };
  }, [lojaSuporte]);

  // Scroll to bottom no chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [mensagens]);

  const enviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaMensagem.trim() || !chatId) return;
    const txt = novaMensagem;
    setNovaMensagem('');
    await supabase.from('suporte_mensagens').insert({ chat_id: chatId, remetente_id: meuId, texto: txt });
  };

  const registrar = async (loja_id: string, acao: string, detalhes: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('auditoria').insert({ loja_id, ator: user?.id, acao, detalhes });
  };

  const toggleAtivo = async (l: Loja) => {
    await supabase.from('lojas').update({ ativo: !l.ativo }).eq('id', l.id);
    await registrar(l.id, l.ativo ? 'loja_inativada' : 'loja_ativada', {});
    carregar();
  };
  const mudarPlano = async (l: Loja, plano: string) => {
    await supabase.from('lojas').update({ plano }).eq('id', l.id);
    await registrar(l.id, 'plano_alterado', { plano });
    carregar();
  };
  const mudarStatus = async (l: Loja, status_assinatura: string) => {
    await supabase.from('lojas').update({ status_assinatura }).eq('id', l.id);
    await registrar(l.id, 'status_assinatura_alterado', { status_assinatura });
    carregar();
  };
  const salvarNota = async (l: Loja, observacao_admin: string) => {
    if (observacao_admin === (l.observacao_admin ?? '')) return;
    await supabase.from('lojas').update({ observacao_admin: observacao_admin || null }).eq('id', l.id);
    carregar();
  };

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lojaEditando) return;
    await supabase.from('lojas').update({ nome: editForm.nome, slug: editForm.slug }).eq('id', lojaEditando.id);
    await registrar(lojaEditando.id, 'loja_editada', editForm);
    setLojaEditando(null);
    carregar();
  };

  const visiveis = lojas.filter((l) => !busca || l.nome.toLowerCase().includes(busca.toLowerCase()) || l.slug.includes(busca.toLowerCase()));

  // BI Globals
  const totalGMV = useMemo(() => Object.values(metricas).reduce((acc, m) => acc + (m.gmv_30d || 0), 0), [metricas]);
  const totalPedidos = useMemo(() => Object.values(metricas).reduce((acc, m) => acc + (m.pedidos_30d || 0), 0), [metricas]);
  const activeTenants = lojas.filter(l => l.ativo).length;

  // Mock data for chart - in production, this should come from a daily aggregation Edge Function
  const chartData = [
    { name: '10/07', gmv: totalGMV * 0.1 },
    { name: '11/07', gmv: totalGMV * 0.15 },
    { name: '12/07', gmv: totalGMV * 0.2 },
    { name: '13/07', gmv: totalGMV * 0.25 },
    { name: 'Hoje', gmv: totalGMV * 0.3 },
  ];

  if (carregando) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6">
      
      {/* Global BI Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-lg">
          <div className="flex items-center gap-3 text-indigo-400">
            <Users size={20} />
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">Tenants Ativos</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">{activeTenants} <span className="text-sm font-normal text-gray-500">/ {lojas.length}</span></p>
        </div>
        
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-lg">
          <div className="flex items-center gap-3 text-green-400">
            <DollarSign size={20} />
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">GMV (30d)</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">{fmt(totalGMV)}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-lg">
          <div className="flex items-center gap-3 text-pink-400">
            <Activity size={20} />
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">Pedidos (30d)</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">{totalPedidos}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl backdrop-blur-lg">
          <div className="flex items-center gap-3 text-yellow-400">
            <TrendingUp size={20} />
            <p className="text-sm font-semibold uppercase tracking-wider text-gray-400">Ticket Médio</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            {totalPedidos > 0 ? fmt(totalGMV / totalPedidos) : 'R$ 0,00'}
          </p>
        </div>
      </div>

      {/* BI Chart */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <h3 className="mb-4 text-sm font-semibold tracking-widest text-gray-400 uppercase">Fluxo de Transações Globais (GMV)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ color: '#818cf8' }}
              />
              <Area type="monotone" dataKey="gmv" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorGmv)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Listagem Lojas */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Tenants ({lojas.length})</h2>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar loja..."
            className="w-64 rounded-xl border border-white/20 bg-white/5 p-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>

        <div className="space-y-4">
          {visiveis.map((l) => {
            const m = metricas[l.id];
            return (
              <div key={l.id} className={`flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 transition-all hover:bg-white/10 ${!l.ativo ? 'opacity-50 grayscale' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white shadow-lg">
                      {l.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">{l.nome}</p>
                      <a href={`/${l.slug}`} target="_blank" className="text-sm text-indigo-400 hover:underline">miseon.com.br/{l.slug}</a>
                    </div>
                  </div>
                  <button onClick={() => toggleAtivo(l)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${l.ativo ? 'border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                    {l.ativo ? 'Em Operação' : 'Bloqueada'}
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-4 rounded-xl bg-black/20 p-4 text-sm">
                  <div>
                    <p className="text-gray-500">Pedidos (30d)</p>
                    <p className="font-semibold text-gray-200">{m?.pedidos_30d ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">GMV (30d)</p>
                    <p className="font-semibold text-green-400">{fmt(m?.gmv_30d ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Último Pedido</p>
                    <p className="font-semibold text-gray-200">{m?.ultimo_pedido ? new Date(m.ultimo_pedido).toLocaleDateString('pt-BR') : '—'}</p>
                  </div>
                  <div className="flex gap-2">
                    <select value={l.plano} onChange={(e) => mudarPlano(l, e.target.value)} className="w-full rounded-lg border border-white/20 bg-gray-900 p-1.5 text-xs text-white">
                      {['trial', 'basico', 'pro'].map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                    </select>
                    <select value={l.status_assinatura} onChange={(e) => mudarStatus(l, e.target.value)} className="w-full rounded-lg border border-white/20 bg-gray-900 p-1.5 text-xs text-white">
                      {['trial', 'ativa', 'atrasada', 'cancelada', 'vitalicio'].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>

                <input defaultValue={l.observacao_admin ?? ''} onBlur={(e) => salvarNota(l, e.target.value)}
                  placeholder="Nota interna sigilosa (ex: Motivo do bloqueio)..."
                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-gray-300 placeholder-gray-600 focus:border-indigo-500 focus:outline-none" />
                <div className="mt-4 flex gap-2">
                  <button onClick={() => { setLojaEditando(l); setEditForm({ nome: l.nome, slug: l.slug }); }} className="flex-1 rounded-lg bg-white/5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/10 border border-white/10">
                    Editar Configs
                  </button>
                  <button onClick={() => setLojaFaturas(l)} className="flex-1 rounded-lg bg-indigo-500/10 py-2 text-xs font-semibold text-indigo-400 transition-colors hover:bg-indigo-500/20 border border-indigo-500/20">
                    Ver Faturas
                  </button>
                  <button onClick={() => setLojaPerfil(l)} className="flex-1 rounded-lg bg-amber-500/10 py-2 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-500/20 border border-amber-500/20">
                    Perfil do Negócio
                  </button>
                  <button onClick={() => setLojaSuporte(l)} className="flex-1 rounded-lg bg-green-500/10 py-2 text-xs font-semibold text-green-400 transition-colors hover:bg-green-500/20 border border-green-500/20">
                    Atender Loja
                  </button>
                </div>
              </div>
            );
          })}
          {visiveis.length === 0 && <p className="py-10 text-center text-gray-500">Nenhum tenant encontrado.</p>}
        </div>
      </div>

      {/* MODAL DE EDIÇÃO PROFUNDA */}
      {lojaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={salvarEdicao} className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-white">Editar Tenant</h3>
            
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-400">Nome da Empresa</label>
                <input value={editForm.nome} onChange={e => setEditForm({...editForm, nome: e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white focus:border-indigo-500 focus:outline-none" required />
              </div>
              
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-400">Slug (URL)</label>
                <div className="flex rounded-xl border border-white/10 bg-black/20 overflow-hidden focus-within:border-indigo-500">
                  <span className="flex items-center px-3 text-sm text-gray-500 bg-black/40 border-r border-white/10">miseon.com.br/</span>
                  <input value={editForm.slug} onChange={e => setEditForm({...editForm, slug: e.target.value})} className="w-full bg-transparent p-3 text-white focus:outline-none" required />
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button type="button" onClick={() => setLojaEditando(null)} className="flex-1 rounded-xl bg-white/10 py-3 font-semibold text-white hover:bg-white/20 transition-colors">Cancelar</button>
              <button type="submit" className="flex-1 rounded-xl bg-indigo-500 py-3 font-semibold text-white hover:bg-indigo-600 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.4)]">Salvar Alterações</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE FATURAS DA ASSINATURA SAAS */}
      {lojaFaturas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Faturas da Assinatura MiseOn</h3>
              <button onClick={() => setLojaFaturas(null)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <p className="text-sm text-gray-400 mb-6">Cobranças e notas fiscais da assinatura de <b>{lojaFaturas.nome}</b>.</p>

            <div className="space-y-3">
              {carregandoFaturas ? (
                <p className="text-gray-500">Buscando faturas no banco...</p>
              ) : faturas.length === 0 ? (
                <p className="text-gray-500">{tDynamic('Esta loja ainda não possui faturas de assinatura.')}</p>
              ) : faturas.map((f) => (
                <div key={f.id} className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{new Date(f.created_at).toLocaleDateString('pt-BR')}</p>
                      <p className="text-xs text-gray-500">{f.ciclo === 'anual' ? 'Plano anual' : 'Plano mensal'} · {f.forma_pagamento}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-indigo-400">R$ {Number(f.valor_cobrado).toFixed(2)}</p>
                      <span className={`text-xs font-bold uppercase px-2 py-1 rounded-md ${f.status_cobranca === 'pago' ? 'bg-green-400/10 text-green-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
                        {f.status_cobranca}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                    <span className={`text-[11px] font-bold uppercase px-2 py-1 rounded-md ${
                      f.nfse_status === 'emitida' ? 'bg-emerald-400/10 text-emerald-400'
                      : f.nfse_status === 'erro' ? 'bg-red-400/10 text-red-400'
                      : 'bg-gray-400/10 text-gray-400'
                    }`}>
                      NFS-e: {f.nfse_status.replace('_', ' ')}
                    </span>
                    {f.nfse_pdf_url && (
                      <a href={f.nfse_pdf_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-400 hover:underline">Ver PDF</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PERFIL DE NEGÓCIO */}
      {lojaPerfil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Perfil do Negócio</h3>
              <button onClick={() => setLojaPerfil(null)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <p className="text-sm text-gray-400 mb-6">Dados que <b>{lojaPerfil.nome}</b> informou no cadastro — use para personalizar o contato.</p>

            {carregandoPerfil ? (
              <p className="text-gray-500">Carregando…</p>
            ) : !perfil ? (
              <p className="text-gray-500">{tDynamic('Esta loja ainda não preencheu o cadastro de perfil de negócio.')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="text-gray-500 text-xs">Segmento</p>
                  <p className="font-semibold text-white">{perfil.segmento_negocio?.replace(/_/g, ' ') ?? '—'}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="text-gray-500 text-xs">Funcionários</p>
                  <p className="font-semibold text-white">{perfil.qtd_funcionarios ?? '—'}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="text-gray-500 text-xs">Atende no salão (garçom)</p>
                  <p className="font-semibold text-white">{perfil.atende_salao_garcom ? 'Sim' : 'Não'}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="text-gray-500 text-xs">Entrega</p>
                  <p className="font-semibold text-white">{perfil.faz_entregas ? (perfil.modelo_entrega === 'freelancer' ? 'Freelancer' : 'Fixo') : 'Não faz'}</p>
                </div>
                <div className="col-span-2 rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="text-gray-500 text-xs">{perfil.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'} / Razão social</p>
                  <p className="font-semibold text-white">{perfil.cpf_cnpj} — {perfil.razao_social_ou_nome}</p>
                </div>
                <div className="col-span-2 rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="text-gray-500 text-xs">E-mail de cobrança</p>
                  <p className="font-semibold text-white">{perfil.email_cobranca}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE SUPORTE (REAL-TIME) */}
      {lojaSuporte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gray-900 overflow-hidden shadow-2xl flex flex-col h-[600px]">
            <div className="bg-white/5 p-4 border-b border-white/10 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white">Suporte Direto</h3>
                <p className="text-xs text-green-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Websocket Ativo: {lojaSuporte.nome}</p>
              </div>
              <button onClick={() => setLojaSuporte(null)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            
            <div ref={chatRef} className="flex-1 p-4 bg-black/20 flex flex-col gap-4 overflow-y-auto scroll-smooth">
              {mensagens.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-500 text-sm">Nenhuma mensagem ainda. Envie a primeira!</div>
              ) : (
                mensagens.map((msg, i) => {
                  const isMinha = msg.remetente_id === meuId;
                  return (
                    <div key={i} className={`max-w-[85%] rounded-2xl p-3 text-sm ${isMinha ? 'self-end rounded-tr-none bg-indigo-500/20 border border-indigo-500/30 text-indigo-100' : 'self-start rounded-tl-none bg-white/10 text-gray-200'}`}>
                      <p>{msg.texto}</p>
                      <span className={`text-[10px] mt-1 block ${isMinha ? 'text-indigo-400/50 text-right' : 'text-gray-500'}`}>
                        {new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            
            <form onSubmit={enviarMensagem} className="p-4 border-t border-white/10 bg-white/5">
              <div className="flex gap-2">
                <input value={novaMensagem} onChange={e => setNovaMensagem(e.target.value)} placeholder="Digite uma mensagem..." className="flex-1 rounded-xl bg-black/40 px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" required />
                <button type="submit" disabled={!chatId} className="rounded-xl bg-indigo-500 px-6 py-3 font-bold text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors">Enviar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
