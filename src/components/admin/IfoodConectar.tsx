import { useEffect, useState } from 'react';
import {
  Store, CheckCircle2, Loader2, AlertCircle, Clock, ExternalLink,
  ClipboardCheck, Mail, PlugZap, RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Conexão da loja com o iFood, guiada passo a passo.
 *
 * ─── POR QUE UM GUIA, E NÃO UM BOTÃO ──────────────────────────────────────
 * Conectar ao iFood não é uma ação: é uma espera. O aplicativo MiseOn é
 * homologado e centralizado, então quem concede o acesso é o RESTAURANTE — o
 * responsável pela loja recebe um e-mail do iFood ("Um novo aplicativo pediu
 * acesso a dados da sua loja") e precisa aprovar. Entre pedir e ser aprovado
 * passa de minutos a dias, e nada disso está sob controle de quem olha a tela.
 *
 * Uma tela com um botão "Conectar" que falha em silêncio nesse intervalo é o
 * que faz o lojista concluir que "o sistema não funciona" e desistir da
 * integração — quando na verdade só falta ele abrir um e-mail.
 *
 * Por isso a tela mostra ONDE ele está no processo, o que já aconteceu e qual
 * é a única coisa que falta agora. Cada passo diz quem age: ele, o iFood, ou o
 * MiseOn.
 *
 * ─── OS TRÊS PASSOS ───────────────────────────────────────────────────────
 *   1. pegar o ID da loja no Portal do Parceiro (só ele tem acesso);
 *   2. aprovar o e-mail que o iFood envia (só ele pode aprovar);
 *   3. escolher a loja aqui — o único passo que é nosso, e leva um clique.
 */

interface Props {
  lojaId: string;
  /** merchantId já conectado, quando houver. */
  merchantConectado?: string | null;
  /** ID informado que está aguardando autorização. */
  merchantSolicitado?: string | null;
  pedidoEm?: string | null;
  onConectado: () => void;
}

interface MerchantDisponivel {
  id: string;
  nome: string;
  jaVinculadaEm: string | null;
}

/** O ID do iFood é um UUID. Validar antes evita um pedido que nasce morto. */
const FORMATO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function IfoodConectar({
  lojaId, merchantConectado, merchantSolicitado, pedidoEm, onConectado,
}: Props) {
  const { tDynamic } = useI18n();

  const [idLoja, setIdLoja] = useState(merchantSolicitado ?? '');
  const [merchants, setMerchants] = useState<MerchantDisponivel[] | null>(null);
  const [aguardando, setAguardando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const idValido = FORMATO_ID.test(idLoja.trim());

  /**
   * Pergunta ao iFood se a loja já foi autorizada.
   *
   * É o coração da tela: enquanto ninguém autorizou, a API responde 403 e a
   * função devolve `aguardandoAutorizacao` em vez de erro — porque esperar
   * aprovação não é falha, é o estado normal de quem acabou de pedir.
   */
  const verificar = async (silencioso = false) => {
    if (!silencioso) setVerificando(true);
    setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('ifood-auth', {
        body: { lojaId, acao: 'listar' },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setAguardando(!!data?.aguardandoAutorizacao);
      setMerchants(data?.merchants ?? []);
    } catch (e) {
      if (!silencioso) setErro((e as Error).message || 'Não consegui falar com o iFood agora.');
    } finally {
      setVerificando(false);
    }
  };

  // Verifica ao abrir: se o lojista aprovou o e-mail enquanto a aba estava
  // fechada, ele encontra a tela já no passo certo, sem ter que clicar em nada.
  useEffect(() => {
    if (!merchantConectado) void verificar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaId]);

  const anotarPedido = async () => {
    setSalvando(true);
    setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('ifood-auth', {
        body: { lojaId, acao: 'anotar', merchantId: idLoja.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      await verificar(true);
      onConectado();
    } catch (e) {
      setErro((e as Error).message || 'Não consegui salvar o ID.');
    } finally {
      setSalvando(false);
    }
  };

  const conectar = async (merchantId: string) => {
    setSalvando(true);
    setErro('');
    try {
      const { data, error } = await supabase.functions.invoke('ifood-auth', {
        body: { lojaId, acao: 'vincular', merchantId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      onConectado();
    } catch (e) {
      setErro((e as Error).message || 'Não consegui conectar.');
    } finally {
      setSalvando(false);
    }
  };

  const diasEsperando = pedidoEm
    ? Math.floor((Date.now() - new Date(pedidoEm).getTime()) / 86_400_000)
    : null;

  const autorizadas = (merchants ?? []).filter((m) => !m.jaVinculadaEm);

  // ─── Já conectado ────────────────────────────────────────────────────────
  if (merchantConectado) {
    return (
      <div className="rounded-2xl border-2 border-emerald-500/20 bg-emerald-50 p-6 dark:bg-emerald-900/10">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={28} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h3 className="text-lg font-black text-emerald-800 dark:text-emerald-400">
              {tDynamic('iFood conectado')}
            </h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-500">
              {tDynamic('Os pedidos entram direto no painel.')}
            </p>
          </div>
        </div>
        <p className="mt-3 break-all font-mono text-xs opacity-95 text-emerald-700/70 dark:text-emerald-500/70">
          {merchantConectado}
        </p>
      </div>
    );
  }

  const passoAtual = autorizadas.length > 0 ? 3 : merchantSolicitado ? 2 : 1;

  return (
    <div className="space-y-4">
      {/* Trilha dos passos: o lojista vê onde está antes de ler qualquer coisa. */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
              passoAtual > n
                ? 'bg-emerald-500 text-white'
                : passoAtual === n
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {passoAtual > n ? '✓' : n}
            </div>
            {n < 3 && <div className={`h-0.5 flex-1 ${passoAtual > n ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-800'}`} />}
          </div>
        ))}
      </div>

      {/* ── PASSO 1 — o ID da loja ─────────────────────────────────────── */}
      <div className={`rounded-2xl border p-5 ${passoAtual === 1 ? 'border-red-300 bg-white dark:border-red-900/50 dark:bg-gray-900' : 'border-gray-200 bg-gray-50 opacity-70 dark:border-gray-800 dark:bg-gray-900/40'}`}>
        <div className="flex items-start gap-3">
          <ClipboardCheck size={20} className="mt-0.5 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <h4 className="font-black text-gray-900 dark:text-gray-100">
              {tDynamic('1. Pegue o ID da sua loja no iFood')}
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {tDynamic('Entre no Portal do Parceiro e vá em')} <b>{tDynamic('Minha Loja → Loja')}</b>.{' '}
              {tDynamic('Logo abaixo do nome da sua loja aparece o ID — um código como este:')}
            </p>
            <p className="mt-1 font-mono text-xs opacity-95 text-gray-400">ffbff387-e005-4829-9cfe-496a386491c3</p>

            <a
              href="https://portal.ifood.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:underline dark:text-red-400"
            >
              {tDynamic('Abrir o Portal do Parceiro')} <ExternalLink size={12} />
            </a>

            {passoAtual === 1 && (
              <div className="mt-3 space-y-2">
                <input
                  value={idLoja}
                  onChange={(e) => setIdLoja(e.target.value.trim())}
                  placeholder="ffbff387-e005-4829-9cfe-496a386491c3"
                  className="w-full rounded-xl border border-gray-300 p-3 font-mono text-sm outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
                {idLoja && !idValido && (
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    {tDynamic('Esse código não parece um ID de loja. Ele tem 5 blocos separados por hífen.')}
                  </p>
                )}
                <button
                  onClick={anotarPedido}
                  disabled={!idValido || salvando}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 p-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {salvando ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
                  {tDynamic('Salvar e continuar')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PASSO 2 — a autorização ────────────────────────────────────── */}
      <div className={`rounded-2xl border p-5 ${passoAtual === 2 ? 'border-red-300 bg-white dark:border-red-900/50 dark:bg-gray-900' : 'border-gray-200 bg-gray-50 opacity-70 dark:border-gray-800 dark:bg-gray-900/40'}`}>
        <div className="flex items-start gap-3">
          <Mail size={20} className="mt-0.5 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <h4 className="font-black text-gray-900 dark:text-gray-100">
              {tDynamic('2. Autorize o MiseOn no iFood')}
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {tDynamic('O iFood envia um e-mail ao responsável pela loja com o assunto')}{' '}
              <b>{tDynamic('“Um novo aplicativo pediu acesso a dados da sua loja”')}</b>.{' '}
              {tDynamic('Abra e clique em autorizar. O pedido também aparece como aviso dentro do Portal do Parceiro.')}
            </p>

            {passoAtual === 2 && (
              <>
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/15">
                  <Clock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-bold">{tDynamic('Aguardando a sua autorização no iFood')}</p>
                    <p className="mt-0.5">
                      {diasEsperando != null && diasEsperando > 0
                        ? `${tDynamic('Pedido enviado há')} ${diasEsperando} ${diasEsperando === 1 ? tDynamic('dia') : tDynamic('dias')}.`
                        : tDynamic('Pedido enviado. Se o e-mail não chegou, confira a caixa de spam e o endereço cadastrado da loja no iFood.')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => verificar()}
                  disabled={verificando}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-600 p-3 text-sm font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                >
                  {verificando ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  {verificando ? tDynamic('Verificando...') : tDynamic('Já autorizei — verificar agora')}
                </button>

                {merchants !== null && aguardando && !verificando && (
                  <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                    {tDynamic('Ainda não consta autorização. A aprovação pode levar alguns minutos para valer.')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── PASSO 3 — conectar ─────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-5 ${passoAtual === 3 ? 'border-emerald-400 bg-white dark:border-emerald-800 dark:bg-gray-900' : 'border-gray-200 bg-gray-50 opacity-70 dark:border-gray-800 dark:bg-gray-900/40'}`}>
        <div className="flex items-start gap-3">
          <PlugZap size={20} className={`mt-0.5 shrink-0 ${passoAtual === 3 ? 'text-emerald-600' : 'text-gray-400'}`} />
          <div className="min-w-0 flex-1">
            <h4 className="font-black text-gray-900 dark:text-gray-100">
              {tDynamic('3. Conecte a loja')}
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {tDynamic('Assim que a autorização sair, sua loja aparece aqui. É só escolher.')}
            </p>

            {passoAtual === 3 && (
              <div className="mt-3 space-y-2">
                {autorizadas.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => conectar(m.id)}
                    disabled={salvando}
                    className="flex w-full items-start gap-3 rounded-xl border-2 border-emerald-300 p-3.5 text-left transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:hover:bg-emerald-900/15"
                  >
                    <Store size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-gray-900 dark:text-gray-100">{m.nome}</span>
                      <span className="block truncate font-mono text-xs opacity-90 text-gray-400">{m.id}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {erro && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}
    </div>
  );
}
