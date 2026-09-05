import { useState } from 'react';
import {
  Touchpad,
  CheckCircle,
  Clock,
  ChefHat,
  ArrowRight,
  RotateCcw,
  QrCode,
  CreditCard,
  Utensils,
  Plus,
  Check,
} from 'lucide-react';
import { KioskLeadModal } from '../landing/KioskLeadModal';
import { useI18n } from '../../contexts/I18nContext';

interface ItemMenu {
  id: string;
  nome: string;
  preco: number;
  categoria: string;
  imagem: string;
  descricao: string;
}

const MENU_MOCK: ItemMenu[] = [
  {
    id: '1',
    nome: 'X-Burger Artesanal',
    preco: 32.9,
    categoria: 'Burgers',
    imagem: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
    descricao: 'Pão brioche, blend 160g, queijo cheddar inglês e maionese da casa.',
  },
  {
    id: '2',
    nome: 'Smash Duplo Bacon',
    preco: 28.5,
    categoria: 'Burgers',
    imagem: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=400&q=80',
    descricao: 'Dois smashes 90g, muito bacon crocante e queijo prato derretido.',
  },
  {
    id: '3',
    nome: 'Batata Rústica Paprika',
    preco: 16.0,
    categoria: 'Acompanhamentos',
    imagem: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80',
    descricao: 'Batatas rústicas fritas com alecrim e páprica defumada.',
  },
  {
    id: '4',
    nome: 'Coca-Cola Zero 350ml',
    preco: 7.5,
    categoria: 'Bebidas',
    imagem: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
    descricao: 'Lata 350ml trincando de gelada.',
  },
];

export function KioskSimulator({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { tDynamic } = useI18n();
  const [etapa, setEtapa] = useState<'inicio' | 'cardapio' | 'carrinho' | 'pagamento' | 'sucesso'>('inicio');
  const [carrinho, setCarrinho] = useState<{ item: ItemMenu; qtd: number; obs: string }[]>([]);
  const [baconExtra, setBaconExtra] = useState(false);
  const [semCebola, setSemCebola] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState<'pix' | 'cartao'>('pix');
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
  const [numeroPedido, setNumeroPedido] = useState(104);

  const [modalOpen, setModalOpen] = useState(false);

  // KDS State simulado
  const [pedidosKds, setPedidosKds] = useState([
    { id: 101, cliente: 'Balcão #101', itens: ['X-Burger Artesanal', 'Coca-Cola Zero'], status: 'pronto', tempo: '08:12' },
    { id: 102, cliente: 'Kiosk #102', itens: ['Smash Duplo', 'Batata Rústica'], status: 'em_preparo', tempo: '03:45' },
    { id: 103, cliente: 'Delivery #103', itens: ['2x Smash Duplo'], status: 'em_preparo', tempo: '01:20' },
  ]);

  const adicionarAoCarrinho = (item: ItemMenu) => {
    setCarrinho((prev) => {
      const existe = prev.find((i) => i.item.id === item.id);
      if (existe) {
        return prev.map((i) => (i.item.id === item.id ? { ...i, qtd: i.qtd + 1 } : i));
      }
      return [...prev, { item, qtd: 1, obs: '' }];
    });
  };

  const totalCarrinho = carrinho.reduce((acc, curr) => acc + curr.item.preco * curr.qtd + (baconExtra ? 4.5 : 0), 0);

  const finalizarPagamento = () => {
    setProcessandoPagamento(true);
    setTimeout(() => {
      setProcessandoPagamento(false);
      setEtapa('sucesso');

      // Adicionar novo pedido ao KDS
      const novoNum = numeroPedido;
      const descItens = carrinho.map((c) => `${c.qtd}x ${c.item.nome}`);
      if (baconExtra) descItens.push('+ Bacon Extra');
      if (semCebola) descItens.push('(Sem Cebola)');

      setPedidosKds((prev) => [
        { id: novoNum, cliente: `MiseOn Kiosk #${novoNum}`, itens: descItens, status: 'recebido', tempo: '00:01' },
        ...prev,
      ]);
    }, 1500);
  };

  const reiniciarSimulacao = () => {
    setEtapa('inicio');
    setCarrinho([]);
    setBaconExtra(false);
    setSemCebola(false);
    setNumeroPedido((n) => n + 1);
  };

  return (
    <div className="w-full">
      {/* Header explicativo do simulador */}
      {!isEmbedded && (
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FC5B24]/40 bg-[#FC5B24]/10 px-4 py-1.5 text-xs font-bold text-[#FC5B24] mb-2">
            <Touchpad size={16} /> SIMULADOR INTERATIVO MISEON KIOSK
          </div>
          <h2 className="font-['Sora'] text-2xl sm:text-4xl font-bold text-white">
            {tDynamic('Experimente o autoatendimento na prática')}
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            {tDynamic('Faça um pedido no totem virtual à esquerda e veja a comanda cair instantaneamente no KDS da cozinha à direita.')}
          </p>
        </div>
      )}

      {/* Grid Principal do Simulador: Totem + KDS Live */}
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        
        {/* COLUNA 1: Totem Virtual (6 Cols no Desktop) */}
        <div className="lg:col-span-6 flex justify-center">
          {/* Frame Físico do Totem Bravus */}
          <div className="relative w-full max-w-sm rounded-[40px] border-[10px] border-slate-200 bg-[#070C18] p-3 shadow-2xl shadow-black/80 dark:border-slate-800">
            
            {/* Top Bar com Câmeras/Sensores & Logo Bravus */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">BRAVUS KIOSK 21.5"</span>
              </div>
              <span className="text-[10px] font-extrabold text-[#FC5B24]">MISEON OS</span>
            </div>

            {/* Tela do Totem (Proporção 16:9 vertical) */}
            <div className="relative min-h-[500px] sm:min-h-[540px] rounded-3xl bg-[#0B1120] overflow-hidden flex flex-col justify-between p-4 border border-gray-800">
              
              {/* ETAPA 1: TELA DE INÍCIO */}
              {etapa === 'inicio' && (
                <div className="flex flex-col items-center justify-center flex-1 text-center py-10 animate-in fade-in duration-300">
                  <div className="w-20 h-20 rounded-full bg-[#FC5B24]/20 flex items-center justify-center text-[#FC5B24] mb-4 animate-bounce">
                    <Utensils size={36} />
                  </div>
                  <h3 className="font-['Sora'] text-2xl font-black text-white">{tDynamic('Toque para pedir')}</h3>
                  <p className="mt-2 text-xs text-gray-400 px-6">
                    {tDynamic('Faça seu pedido com rapidez, personalize seus adicionais e pague na hora.')}
                  </p>

                  <button
                    onClick={() => {
                      setEtapa('cardapio');
                      adicionarAoCarrinho(MENU_MOCK[0]);
                    }}
                    className="mt-8 rounded-full bg-[#FC5B24] px-8 py-3.5 font-['Sora'] text-sm font-bold text-white shadow-lg shadow-[#FC5B24]/40 hover:scale-105 transition"
                  >
                    Iniciar Pedido →
                  </button>
                </div>
              )}

              {/* ETAPA 2: CARDÁPIO & SELEÇÃO DE PRODUTO */}
              {etapa === 'cardapio' && (
                <div className="flex flex-col flex-1 justify-between animate-in fade-in duration-200">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Cardápio Kiosk</span>
                      <span className="text-xs text-[#FC5B24] font-semibold">{carrinho.length} itens no carrinho</span>
                    </div>

                    {/* Lista de itens do mock */}
                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {MENU_MOCK.map((m) => {
                        const noCarrinho = carrinho.some((c) => c.item.id === m.id);
                        return (
                          <div
                            key={m.id}
                            className={`flex items-center gap-3 p-2.5 rounded-2xl border transition ${
                              noCarrinho
                                ? 'border-[#FC5B24] bg-[#FC5B24]/10'
                                : 'border-gray-800 bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <img src={m.imagem} alt={m.nome} className="w-14 h-14 rounded-xl object-cover" />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-bold text-white truncate">{m.nome}</h4>
                              <p className="text-[10px] text-gray-400 truncate">{m.descricao}</p>
                              <span className="text-xs font-extrabold text-emerald-400">
                                R$ {m.preco.toFixed(2).replace('.', ',')}
                              </span>
                            </div>
                            <button
                              onClick={() => adicionarAoCarrinho(m)}
                              className="rounded-full bg-[#FC5B24] p-1.5 text-white hover:scale-110 transition shrink-0"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Adicionais opcionais */}
                    <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/10">
                      <span className="text-[11px] font-bold text-gray-300 block mb-2">Personalizar X-Burger:</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setBaconExtra(!baconExtra)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition ${
                            baconExtra
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                              : 'border-gray-700 text-gray-400'
                          }`}
                        >
                          + Bacon Extra (+R$ 4,50)
                        </button>
                        <button
                          onClick={() => setSemCebola(!semCebola)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition ${
                            semCebola
                              ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                              : 'border-gray-700 text-gray-400'
                          }`}
                        >
                          Sem Cebola
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Barra Inferior com Total e Botão */}
                  <div className="pt-3 border-t border-gray-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 block">{tDynamic('Total do Pedido')}</span>
                      <span className="text-base font-extrabold text-white">
                        R$ {totalCarrinho.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <button
                      onClick={() => setEtapa('pagamento')}
                      disabled={carrinho.length === 0}
                      className="rounded-full bg-[#FC5B24] px-5 py-2.5 font-['Sora'] text-xs font-bold text-white shadow-lg shadow-[#FC5B24]/30 hover:brightness-110 disabled:opacity-50"
                    >
                      {tDynamic('Avançar para Pagamento →')}
                    </button>
                  </div>
                </div>
              )}

              {/* ETAPA 3: SIMULAÇÃO DE PAGAMENTO */}
              {etapa === 'pagamento' && (
                <div className="flex flex-col flex-1 justify-between animate-in fade-in duration-200">
                  <div>
                    <h4 className="font-['Sora'] text-base font-bold text-white mb-1">Selecione como pagar</h4>
                    <p className="text-[11px] text-gray-400 mb-4">Total a pagar: R$ {totalCarrinho.toFixed(2).replace('.', ',')}</p>

                    {/* Tabs de Metodo */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <button
                        onClick={() => setMetodoPagamento('pix')}
                        className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                          metodoPagamento === 'pix'
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                            : 'border-gray-800 text-gray-400'
                        }`}
                      >
                        <QrCode size={20} />
                        <span className="text-xs font-bold">{tDynamic('Pix Instantâneo')}</span>
                      </button>
                      <button
                        onClick={() => setMetodoPagamento('cartao')}
                        className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                          metodoPagamento === 'cartao'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-gray-800 text-gray-400'
                        }`}
                      >
                        <CreditCard size={20} />
                        <span className="text-xs font-bold">Cartão no POS</span>
                      </button>
                    </div>

                    {/* Exibição QR Code Pix ou Pinpad */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                      {metodoPagamento === 'pix' ? (
                        <div className="flex flex-col items-center">
                          <div className="w-28 h-28 bg-white p-2 rounded-xl mb-2 flex items-center justify-center">
                            <QrCode size={96} className="text-slate-950" />
                          </div>
                          <span className="text-[11px] text-gray-300 font-semibold">
                            {tDynamic('Aponte a câmera do seu banco')}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-4">
                          <CreditCard size={40} className="text-blue-400 mb-2 animate-pulse" />
                          <span className="text-xs text-white font-bold">{tDynamic('Insira ou aproxime o cartão')}</span>
                          <span className="text-[10px] text-gray-400 mt-1">Leitor POS lateral homologado</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={finalizarPagamento}
                    disabled={processandoPagamento}
                    className="w-full rounded-full bg-emerald-500 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition"
                  >
                    {processandoPagamento ? 'Processando Pagamento...' : 'Simular Pagamento Aprovado ✓'}
                  </button>
                </div>
              )}

              {/* ETAPA 4: SUCESSO & IMPRESSÃO */}
              {etapa === 'sucesso' && (
                <div className="flex flex-col items-center justify-center flex-1 text-center py-6 animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                    <CheckCircle size={32} />
                  </div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    PAGAMENTO APROVADO
                  </span>
                  <h3 className="font-['Sora'] text-xl font-bold text-white mt-1">
                    Pedido #{numeroPedido} enviado!
                  </h3>
                  <p className="mt-1 text-[11px] text-gray-300 px-4">
                    {tDynamic('Sua senha foi impressa na impressora de 80mm do totem e enviada direto para o KDS da cozinha.')}
                  </p>

                  <div className="mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-left w-full">
                    <div className="text-[10px] text-emerald-400 font-bold uppercase mb-1">
                      {tDynamic('Status da Operação:')}
                    </div>
                    <div className="text-xs text-white font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      {tDynamic('Recebido no KDS Kanban da Cozinha!')}
                    </div>
                  </div>

                  <button
                    onClick={reiniciarSimulacao}
                    className="mt-5 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition"
                  >
                    <RotateCcw size={14} /> Testar novamente
                  </button>
                </div>
              )}
            </div>

            {/* Periféricos do Totem: Impressora 80mm + Scanner 1D/2D + POS lateral */}
            <div className="mt-3 flex items-center justify-between px-2 pt-1 border-t border-gray-800/80 text-[10px] text-gray-500">
              <span>Impressora 80mm integrada</span>
              <span>Scanner QR/1D</span>
              <span>POS Side-mount</span>
            </div>
          </div>
        </div>

        {/* COLUNA 2: Tela do KDS Kanban da Cozinha recebendo ao vivo (6 Cols no Desktop) */}
        <div className="lg:col-span-6 flex flex-col justify-between h-full bg-[#070C18] rounded-3xl p-5 sm:p-7 border border-gray-800 shadow-2xl">
          <div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-orange-500/20 p-2 text-orange-400">
                  <ChefHat size={20} />
                </div>
                <div>
                  <h4 className="font-['Sora'] text-sm font-bold text-white">{tDynamic('MiseOn KDS — Cozinha em Tempo Real')}</h4>
                  <span className="text-[11px] text-gray-400">{tDynamic('Visão da equipe de produção (Sem papel)')}</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sincronizado
              </span>
            </div>

            {/* Kanban Columns Mock */}
            <div className="grid grid-cols-3 gap-3">
              
              {/* Coluna 1: Novos / Recebidos */}
              <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
                <div className="flex justify-between items-center text-[11px] font-bold text-amber-400 mb-2">
                  <span>Novos ({pedidosKds.filter((p) => p.status === 'recebido').length})</span>
                  <Clock size={12} />
                </div>

                <div className="space-y-2">
                  {pedidosKds
                    .filter((p) => p.status === 'recebido')
                    .map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs animate-in zoom-in-95 duration-300"
                      >
                        <div className="flex justify-between font-bold text-white mb-1">
                          <span>#{p.id}</span>
                          <span className="text-[10px] text-amber-400">{p.tempo}</span>
                        </div>
                        <div className="text-[10px] font-semibold text-gray-300">{p.cliente}</div>
                        <ul className="mt-1 text-[10px] text-gray-400 space-y-0.5 border-t border-amber-500/20 pt-1">
                          {p.itens.map((it, idx) => (
                            <li key={idx}>• {it}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              </div>

              {/* Coluna 2: Em Preparo */}
              <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
                <div className="flex justify-between items-center text-[11px] font-bold text-blue-400 mb-2">
                  <span>Em Preparo</span>
                  <Utensils size={12} />
                </div>

                <div className="space-y-2">
                  {pedidosKds
                    .filter((p) => p.status === 'em_preparo')
                    .map((p) => (
                      <div key={p.id} className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs">
                        <div className="flex justify-between font-bold text-white mb-1">
                          <span>#{p.id}</span>
                          <span className="text-[10px] text-blue-400">{p.tempo}</span>
                        </div>
                        <div className="text-[10px] text-gray-300">{p.cliente}</div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Coluna 3: Pronto */}
              <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
                <div className="flex justify-between items-center text-[11px] font-bold text-emerald-400 mb-2">
                  <span>Pronto</span>
                  <Check size={12} />
                </div>

                <div className="space-y-2">
                  {pedidosKds
                    .filter((p) => p.status === 'pronto')
                    .map((p) => (
                      <div key={p.id} className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
                        <div className="flex justify-between font-bold text-white mb-1">
                          <span>#{p.id}</span>
                          <span className="text-[10px] text-emerald-400">{p.tempo}</span>
                        </div>
                        <div className="text-[10px] text-gray-300">{p.cliente}</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Banner de Conversão ao Rodapé da Demo */}
          <div className="mt-6 pt-4 border-t border-gray-800">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FC5B24]/20 to-[#E34A1B]/10 border border-[#FC5B24]/30">
              <h5 className="font-['Sora'] text-sm font-bold text-white">
                {tDynamic('Agora imagine isso acontecendo automaticamente no seu restaurante.')}
              </h5>
              <p className="mt-1 text-xs text-gray-300">
                {tDynamic('Sem filas no balcão, sem erro de anotação e com baixa automática de estoque no KDS.')}
              </p>

              <button
                onClick={() => setModalOpen(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#FC5B24] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#FC5B24]/30 hover:brightness-110 transition"
              >
                <span>{tDynamic('Quero implementar no meu negócio')}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Lead */}
      <KioskLeadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Implementar o MiseOn Kiosk na sua Operação"
        subtitle="Agende uma demonstração ao vivo e receba a proposta comercial completa (Hardware Bravus + Plataforma MiseOn)."
        origem="kiosk_simulator_cta"
      />
    </div>
  );
}
