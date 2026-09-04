import { useState, useEffect } from 'react';
import {
  Maximize2, X, Sparkles, MessageCircle, ShoppingBag, Boxes,
  QrCode, HeartPulse, Wallet, ChefHat, UtensilsCrossed, BarChart3, Bike, Scale,
  ShoppingCart, Megaphone,
} from 'lucide-react';
import { useI18n } from '../../contexts/I18nContext';

interface TelaReal {
  id: string;
  titulo: string;
  subtitulo: string;
  categoria: string;
  icone: any;
  src: string;
  alt: string;
  descricao: string;
  largura: number;
  altura: number;
}

const TELAS: TelaReal[] = [
  {
    id: 'cardapio-digital',
    titulo: 'Cardápio Digital com Resumo Nutricional & Carrinho',
    subtitulo: 'Os Mais Pedidos & Autoatendimento sem Taxas',
    categoria: 'Cardápio Digital',
    icone: QrCode,
    src: '/images/telas-reais/media__1788462048036.png',
    alt: 'Cardápio digital do MiseOn com os pratos mais pedidos, calorias por item e carrinho em tempo real',
    descricao: 'Design moderno e ultra-rápido para celular ou computador. Exibe os mais pedidos, calorias por item, promoções e carrinho em tempo real.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'cardapio-alergenicos',
    titulo: 'Ficha do Prato: Calorias, Proteína & Alergênicos',
    subtitulo: 'Informação Nutricional Transparente (Anvisa)',
    categoria: 'Tabela Nutricional',
    icone: HeartPulse,
    src: '/images/telas-reais/cardapio-checkout-pix-cashback.png',
    alt: 'Modal de produto X-Bacon no MiseOn destacando calorias, proteína e aviso legal de alergênicos',
    descricao: 'Segurança total para o seu cliente: indicação clara de alergênicos (Glúten, Leite, Ovo, Soja), calorias agregadas e selos nutricionais.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'cardapio-checkout',
    titulo: 'Checkout Flexível com Cashback & Pix Direto',
    subtitulo: 'Finalização de Pedido Sem Atrito',
    categoria: 'Checkout & Cashback',
    icone: Wallet,
    src: '/images/telas-reais/media__1788462128250.png',
    alt: 'Tela de checkout do MiseOn com aplicação de cupom, desconto de cashback e pagamento Pix/Crédito',
    descricao: 'Seu cliente aplica cupons, acumula cashback automático na sua loja e paga via Pix ou cartão sem pagar comissão de marketplace.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'pdv-balcao',
    titulo: 'PDV Express de Balcão & Comandas Rápidas',
    subtitulo: 'Atendimento Rápido sem Fila',
    categoria: 'PDV Balcão',
    icone: UtensilsCrossed,
    src: '/images/telas-reais/pdv-balcao.png',
    alt: 'Interface do PDV Express Balcão do MiseOn com atalhos de salgados, busca rápida e emissão de comanda/NFC-e em 3s',
    descricao: 'Lançamento ultrarrápido por toque ou leitor de código de barras. Permite fechar a conta no balcão em 3 segundos e emitir NFC-e automática.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'kds-cozinha',
    titulo: 'Painel KDS de Cozinha por Estações Kanban',
    subtitulo: 'Produção sem Papel & Controle de Tempo',
    categoria: 'KDS Cozinha',
    icone: ChefHat,
    src: '/images/telas-reais/kds-cozinha.png',
    alt: 'Tela KDS de produção na cozinha com comandas digitais organizadas por estação Chapa, Fritadeira e Bar',
    descricao: 'Substitua impressoras e papéis engordurados por telas de produção. Mostra os itens agrupados por estação (Chapa, Fritadeira, Bar) com alertas de atraso em tempo real.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'mapa-mesas',
    titulo: 'Mapa de Mesas 3D & Comandas por Salão',
    subtitulo: 'Gestão de Mesas, Comandas e Garçons',
    categoria: 'Salão & Mesas',
    icone: Scale,
    src: '/images/telas-reais/mapa-mesas.png',
    alt: 'Visão do Mapa de Mesas 3D no MiseOn destacando mesas livres, ocupadas e comandas ativas',
    descricao: 'Visualize o salão em tempo real. O garçom lança o pedido pelo celular, abre comandas por assento e fecha a conta com divisão automática por pessoa.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'estoque-nfce',
    titulo: 'Entrada de Estoque por Cupom Fiscal (NFC-e)',
    subtitulo: 'Gestão de Suprimentos & Alerta Crítico',
    categoria: 'Estoque & NFC-e',
    icone: Boxes,
    src: '/images/telas-reais/cardapio-digital-os-mais-pedidos.png',
    alt: 'Tela de Estoque Geral do MiseOn mostrando alerta de estoque crítico e escaneamento de cupom fiscal NFC-e',
    descricao: 'Escaneie o QR Code da nota do mercado ou importe o XML do fornecedor: o estoque baixa/alimenta automaticamente por custo PEPS.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'central-compras',
    titulo: 'Central de Compras & Cotação com Fornecedores',
    subtitulo: 'Gestão Inteligente de Pedidos de Insumos',
    categoria: 'Central de Compras',
    icone: ShoppingCart,
    src: '/images/telas-reais/central-compras.png',
    alt: 'Painel da Central de Compras do MiseOn com sugestões automáticas de reposição baseadas no estoque crítico',
    descricao: 'Gerencie pedidos de compras com fornecedores, compare preços de insumos e receba sugestões automáticas de reposição antes do estoque acabar.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'fichas-tecnicas',
    titulo: 'Fichas Técnicas & Validade de Preparos Base',
    subtitulo: 'Preparo de Insumos Brutos & Molhos',
    categoria: 'Fichas Técnicas',
    icone: Sparkles,
    src: '/images/telas-reais/estoque-cupom-nfce.png',
    alt: 'Tela de Fichas Técnicas de Preparos Base e controle de receitas do MiseOn',
    descricao: 'Transforme insumos brutos em receitas base. Cada produção gera uma ordem de serviço com controle de lote e validade pós-preparo.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'dre-financeiro',
    titulo: 'DRE Gerencial de Dupla Entrada & Margem Líquida',
    subtitulo: 'Financeiro Transparente sem Planilhas',
    categoria: 'DRE Financeiro',
    icone: BarChart3,
    src: '/images/telas-reais/dre-financeiro.png',
    alt: 'Painel DRE Gerencial do MiseOn exibindo faturamento bruto, deduções de taxas, CMV real e margem líquida',
    descricao: 'Veja exatamente quanto sobrou no seu bolso. O DRE cruza vendas, custos fixos, CMV das fichas técnicas e taxas de cartões/iFood automaticamente.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'marketing',
    titulo: 'Marketing, Cupons & Disparo Automatizado',
    subtitulo: 'Fidelização & Recuperação de Clientes Inativos',
    categoria: 'Marketing & Cupons',
    icone: Megaphone,
    src: '/images/telas-reais/marketing.png',
    alt: 'Painel de Marketing e Automação de Cupons no MiseOn para atrair e fidelizar clientes',
    descricao: 'Crie campanhas de cashback, cupons promocionais com regras avançadas e automatize disparos de recuperação de clientes inativos.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'ifood-conexao',
    titulo: 'Integração iFood via API Oficial',
    subtitulo: 'Conexão, Taxas & De-Para de Produtos',
    categoria: 'Integração iFood',
    icone: ShoppingBag,
    src: '/images/telas-reais/media__1788461951505.png',
    alt: 'Painel de Integração iFood no MiseOn exibindo a aba de Conexão e Taxas do contrato',
    descricao: 'Insira o ID da sua loja no iFood e configure a taxa do contrato. O MiseOn calcula a margem líquida por pedido e traz os pedidos direto para o PDV.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'whatsapp-conectado',
    titulo: 'WhatsApp Business Cloud API (Oficial Meta)',
    subtitulo: 'Atendimento com IA & Status Conectado',
    categoria: 'WhatsApp IA',
    icone: MessageCircle,
    src: '/images/telas-reais/media__1788461951550.png',
    alt: 'Painel do WhatsApp no MiseOn exibindo o número conectado oficialmente na API Cloud da Meta',
    descricao: 'Número verificado sem risco de banimento. A IA responde dúvidas do cardápio com dados reais e silencia no instante em que o atendente assume.',
    largura: 1200,
    altura: 680,
  },
  {
    id: 'entregas-gps',
    titulo: 'Gestão de Entregas & Rota GPS Motoboy',
    subtitulo: 'Rastreamento de Entregadores & Taxa por Raio',
    categoria: 'Delivery & Rotas',
    icone: Bike,
    src: '/images/telas-reais/entregas-gps.png',
    alt: 'Painel de Gestão de Entregas do MiseOn com mapa de rotas, alocação de motoboys e taxa de entrega por raio km',
    descricao: 'Acompanhe a localização dos entregadores no mapa ao vivo. Calcule a taxa de entrega automaticamente com base na distância real da loja até o cliente.',
    largura: 1200,
    altura: 680,
  },
];

export default function ShowcaseTelasReais() {
  const { tDynamic } = useI18n();
  const [telaAtiva, setTelaAtiva] = useState<string>(TELAS[0].id);
  const [ampliada, setAmpliada] = useState<TelaReal | null>(null);

  const ativa = TELAS.find((t) => t.id === telaAtiva) || TELAS[0];

  useEffect(() => {
    if (!ampliada) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAmpliada(null); };
    const anterior = {
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
    };
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = anterior.body;
      document.documentElement.style.overflow = anterior.html;
    };
  }, [ampliada]);

  return (
    <section id="telas-reais" className="relative overflow-hidden bg-[#070C18] py-20 text-white border-b border-white/10">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
      
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-black uppercase tracking-widest text-emerald-400">
            <Sparkles size={14} /> {tDynamic('Provação Real do Produto')}
          </span>
          <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight sm:text-4xl">
            {tDynamic('Você sabe exatamente o que está levando: telas reais da sua operação.')}
          </h2>
          <p className="mt-3 text-sm text-slate-300 max-w-2xl mx-auto">
            {tDynamic('Sem ilustrações falsas. Veja exatamente como a sua cozinha, seu caixa e seu estoque vão funcionar no dia a dia:')}
          </p>
        </div>

        {/* Abas de Navegação pelas Telas Reais */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {TELAS.map((t) => {
            const selecionado = t.id === telaAtiva;
            const IconeComp = t.icone;
            return (
              <button
                key={t.id}
                onClick={() => setTelaAtiva(t.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all border ${
                  selecionado
                    ? 'border-[#FC5B24] bg-[#FC5B24]/20 text-white shadow-lg shadow-[#FC5B24]/20 scale-105'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <IconeComp size={15} className={selecionado ? 'text-orange-400' : 'text-slate-400'} />
                <span>{tDynamic(t.categoria)}</span>
              </button>
            );
          })}
        </div>

        {/* Card Principal da Tela Ativa */}
        <div className="mt-8 rounded-3xl border border-white/15 bg-white/5 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            
            {/* Informações da Tela (Esquerda) */}
            <div className="lg:col-span-5 space-y-4 text-left">
              <span className="inline-flex rounded-full bg-orange-500/20 border border-orange-500/30 px-3.5 py-1 text-xs font-extrabold text-orange-300 uppercase tracking-wider">
                {tDynamic(ativa.subtitulo)}
              </span>

              <h3 className="font-['Sora'] text-2xl font-bold text-white leading-tight">
                {tDynamic(ativa.titulo)}
              </h3>

              <p className="text-sm leading-relaxed text-slate-300">
                {tDynamic(ativa.descricao)}
              </p>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setAmpliada(ativa)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-white/20"
                >
                  <Maximize2 size={14} /> {tDynamic('Ver em Tela Cheia')}
                </button>
              </div>
            </div>

            {/* Imagem Real da Tela em Moldura SaaS Premium (Direita) */}
            <div className="lg:col-span-7">
              <div
                onClick={() => setAmpliada(ativa)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/20 bg-[#0F172A] shadow-2xl transition-all duration-300 hover:border-[#FC5B24] hover:shadow-[#FC5B24]/20 hover:shadow-2xl"
              >
                {/* Moldura de Navegador (Browser Header Frame) */}
                <div className="flex items-center justify-between border-b border-white/10 bg-[#1E293B]/80 px-4 py-2.5 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500/80" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                    <div className="h-3 w-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex items-center rounded-md bg-black/40 px-3 py-1 text-[11px] font-mono text-slate-400 border border-white/5 w-64 truncate justify-center">
                    https://app.miseon.com.br/{ativa.id}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">MiseOn App</div>
                </div>

                {/* Imagem da Tela */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/60 flex items-center justify-center p-1">
                  <img
                    src={ativa.src}
                    alt={ativa.alt}
                    width={ativa.largura}
                    height={ativa.altura}
                    className="w-full h-full object-contain transition duration-300 group-hover:scale-[1.01]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-4">
                    <span className="flex items-center gap-2 rounded-full bg-black/90 px-4 py-2 text-xs font-bold text-white border border-white/20 backdrop-blur-md">
                      <Maximize2 size={14} /> {tDynamic('Clique para ampliar em tela cheia')}
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Modal de Ampliação da Imagem */}
      {ampliada && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setAmpliada(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => setAmpliada(null)}
            className="absolute right-6 top-6 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
          >
            <X size={24} />
          </button>
          
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-full overflow-auto rounded-2xl p-2 text-center"
          >
            <img
              src={ampliada.src}
              alt={ampliada.alt}
              className="h-auto max-h-[85vh] w-auto max-w-full rounded-xl stroke-none shadow-2xl mx-auto border border-white/20"
            />
            <p className="mt-3 font-['Sora'] text-sm font-bold text-white">
              {tDynamic(ampliada.titulo)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {tDynamic('Toque fora ou aperte Esc para fechar')}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

