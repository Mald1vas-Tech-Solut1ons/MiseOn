import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Sparkles, ShoppingBag, Check } from 'lucide-react';
import { Produto, fmt } from '../types';

import { useI18n } from '../contexts/I18nContext';
interface VoiceOrderModalProps {
  aberto: boolean;
  onFechar: () => void;
  produtos: Produto[];
  onAdicionarAoCarrinho: (item: { produto: Produto; quantidade: number }) => void;
}

export default function VoiceOrderModal({
  aberto,
  onFechar,
  produtos,
  onAdicionarAoCarrinho,
}: VoiceOrderModalProps) {
  const { tDynamic } = useI18n();
  const [ouvindo, setOuvindo] = useState(false);
  const [transcricao, setTranscricao] = useState('');
  const [itensEncontrados, setItensEncontrados] = useState<{ produto: Produto; quantidade: number }[]>([]);
  const [processado, setProcessado] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'pt-BR';

      rec.onresult = (event: any) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        setTranscricao(text);
      };

      rec.onend = () => {
        setOuvindo(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const iniciarGravacao = () => {
    if (!recognitionRef.current) {
      alert('Seu navegador não suporta voz. Use o Chrome ou Edge.');
      return;
    }
    setTranscricao('');
    setItensEncontrados([]);
    setProcessado(false);
    try {
      recognitionRef.current.start();
      setOuvindo(true);
    } catch {
      setOuvindo(false);
    }
  };

  const pararGravacao = () => {
    if (recognitionRef.current && ouvindo) {
      recognitionRef.current.stop();
      setOuvindo(false);
    }
  };

  // Processa texto falado e localiza produtos no catálogo
  useEffect(() => {
    if (!transcricao || ouvindo) return;

    const texto = transcricao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const achados: { produto: Produto; quantidade: number }[] = [];

    produtos.forEach((prod) => {
      const nomeLimpo = prod.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (texto.includes(nomeLimpo)) {
        // Tenta detectar quantidade antes do nome (ex: "dois burgueres", "2 coca")
        let qtd = 1;
        if (texto.includes(`2 ${nomeLimpo}`) || texto.includes(`dois ${nomeLimpo}`) || texto.includes(`duas ${nomeLimpo}`)) {
          qtd = 2;
        } else if (texto.includes(`3 ${nomeLimpo}`) || texto.includes(`tres ${nomeLimpo}`)) {
          qtd = 3;
        }
        achados.push({ produto: prod, quantidade: qtd });
      }
    });

    setItensEncontrados(achados);
    setProcessado(true);
  }, [transcricao, ouvindo, produtos]);

  const confirmarEAdicionar = () => {
    itensEncontrados.forEach((item) => {
      onAdicionarAoCarrinho(item);
    });
    onFechar();
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-[#FC5B24]" />
            <h3 className="font-['Sora'] font-bold text-lg text-gray-900 dark:text-white">
              {tDynamic('Fazer Pedido por Voz')}
            </h3>
          </div>
          <button onClick={onFechar} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        {/* Círculo do Microfone com Pulso */}
        <div className="flex flex-col items-center justify-center py-6 space-y-4">
          <button
            onClick={ouvindo ? pararGravacao : iniciarGravacao}
            className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all ${
              ouvindo
                ? 'bg-red-500 text-white shadow-[0_0_40px_rgba(239,68,68,0.6)] animate-pulse'
                : 'bg-[#FC5B24] text-white shadow-[0_0_30px_rgba(252,91,36,0.4)] hover:scale-105'
            }`}
          >
            {ouvindo ? <MicOff size={36} /> : <Mic size={36} />}
          </button>

          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
            {ouvindo ? 'Ouvindo... Fale o que você deseja pedir' : 'Clique no microfone para falar o seu pedido'}
          </p>
        </div>

        {/* Transcrição da Fala */}
        {transcricao && (
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/50 p-4 border border-gray-200 dark:border-gray-700 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Você falou:</span>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 italic">
              "{transcricao}"
            </p>
          </div>
        )}

        {/* Itens Encontrados */}
        {processado && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
              {itensEncontrados.length > 0
                ? `${itensEncontrados.length} item(ns) identificados:`
                : 'Nenhum item do cardápio foi reconhecido. Tente falar o nome exato do produto.'}
            </p>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {itensEncontrados.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={14} />
                    <span>
                      {item.quantidade}x {item.produto.nome}
                    </span>
                  </div>
                  <span>{fmt(Number(item.produto.preco) * item.quantidade)}</span>
                </div>
              ))}
            </div>

            {itensEncontrados.length > 0 && (
              <button
                onClick={confirmarEAdicionar}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white shadow-lg hover:brightness-110 transition-all"
              >
                <Check size={18} /> {tDynamic('Adicionar ao Carrinho')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
