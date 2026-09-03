import { useState } from 'react';
import { PlayCircle, ShoppingBag, ChefHat, Boxes, Wallet, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../contexts/I18nContext';

const ETAPAS = [
  {
    id: 1,
    icone: ShoppingBag,
    titulo: '1. Cliente Pede',
    subtitulo: 'Venda Unificada',
    descricao: 'Pedido realizado no QR Code da mesa, no balcão, no iFood ou no WhatsApp. O sistema valida o estoque em tempo real.',
    cor: 'text-blue-400',
    bgBadge: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    detalhes: [
      'Entrada automática sem redigitar',
      'Identificação da mesa, balcão ou delivery',
      'Pix instantâneo direto na conta Efí',
    ],
    previewData: {
      origem: 'Mesa 04 — QR Code',
      itens: ['2x X-Salada Artesanal', '1x Coca-Cola Zero 350ml'],
      valor: 'R$ 68,00',
      status: 'ACEITO E ENVIADO PARA A COZINHA',
    },
  },
  {
    id: 2,
    icone: ChefHat,
    titulo: '2. Cozinha Prepara',
    subtitulo: 'KDS Kanban Sem Papel',
    descricao: 'A cozinha recebe o pedido na tela de produção dividida por estação (Chapa, Grelha, Bar), com timer em tempo real.',
    cor: 'text-orange-400',
    bgBadge: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
    detalhes: [
      'Fim dos comanda de papel engordurados',
      'Cronômetro de preparo por estação',
      'Aviso sonoro e garçom notificado no PWA',
    ],
    previewData: {
      origem: 'Estação Chapa #1',
      itens: ['Ponto da carne: Ao Ponto', 'Sem cebola, molho extra'],
      valor: 'Tempo: 04m 12s',
      status: 'EM PREPARAÇÃO NA CHAPA',
    },
  },
  {
    id: 3,
    icone: Boxes,
    titulo: '3. Estoque Baixa',
    subtitulo: 'Ficha Técnica PEPS',
    descricao: 'No momento da confirmação, cada ingrediente é baixado proporcionalmente pela Ficha Técnica pelo custo exato do lote.',
    cor: 'text-purple-400',
    bgBadge: 'bg-purple-500/20 border-purple-500/40 text-purple-300',
    detalhes: [
      'Baixa exata de 360g de carne, 40g de queijo',
      'Método PEPS (Primeiro que entra, primeiro que sai)',
      'Alerta automático se atingir estoque mínimo',
    ],
    previewData: {
      origem: 'Baixa de Insumos PEPS',
      itens: ['-360g Blend Fraldinha (Lote #1042)', '-40g Queijo Prato (Lote #0988)'],
      valor: 'CMV Baixado: R$ 21,40',
      status: 'ESTOQUE ATUALIZADO EM TEMPO REAL',
    },
  },
  {
    id: 4,
    icone: Wallet,
    titulo: '4. Margem Aparece',
    subtitulo: 'DRE Financeiro Real',
    descricao: 'O faturamento é conciliado, a taxa do iFood/maquininha é abatida e a margem de lucro líquido do pedido surge no painel.',
    cor: 'text-emerald-400',
    bgBadge: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    detalhes: [
      'Receita Bruta vs Receita Líquida real',
      'Margem de contribuição por prato',
      'Contabilidade de Dupla Entrada automatizada',
    ],
    previewData: {
      origem: 'Demonstrativo Financeiro DRE',
      itens: ['Venda Bruta: R$ 68,00', 'CMV Insumos: -R$ 21,40 | Taxa: -R$ 2,38'],
      valor: 'Lucro Líquido: R$ 44,22 (65%)',
      status: 'MARGEM REGISTRADA NO CAIXA',
    },
  },
];

export default function DemonstracaoFluxo() {
  const { tDynamic } = useI18n();
  const [etapaAtiva, setEtapaAtiva] = useState<number>(1);

  const ativa = ETAPAS.find((e) => e.id === etapaAtiva) || ETAPAS[0];

  return (
    <section id="demonstracao-fluxo" className="relative overflow-hidden bg-slate-900 py-20 border-b border-white/10 text-white">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
      
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-black uppercase tracking-widest text-emerald-400">
            <PlayCircle size={14} /> {tDynamic('Veja o MiseOn Funcionando em 60s')}
          </span>
          <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight sm:text-4xl">
            {tDynamic('Tudo se conectando em tempo real. Sem esforço.')}
          </h2>
          <p className="mt-3 text-sm text-slate-300 max-w-2xl mx-auto">
            {tDynamic('Clique nas etapas abaixo para ver como um único pedido percorre a venda, a cozinha, o estoque e o financeiro sem nenhuma digitação duplicada:')}
          </p>
        </div>

        {/* Tabs de Seleção da Etapa */}
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {ETAPAS.map((e) => {
            const selecionado = e.id === etapaAtiva;
            return (
              <button
                key={e.id}
                onClick={() => setEtapaAtiva(e.id)}
                className={`flex items-center gap-3 rounded-2xl p-4 text-left border transition-all duration-200 ${
                  selecionado
                    ? 'border-emerald-500/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className={`rounded-xl p-2.5 bg-white/10 ${e.cor}`}>
                  <e.icone size={20} />
                </div>
                <div>
                  <h3 className="font-['Sora'] text-xs font-bold text-white">{tDynamic(e.titulo)}</h3>
                  <p className="text-xs text-slate-400">{tDynamic(e.subtitulo)}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Visualização Detalhada da Etapa Selecionada */}
        <div className="mt-8 rounded-3xl border border-white/15 bg-white/5 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            
            {/* Explicação da Etapa (Esquerda) */}
            <div className="lg:col-span-6 space-y-4">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${ativa.bgBadge}`}>
                {tDynamic(ativa.subtitulo)}
              </span>
              
              <h3 className="font-['Sora'] text-2xl font-bold text-white flex items-center gap-2">
                <ativa.icone size={24} className={ativa.cor} />
                {tDynamic(ativa.titulo)}
              </h3>
              
              <p className="text-sm leading-relaxed text-slate-300">
                {tDynamic(ativa.descricao)}
              </p>

              <ul className="space-y-2 pt-2">
                {ativa.detalhes.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>{tDynamic(item)}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-4">
                <Link
                  to="/cadastre-se"
                  className="inline-flex items-center gap-2 text-xs font-extrabold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {tDynamic('Quero ver esta automação no meu restaurante')} <ArrowRight size={14} />
                </Link>
              </div>
            </div>

            {/* Simulação Visual do Card/Painel (Direita) */}
            <div className="lg:col-span-6 rounded-2xl border border-white/10 bg-black/60 p-6 backdrop-blur-md font-mono text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {tDynamic(ativa.previewData.origem)}
                </span>
                <span className="text-slate-400 text-xs">{tDynamic(ativa.previewData.status)}</span>
              </div>

              <div className="space-y-2 mb-4">
                {ativa.previewData.itens.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white/5 rounded-xl p-3 text-slate-200 font-sans text-xs">
                    <span>{tDynamic(it)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 pt-3 flex justify-between items-center text-sm font-bold text-white font-sans">
                <span>{tDynamic('Resultado da Etapa:')}</span>
                <span className={ativa.cor}>{ativa.previewData.valor}</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
