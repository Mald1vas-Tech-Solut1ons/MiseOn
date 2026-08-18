import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, Camera, Keyboard, X, ArrowRight, Loader2, AlertCircle, Image as ImageIcon, Zap, ZapOff } from 'lucide-react';
import { temDetectorNativo, lerQrDeImagem, lerQrDeVideo, type EtapaLeitura } from '../../lib/lerQrCode';

/**
 * Abre a câmera tentando do pedido mais rico ao mais simples.
 *
 * Pedir 1920x1080 de cara é ótimo para ler QR denso, mas há aparelho que recusa
 * a combinação inteira (OverconstrainedError) em vez de negociar — e aí a tela
 * dizia só "não consegui abrir a câmera", com a câmera perfeitamente disponível.
 */
async function abrirCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('SEM_SUPORTE');
  }

  const pedidos: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
    { video: { facingMode: { ideal: 'environment' } } },
    { video: true },
  ];

  let ultimoErro: unknown;
  for (const pedido of pedidos) {
    try {
      return await navigator.mediaDevices.getUserMedia(pedido);
    } catch (e) {
      ultimoErro = e;
      // Permissão negada não melhora com pedido mais simples: para aqui.
      if ((e as DOMException)?.name === 'NotAllowedError') break;
    }
  }
  throw ultimoErro;
}

/** Traduz a falha da câmera em instrução acionável, em vez de "deu erro". */
function explicarErroCamera(erro: unknown): string {
  const nome = (erro as DOMException)?.name ?? (erro as Error)?.message;
  switch (nome) {
    case 'NotAllowedError':
      return 'A permissão da câmera está bloqueada para este site. Abra o cadeado ao lado do endereço, ' +
        'libere a Câmera e toque em "Câmera" de novo. Enquanto isso, a aba "Foto" funciona normalmente.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Não encontrei uma câmera disponível neste aparelho. Use a aba "Foto".';
    case 'NotReadableError':
      return 'A câmera está ocupada por outro aplicativo. Feche o outro app e tente de novo, ou use a aba "Foto".';
    case 'SEM_SUPORTE':
      return 'Este navegador não libera a câmera para páginas. Use a aba "Foto".';
    default:
      return 'Não consegui abrir a câmera. Use a aba "Foto": funciona com uma imagem já salva na galeria.';
  }
}

const TEXTO_ETAPA: Record<EtapaLeitura, string> = {
  lendo: 'Procurando o QR Code na imagem...',
  ampliando: 'Ampliando a imagem...',
  realcando: 'Realçando o contraste...',
  varrendo: 'Varrendo a foto por partes...',
};

interface Props {
  onFechar: () => void;
  onLido: (urlOuChave: string) => void;
  carregando?: boolean;
}

type Modo = 'CAMERA' | 'FOTO' | 'DIGITACAO';

export default function ScannerQRCodeModal({ onFechar, onLido, carregando }: Props) {
  const [modo, setModo] = useState<Modo>('CAMERA');
  const [chaveManual, setChaveManual] = useState('');
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [lendoFoto, setLendoFoto] = useState(false);
  const [etapa, setEtapa] = useState<EtapaLeitura | null>(null);
  const [lanternaLigada, setLanternaLigada] = useState(false);
  const [temLanterna, setTemLanterna] = useState(false);
  const [usandoNativo, setUsandoNativo] = useState(false);
  // Contador de reabertura: muda para o efeito rodar de novo depois que a
  // pessoa libera a permissao da camera sem sair da tela.
  const [tentativa, setTentativa] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pararLeituraRef = useRef<(() => void) | null>(null);
  const fallbackRef = useRef<Html5Qrcode | null>(null);
  const inputFotoRef = useRef<HTMLInputElement | null>(null);
  const containerFallbackId = 'reader-nfce-fallback';

  useEffect(() => {
    if (modo !== 'CAMERA' || carregando) return;

    let cancelado = false;

    const entregar = (valor: string) => {
      if (cancelado) return;
      cancelado = true;
      if (navigator.vibrate) navigator.vibrate(100);
      onLido(valor);
    };

    const iniciar = async () => {
      setErroCamera(null);

      // Caminho principal: mesma API que o app de câmera do celular usa, sobre
      // o quadro inteiro em resolução cheia — sem recorte, sem redimensionar.
      if (temDetectorNativo()) {
        try {
          const stream = await abrirCamera();
          if (cancelado) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          setUsandoNativo(true);

          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            video.setAttribute('playsinline', 'true');
            await video.play().catch(() => {});
            pararLeituraRef.current = lerQrDeVideo(video, entregar);
          }

          const trilha = stream.getVideoTracks()[0];
          const capacidades = trilha?.getCapabilities?.() as { torch?: boolean } | undefined;
          if (capacidades?.torch) setTemLanterna(true);
          return;
        } catch (err) {
          console.warn('Câmera nativa indisponível:', err);
          // Permissão bloqueada, câmera ocupada ou ausente: o html5-qrcode vai
          // esbarrar no mesmo obstáculo. Mostra logo o motivo e o que fazer,
          // em vez de gastar segundos numa segunda tentativa fadada a falhar.
          const nome = (err as DOMException)?.name;
          if (nome === 'NotAllowedError' || nome === 'NotReadableError' || nome === 'NotFoundError') {
            setErroCamera(explicarErroCamera(err));
            return;
          }
        }
      }

      // Alternativa para aparelho sem BarcodeDetector (hoje, iPhone).
      try {
        setUsandoNativo(false);
        const scanner = new Html5Qrcode(containerFallbackId, { verbose: false });
        fallbackRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (l: number, a: number) => {
              const lado = Math.floor(Math.min(l, a) * 0.9);
              return { width: lado, height: lado };
            },
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              focusMode: 'continuous',
            } as unknown as MediaTrackConstraints,
          },
          entregar,
          () => {},
        );
      } catch (err) {
        console.warn('Câmera indisponível:', err);
        setErroCamera(explicarErroCamera(err));
      }
    };

    void iniciar();

    return () => {
      cancelado = true;
      pararLeituraRef.current?.();
      pararLeituraRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (fallbackRef.current?.isScanning) fallbackRef.current.stop().catch(() => {});
      fallbackRef.current = null;
    };
  }, [modo, carregando, onLido, tentativa]);

  const alternarLanterna = async () => {
    const trilha = streamRef.current?.getVideoTracks()[0];
    if (!trilha) return;
    try {
      await trilha.applyConstraints({
        advanced: [{ torch: !lanternaLigada }],
      } as unknown as MediaTrackConstraints);
      setLanternaLigada((v) => !v);
    } catch {
      setTemLanterna(false);
    }
  };

  /**
   * Leitura por imagem: resolve o cupom que a câmera ao vivo não pega, porque a
   * foto congela o melhor foco. Usa o detector nativo na imagem em resolução
   * cheia e, se preciso, insiste com ampliação e binarização.
   */
  const lerDeArquivo = async (arquivo: File) => {
    setErroFoto(null);
    setLendoFoto(true);
    setEtapa('lendo');
    try {
      const valor = await lerQrDeImagem(arquivo, setEtapa);
      if (valor) {
        onLido(valor);
        return;
      }
      setErroFoto(
        'Não achei o QR Code nessa imagem. Tire outra foto com o cupom esticado sobre uma superfície ' +
          'plana, com o QR ocupando boa parte do quadro e sem sombra em cima dele.',
      );
    } catch (err) {
      console.warn('Falha ao ler QR da imagem:', err);
      setErroFoto('Não consegui abrir essa imagem. Tente uma foto em JPG ou PNG.');
    } finally {
      setLendoFoto(false);
      setEtapa(null);
    }
  };

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chaveManual.trim()) return;
    onLido(chaveManual.trim());
  };

  const classeAba = (alvo: Modo) =>
    `flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition ${
      modo === alvo
        ? 'bg-white dark:bg-gray-900 text-orange-600 shadow-sm'
        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800 relative" onClick={e => e.stopPropagation()}>
        <button onClick={onFechar} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-4 pr-8">
          <div className="rounded-xl bg-orange-100 p-2.5 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
            <QrCode size={22} />
          </div>
          <div>
            <h3 className="font-black text-base leading-tight text-gray-900 dark:text-gray-100">Escanear Cupom Fiscal</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Importação sem digitação manual</p>
          </div>
        </div>

        <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800 mb-4">
          <button onClick={() => setModo('CAMERA')} className={classeAba('CAMERA')}>
            <Camera size={14} /> Câmera
          </button>
          <button onClick={() => setModo('FOTO')} className={classeAba('FOTO')}>
            <ImageIcon size={14} /> Foto
          </button>
          <button onClick={() => setModo('DIGITACAO')} className={classeAba('DIGITACAO')}>
            <Keyboard size={14} /> URL
          </button>
        </div>

        {carregando ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 size={36} className="animate-spin text-orange-600 mb-3" />
            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">Consultando nota na SEFAZ SP...</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Buscando itens, quantidades e valores.</p>
          </div>
        ) : modo === 'CAMERA' ? (
          <div>
            {erroCamera ? (
              <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/40 text-center">
                <AlertCircle size={28} className="mx-auto text-amber-600 dark:text-amber-400 mb-2" />
                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mb-3">{erroCamera}</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button onClick={() => setModo('FOTO')} className="bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-amber-700">
                    Ler a partir de uma foto
                  </button>
                  <button
                    onClick={() => setTentativa((n) => n + 1)}
                    className="border border-amber-600 text-amber-700 dark:text-amber-300 font-bold text-xs px-4 py-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  >
                    Tentar a câmera de novo
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-orange-300 bg-black">
                  <video
                    ref={videoRef}
                    className={usandoNativo ? 'block max-h-[320px] w-full object-cover' : 'hidden'}
                    muted
                    playsInline
                  />
                  <div id={containerFallbackId} className={usandoNativo ? 'hidden' : 'min-h-[280px]'} />
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Encoste no QR Code do cupom, a uns 10 cm, com o papel esticado.
                    {usandoNativo && <span className="block text-emerald-600 dark:text-emerald-400">Leitor do próprio aparelho ativo.</span>}
                  </p>
                  {temLanterna && (
                    <button
                      onClick={alternarLanterna}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 px-2.5 py-1.5 text-[11px] font-bold text-gray-700 dark:text-gray-300"
                    >
                      {lanternaLigada ? <ZapOff size={13} /> : <Zap size={13} />}
                      {lanternaLigada ? 'Apagar' : 'Lanterna'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : modo === 'FOTO' ? (
          <div className="space-y-4">
            <div id={containerFallbackId} className="hidden" />
            <div className="rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-900/50 p-5">
              <div className="mb-4 flex items-start gap-2">
                <ImageIcon size={22} className="mt-0.5 shrink-0 text-orange-500" />
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Como fotografar</p>
                  <ol className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
                    <li><strong>1.</strong> Deixe o cupom esticado sobre uma mesa, sem dobra no QR.</li>
                    <li><strong>2.</strong> Fotografe de cima, a uns 15 cm, com o QR no meio do quadro.</li>
                    <li><strong>3.</strong> Evite sombra da própria mão e reflexo em cima do código.</li>
                  </ol>
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-500">
                    Serve foto da galeria, inclusive uma que você já tirou antes.
                  </p>
                </div>
              </div>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  if (arquivo) void lerDeArquivo(arquivo);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => inputFotoRef.current?.click()}
                disabled={lendoFoto}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl shadow-md transition disabled:opacity-50"
              >
                {lendoFoto ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                {lendoFoto ? 'Lendo...' : 'Escolher foto do cupom'}
              </button>
              {lendoFoto && etapa && (
                <p className="mt-2 text-center text-[11px] text-gray-500 dark:text-gray-400">{TEXTO_ETAPA[etapa]}</p>
              )}
            </div>
            {erroFoto && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/40">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-[11px] text-amber-800 dark:text-amber-300">{erroFoto}</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmitManual} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                URL contida no QR Code
              </label>
              <textarea
                rows={3}
                value={chaveManual}
                onChange={e => setChaveManual(e.target.value)}
                placeholder="https://www.nfce.fazenda.sp.gov.br/qrcode?p=3526...|2|1|1|A1B2C3..."
                className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent dark:text-gray-100 text-xs font-mono focus:border-orange-500 focus:outline-none"
              />
              <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                Dica: leia o QR com a câmera do próprio celular, copie o endereço que abrir e cole aqui.
                A chave de 44 dígitos sozinha não serve — a SEFAZ exige o código de segurança que só
                existe dentro do QR.
              </p>
            </div>
            <button
              type="submit"
              disabled={!chaveManual.trim()}
              className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl shadow-md transition disabled:opacity-50"
            >
              Consultar Nota Fiscal <ArrowRight size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
