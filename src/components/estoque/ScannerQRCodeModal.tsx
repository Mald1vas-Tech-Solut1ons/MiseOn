import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, Camera, Keyboard, X, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  onFechar: () => void;
  onLido: (urlOuChave: string) => void;
  carregando?: boolean;
}

export default function ScannerQRCodeModal({ onFechar, onLido, carregando }: Props) {
  const [modo, setModo] = useState<'CAMERA' | 'DIGITACAO'>('CAMERA');
  const [chaveManual, setChaveManual] = useState('');
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'reader-nfce-qrcode';

  useEffect(() => {
    if (modo !== 'CAMERA') return;

    let html5QrcodeScanner: Html5Qrcode | null = null;
    let cancelado = false;

    const iniciarCamera = async () => {
      try {
        setErroCamera(null);
        html5QrcodeScanner = new Html5Qrcode(containerId);
        scannerRef.current = html5QrcodeScanner;

        await html5QrcodeScanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            if (cancelado) return;
            // Tocar feedback sonoro / hálptico se disponível
            if (navigator.vibrate) navigator.vibrate(100);
            onLido(decodedText);
          },
          () => {
            // Ignora erros de frame contínuo sem QR code
          }
        );
      } catch (err) {
        console.warn('Câmera indisponível:', err);
        setErroCamera('Não foi possível acessar a câmera. Você pode colar a URL ou Chave da nota na aba "Colar / Digitar".');
      }
    };

    iniciarCamera();

    return () => {
      cancelado = true;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [modo, onLido]);

  const handleSubmitManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chaveManual.trim()) return;
    onLido(chaveManual.trim());
  };

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

        {/* Abas Modo */}
        <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800 mb-4">
          <button onClick={() => setModo('CAMERA')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition ${modo === 'CAMERA' ? 'bg-white dark:bg-gray-900 text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
            <Camera size={14} /> Usar Câmera
          </button>
          <button onClick={() => setModo('DIGITACAO')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition ${modo === 'DIGITACAO' ? 'bg-white dark:bg-gray-900 text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
            <Keyboard size={14} /> Colar URL ou Chave
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
                <button onClick={() => setModo('DIGITACAO')} className="bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-amber-700">
                  Ir para Digitação / Colar Chave
                </button>
              </div>
            ) : (
              <div>
                <div id={containerId} className="overflow-hidden rounded-xl border-2 border-dashed border-orange-300 bg-black min-h-[260px]" />
                <p className="mt-3 text-center text-[11px] text-gray-500 dark:text-gray-400">
                  Aproxime o QR Code do cupom fiscal da câmera até ser detectado.
                </p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmitManual} className="space-y-4">
            <div>
              <label className="block text-xsBackend font-bold text-gray-700 dark:text-gray-300 mb-1">
                URL do QR Code ou Chave de Acesso (44 Dígitos)
              </label>
              <textarea
                rows={3}
                value={chaveManual}
                onChange={e => setChaveManual(e.target.value)}
                placeholder="Cole a URL inteira da NFC-e (ex: https://www.nfce.fazenda.sp.gov.br/...) ou digite a chave de 44 dígitos"
                className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent dark:text-gray-100 text-xs font-mono focus:border-orange-500 focus:outline-none"
              />
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
