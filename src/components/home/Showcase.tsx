import { useState } from 'react';
import { ShoppingBag, Store, Boxes, QrCode, ChevronRight, TrendingUp, DollarSign, CheckCircle2, Clock, MapPin, Truck, Box } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
const RECURSOS = [
  {
    id: 'salao3d',
    icon: <Box size={24} />,
    titulo: 'Salão 3D & Assentos (App Garçom)',
    texto: 'Mapa 3D interativo do seu salão com divisão inteligente de comanda por cadeira e tempo de permanência.',
    detalhe: 'O garçom lança pedidos sabendo exatamente qual assento pediu o prato. Suporte a cobrança individual por cadeira, divisão igualitária e alerta de permanência.',
  },
  {
    id: 'estoque3d',
    icon: <Boxes size={24} />,
    titulo: 'Grafo 3D PEPS & Custeio Real',
    texto: 'Motor 3D de rastreabilidade PEPS que calcula a rota do custo do lote comprado até a porção vendida.',
    detalhe: 'Conservação exata de valor de insumos, margem bruta em tempo real e visualização gráfica de fracionamentos por lote.',
  },
  {
    id: 'kds',
    icon: <ShoppingBag size={24} />,
    titulo: 'Cardápio próprio + Cozinha (KDS)',
    texto: 'Seu cliente pede no SEU link, sem marketplace no meio. O pedido cai na tela da cozinha no mesmo segundo.',
    detalhe: 'Cada pedido feito no celular do cliente, no PDV ou vindo do iFood entra na mesma fila — cronometrado e organizado.',
  },
  {
    id: 'ifood',
    icon: <Store size={24} />,
    titulo: 'Integração iFood completa',
    texto: 'Pedido do iFood cai direto no seu painel, junto com os pedidos do seu site. Uma fila só, zero retrabalho.',
    detalhe: 'O sistema calcula sozinho a taxa que o iFood retém de cada pedido e te mostra o valor LÍQUIDO real. O estoque baixa certinho.',
  },
  {
    id: 'efi',
    icon: <QrCode size={24} />,
    titulo: 'Dinheiro direto na SUA conta',
    texto: 'Pix e cartão processados pelo Efí Bank e repassados para a sua conta. O MiseOn não toca no seu dinheiro.',
    detalhe: 'O cliente paga e o valor cai na sua conta Efí — Pix na hora, cartão no prazo que você escolher. Sem comissão do MiseOn.',
  },
  {
    id: 'logistica',
    icon: <Truck size={24} />,
    titulo: 'Entregas & Motoboy',
    texto: 'Despache pedidos em tempo real com acompanhamento de rota no mapa.',
    detalhe: 'Rotas otimizadas por bairro, status automático para o cliente e registro de entregas por entregador.',
  },
];

// Sub-componentes visuais para simular a UI do sistema
const MockupKDS = () => {
  const { tDynamic } = useI18n();
  return (
  <div className="w-full h-full bg-[#0B1120] p-4 flex flex-col gap-4 font-sans">
    <div className="flex justify-between items-center border-b border-gray-800 pb-3">
      <div className="text-white font-bold flex items-center gap-2"><Clock size={16} className="text-orange-500" /> {tDynamic('KDS - Linha de Produção')}</div>
      <div className="flex gap-2">
        <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded text-xs font-bold">12 Atrasados</span>
        <span className="bg-green-500/20 text-green-500 px-2 py-1 rounded text-xs font-bold">45 Prontos</span>
      </div>
    </div>
    <div className="flex gap-4 h-full overflow-hidden">
      {/* Coluna A Fazer */}
      <div className="flex-1 bg-gray-900/50 rounded-xl p-3 flex flex-col gap-3">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">A Fazer (3)</div>
        <div className="bg-gray-800 rounded-lg p-3 border border-red-500/30 shadow-lg shadow-red-500/10">
          <div className="flex justify-between text-xs mb-2"><span className="text-red-400 font-bold">#1042</span> <span className="text-gray-500">22:04</span></div>
          <div className="text-white text-sm font-bold">1x Combo Master X-Bacon</div>
          <div className="text-gray-400 text-xs mt-1">- Sem cebola</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <div className="flex justify-between text-xs mb-2"><span className="text-gray-400 font-bold">#1043</span> <span className="text-gray-500">22:08</span></div>
          <div className="text-white text-sm font-bold">2x Coca-Cola 2L</div>
        </div>
      </div>
      {/* Coluna Em Preparo */}
      <div className="flex-1 bg-gray-900/50 rounded-xl p-3 flex flex-col gap-3">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Em Preparo (1)</div>
        <div className="bg-gray-800 rounded-lg p-3 border border-yellow-500/50 shadow-lg shadow-yellow-500/10 animate-pulse">
          <div className="flex justify-between text-xs mb-2"><span className="text-yellow-500 font-bold">#1041</span> <span className="text-gray-500">21:58</span></div>
          <div className="text-white text-sm font-bold">1x Pizza Calabresa GG</div>
          <div className="text-gray-400 text-xs mt-1">- Borda recheada</div>
        </div>
      </div>
    </div>
  </div>
  );
};

const MockupIFood = () => {
  const { tDynamic } = useI18n();
  return (
  <div className="w-full h-full bg-[#0B1120] p-5 flex flex-col gap-5">
    <div className="flex justify-between items-center">
      <div className="text-white font-bold text-lg flex items-center gap-2"><Store size={20} className="text-red-500" /> {tDynamic('Sincronização iFood')}</div>
      <div className="flex items-center gap-2 text-xs font-bold text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div> Online
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="text-gray-400 text-xs mb-1">Pedidos Hoje (iFood)</div>
        <div className="text-2xl font-black text-white">142</div>
        <div className="text-green-400 text-xs mt-1 flex items-center"><TrendingUp size={12} className="mr-1"/> +12% vs ontem</div>
      </div>
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="text-gray-400 text-xs mb-1">{tDynamic('Repasse Líquido Estimado')}</div>
        <div className="text-2xl font-black text-red-400">R$ 4.290,00</div>
        <div className="text-gray-500 text-xs mt-1">{tDynamic('Taxas já deduzidas')}</div>
      </div>
    </div>

    <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="text-sm font-bold text-white mb-3">{tDynamic('Últimos Pedidos')}</div>
      {[1,2,3].map((i) => (
        <div key={i} className="flex justify-between items-center border-b border-gray-800 py-2 last:border-0">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/10 p-2 rounded-lg"><Store size={14} className="text-red-500" /></div>
            <div>
              <div className="text-white text-sm font-bold">#49{i}2 <span className="text-gray-500 font-normal text-xs ml-2">Há {i*2} min</span></div>
              <div className="text-gray-400 text-xs">{tDynamic('João Silva • 2 itens')}</div>
            </div>
          </div>
          <div className="text-white font-bold text-sm">R$ {(i * 45.9).toFixed(2)}</div>
        </div>
      ))}
    </div>
  </div>
  );
};



const MockupEfi = () => {
  const { tDynamic } = useI18n();
  return (
  <div className="w-full h-full bg-[#0B1120] p-5 flex flex-col gap-5">
    <div className="flex justify-between items-center">
      <div className="text-white font-bold text-lg flex items-center gap-2"><QrCode size={20} className="text-orange-500" /> {tDynamic('Efí Bank Integrado')}</div>
      <div className="bg-orange-500/20 text-orange-400 text-xs font-bold px-2 py-1 rounded">Saldo Atual</div>
    </div>

    <div className="bg-gradient-to-r from-orange-600 to-orange-400 rounded-2xl p-6 shadow-[0_10px_40px_rgba(249,115,22,0.3)]">
      <div className="text-orange-100 text-sm mb-1">{tDynamic('Disponível para saque')}</div>
      <div className="text-4xl font-black text-white">R$ 14.850,00</div>
      <div className="flex gap-4 mt-4 text-xs font-bold text-white">
        <div className="bg-white/20 px-3 py-1.5 rounded-lg flex items-center gap-1"><ArrowUpRight size={14}/> Transferir</div>
        <div className="bg-white/20 px-3 py-1.5 rounded-lg flex items-center gap-1"><QrCode size={14}/> Pagar Boleto</div>
      </div>
    </div>

    <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="text-sm font-bold text-white mb-3">{tDynamic('Últimas Transações')}</div>
      {[
        { t: 'Pix Recebido - Pedido #1042', v: '+ R$ 45,90', c: 'text-green-400' },
        { t: 'Pix Recebido - Pedido #1041', v: '+ R$ 89,90', c: 'text-green-400' },
        { t: 'Pagamento Fornecedor (Carne)', v: '- R$ 1.250,00', c: 'text-gray-400' }
      ].map((i, idx) => (
        <div key={idx} className="flex justify-between items-center border-b border-gray-800 py-3 last:border-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${idx === 2 ? 'bg-gray-800' : 'bg-green-500/10'}`}>
              {idx === 2 ? <DollarSign size={14} className="text-gray-400" /> : <CheckCircle2 size={14} className="text-green-500" />}
            </div>
            <div className="text-white text-sm font-medium">{i.t}</div>
          </div>
          <div className={`font-bold text-sm ${i.c}`}>{i.v}</div>
        </div>
      ))}
    </div>
  </div>
  );
};

const MockupLogistica = () => {
  const { tDynamic } = useI18n();
  return (
  <div className="w-full h-full bg-[#0B1120] p-5 flex flex-col gap-4 relative overflow-hidden">
    <div className="flex justify-between items-center z-10">
      <div className="text-white font-bold text-lg flex items-center gap-2"><Truck size={20} className="text-indigo-500" /> {tDynamic('Logística & Rotas')}</div>
    </div>

    <div className="flex-1 grid grid-rows-2 gap-4 z-10">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col justify-center relative overflow-hidden">
        {/* Abstract Map Background */}
        <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
        <div className="absolute top-1/2 left-1/4 w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,1)]"></div>
        <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,1)]"></div>
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
          <path d="M 120 70 Q 200 120 280 60" fill="transparent" stroke="rgba(99,102,241,0.5)" strokeWidth="2" strokeDasharray="5,5" className="animate-pulse" />
        </svg>

        <div className="relative z-10 bg-black/60 backdrop-blur-md p-3 rounded-lg border border-gray-700 w-max">
          <div className="text-xs text-indigo-400 font-bold mb-1 flex items-center gap-1"><MapPin size={12}/> Rota Otimizada</div>
          <div className="text-white text-sm">Entregador: Carlos M.</div>
          <div className="text-gray-400 text-xs">2 entregas • 14 min restantes</div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 overflow-y-auto">
        <div className="text-sm font-bold text-white mb-3">{tDynamic('Fila de Despacho')}</div>
        <div className="bg-gray-800 rounded-lg p-3 flex justify-between items-center mb-2">
          <div>
            <div className="text-white font-bold text-sm">Pedido #1043</div>
            <div className="text-gray-400 text-xs">{tDynamic('Rua das Flores, 123 - Centro')}</div>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded transition">Despachar</button>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 flex justify-between items-center">
          <div>
            <div className="text-white font-bold text-sm">Pedido #1044</div>
            <div className="text-gray-400 text-xs">Av. Paulista, 900 - Bela Vista</div>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded transition">Despachar</button>
        </div>
      </div>
    </div>
  </div>
  );
};

// Helper for Arrow
const ArrowUpRight = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
);

const MockupEstoque3D = () => {
  const { tDynamic } = useI18n();
  return (
  <div className="w-full h-full bg-[#0B1120] p-5 flex flex-col gap-4 font-sans">
    <div className="flex justify-between items-center border-b border-gray-800 pb-3">
      <div className="text-white font-bold text-lg flex items-center gap-2">
        <Boxes size={20} className="text-cyan-400" /> {tDynamic('Grafo 3D PEPS & Rastreio de Lotes')}
      </div>
      <div className="flex items-center gap-2">
        <span className="bg-cyan-500/20 text-cyan-300 text-xs font-bold px-3 py-1 rounded-full border border-cyan-500/30">
          Engine WebGL 3D
        </span>
      </div>
    </div>

    <div className="relative flex-1 bg-[#070C18] rounded-2xl border border-gray-800 p-4 overflow-hidden flex flex-col justify-between shadow-2xl">
      {/* Grade Neon e Linhas de Conexão Causal 3D */}
      <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#0A5CC4_1px,transparent_1px)] bg-[size:16px_16px]"></div>
      
      {/* Visualizador de Nós de Grafo 3D */}
      <div className="relative z-10 grid grid-cols-3 gap-3 h-full my-auto items-center">
        
        {/* Nó 1: Lote de Compra */}
        <div className="bg-gray-900/90 backdrop-blur-md border-2 border-cyan-500/60 rounded-2xl p-3.5 shadow-[0_0_20px_rgba(6,182,212,0.15)] flex flex-col justify-between h-36">
          <div className="flex justify-between items-center">
            <span className="text-xs opacity-90 font-black uppercase text-cyan-400 tracking-wider">{tDynamic('Nó #1 • Lote PEPS')}</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          </div>
          <div>
            <p className="text-white font-black text-xs leading-tight">Lote #2026-07A</p>
            <p className="text-gray-400 text-xs opacity-95 font-medium mt-0.5">Caixa Carne 25kg</p>
          </div>
          <div className="border-t border-gray-800 pt-1.5 flex justify-between items-center text-xs opacity-90">
            <span className="text-gray-500">Custo Lote:</span>
            <span className="text-cyan-300 font-bold">R$ 625,00</span>
          </div>
        </div>

        {/* Nó 2: Insumo Processado */}
        <div className="bg-gray-900/90 backdrop-blur-md border-2 border-orange-500/60 rounded-2xl p-3.5 shadow-[0_0_20px_rgba(252,91,36,0.15)] flex flex-col justify-between h-36 relative">
          <div className="flex justify-between items-center">
            <span className="text-xs opacity-90 font-black uppercase text-orange-400 tracking-wider">{tDynamic('Nó #2 • Ficha Técnica')}</span>
            <span className="bg-orange-500/20 text-orange-400 text-xs opacity-80 font-bold px-1.5 py-0.5 rounded">Rendimento 96.8%</span>
          </div>
          <div>
            <p className="text-white font-black text-xs leading-tight">Blend Smash 180g</p>
            <p className="text-gray-400 text-xs opacity-95 font-medium mt-0.5">138 porções ativas</p>
          </div>
          <div className="border-t border-gray-800 pt-1.5 flex justify-between items-center text-xs opacity-90">
            <span className="text-gray-500">Custo/Un:</span>
            <span className="text-orange-300 font-bold">{tDynamic('R$ 4,50 /porção')}</span>
          </div>
        </div>

        {/* Nó 3: Produto Final */}
        <div className="bg-gray-900/90 backdrop-blur-md border-2 border-emerald-500/60 rounded-2xl p-3.5 shadow-[0_0_20px_rgba(16,185,129,0.15)] flex flex-col justify-between h-36">
          <div className="flex justify-between items-center">
            <span className="text-xs opacity-90 font-black uppercase text-emerald-400 tracking-wider">{tDynamic('Nó #3 • Produto Final')}</span>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs opacity-80 font-bold px-1.5 py-0.5 rounded">Margem 79.1%</span>
          </div>
          <div>
            <p className="text-white font-black text-xs leading-tight">Burger Master X-Bacon</p>
            <p className="text-gray-400 text-xs opacity-95 font-medium mt-0.5">{tDynamic('Preço: R$ 38,90')}</p>
          </div>
          <div className="border-t border-gray-800 pt-1.5 flex justify-between items-center text-xs opacity-90">
            <span className="text-gray-500">CMV Exato:</span>
            <span className="text-emerald-300 font-bold">R$ 8,12 (20.8%)</span>
          </div>
        </div>

      </div>

      <div className="relative z-10 bg-gray-900/90 backdrop-blur-md rounded-xl border border-gray-800 p-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs text-gray-200 font-bold">{tDynamic('Conservação de Valor PEPS:')} <strong className="text-emerald-400">100.0% Auditado</strong></span>
        </div>
        <span className="text-xs opacity-95 text-gray-400 font-mono">Rastreio Causal Lote → Venda</span>
      </div>
    </div>
  </div>
  );
};

const MockupSalao3D = () => {
  const { tDynamic } = useI18n();
  return (
  <div className="w-full h-full bg-[#0B1120] p-5 flex flex-col gap-4 font-sans">
    <div className="flex justify-between items-center border-b border-gray-800 pb-3">
      <div className="text-white font-bold text-lg flex items-center gap-2">
        <Box size={20} className="text-orange-500" /> {tDynamic('Salão 3D & Divisão por Cadeira')}
      </div>
      <span className="bg-orange-500/20 text-orange-400 text-xs font-bold px-3 py-1 rounded-full border border-orange-500/30">
        Three.js WebGL Engine
      </span>
    </div>

    <div className="relative flex-1 bg-[#070C18] rounded-2xl border border-gray-800 p-4 overflow-hidden flex flex-col justify-between shadow-2xl">
      {/* Simulação Salão Isometrico 3D */}
      <div className="grid grid-cols-2 gap-4 my-auto">
        
        {/* Mesa Ocupada */}
        <div className="bg-gray-900/90 backdrop-blur-md border-2 border-orange-500/80 rounded-2xl p-4 relative shadow-[0_0_30px_rgba(252,91,36,0.2)]">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_#FC5B24] animate-pulse"></div>
              <span className="text-white font-black text-lg">Mesa 04 (Redonda)</span>
            </div>
            <span className="bg-orange-500 text-white text-xs opacity-90 font-black px-2.5 py-0.5 rounded-full">OCUPADA</span>
          </div>
          <div className="flex items-baseline justify-between mt-3">
            <span className="text-orange-400 font-black text-2xl">R$ 214,00</span>
            <span className="text-xs text-blue-400 font-bold bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">4/4 Cadeiras</span>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-300 font-medium border-t border-gray-800 pt-2">
            <span>⏱️ <strong>1h 12m</strong> em mesa</span>
            <span className="text-gray-600">•</span>
            <span className="text-emerald-400 font-semibold">Comanda Ativa #890</span>
          </div>
        </div>

        {/* Mesa Livre */}
        <div className="bg-gray-900/90 backdrop-blur-md border-2 border-emerald-500/40 rounded-2xl p-4 relative">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#10B981]"></div>
              <span className="text-white font-black text-lg">Mesa 05 (Booth)</span>
            </div>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs opacity-90 font-black px-2.5 py-0.5 rounded-full">LIVRE</span>
          </div>
          <div className="mt-4">
            <p className="text-gray-400 font-medium text-sm">{tDynamic('Pronta para Atendimento')}</p>
            <p className="text-xs text-emerald-400 font-bold mt-1">4 lugares disponíveis no setor Salão Principal</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-900/90 backdrop-blur-md rounded-xl border border-gray-800 p-3.5 flex justify-between items-center">
        <div>
          <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-0.5">{tDynamic('App Garçom • Divisão por Assento')}</div>
          <div className="text-xs text-gray-300">Cadeira #1: R$ 65,00 · Cadeira #2: R$ 82,00 · Cadeira #3: R$ 67,00</div>
        </div>
        <span className="text-xs opacity-90 font-bold text-orange-400 bg-orange-500/10 px-2.5 py-1.5 rounded-lg border border-orange-500/20 shrink-0">
          3 Modos de Fechamento
        </span>
      </div>
    </div>
  </div>
  );
};

export default function Showcase() {
  const { tDynamic } = useI18n();
  const [activeTab, setActiveTab] = useState(RECURSOS[0].id);

  const renderMockup = () => {
    switch (activeTab) {
      case 'salao3d': return <MockupSalao3D />;
      case 'estoque3d': return <MockupEstoque3D />;
      case 'kds': return <MockupKDS />;
      case 'ifood': return <MockupIFood />;
      case 'efi': return <MockupEfi />;
      case 'logistica': return <MockupLogistica />;
      default: return <MockupSalao3D />;
    }
  };

  return (
    <section style={{ borderTop: '1px solid rgba(10,92,196,0.15)', background: 'linear-gradient(180deg, #070C18 0%, #0B1120 100%)' }} className="py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-20 text-center">
          <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-black tracking-tight text-white sm:text-5xl">
            {tDynamic('Um sistema só.')}<span className="text-[#FC5B24]">{tDynamic('Do pedido ao dinheiro na conta.')}</span>
          </h2>
          <p className="mt-6 text-xl text-gray-400 max-w-3xl mx-auto font-medium">
            {tDynamic('Você não precisa de 5 aplicativos para tocar sua loja. Veja a operação do MiseOn em ação.')}
          </p>
        </div>

        <div className="flex flex-col gap-12 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-4 lg:w-1/2">
            {RECURSOS.map((r) => {
              const isActive = activeTab === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setActiveTab(r.id)}
                  className={`group cursor-pointer rounded-3xl border-2 p-6 transition-all duration-300 ${
                    isActive
                      ? 'border-[#FC5B24] bg-[#FC5B24]/10 shadow-[0_0_40px_rgba(252,91,36,0.15)] scale-[1.02]'
                      : 'border-gray-800 bg-[#0B1120] hover:border-gray-600 hover:bg-gray-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${
                          isActive
                            ? 'bg-gradient-to-br from-[#FC5B24] to-orange-600 text-white shadow-lg'
                            : 'bg-gray-800 text-gray-400 group-hover:text-white'
                        }`}
                      >
                        {r.icon}
                      </div>
                      <h3 style={{ fontFamily: "'Sora', sans-serif" }} className={`text-2xl font-black transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                        {r.titulo}
                      </h3>
                    </div>
                    <ChevronRight size={24} className={`transition-all duration-300 ${isActive ? 'rotate-90 text-[#FC5B24]' : 'text-gray-600 group-hover:text-gray-400 group-hover:translate-x-1'}`} />
                  </div>

                  <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isActive ? 'mt-6 max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <p className="mb-3 text-base font-bold text-white leading-relaxed">
                      {r.texto}
                    </p>
                    <p className="text-sm leading-relaxed text-gray-400 font-medium">
                      {r.detalhe}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:w-1/2">
            <div className="sticky top-32 flex h-[550px] flex-col overflow-hidden rounded-[2.5rem] border-2 border-gray-800 bg-[#070C18] p-3 shadow-[0_0_80px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-3 rounded-t-[2rem] border-b border-gray-800 bg-black px-6 py-4">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <div className="ml-4 font-mono text-sm text-gray-500 font-bold bg-gray-900 px-4 py-1 rounded-full">app.miseon.com.br</div>
              </div>
              <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center rounded-b-[2rem]">
                <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black"></div>
                <div className="relative z-10 h-full w-full animate-in fade-in zoom-in-95 duration-500">
                  {renderMockup()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
