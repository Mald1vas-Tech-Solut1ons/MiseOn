import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  MessageCircle, Loader2, Save, AlertTriangle, RefreshCw,
  Unplug, Activity, Sparkles, Mail, PhoneOff,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { MiseOnLoader } from '../../components/MiseOnLoader';
import type { CtxLoja } from './AdminLayout';

/* ══════════════════════════════════════════════════════════════════
   Tipos da resposta da Edge Function whatsapp-conectar
   ══════════════════════════════════════════════════════════════════ */
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

interface EventoSaude {
  status: string;
  erro: string | null;
  criado_em: string;
}

interface StatusResponse {
  ok: boolean;
  conexao: Conexao | null;
  loja: {
    whatsapp_ia_ativo: boolean;
    whatsapp_templates_ativo: boolean;
    whatsapp_saudacao: string;
  };
  eventos: EventoSaude[];
}

/* ══════════════════════════════════════════════════════════════════
   Embedded Signup (Meta) — Facebook Login for Business
   ══════════════════════════════════════════════════════════════════
   O lojista conecta o WhatsApp da loja SEM criar conta de desenvolvedor.
   O SDK abre o popup oficial da Meta e devolve DUAS coisas:
     • `code` no callback do FB.login → trocamos por token no servidor;
     • `sessionInfo` via postMessage  → waba_id + phone_number_id.
   Se o SDK não carregar (bloqueador de anúncios, rede corporativa), caímos
   no dialog OAuth por redirect, que devolve o `code` na URL de volta.
   ══════════════════════════════════════════════════════════════════ */
const META_APP_ID = '1409543307655107';
const META_CONFIG_ID = '1810926466545925'; // App Dashboard → WhatsApp → Cadastro incorporado
const META_API_VERSION = 'v21.0';
const META_EXTRAS = { setup: {}, featureType: '', sessionInfoVersion: '3' };

// Precisa estar em "URIs de redirecionamento OAuth válidos" no app da Meta.
const redirectUri = () => `${window.location.origin}/admin/whatsapp`;

declare global {
  interface Window { FB?: any }
}

// Dados que a Meta manda por postMessage durante o Embedded Signup.
interface SessionInfo {
  waba_id?: string;
  phone_number_id?: string;
}

// Carrega o SDK do Facebook uma única vez e devolve o FB já inicializado.
function carregarFbSdk(): Promise<any> {
  if (window.FB) return Promise.resolve(window.FB);
  return new Promise((resolve, reject) => {
    const iniciar = () => {
      if (!window.FB) return reject(new Error('SDK do Facebook indisponível.'));
      window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: false, version: META_API_VERSION });
      resolve(window.FB);
    };
    const jaNoDom = document.getElementById('facebook-jssdk') as HTMLScriptElement | null;
    if (jaNoDom) {
      jaNoDom.addEventListener('load', iniciar);
      jaNoDom.addEventListener('error', () => reject(new Error('SDK do Facebook não carregou.')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onload = iniciar;
    script.onerror = () => reject(new Error('SDK do Facebook não carregou.'));
    document.head.appendChild(script);
  });
}

// Plano B: mesmo fluxo, porém por redirect — volta em /admin/whatsapp?code=…
const urlDialogOAuth = () =>
  `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?` +
  new URLSearchParams({
    client_id: META_APP_ID,
    config_id: META_CONFIG_ID,
    response_type: 'code',
    override_default_response_type: 'true',
    redirect_uri: redirectUri(),
    extras: JSON.stringify(META_EXTRAS),
  }).toString();

// Mascara o número para exibição: "+1 555 ••••-1792"
function mascararTelefone(tel: string | null): string {
  if (!tel) return '—';
  const d = tel.replace(/\D/g, '');
  if (d.length <= 4) return `+${d}`;
  const ultimos4 = d.slice(-4);
  const prefixo = d.slice(0, Math.max(1, d.length - 8));
  return `+${prefixo} ••••-${ultimos4}`;
}

export default function WhatsApp() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const toast = useToast();

  const [carregando, setCarregando] = useState(true);
  const [conexao, setConexao] = useState<Conexao | null>(null);
  const [eventos, setEventos] = useState<EventoSaude[]>([]);
  const [testando, setTestando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [trocandoNumero, setTrocandoNumero] = useState(false);
  const [devolvendo, setDevolvendo] = useState(false);
  const [sdkPronto, setSdkPronto] = useState(false);
  // sessionInfo do Embedded Signup: chega por postMessage ANTES do callback
  // do FB.login, então guardamos em ref para mandar junto com o code.
  const sessionInfo = useRef<SessionInfo>({});

  const [iaAtivo, setIaAtivo] = useState(false);
  const [templatesAtivo, setTemplatesAtivo] = useState(false);
  const [saudacao, setSaudacao] = useState('');
  const [salvandoCfg, setSalvandoCfg] = useState(false);

  // Chama a Edge Function e traduz erros HTTP para mensagens PT-BR
  const chamar = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('whatsapp-conectar', { body });
    if (error) {
      let msg = error.message;
      try {
        const ctx = await (error as any).context?.json();
        if (ctx?.error) msg = ctx.error;
      } catch { /* mantém a mensagem genérica */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const carregar = useCallback(async () => {
    try {
      const data: StatusResponse = await chamar({ acao: 'status', loja_id: lojaId });
      setConexao(data.conexao);
      setEventos(data.eventos ?? []);
      setIaAtivo(data.loja?.whatsapp_ia_ativo ?? false);
      setTemplatesAtivo(data.loja?.whatsapp_templates_ativo ?? false);
      setSaudacao(data.loja?.whatsapp_saudacao ?? '');
    } catch (e) {
      toast('Erro ao carregar status da integração: ' + (e as Error).message, 'erro');
    }
    setCarregando(false);
  }, [chamar, lojaId, toast]);

  useEffect(() => { setTimeout(carregar, 0); }, [carregar]);

  // Retorno do Embedded Signup: a Meta redireciona para /admin/whatsapp?code=...
  // O code é de uso único e expira rápido — trocamos por token imediatamente.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const erroMeta = params.get('error_message') ?? params.get('error_description') ?? params.get('error');
    if (!code && !erroMeta) return;
    // limpa a URL em qualquer cenário (o code não pode ser reutilizado)
    window.history.replaceState({}, '', window.location.pathname);
    if (erroMeta) {
      toast('A Meta não concluiu a conexão: ' + erroMeta, 'erro');
      return;
    }
    setFinalizando(true);
    chamar({ acao: 'trocar_codigo', loja_id: lojaId, code, redirect_uri: redirectUri() })
      .then((data) => {
        toast(`WhatsApp conectado: ${data.verified_name ?? data.display_phone ?? 'número verificado'} 🎉`, 'sucesso');
      })
      .catch((e) => toast((e as Error).message, 'erro'))
      .finally(async () => {
        setFinalizando(false);
        await carregar();
      });
  }, [chamar, lojaId, carregar, toast]);

  // A Meta publica o andamento do Embedded Signup por postMessage.
  // É daqui que saem waba_id e phone_number_id do número recém-conectado.
  useEffect(() => {
    const aoReceber = (ev: MessageEvent) => {
      if (!/^https:\/\/(www|web|business)\.facebook\.com$/.test(ev.origin)) return;
      try {
        const msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (msg?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (msg.event === 'FINISH' || msg.event === 'FINISH_ONLY_WABA' || msg.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
          sessionInfo.current = {
            waba_id: msg.data?.waba_id,
            phone_number_id: msg.data?.phone_number_id,
          };
        }
      } catch { /* mensagem que não é do Embedded Signup */ }
    };
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, []);

  // O SDK é carregado ANTES do clique, de propósito: o FB.login precisa rodar
  // dentro do próprio gesto do usuário. Chamado depois de um await, o popup até
  // abre, mas perde o vínculo com a janela que o abriu — a tela final da Meta
  // fica aberta para sempre e o callback com o `code` nunca chega.
  useEffect(() => {
    carregarFbSdk().then(() => setSdkPronto(true)).catch(() => setSdkPronto(false));
  }, []);

  // Recebe o `code` do popup e fecha a conexão no servidor.
  const finalizarLogin = useCallback(async (resposta: any) => {
    const code = resposta?.authResponse?.code;
    if (!code) {
      setFinalizando(false);
      toast('Conexão cancelada na janela da Meta. Nada foi alterado.', 'erro');
      return;
    }
    try {
      const data = await chamar({
        acao: 'trocar_codigo',
        loja_id: lojaId,
        code,
        ...sessionInfo.current,
      });
      toast(`WhatsApp conectado: ${data.verified_name ?? data.display_phone ?? 'número verificado'} 🎉`, 'sucesso');
      setTrocandoNumero(false);
      await carregar();
    } catch (e) {
      toast((e as Error).message, 'erro');
    } finally {
      setFinalizando(false);
    }
  }, [chamar, lojaId, carregar, toast]);

  // Conectar com Facebook — SEM await antes do FB.login (ver comentário acima).
  const conectarComFacebook = () => {
    if (!window.FB) {
      // SDK bloqueado ou ainda carregando: vai pelo redirect, que não depende
      // de popup nem de comunicação entre janelas.
      window.location.href = urlDialogOAuth();
      return;
    }
    sessionInfo.current = {};
    setFinalizando(true);
    window.FB.login((resposta: any) => { void finalizarLogin(resposta); }, {
      config_id: META_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: META_EXTRAS,
    });
  };

  // Saída de emergência: leva a página inteira para a Meta e volta em
  // /admin/whatsapp?code=… — nada de popup, nada de postMessage.
  const conectarPorRedirect = () => {
    window.location.href = urlDialogOAuth();
  };

  const testar = async () => {
    setTestando(true);
    try {
      const data = await chamar({ acao: 'testar', loja_id: lojaId });
      toast(data.mensagem ?? 'Conexão testada com sucesso!', 'sucesso');
    } catch (e) {
      toast((e as Error).message, 'erro');
    }
    await carregar();
    setTestando(false);
  };

  const desconectar = async () => {
    const ok = window.confirm(
      `Desconectar o WhatsApp ${mascararTelefone(conexao?.display_phone ?? null)} desta loja?\n\n` +
      '• A Meta para de entregar as mensagens deste número ao MiseOn;\n' +
      '• o atendimento automático com IA é desligado na hora;\n' +
      '• o número volta a ser só do dono — nada é respondido automaticamente.\n\n' +
      'Você pode reconectar quando quiser pelo botão "Conectar com Facebook".'
    );
    if (!ok) return;
    setDesconectando(true);
    try {
      const data = await chamar({ acao: 'desconectar', loja_id: lojaId });
      setTrocandoNumero(false);
      if (data?.desinscrito === false && data?.aviso) {
        // desligou de verdade aqui, mas a Meta não confirmou a remoção do app
        toast(data.aviso, 'erro');
      } else {
        toast('WhatsApp desconectado. Este número não recebe nem responde mais pelo MiseOn.', 'sucesso');
      }
      await carregar();
    } catch (e) {
      toast('Erro ao desconectar: ' + (e as Error).message, 'erro');
    }
    setDesconectando(false);
  };

  // Devolver o número ao WhatsApp comum: desconectar sozinho não faz isso —
  // enquanto o número estiver no Cloud API, o app normal recusa o cadastro.
  const devolverNumero = async () => {
    const numero = mascararTelefone(conexao?.display_phone ?? null);
    const ok = window.confirm(
      `Devolver o número ${numero} ao WhatsApp comum?\n\n` +
      '• O número sai da conta do WhatsApp Business API na Meta;\n' +
      '• o MiseOn para de receber e de responder por ele;\n' +
      '• o dono do número volta a usar o WhatsApp normal (instalar o app e confirmar o SMS).\n\n' +
      'Para usar este número no MiseOn de novo será preciso refazer a conexão do zero.'
    );
    if (!ok) return;
    setDevolvendo(true);
    try {
      const data = await chamar({ acao: 'devolver_numero', loja_id: lojaId });
      setTrocandoNumero(false);
      toast(data?.proximo_passo ?? 'Número devolvido ao WhatsApp comum.', 'sucesso');
      await carregar();
    } catch (e) {
      toast((e as Error).message, 'erro');
    }
    setDevolvendo(false);
  };

  const salvarConfig = async () => {
    setSalvandoCfg(true);
    const { error } = await supabase.from('lojas').update({
      whatsapp_ia_ativo: iaAtivo,
      whatsapp_templates_ativo: templatesAtivo,
      whatsapp_saudacao: saudacao.trim() || null,
    }).eq('id', lojaId);
    setSalvandoCfg(false);
    if (error) toast('Erro ao salvar configurações: ' + error.message, 'erro');
    else toast('Configurações do WhatsApp salvas!', 'sucesso');
  };

  if (carregando) {
    return (
      <div className="flex justify-center pt-24">
        <MiseOnLoader status="Carregando integração WhatsApp" rows={3} />
      </div>
    );
  }

  const status = conexao?.status ?? null;
  const semaforo = status === 'CONECTADO'
    ? { rotulo: 'Conectado', dot: 'bg-emerald-500 shadow-[0_0_8px_#22c55e]', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', emoji: '🟢' }
    : status === 'PENDENTE'
      ? { rotulo: 'Pendente', dot: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', emoji: '🟡' }
      : { rotulo: status === 'ERRO' ? 'Erro' : 'Desconectado', dot: status === 'ERRO' ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-gray-400', pill: status === 'ERRO' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400', emoji: status === 'ERRO' ? '🔴' : '⚪' };

  return (
    <div className="px-4 py-6">
      {/* ── Cabeçalho ── */}
      <div data-tour="tour-whatsapp-header" className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25">
            <MessageCircle size={24} />
          </div>
          <div>
            <h1 className="font-['Sora'] text-2xl font-extrabold text-gray-900 dark:text-white">Integração WhatsApp</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Atendimento automático com IA direto no WhatsApp da sua loja.
            </p>
          </div>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black uppercase tracking-wide ${semaforo.pill}`}>
          <span className={`h-2 w-2 rounded-full ${semaforo.dot}`} />
          {semaforo.emoji} {semaforo.rotulo}
        </span>
      </div>

      <div className="space-y-4">
        {/* ── Card de status ── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-['Sora'] text-base font-bold text-gray-900 dark:text-white">Status da conexão</h3>
              {conexao ? (
                <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <p>
                    <span className="font-semibold">Número:</span>{' '}
                    <span className="font-['JetBrains_Mono']">{mascararTelefone(conexao.display_phone)}</span>
                    {conexao.verified_name && <span className="text-gray-400"> · {conexao.verified_name}</span>}
                  </p>
                  {conexao.conectado_em && (
                    <p className="text-xs text-gray-400">
                      Conectado em {new Date(conexao.conectado_em).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(conexao.conectado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">
                    <b>Desconectar</b> para o atendimento automático na hora, mas o número segue
                    reservado ao WhatsApp Business API. Para o dono voltar a usá-lo no
                    <b> WhatsApp comum</b>, use <b>Devolver número</b>.
                  </p>
                  {conexao.ultimo_erro && (
                    <p className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-400">
                      Último erro: {conexao.ultimo_erro}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Nenhum número conectado. Preencha o assistente abaixo para ativar o atendimento automático.
                </p>
              )}
            </div>
            {conexao && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  onClick={testar}
                  disabled={testando}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {testando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  Testar conexão
                </button>
                <button
                  onClick={() => setTrocandoNumero((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/5"
                >
                  <MessageCircle size={15} />
                  {trocandoNumero ? 'Cancelar troca' : 'Trocar de número'}
                </button>
                <button
                  onClick={desconectar}
                  disabled={desconectando || devolvendo}
                  className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/10"
                >
                  {desconectando ? <Loader2 size={15} className="animate-spin" /> : <Unplug size={15} />}
                  Desconectar
                </button>
                <button
                  onClick={devolverNumero}
                  disabled={devolvendo || desconectando}
                  title="Remove o número da Meta para ele voltar a funcionar no WhatsApp comum"
                  className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 disabled:opacity-50"
                >
                  {devolvendo ? <Loader2 size={15} className="animate-spin" /> : <PhoneOff size={15} />}
                  Devolver número
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Aviso âmbar ── */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-400">
            <b>Atenção:</b> o número conectado sai do WhatsApp comum e passa a ser só do atendimento automático.
            Use um chip dedicado — <b>nunca</b> o número que você já usa no celular.
          </p>
        </div>

        {/* ── Conexão principal: Embedded Signup (Meta) ── */}
        {(status !== 'CONECTADO' || trocandoNumero) && (
          <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#052e16] p-6 shadow-lg">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="relative flex flex-col items-center gap-3 text-center">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
                <MessageCircle size={26} className="text-emerald-300" />
              </div>
              <h3 className="font-['Sora'] text-lg font-black text-white">Conectar com Facebook</h3>
              <p className="max-w-md text-sm leading-relaxed text-emerald-100/85">
                A forma mais fácil: a Meta abre uma janela segura, você entra com a sua conta,
                escolhe o número de WhatsApp da sua loja e pronto —
                <b className="text-white"> sem criar conta de desenvolvedor e sem colar código nenhum</b>.
              </p>
              <button
                onClick={conectarComFacebook}
                disabled={finalizando}
                className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-['Sora'] text-sm font-black text-emerald-950 shadow-xl transition hover:scale-105 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {finalizando ? <Loader2 size={17} className="animate-spin" /> : <MessageCircle size={17} />}
                {finalizando ? 'Finalizando conexão…' : 'Conectar com Facebook'}
              </button>
              <span className="text-[11px] text-emerald-200/70">
                Processo oficial da Meta · leva menos de 2 minutos
                {!sdkPronto && ' · abrindo na própria aba'}
              </span>
              <button
                onClick={conectarPorRedirect}
                className="text-[11px] font-bold text-emerald-200/90 underline underline-offset-2 transition hover:text-white"
              >
                A janela da Meta travou ou não fechou? Concluir sem janela extra
              </button>
            </div>
          </div>
        )}

        {/* ── Deu problema? Suporte assume — sem credencial na mão do lojista ── */}
        {status !== 'CONECTADO' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-2.5">
              <Mail size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="font-['Sora'] text-base font-bold text-gray-900 dark:text-white">
                  A conexão não concluiu?
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  Não existe nada para você configurar manualmente — <b>o MiseOn cuida de toda a
                  parte técnica com a Meta</b>. Se o botão acima não concluir, fale com o suporte
                  em <b>suporte@miseon.app.br</b> que a gente resolve a conexão pra você.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Configurações do atendimento ── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-['Sora'] text-base font-bold text-gray-900 dark:text-white">Atendimento automático</h3>
          </div>

          <div className="space-y-3">
            {/* Toggle IA */}
            <button
              onClick={() => setIaAtivo((v) => !v)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5"
            >
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Atendimento automático com IA</p>
                <p className="text-[11px] text-gray-400">A IA responde os clientes no WhatsApp usando seu cardápio.</p>
              </div>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${iaAtivo ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${iaAtivo ? 'left-[22px]' : 'left-0.5'}`} />
              </span>
            </button>

            {/* Toggle templates */}
            <button
              onClick={() => setTemplatesAtivo((v) => !v)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5"
            >
              <div>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Mensagens fora da janela (templates)</p>
                <p className="text-[11px] leading-snug text-gray-400">
                  Permite avisar o cliente depois de 24h sem resposta.{' '}
                  <b className="text-amber-600 dark:text-amber-400">Mensagens fora da janela de 24h são cobradas pela Meta</b>{' '}
                  — desligado por padrão.
                </p>
              </div>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${templatesAtivo ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${templatesAtivo ? 'left-[22px]' : 'left-0.5'}`} />
              </span>
            </button>

            {/* Saudação */}
            <div>
              <span className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">Mensagem de saudação</span>
              <textarea
                value={saudacao}
                onChange={(e) => setSaudacao(e.target.value)}
                rows={3}
                placeholder="Ex: Olá! Bem-vindo à Pizzaria do Zé 🍕 Posso te ajudar com o cardápio ou com seu pedido?"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <span className="mt-1 block text-[11px] text-gray-400">
                Primeira mensagem que o cliente recebe ao falar com sua loja.
              </span>
            </div>

            <button
              onClick={salvarConfig}
              disabled={salvandoCfg}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 p-3 text-sm font-black text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {salvandoCfg ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar configurações
            </button>
          </div>
        </div>

        {/* ── Card Saúde ── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Activity size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-['Sora'] text-base font-bold text-gray-900 dark:text-white">Saúde da integração</h3>
          </div>
          {eventos.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Nenhuma mensagem recebida ainda. Quando um cliente chamar no WhatsApp, os eventos aparecem aqui.
            </p>
          ) : (
            <div className="space-y-2">
              {eventos.map((ev, i) => {
                const cor = ev.status === 'OK'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : ev.status === 'ERRO'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
                const rotulo = ev.status === 'OK' ? 'Respondida' : ev.status === 'ERRO' ? 'Erro' : 'Na fila';
                return (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3.5 py-2.5 dark:bg-white/5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Mail size={14} className="shrink-0 text-gray-400" />
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${cor}`}>{rotulo}</span>
                      {ev.erro && (
                        <span className="truncate text-[11px] text-red-500 dark:text-red-400" title={ev.erro}>
                          {ev.erro}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {new Date(ev.criado_em).toLocaleDateString('pt-BR')} {new Date(ev.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
