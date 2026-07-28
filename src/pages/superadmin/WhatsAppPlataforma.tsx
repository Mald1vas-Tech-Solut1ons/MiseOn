// SuperAdmin → WhatsApp: ferramenta de SUPORTE da plataforma.
// Regra de negócio: o assinante NUNCA cadastra credencial da Meta — ele conecta
// pelo Embedded Signup (botão "Conectar com Facebook"). A conexão manual existe
// só para o time MiseOn destravar um tenant, e mora aqui, não no painel da loja.
import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Loader2, Plug, RefreshCw, Unplug, KeyRound, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Loja {
  id: string;
  nome: string;
}

interface Conexao {
  status: 'PENDENTE' | 'CONECTADO' | 'ERRO';
  display_phone: string | null;
  verified_name: string | null;
  phone_number_id: string;
  waba_id: string;
  conectado_em: string | null;
  ultimo_erro: string | null;
  access_token: string | null; // mascarado pela Edge Function (RN-15)
  app_secret: string | null;   // mascarado pela Edge Function (RN-15)
}

const FORM_VAZIO = { app_id: '', phone_number_id: '', waba_id: '', access_token: '', app_secret: '' };

// Credenciais do app MiseOn na Meta. São da PLATAFORMA e valem para todos os
// tenants — o app_secret vive nos secrets do Supabase e nunca chega ao browser.
const APP_MISEON = {
  app_id: '1409543307655107',
  business_id: '2087734738766466',
  config_id: '1810926466545925',
};

export default function WhatsAppPlataforma() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [lojaId, setLojaId] = useState('');
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState<{ texto: string; tipo: 'ok' | 'erro' } | null>(null);

  const [form, setForm] = useState(FORM_VAZIO);
  const [conectando, setConectando] = useState(false);
  const [novoToken, setNovoToken] = useState('');
  const [atualizandoToken, setAtualizandoToken] = useState(false);
  const [testando, setTestando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  const chamar = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('whatsapp-conectar', { body });
    if (error) {
      let m = error.message;
      try {
        const ctx = await (error as any).context?.json();
        if (ctx?.error) m = ctx.error;
      } catch { /* mantém a mensagem genérica */ }
      throw new Error(m);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('lojas').select('id, nome').order('nome');
      setLojas((data as Loja[]) ?? []);
    })();
  }, []);

  const carregar = useCallback(async () => {
    if (!lojaId) return;
    setCarregando(true);
    try {
      const data = await chamar({ acao: 'status', loja_id: lojaId });
      setConexao(data.conexao);
    } catch (e) {
      setMsg({ texto: (e as Error).message, tipo: 'erro' });
    }
    setCarregando(false);
  }, [chamar, lojaId]);

  useEffect(() => { if (lojaId) carregar(); else setConexao(null); }, [lojaId, carregar]);

  const executar = async (
    fn: () => Promise<any>,
    setLoading: (v: boolean) => void,
    sucesso: (d: any) => string,
  ) => {
    setMsg(null);
    setLoading(true);
    try {
      const data = await fn();
      setMsg({ texto: sucesso(data), tipo: 'ok' });
    } catch (e) {
      setMsg({ texto: (e as Error).message, tipo: 'erro' });
    }
    setLoading(false);
    await carregar();
  };

  const conectar = () => {
    if (Object.values(form).some((v) => !v.trim())) {
      setMsg({ texto: 'Preencha os 5 campos antes de conectar.', tipo: 'erro' });
      return;
    }
    executar(
      () => chamar({ acao: 'conectar', loja_id: lojaId, ...form }),
      setConectando,
      (d) => {
        setForm(FORM_VAZIO);
        return `Conectado: ${d.verified_name ?? d.display_phone ?? 'número verificado'}`;
      },
    );
  };

  const atualizarToken = () => {
    if (!novoToken.trim()) {
      setMsg({ texto: 'Cole o token gerado na Meta.', tipo: 'erro' });
      return;
    }
    executar(
      () => chamar({ acao: 'atualizar_token', loja_id: lojaId, access_token: novoToken.trim() }),
      setAtualizandoToken,
      (d) => {
        setNovoToken('');
        return `Token atualizado — ${d.verified_name ?? d.display_phone ?? 'número'} reconectado`;
      },
    );
  };

  const testar = () =>
    executar(() => chamar({ acao: 'testar', loja_id: lojaId }), setTestando, (d) => d.mensagem ?? 'Conexão OK');

  const desconectar = () => {
    if (!window.confirm('Desconectar o WhatsApp desta loja? O atendimento automático para imediatamente.')) return;
    executar(() => chamar({ acao: 'desconectar', loja_id: lojaId }), setDesconectando, () => 'WhatsApp desconectado.');
  };

  const campoCls =
    'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-gray-100 outline-none transition focus:border-indigo-400';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <MessageCircle size={22} className="text-emerald-400" />
        <div>
          <h1 className="font-['Sora'] text-xl font-black text-white">WhatsApp — Suporte da Plataforma</h1>
          <p className="text-xs text-gray-400">
            Conexão manual de tenants. O lojista nunca vê estes campos — ele conecta pelo Embedded Signup.
          </p>
        </div>
      </div>

      {/* ── Credenciais do app MiseOn (leitura) ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={18} className="text-indigo-400" />
          <h2 className="font-['Sora'] text-sm font-bold text-white">App MiseOn na Meta (vale para todos os tenants)</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { r: 'App ID', v: APP_MISEON.app_id },
            { r: 'Business ID', v: APP_MISEON.business_id },
            { r: 'Config ID (Embedded Signup)', v: APP_MISEON.config_id },
          ].map((c) => (
            <div key={c.r}>
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-400">{c.r}</span>
              <p className="rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-gray-200">{c.v}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          O <b>App Secret</b> fica em Supabase → Edge Functions → Secrets (<code>META_APP_SECRET</code>) e
          nunca é exposto ao navegador.
        </p>
      </div>

      {/* ── Seletor de loja ── */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <label className="mb-1 block text-xs font-bold text-gray-300">Tenant</label>
        <select value={lojaId} onChange={(e) => setLojaId(e.target.value)} className={campoCls}>
          <option value="">Selecione uma loja…</option>
          {lojas.map((l) => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
      </div>

      {msg && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            msg.tipo === 'ok'
              ? 'bg-emerald-500/10 text-emerald-300'
              : 'bg-red-500/10 text-red-300'
          }`}
        >
          {msg.texto}
        </div>
      )}

      {carregando && <p className="text-sm text-gray-400">Carregando conexão…</p>}

      {lojaId && !carregando && (
        <>
          {/* ── Status ── */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 font-['Sora'] text-sm font-bold text-white">Status da conexão</h2>
            {conexao ? (
              <div className="space-y-1 text-sm text-gray-300">
                <p>
                  <b>Status:</b>{' '}
                  <span className={conexao.status === 'CONECTADO' ? 'text-emerald-400' : 'text-red-400'}>
                    {conexao.status}
                  </span>
                </p>
                <p><b>Número:</b> <span className="font-mono">{conexao.display_phone ?? '—'}</span></p>
                <p><b>Phone Number ID:</b> <span className="font-mono text-xs">{conexao.phone_number_id}</span></p>
                <p><b>WABA ID:</b> <span className="font-mono text-xs">{conexao.waba_id}</span></p>
                <p><b>Token:</b> <span className="font-mono text-xs">{conexao.access_token ?? '—'}</span></p>
                {conexao.ultimo_erro && (
                  <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                    Último erro: {conexao.ultimo_erro}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={testar} disabled={testando}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50">
                    {testando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Testar
                  </button>
                  <button onClick={desconectar} disabled={desconectando}
                    className="flex items-center gap-2 rounded-xl border border-red-500/40 px-4 py-2 text-xs font-black text-red-300 transition hover:bg-red-500/10 disabled:opacity-50">
                    {desconectando ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />} Desconectar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenhuma conexão para este tenant.</p>
            )}
          </div>

          {/* ── Trocar só o token ── */}
          {conexao && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound size={18} className="text-amber-400" />
                <div>
                  <h2 className="font-['Sora'] text-sm font-bold text-white">Trocar o token</h2>
                  <p className="text-xs text-gray-400">
                    O número já está cadastrado — use quando o token vencer. É o único campo necessário.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="password" value={novoToken} onChange={(e) => setNovoToken(e.target.value.trim())}
                  placeholder="EAA…" autoComplete="off" className={`flex-1 ${campoCls}`} />
                <button onClick={atualizarToken} disabled={atualizandoToken}
                  className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-black text-gray-950 transition hover:bg-amber-400 disabled:opacity-50">
                  {atualizandoToken ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                  {atualizandoToken ? 'Validando…' : 'Atualizar'}
                </button>
              </div>
            </div>
          )}

          {/* ── Conexão manual completa ── */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Plug size={18} className="text-indigo-400" />
              <div>
                <h2 className="font-['Sora'] text-sm font-bold text-white">Conexão manual completa</h2>
                <p className="text-xs text-gray-400">
                  Registra o webhook e inscreve o app na WABA. Use só quando o Embedded Signup não resolver.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                { campo: 'app_id', rotulo: 'App ID', ajuda: 'Configurações do app → Básico' },
                { campo: 'phone_number_id', rotulo: 'Phone Number ID', ajuda: 'WhatsApp → Configuração da API' },
                { campo: 'waba_id', rotulo: 'WABA ID', ajuda: 'WhatsApp → Configuração da API' },
                { campo: 'access_token', rotulo: 'Access Token', ajuda: 'Token permanente (System User)' },
                { campo: 'app_secret', rotulo: 'App Secret', ajuda: 'Configurações do app → Básico' },
              ] as { campo: keyof typeof FORM_VAZIO; rotulo: string; ajuda: string }[]).map((f) => (
                <label key={f.campo} className={f.campo === 'access_token' || f.campo === 'app_secret' ? 'sm:col-span-2' : ''}>
                  <span className="mb-1 block text-xs font-bold text-gray-300">{f.rotulo}</span>
                  <input
                    type={f.campo === 'access_token' || f.campo === 'app_secret' ? 'password' : 'text'}
                    value={form[f.campo]}
                    onChange={(e) => setForm((o) => ({ ...o, [f.campo]: e.target.value.trim() }))}
                    autoComplete="off"
                    className={campoCls}
                  />
                  <span className="mt-1 block text-[11px] text-gray-500">{f.ajuda}</span>
                </label>
              ))}
            </div>
            <button onClick={conectar} disabled={conectando}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 p-3 text-sm font-black text-white transition hover:bg-indigo-500 disabled:opacity-50">
              {conectando ? <Loader2 size={18} className="animate-spin" /> : <Plug size={18} />}
              {conectando ? 'Configurando na Meta…' : 'Conectar WhatsApp'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
