import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import SEO from '../../components/SEO';
import { KioskSimulator } from '../../components/kiosk/KioskSimulator';
import FooterSEO from '../../components/FooterSEO';

export default function DemoKioskPage() {
  return (
    <div className="min-h-screen bg-[#070C18] text-white selection:bg-[#FC5B24] selection:text-white font-sans pt-20 pb-12">
      <SEO
        title="Demonstração Interativa | MiseOn Kiosk & KDS Cozinha"
        description="Experimente o simulador do MiseOn Kiosk: faça um pedido virtual no totem Bravus e veja a comanda surgir no KDS Kanban da cozinha em tempo real."
        canonicalUrl="https://miseon.app.br/demo-kiosk"
      />

      {/* Header Fixo de Retorno */}
      <div className="fixed top-0 inset-x-0 z-50 border-b border-gray-800 bg-[#070C18]/90 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link
            to="/autoatendimento"
            className="inline-flex items-center gap-2 text-xs font-bold text-gray-300 hover:text-white transition"
          >
            <ArrowLeft size={16} /> Voltar para a Landing Page do Kiosk
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FC5B24]">
            <Sparkles size={14} /> DEMONSTRAÇÃO INTERATIVA AO VIVO
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <KioskSimulator isEmbedded={false} />
      </div>

      <div className="mt-16">
        <FooterSEO />
      </div>
    </div>
  );
}
