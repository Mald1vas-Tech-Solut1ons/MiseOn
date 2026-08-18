import { useRef, useState, useCallback } from 'react';
import { Upload, Loader2, X, Image as ImageIcon, AlertCircle, RotateCw, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { getOptimizedImageUrl } from '../lib/cdn';

/* ─────────────────────────────────────────────────────────────
   ImageUpload com react-easy-crop (React 19 compatível)
   Substitui o Filerobot que não disparava onSave.
   ───────────────────────────────────────────────────────────── */

/** Converte "aspect-square" → 1, "aspect-[21/9]" → 21/9, etc. */
function parseAspect(aspecto: string): number | undefined {
  if (aspecto === 'aspect-square') return 1;
  if (aspecto === 'aspect-video') return 16 / 9;
  const m = aspecto.match(/aspect-\[(\d+)\/(\d+)\]/);
  if (m) return Number(m[1]) / Number(m[2]);
  return undefined; // livre
}

/** Cria um canvas recortado, limita dimensões máximas (1600px) e retorna como Blob otimizado. */
async function getCroppedBlob(imageSrc: string, crop: Area, rotation: number, maxWidth = 1600): Promise<Blob> {
  const img = await createImage(imageSrc);
  const rotRad = (rotation * Math.PI) / 180;
  const { width: bW, height: bH } = getRotatedSize(img.width, img.height, rotation);

  let targetWidth = crop.width;
  let targetHeight = crop.height;
  if (targetWidth > maxWidth || targetHeight > maxWidth) {
    const scale = Math.min(maxWidth / targetWidth, maxWidth / targetHeight);
    targetWidth = Math.round(targetWidth * scale);
    targetHeight = Math.round(targetHeight * scale);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.scale(targetWidth / crop.width, targetHeight / crop.height);
  ctx.translate(crop.width / 2, crop.height / 2);
  ctx.translate(-crop.x - crop.width / 2, -crop.y - crop.height / 2);
  ctx.translate(bW / 2, bH / 2);
  ctx.rotate(rotRad);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob falhou'))),
      'image/jpeg',
      0.88,
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (e) => reject(e));
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

function getRotatedSize(w: number, h: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    width: Math.abs(Math.cos(rad) * w) + Math.abs(Math.sin(rad) * h),
    height: Math.abs(Math.sin(rad) * w) + Math.abs(Math.cos(rad) * h),
  };
}

export default function ImageUpload({
  lojaId,
  pasta,
  value,
  onChange,
  aspecto = 'aspect-video',
  label,
}: {
  lojaId: string;
  pasta: string;
  value?: string | null;
  onChange: (url: string) => void;
  aspecto?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  // Estado do editor de recorte
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const aspectRatio = parseAspect(aspecto) ?? 16 / 9;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setErro('');
    if (!file.type.startsWith('image/')) return setErro('Escolha um arquivo de imagem válido.');
    if (file.size > 20 * 1024 * 1024) return setErro('A foto é muito pesada (máx. 20MB). Tente uma imagem mais leve.');

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setImgSrc(ev.target.result.toString());
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setRotation(0);
        setIsEditorOpen(true);
      }
    };
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  const salvarRecorte = async () => {
    if (!croppedArea || !imgSrc) return;
    try {
      setIsEditorOpen(false);
      setEnviando(true);
      setErro('');

      const blob = await getCroppedBlob(imgSrc, croppedArea, rotation);
      const fileName = `${crypto.randomUUID()}.jpg`;
      const caminho = `${lojaId}/${pasta}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('loja-assets')
        .upload(caminho, blob, {
          cacheControl: '31536000, immutable',
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('loja-assets').getPublicUrl(caminho);
      onChange(`${data.publicUrl}?v=${Date.now()}`);
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setErro('Erro ao salvar imagem: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      {label && <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>}

      <div className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-gray-50 dark:bg-gray-800 ${value ? 'border-transparent' : 'border-gray-300 dark:border-gray-700'} ${aspecto}`}>
        {value ? (
          <img src={getOptimizedImageUrl(value)} className="h-full w-full object-cover" alt="Upload preview" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
            <ImageIcon size={24} className="opacity-50" />
            <span className="text-xs font-medium">Toque para enviar foto</span>
          </div>
        )}

        {enviando && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 backdrop-blur-sm">
            <Loader2 size={24} className="animate-spin text-white" />
            <span className="text-xs font-bold text-white">Salvando Nuvem...</span>
          </div>
        )}

        {value && !enviando && (
          <button type="button" onClick={() => onChange('')} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-red-500 hover:scale-110 shadow-sm">
            <X size={16} />
          </button>
        )}

        {/* Aciona o upload clicando na área */}
        {!value && !enviando && (
          <button type="button" className="absolute inset-0 w-full h-full cursor-pointer" onClick={() => inputRef.current?.click()} />
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      <button type="button" onClick={() => inputRef.current?.click()} disabled={enviando}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 shadow-sm">
        <Upload size={16} />
        {enviando ? 'Enviando...' : value ? 'Trocar Imagem' : 'Fazer Upload'}
      </button>

      {erro && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm font-semibold">{erro}</p>
        </div>
      )}

      {/* MODAL DE RECORTE (FULLSCREEN) */}
      {isEditorOpen && imgSrc && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-gray-950">
          {/* Toolbar superior */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
            <button
              type="button"
              onClick={() => setIsEditorOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                title="Girar 90°"
              >
                <RotateCw size={16} />
                <span className="hidden sm:inline">Girar</span>
              </button>
            </div>

            <button
              type="button"
              onClick={salvarRecorte}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-500 transition-colors shadow-lg"
            >
              <Check size={16} />
              Salvar Imagem
            </button>
          </div>

          {/* Área do cropper */}
          <div className="relative flex-1">
            <Cropper
              image={imgSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid
              style={{
                containerStyle: { background: '#0a0a0a' },
                cropAreaStyle: { border: '2px solid rgba(255,255,255,0.6)' },
              }}
            />
          </div>

          {/* Controles de zoom na parte inferior */}
          <div className="flex items-center justify-center gap-4 px-4 py-4 bg-gray-900 border-t border-gray-800">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
              className="rounded-full p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <ZoomOut size={20} />
            </button>

            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-40 sm:w-56 accent-green-500"
            />

            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
              className="rounded-full p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <ZoomIn size={20} />
            </button>

            <span className="ml-2 text-xs font-mono text-gray-500 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
