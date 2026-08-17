import { useRef, useState } from 'react';
import { Upload, Loader2, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';

/**
 * ImageUpload Profissional (Filerobot)
 * Traz filtros, ajustes avançados de cor, crop livre, anotações e rotação.
 */
export default function ImageUpload({ lojaId, pasta, value, onChange, aspecto = 'aspect-video', label }: {
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
  
  // Estado do Filerobot
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setErro('');
    if (!file.type.startsWith('image/')) return setErro('Escolha um arquivo de imagem válido.');
    if (file.size > 20 * 1024 * 1024) return setErro('A foto é muito pesada (máx. 20MB). Tente uma imagem mais leve.');

    // Carregar como Data URL para passar ao editor
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setImgSrc(ev.target.result.toString());
        setIsEditorOpen(true);
      }
    };
    reader.readAsDataURL(file);
    
    // Resetar input
    if (inputRef.current) inputRef.current.value = '';
  };

  const salvarImagemEditada = async (editedImageObject: any) => {
    try {
      setIsEditorOpen(false); // Fecha o modal
      setEnviando(true);
      setErro('');
      
      let blob: Blob;
      if (!editedImageObject.imageBase64) {
        throw new Error('O editor não retornou a imagem processada (imageBase64 vazio). Tente com uma imagem menor.');
      }

      try {
        // Tenta usar fetch primeiro (mais rápido em navegadores modernos)
        const res = await fetch(editedImageObject.imageBase64);
        blob = await res.blob();
      } catch {
        // Fallback para atob() se o fetch falhar com base64 muito longo
        const arr = editedImageObject.imageBase64.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      }
      
      const fileExt = editedImageObject.extension || 'jpg';
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const caminho = `${lojaId}/${pasta}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('loja-assets')
        .upload(caminho, blob, { 
          cacheControl: '3600', 
          upsert: true,
          contentType: editedImageObject.mimeType || blob.type || 'image/jpeg' 
        });
        
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('loja-assets').getPublicUrl(caminho);
      onChange(`${data.publicUrl}?v=${new Date().getTime()}`);
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setErro('Erro ao salvar imagem editada: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setEnviando(false);
      setIsEditorOpen(false);
    }
  };

  return (
    <div>
      {label && <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>}
      
      <div className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-gray-50 dark:bg-gray-800 ${value ? 'border-transparent' : 'border-gray-300 dark:border-gray-700'} ${aspecto}`}>
        {value ? (
          <img src={value} className="h-full w-full object-cover" alt="Upload preview" />
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
        {enviando ? 'Enviando...' : value ? 'Trocar e Editar Imagem' : 'Fazer Upload e Editar'}
      </button>
      
      {erro && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm font-semibold">{erro}</p>
        </div>
      )}

      {/* MODAL FILEROBOT (FULLSCREEN) */}
      {isEditorOpen && imgSrc && (
        <div className="fixed inset-0 z-[9999] bg-[#111827]">
           <FilerobotImageEditor
            source={imgSrc}
            onSave={(editedImageObject) => salvarImagemEditada(editedImageObject)}
            onClose={() => setIsEditorOpen(false)}
            annotationsCommon={{ fill: '#FC5B24' }}
            Text={{ text: 'MiseOn...' }}
            Rotate={{ angle: 90, componentType: 'slider' }}
            Crop={{
              ratio: aspecto === 'aspect-square' ? 1 : aspecto === 'aspect-[21/9]' ? 21/9 : 'custom',
              autoResize: true,
            }}
            tabsIds={[TABS.ADJUST, TABS.FILTERS, TABS.FINETUNE, TABS.ANNOTATE]}
            defaultTabId={TABS.ADJUST}
            defaultToolId={TOOLS.CROP}
            savingPixelRatio={1}
            previewPixelRatio={1}
            defaultSavedImageName="miseon-image"
            useBackendTranslations={false}
            avoidChangesNotSavedAlertOnLeave={true}
            translations={{
              save: 'Salvar Imagem',
              adjust: 'Cortar / Girar',
              filters: 'Filtros',
              finetune: 'Ajuste Fino',
              annotate: 'Desenhar',
              watermark: 'Marca d\'água',
              crop: 'Recortar',
              rotate: 'Girar',
              custom: 'Livre',
              original: 'Original',
              square: 'Quadrado',
              landscape: 'Paisagem',
              portrait: 'Retrato'
            }}
          />
        </div>
      )}
    </div>
  );
}
