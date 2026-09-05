import { X, Sparkles } from 'lucide-react';
import { KioskLeadForm } from './KioskLeadForm';

interface KioskLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  origem?: string;
  defaultPedidosDia?: number;
}

export function KioskLeadModal({
  isOpen,
  onClose,
  title = 'Solicitar Demonstração do MiseOn Kiosk',
  subtitle = 'Hardware Bravus + Plataforma Operacional MiseOn. Preencha os dados abaixo para receber uma análise e proposta para seu restaurante.',
  origem = 'kiosk_modal',
  defaultPedidosDia,
}: KioskLeadModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-700/60 bg-[#070C18] p-6 sm:p-8 shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-200 dark:border-white/15 dark:bg-[#0B1120]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white transition"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FC5B24]/40 bg-[#FC5B24]/10 px-3 py-1 text-xs font-bold text-[#FC5B24] mb-3">
            <Sparkles size={14} /> MISEON KIOSK • BRAVUS HARDWARE
          </div>
          <h3 className="font-['Sora'] text-2xl font-bold text-white sm:text-3xl leading-tight">
            {title}
          </h3>
          <p className="mt-2 text-sm text-gray-300 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Lead Form */}
        <KioskLeadForm
          origem={origem}
          defaultPedidosDia={defaultPedidosDia}
          onSuccess={() => {
            // keep open for success state display
          }}
        />
      </div>
    </div>
  );
}
