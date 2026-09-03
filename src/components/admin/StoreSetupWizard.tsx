import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, ShoppingBag, CreditCard, Clock, Share2,
  Link2, MessageSquare, CheckCircle2, ChevronDown, ChevronUp,
  X, Rocket, ArrowRight, Circle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';

interface WizardStep {
  id: string;
  icon: React.ReactNode;
  titulo: string;
  tituloEn: string;
  descricao: string;
  descricaoEn: string;
  rota: string;
  obrigatorio: boolean;
}

const PASSOS_WIZARD: WizardStep[] = [
  {
    id: 'identidade',
    icon: <Store size={16} />,
    titulo: 'Identidade da Loja',
    tituloEn: 'Store Identity',
    descricao: 'Adicione logo e nome da loja',
    descricaoEn: 'Add logo and store name',
    rota: '/admin/loja',
    obrigatorio: true,
  },
  {
    id: 'produto',
    icon: <ShoppingBag size={16} />,
    titulo: 'Primeiro Produto',
    tituloEn: 'First Product',
    descricao: 'Cadastre ao menos um item no cardápio',
    descricaoEn: 'Add at least one item to the menu',
    rota: '/admin/cardapio',
    obrigatorio: true,
  },
  {
    id: 'pagamento',
    icon: <CreditCard size={16} />,
    titulo: 'Pagamento',
    tituloEn: 'Payment',
    descricao: 'Configure Pix ou Efí Bank',
    descricaoEn: 'Set up Pix or Efí Bank',
    rota: '/admin/loja#pagamentos',
    obrigatorio: true,
  },
  {
    id: 'horarios',
    icon: <Clock size={16} />,
    titulo: 'Horários',
    tituloEn: 'Opening Hours',
    descricao: 'Defina quando a loja abre e fecha',
    descricaoEn: 'Set when the store opens and closes',
    rota: '/admin/loja#horarios',
    obrigatorio: true,
  },
  {
    id: 'divulgar',
    icon: <Share2 size={16} />,
    titulo: 'Divulgar a loja',
    tituloEn: 'Share your store',
    descricao: 'Copie o link ou QR Code para seus clientes',
    descricaoEn: 'Copy the link or QR Code for your customers',
    rota: '/admin/loja',
    obrigatorio: true,
  },
  {
    id: 'ifood',
    icon: <Link2 size={16} />,
    titulo: 'iFood (opcional)',
    tituloEn: 'iFood (optional)',
    descricao: 'Conecte sua loja ao iFood',
    descricaoEn: 'Connect your store to iFood',
    rota: '/admin/ifood',
    obrigatorio: false,
  },
  {
    id: 'whatsapp',
    icon: <MessageSquare size={16} />,
    titulo: 'WhatsApp IA (opcional)',
    tituloEn: 'WhatsApp AI (optional)',
    descricao: 'Configure o atendimento automático',
    descricaoEn: 'Set up automated customer service',
    rota: '/admin/whatsapp',
    obrigatorio: false,
  },
];

interface StepStatus {
  identidade: boolean;
  produto: boolean;
  pagamento: boolean;
  horarios: boolean;
  divulgar: boolean;
  ifood: boolean;
  whatsapp: boolean;
}

const STATUS_INICIAL: StepStatus = {
  identidade: false,
  produto: false,
  pagamento: false,
  horarios: false,
  divulgar: false,
  ifood: false,
  whatsapp: false,
};

export function StoreSetupWizard({ lojaId }: { lojaId: string }) {
  const { tDynamic, idioma } = useI18n();
  const nav = useNavigate();
  const isEn = idioma === 'en-US';

  const [visible, setVisible] = useState(false);
  const [recolhido, setRecolhido] = useState(false);
  const [dismissedKey] = useState(`miseon_wizard_dismissed_${lojaId}`);
  const [status, setStatus] = useState<StepStatus>(STATUS_INICIAL);
  const [carregando, setCarregando] = useState(true);

  const verificarStatus = useCallback(async () => {
    if (!lojaId) return;
    setCarregando(true);

    try {
      const [{ data: loja }, { data: produtos }, { data: horarios }] = await Promise.all([
        supabase.from('lojas').select('logo_url, nome, pix_chave, efi_payee_code, ifood_merchant_id, whatsapp').eq('id', lojaId).single(),
        supabase.from('produtos').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
        supabase.from('horarios_funcionamento').select('id', { count: 'exact', head: true }).eq('loja_id', lojaId),
      ]);

      const divulgarFeito = localStorage.getItem(`miseon_link_copiado_${lojaId}`) === 'true';

      setStatus({
        identidade: !!(loja?.logo_url && loja?.nome),
        produto: (produtos?.length ?? 0) > 0,
        pagamento: !!(loja?.pix_chave || loja?.efi_payee_code),
        horarios: (horarios?.length ?? 0) > 0,
        divulgar: divulgarFeito,
        ifood: !!loja?.ifood_merchant_id,
        whatsapp: !!loja?.whatsapp,
      });
    } catch {
      // Silencioso — wizard não bloqueia nada
    } finally {
      setCarregando(false);
    }
  }, [lojaId]);

  useEffect(() => {
    // Verificar se o wizard foi dispensado permanentemente
    if (localStorage.getItem(dismissedKey) === 'true') {
      setVisible(false);
      return;
    }
    setVisible(true);
    verificarStatus();
  }, [lojaId, dismissedKey, verificarStatus]);

  const dispensar = () => {
    localStorage.setItem(dismissedKey, 'true');
    setVisible(false);
  };

  const concluidos = PASSOS_WIZARD.filter((p) => status[p.id as keyof StepStatus]).length;
  const total = PASSOS_WIZARD.length;
  const pct = Math.round((concluidos / total) * 100);
  const tudo_concluido = concluidos === total;

  const navegar = (passo: WizardStep) => {
    // Para passos de divulgação, registrar como feito
    if (passo.id === 'divulgar') {
      localStorage.setItem(`miseon_link_copiado_${lojaId}`, 'true');
    }
    if (passo.rota.includes('#')) {
      const [rota] = passo.rota.split('#');
      nav(rota);
    } else {
      nav(passo.rota);
    }
  };

  if (!visible || carregando) return null;

  return (
    <div
      className="fixed bottom-[80px] right-3 z-[9999] w-[340px] sm:bottom-6 sm:right-6"
      style={{ maxHeight: 'calc(100vh - 100px)' }}
    >
      {/* ── Card principal ── */}
      <div className="flex flex-col rounded-[24px] border border-orange-500/20 bg-[#0B1220]/96 text-white shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_0_1px_rgba(249,115,22,0.1)] backdrop-blur-xl overflow-hidden">

        {/* Linha superior de brilho */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
              <Rocket size={16} />
            </span>
            <div>
              <p className="font-['Sora'] text-sm font-black text-white">
                {tDynamic('Configurar sua loja')}
              </p>
              <p className="text-[10px] text-white/40">
                {concluidos}/{total} {isEn ? 'steps done' : 'concluídos'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRecolhido((r) => !r)}
              className="rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-white/80 transition"
            >
              {recolhido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              onClick={dispensar}
              title={tDynamic('Dispensar')}
              className="rounded-lg p-1.5 text-white/40 hover:bg-white/8 hover:text-white/80 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="px-4 pt-3 pb-0">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${pct}%`,
                background: tudo_concluido
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, #f97316, #f59e0b)',
                boxShadow: tudo_concluido
                  ? '0 0 10px rgba(16,185,129,0.6)'
                  : '0 0 10px rgba(249,115,22,0.6)',
              }}
            />
          </div>
          <p className="mt-1.5 mb-3 text-[10px] text-white/30">
            {tudo_concluido
              ? (isEn ? '🎉 All set! Your store is ready to go.' : '🎉 Tudo pronto! Sua loja está no ar.')
              : tDynamic('Complete os passos para colocar sua loja no ar de forma independente.')}
          </p>
        </div>

        {/* Lista de passos */}
        {!recolhido && (
          <div className="overflow-y-auto px-3 pb-3 space-y-1.5" style={{ maxHeight: '280px' }}>
            {PASSOS_WIZARD.map((passo) => {
              const feito = status[passo.id as keyof StepStatus];
              return (
                <button
                  key={passo.id}
                  onClick={() => navegar(passo)}
                  className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-200 group ${
                    feito
                      ? 'bg-white/4 opacity-60 hover:opacity-80'
                      : 'bg-white/5 hover:bg-white/9 hover:scale-[1.015]'
                  }`}
                >
                  {/* Ícone de status */}
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-all ${
                      feito
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : passo.obrigatorio
                          ? 'bg-orange-500/15 text-orange-400'
                          : 'bg-white/8 text-white/40'
                    }`}
                  >
                    {feito ? <CheckCircle2 size={14} /> : passo.icon}
                  </span>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${feito ? 'line-through text-white/40' : 'text-white/90'}`}>
                      {isEn ? passo.tituloEn : passo.titulo}
                    </p>
                    <p className="text-[10px] text-white/30 truncate">
                      {feito ? tDynamic('Feito!') : (isEn ? passo.descricaoEn : passo.descricao)}
                    </p>
                  </div>

                  {/* Seta */}
                  {!feito && (
                    <ArrowRight size={14} className="shrink-0 text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
                  )}
                  {feito && (
                    <Circle size={8} className="shrink-0 text-emerald-500/60 fill-emerald-500/40" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {!recolhido && (
          <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between">
            <p className="text-[10px] text-white/25">
              {isEn ? 'Dismiss anytime' : 'Pode fechar quando quiser'}
            </p>
            <button
              onClick={() => window.dispatchEvent(new Event('iniciar-guided-tour'))}
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-3 py-1.5 text-[10px] font-black text-orange-400 hover:bg-orange-500/25 transition"
            >
              <span>🧭</span>
              {isEn ? 'Take the tour' : 'Fazer o tour'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
