import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, Camera, Keyboard, X, ArrowRight, Loader2, AlertCircle, Image as ImageIcon, Zap, ZapOff } from 'lucide-react';

interface Props {
  onFechar: () => void;
  onLido: (urlOuChave: string) => void;
  carregando?: boolean;
}

type Modo = 'CAMERA' | 'FOTO' | 'DIGITACAO';

/**
 * QR Code de cupom fiscal é denso (uns 60x60 módulos, contra 25x25 de um QR de
 * link comum) e vem impresso pequeno em papel térmico. Isso exige três coisas
 * que a configuração padrão do html5-qrcode não dá:
 *
 *   1. resolução alta — a padrão (640x480) não separa os módulos;
 *   2. janela de leitura grande — o qrbox RECORTA o frame antes de decodificar,
 *      então uma janela de 250px joga fora justamente a resolução conquistada;
 *   3. decodificador nativo (BarcodeDetector) quando o aparelho tiver, que lê
 *      QR denso e desfocado muito melhor que o decodificador em JavaScript.
 */
const CONFIG_LEITURA = {
  fps: 10,
  // 85% do menor lado: cupom precisa de área, não de mira pequena.
  qrbox: (larguraVisivel: number, alturaVisivel: number) => {
    const lado = Math.floor(Math.min(larguraVisivel, alturaVisivel) * 0.85);
    return { width: lado, height: lado };
  },
  videoConstraints: {
    facingMode: 'environment',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    // Foco contínuo: sem isso a câmera fixa o foco no papel inteiro e o QR
    // fica borrado justamente de perto, que é onde ele precisa ser lido.
    focusMode: 'continuous',
  } as unknown as MediaTrackConstraints,
  experimentalFeatures: { useBarCodeDetectorIfSupported: true },
};

export default function ScannerQRCodeModal({ onFechar, onLido, carregando }: Props) {
  const [modo, setModo] = useState<Modo>('CAMERA');
  const [chaveManual, setChaveManual] = useState('');
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [lendoFoto, setLendoFoto] = useState(false);
  const [lanternaLigada, setLanternaLigada] = useState(false);
  const [temLanterna, setTemLanterna] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputFotoRef = useRef<HTMLInputElement | null>(null);
  const containerId = 'reader-nfce-qrcode';

  useEffect(() => {
    if (modo !== 'CAMERA') return;

    let cancelado = false;

    const iniciarCamera = async () => {
      try {
        setErroCamera(null);
        const scanner = new Html5Qrcode(containerId, {
          verbose: false,
          // Só QR: não desperdiça frame procurando código de barras 1D.
          formatsToSupport: [0],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          CONFIG_LEITURA,
          (textoLido) => {
            if (cancelado) return;
            cancelado = true;
            if (navigator.vibrate) navigator.vibrate(100);
            scanner.stop().catch(() => {});
            onLido(textoLido);
          },
          () => {
            // Frame sem QR: silencioso, acontece dezenas de vezes por segundo.
          }
        );

        // Lanterna ajuda muito em papel térmico desbotado e luz fraca.
        const capacidades = scanner.getRunningTrackCapabilities?.() as { torch?: boolean } | undefined;
        if (!cancelado && capacidades?.torch) setTemLanterna(true);
      } catch (err) {
        console.warn('Câmera indisponível:', err);
        setErroCamera(
          'Não foi possível acessar a câmera. Use "Foto do cupom" para ler o QR Code a partir de uma imagem.'
        );
      }
    };

    iniciarCamera();

    return () => {
      cancelado = true;
      const scanner = scannerRef.current;
      if (scanner?.isScanning) scanner.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [modo, onLido]);

  const alternarLanterna = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      // `torch` existe nos navegadores móveis, mas ainda não na tipagem padrão
      // de MediaTrackConstraintSet — daí o cast.
      await scanner.applyVideoConstraints({
        advanced: [{ torch: !lanternaLigada }],
      } as unknown as MediaTrackConstraints);
      setLanternaLigada((v) => !v);
    } catch {
      setTemLanterna(false);
    }
  };

  /**
   * Leitura por imagem. Costuma resolver o cupom que a câmera ao vivo não pega:
   * a foto congela o quadro no melhor foco, sem depender de mão firme.
   */
  const lerDeArquivo = async (arquivo: File) => {
    setErroFoto(null);
    setLendoFoto(true);
    try {
      const scanner = new Html5Qrcode(containerId, {
        verbose: false,
        formatsToSupport: [0],
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      const texto = await scanner.scanFile(arquivo, false);
      onLido(texto);
    } catch (err) {
      console.warn('Falha ao ler QR da imagem:', err);
      setErroFoto(
        'Não consegui achar o QR Code nessa imagem. Tire a foto de perto, só do quadrado do QR, ' +
          'com o cupom esticado e boa luz — sem pegar o restante do cupom.'
      );
    } finally {
      setLendoFoto(false);
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

        <div className="flex items-center gap-2 mb-4">
          <div className="rounded-xl bg-orange-100 p-2.5 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
            <QrCode size={22} />
          </div>
          <div>
            <h3 className="font-black text-lg text-gray-900 dark:text-gray-100">Escanear Cupom Fiscal (NFC-e)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Importação automática sem digitação manual</p>
          </div>
        </div>

        <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800 mb-4">
          <button onClick={() => setModo('CAMERA')} className={classeAba('CAMERA')}>
            <Camera size={14} /> Câmera
          </button>
          <button onClick={() => setModo('FOTO')} className={classeAba('FOTO')}>
            <ImageIcon size={14} /> Foto do cupom
          </button>
          <button onClick={() => setModo('DIGITACAO')} className={classeAba('DIGITACAO')}>
            <Keyboard size={14} /> Colar URL
          </button>
        </div>

        {carregando ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 size={36} className="animate-spin text-orange-600 mb-3" />
            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">Consultando nota na SEFAZ SP...</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Buscando itens, quantidades e valores em tempo real.</p>
          </div>
        ) : modo === 'CAMERA' ? (
          <div>
            {erroCamera ? (
              <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/40 text-center">
                <AlertCircle size={28} className="mx-auto text-amber-600 dark:text-amber-400 mb-2" />
                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mb-3">{erroCamera}</p>
                <button onClick={() => setModo('FOTO')} className="bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-amber-700">
                  Ler a partir de uma foto
                </button>
              </div>
            ) : (
              <div>
                <div id={containerId} className="overflow-hidden rounded-xl border-2 border-dashed border-orange-300 bg-black min-h-[280px]" />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Encoste a câmera no QR Code, a uns 10 cm, com o cupom esticado.
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
            <div id={containerId} className="hidden" />
            <div className="rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-900/50 p-6 text-center">
              <ImageIcon size={30} className="mx-auto text-orange-500 mb-2" />
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Tire uma foto <strong>só do quadrado do QR Code</strong>, bem de perto e com o cupom esticado.
                Costuma funcionar quando a câmera ao vivo não pega.
              </p>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                capture="environment"
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
                {lendoFoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {lendoFoto ? 'Lendo a imagem...' : 'Escolher / tirar foto'}
              </button>
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
                Precisa ser a URL de dentro do QR Code, com o trecho <code className="font-mono">?p=</code> e as
                barras verticais. A chave de 44 dígitos sozinha não serve: a SEFAZ exige o código de segurança
                que só existe no QR.
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
