import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { QrCode, Copy, Check, Clock3, RefreshCw, ShieldCheck, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { tocarSom } from '../lib/som';
import { Button, ProgressBar, SuccessCelebration } from './ui';

import { getOptimizedImageUrl } from '../lib/cdn';

import { useI18n } from '../contexts/I18nContext';
export interface PixInfo {
  copia_e_cola: string;
  qr_imagem?: string;
  expiracao?: number; // segundos de validade da cobrança (Efí devolve 3600)
}

interface Props {
  pedidoId: string;
  numero: number;
  pix: PixInfo;
  onFechar: () => void;
  // Regenera a cobrança Pix (re-invoca pix-criar-cobranca). Opcional.
  onRegenerar?: () => Promise<PixInfo | null>;
}

type Estado = 'aguardando' | 'confirmado' | 'expirado';

// Janela visual de espera. A cobrança Efí vale 1h, mas mostrar 60min assusta;
// usamos uma janela curta e, ao estourar, oferecemos "gerar novo" sem perder
// a cobrança antiga (que segue válida se o cliente pagar).
const JANELA_PADRAO_SEG = 15 * 60;

export default function PagamentoStatus({ pedidoId, numero, pix: pixInicial, onFechar, onRegenerar }: Props) {
  const { tDynamic } = useI18n();
  const [pix, setPix] = useState<PixInfo>(pixInicial);
  const [estado, setEstado] = useState<Estado>('aguardando');
  const [copiado, setCopiado] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [restante, setRestante] = useState(() => Math.min(pixInicial.expiracao ?? JANELA_PADRAO_SEG, JANELA_PADRAO_SEG));
  const confirmadoRef = useRef(false);

  // ── Confirmação: fonte de verdade é pagamentos.status = PAGO ──
  // (a Fase A deu ao cliente leitura do próprio pagamento). O webhook Efí,
  // após verificar na fonte, marca PAGO e põe o pedido em ACEITO.
  const checar = async (): Promise<boolean> => {
    const { data } = await supabase.from('pagamentos').select('status').eq('pedido_id', pedidoId);
    const pago = (data ?? []).some((p: any) => p.status === 'PAGO');
    if (pago && !confirmadoRef.current) {
      confirmadoRef.current = true;
      setEstado('confirmado');
      try { tocarSom(); } catch { /* silêncio se o som falhar */ }
    }
    return pago;
  };

  // Polling curto (robusto: independe de realtime/RLS) + realtime de `pedidos`
  // (essa tabela ESTÁ publicada; o webhook a move de NOVO->ACEITO ao confirmar,
  // dando confirmação instantânea quando o canal entrega).
  useEffect(() => {
    if (estado !== 'aguardando') return;
    let ativo = true;
    const intervalo = setInterval(() => { if (ativo) void checar(); }, 3500);
    const canal = supabase
      .channel(`pag-status-${pedidoId}-${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${pedidoId}` },
        (payload: any) => { if (payload.new?.status && payload.new.status !== 'NOVO') void checar(); })
      .subscribe();
    return () => { ativo = false; clearInterval(intervalo); supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId, estado]);

  // Contagem regressiva da janela visual
  useEffect(() => {
    if (estado !== 'aguardando') return;
    if (restante <= 0) { setEstado('expirado'); return; }
    const t = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restante, estado]);

  // Ao confirmar: leva pro acompanhamento automaticamente
  useEffect(() => {
    if (estado !== 'confirmado') return;
    const t = setTimeout(() => { window.location.href = `/pedido/${pedidoId}`; }, 2800);
    return () => clearTimeout(t);
  }, [estado, pedidoId]);

  const copiar = () => {
    navigator.clipboard.writeText(pix.copia_e_cola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const verificarAgora = async () => {
    setVerificando(true);
    await checar();
    setVerificando(false);
  };

  const regenerar = async () => {
    if (!onRegenerar) return;
    setRegenerando(true);
    const novo = await onRegenerar();
    setRegenerando(false);
    if (novo?.copia_e_cola) {
      setPix(novo);
      setRestante(Math.min(novo.expiracao ?? JANELA_PADRAO_SEG, JANELA_PADRAO_SEG));
      confirmadoRef.current = false;
      setEstado('aguardando');
    }
  };

  const mmss = `${String(Math.floor(restante / 60)).padStart(2, '0')}:${String(restante % 60).padStart(2, '0')}`;
  // Janela total da contagem atual (base da ProgressBar regressiva)
  const janelaSeg = Math.min(pix.expiracao ?? JANELA_PADRAO_SEG, JANELA_PADRAO_SEG);

  // Portal no body: fixed dentro de ancestral com transform seria posicionado errado.
  return createPortal(
    <div className="fade fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">

        {estado === 'confirmado' ? (
          /* ─────────── CONFIRMADO ─────────── */
          <div className="px-6 py-8">
            <SuccessCelebration
              titulo="Pagamento confirmado!"
              subtitulo={`Recebemos seu Pix do pedido #${numero}. A cozinha já foi avisada.`}
            >
              <div className="mt-2 flex flex-col items-center gap-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Loader2 size={14} className="animate-spin" /> Abrindo o acompanhamento…
                </p>
                <Button size="lg" className="w-full" onClick={() => { window.location.href = `/pedido/${pedidoId}`; }}>
                  Acompanhar agora
                </Button>
              </div>
            </SuccessCelebration>
          </div>
        ) : estado === 'expirado' ? (
          /* ─────────── EXPIRADO ─────────── */
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <Clock3 size={38} />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">{tDynamic('O tempo de pagamento acabou')}</h3>
            <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
              {tDynamic('Se você já pagou, toque em verificar. Senão, gere um novo código Pix.')}
            </p>
            <div className="mt-6 flex w-full flex-col gap-2">
              <Button variant="secundario" size="lg" className="w-full" carregando={verificando}
                icone={<RefreshCw size={16} />} onClick={verificarAgora}>
                {tDynamic('Já paguei — verificar')}
              </Button>
              {onRegenerar && (
                <Button size="lg" className="w-full" carregando={regenerando}
                  icone={<QrCode size={16} />} onClick={regenerar}>
                  Gerar novo Pix
                </Button>
              )}
              <Button variant="fantasma" className="w-full" onClick={onFechar}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          /* ─────────── AGUARDANDO ─────────── */
          <>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
                  <QrCode size={18} />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-900 dark:text-white">Pague com Pix</p>
                  <p className="text-[11px] font-medium text-gray-400">Pedido #{numero}</p>
                </div>
              </div>
              <button onClick={onFechar} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
            </div>

            <div className="px-6 py-5">
              {/* Status vivo + cronômetro regressivo */}
              <div className="mb-4 rounded-2xl bg-teal-50 px-4 py-3 dark:bg-teal-900/20">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                    <Loader2 size={14} className="animate-spin" />
                    Verificando pagamento…
                  </span>
                  <span className="flex items-center gap-1 font-mono text-sm font-bold tabular-nums text-teal-700 dark:text-teal-300">
                    <Clock3 size={14} /> {mmss}
                  </span>
                </div>
                <ProgressBar valor={restante} max={janelaSeg} tom="#0d9488" altura="h-1.5" className="mt-2.5" animado={false} />
                <p className="mt-1.5 text-[10px] font-semibold text-teal-600/80 dark:text-teal-400/80">
                  O código expira em {mmss} — depois disso você pode gerar um novo.
                </p>
              </div>

              {/* QR em card destacado */}
              <div className="rounded-2xl border-2 border-teal-500/70 bg-white p-4 shadow-lg shadow-teal-500/10 dark:bg-gray-950">
                {pix.qr_imagem ? (
                  <img src={getOptimizedImageUrl(pix.qr_imagem)} alt="QR Code Pix" className="mx-auto h-52 w-52 object-contain" />
                ) : (
                  <div className="mx-auto flex h-52 w-52 items-center justify-center">
                    <Loader2 size={28} className="animate-spin text-teal-500" />
                  </div>
                )}
              </div>

              {/* Copia e cola */}
              <p className="mb-1.5 ml-1 mt-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Pix copia e cola</p>
              <div className="flex items-center gap-2">
                <input readOnly value={pix.copia_e_cola}
                  className="w-full truncate rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-600 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400" />
                <button onClick={copiar} aria-label={copiado ? 'Copiado' : 'Copiar código Pix'}
                  className={`flex shrink-0 items-center justify-center rounded-xl p-3 transition-colors ${copiado ? 'bg-emerald-600 text-white' : 'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-400'}`}>
                  {copiado ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>

              <Button size="lg" className="mt-4 w-full" carregando={verificando} onClick={verificarAgora}>
                {verificando ? 'Verificando…' : 'Já paguei'}
              </Button>

              <div className="mt-3 flex items-center justify-center gap-3 text-xs">
                <Link to={`/pedido/${pedidoId}`} className="font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">Ver pedido</Link>
                <span className="text-gray-300">·</span>
                <button onClick={onFechar} className="font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">Fechar</button>
              </div>

              <p className="mt-4 flex items-center justify-center gap-1 text-[10px] font-semibold text-gray-400">
                <ShieldCheck size={12} /> {tDynamic('A confirmação é automática assim que o banco liquidar o Pix.')}
              </p>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
