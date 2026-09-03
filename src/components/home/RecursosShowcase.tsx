import { useState } from 'react';
import { ShoppingBag, Bike, Boxes, QrCode, ChevronRight, Activity, TrendingUp, Store, Bot } from 'lucide-react';

const RECURSOS = [
  {
    id: 'kds',
    icon: <ShoppingBag size={24} />,
    titulo: 'Cardápio próprio + Cozinha (KDS)',
    texto: 'Seu cliente pede no SEU link, sem marketplace no meio. O pedido cai na tela da cozinha no mesmo segundo.',
    detalhe: 'Cada pedido feito no celular do cliente, no PDV ou vindo do iFood entra na mesma fila — cronometrado, organizado por prioridade e com aviso sonoro. Ninguém mais anota pedido em papel.',
    mockup: (
      <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-800 bg-[#070C18] p-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="text-sm font-bold text-white">Cozinha · KDS</div>
          <div className="rounded bg-green-900/30 px-2 py-1 text-xs text-green-500">2 Pedidos Novos</div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 rounded-lg border border-orange-500/30 bg-gray-900/50 p-3">
            <div className="mb-2 text-xs font-bold text-orange-500">#1042 · PREPARANDO (04:12)</div>
            <div className="text-sm text-gray-300">1x Combo Baguete 30cm</div>
            <div className="mt-1 text-xs text-gray-500">Sem cebola, molho extra</div>
          </div>
          <div className="flex-1 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <div className="mb-2 text-xs font-bold text-blue-500">#1043 · NOVO (00:45)</div>
            <div className="text-sm text-gray-300">2x Coca Cola 600ml</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'ifood',
    icon: <Store size={24} />,
    titulo: 'Integração iFood completa',
    texto: 'Pedido do iFood cai direto no seu painel, junto com os pedidos do seu site. Uma fila só, zero retrabalho.',
    detalhe: 'O sistema calcula sozinho a taxa que o iFood retém de cada pedido e te mostra o valor LÍQUIDO real. E com o de-para de produtos, o estoque baixa certinho até nas vendas do marketplace.',
    mockup: (
      <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-800 bg-[#070C18] p-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="text-sm font-bold text-white">Pedido iFood #5821</div>
          <div className="rounded bg-red-600 px-2 py-1 text-xs font-bold text-white">iFood</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-900/50 p-3">
            <div className="text-xs text-gray-500">Bruto</div>
            <div className="text-sm font-bold text-white">R$ 67,00</div>
          </div>
          <div className="rounded-lg bg-gray-900/50 p-3">
            <div className="text-xs text-gray-500">Taxa iFood</div>
            <div className="text-sm font-bold text-red-400">- R$ 18,09</div>
          </div>
          <div className="rounded-lg bg-gray-900/50 p-3">
            <div className="text-xs text-gray-500">Você recebe</div>
            <div className="text-sm font-bold text-green-400">R$ 48,91</div>
          </div>
        </div>
        <div className="rounded-lg border border-green-500/20 bg-green-900/10 p-3 text-xs text-green-400">
          ✓ Estoque baixado automaticamente via de-para de produtos
        </div>
      </div>
    ),
  },
  {
    id: 'ia',
    icon: <Bot size={24} />,
    titulo: 'IA que atende seu cliente',
    texto: 'Uma atendente virtual que lê seu cardápio em tempo real e responde o cliente com preço e disponibilidade corretos.',
    detalhe: 'Ela sabe o que está em estoque, avisa quando algo acabou, informa se a loja está aberta e chama um humano quando você quiser assumir. Sem robozinho genérico: ela fala o SEU cardápio.',
    mockup: (
      <div className="flex h-full flex-col gap-2.5 rounded-xl border border-gray-800 bg-[#070C18] p-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="text-sm font-bold text-white">Chat da loja · IA ativa</div>
          <div className="rounded bg-blue-900/40 px-2 py-1 text-xs text-blue-400">online agora</div>
        </div>
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-gray-800/70 p-3 text-xs text-gray-300">
          Oi! Quanto tá o combo de baguete? Ainda tem?
        </div>
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-600/30 p-3 text-xs text-gray-200">
          Oi, tudo bem? 😊 Tem sim! O Combo Baguete 30cm está <b>R$ 32,90</b> e temos em estoque. Quer que eu já anote o seu?
        </div>
        <div className="rounded-lg border border-green-500/20 bg-green-900/10 p-2.5 text-xs opacity-95 text-green-400">
          ✓ Resposta gerada lendo o cardápio e o estoque do banco de dados — não inventa preço.
        </div>
      </div>
    ),
  },
  {
    id: 'estoque',
    icon: <Boxes size={24} />,
    titulo: 'Estoque com Ficha Técnica',
    texto: 'Vendeu um X-Bacon? O sistema baixa o pão, a carne, o bacon e a embalagem. Sozinho.',
    detalhe: 'Você sabe o custo exato de cada produto e a margem real de cada venda — não na intuição, no centavo. E o sistema bloqueia a confirmação de pedido quando um insumo zera, avisando o que falta repor.',
    mockup: (
      <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-800 bg-[#070C18] p-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="text-sm font-bold text-white">Estoque · Insumos</div>
          <Activity size={16} className="text-gray-500" />
        </div>
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300">Pão Baguete 30cm</span>
            <span className="font-bold text-orange-500">12 unid. (Baixo)</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800"><div className="h-full w-[15%] bg-orange-500"></div></div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-gray-300">Hambúrguer 180g</span>
            <span className="font-bold text-green-500">142 unid.</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800"><div className="h-full w-[75%] bg-green-500"></div></div>
        </div>
      </div>
    ),
  },
  {
    id: 'efi',
    icon: <QrCode size={24} />,
    titulo: 'Dinheiro direto na SUA conta',
    texto: 'Pix e cartão processados pelo Efí Bank e repassados automaticamente para a sua conta. O MiseOn não toca no seu dinheiro.',
    detalhe: 'Split de pagamento nativo: o cliente paga e o valor cai na sua conta Efí — Pix na hora, cartão no prazo que você escolher. Sem comissão do MiseOn por venda, sem repasse manual, sem letra miúda.',
    mockup: (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-gray-800 bg-[#070C18] p-4">
        <TrendingUp size={32} className="mb-2 text-blue-500" />
        <div className="text-xs uppercase tracking-widest text-gray-400">Saldo Disponível</div>
        <div className="mb-4 text-3xl font-bold text-white">R$ 14.250,00</div>
        <div className="flex w-full items-center justify-between rounded-lg border border-green-500/20 bg-green-900/20 p-3">
          <span className="text-xs text-green-500">Último Pix Recebido</span>
          <span className="text-sm font-bold text-green-400">+ R$ 38,90</span>
        </div>
      </div>
    ),
  },
  {
    id: 'logistica',
    icon: <Bike size={24} />,
    titulo: 'Entregas com app do motoboy',
    texto: 'Despache com um toque e acompanhe a entrega em tempo real — sem cobrar app extra do entregador.',
    detalhe: 'Rotas organizadas por bairro, status automático para o cliente e registro de quem entregou o quê. Seu delivery próprio funcionando como os grandes — mas o cliente é seu.',
    mockup: (
      <div className="relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-gray-800 bg-[#070C18] p-4">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #0A5CC4 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
        <div className="relative z-10 mb-auto flex items-center justify-between rounded-lg border border-gray-800 bg-black/60 p-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white"><Bike size={16} /></div>
            <div>
              <div className="text-sm font-bold text-white">Motoboy Carlos</div>
              <div className="text-xs text-gray-400">A caminho · 2 min</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 rounded-lg border border-gray-800 bg-black/60 p-3 backdrop-blur-md">
          <div className="text-sm text-gray-300">Pedido #1042</div>
          <div className="truncate text-xs text-gray-500">Rua das Flores, 123 - Centro</div>
        </div>
      </div>
    ),
  },
];

export function RecursosShowcase() {
  const [activeTab, setActiveTab] = useState(RECURSOS[0].id);

  return (
    <section id="recursos" style={{ borderTop: '1px solid rgba(10,92,196,0.15)', background: 'rgba(10,92,196,0.03)' }} className="py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Um sistema só. Do pedido ao dinheiro na conta.
          </h2>
          <p style={{ color: 'rgba(234,241,251,0.5)' }} className="mt-4 text-lg">
            Você não precisa de 5 aplicativos para tocar sua loja. Precisa de um que faça tudo direito.
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex flex-col gap-3 lg:w-1/2">
            {RECURSOS.map((r) => {
              const isActive = activeTab === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setActiveTab(r.id)}
                  className={`group cursor-pointer rounded-2xl border p-6 transition-all duration-300 ${
                    isActive
                      ? 'border-[rgba(10,92,196,0.4)] bg-[rgba(10,92,196,0.1)] shadow-[0_0_30px_rgba(10,92,196,0.15)]'
                      : 'border-gray-800 bg-[#0B1120]/40 hover:border-gray-700 hover:bg-[#0B1120]/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-inner transition-all duration-300 ${
                          isActive
                            ? 'scale-110 bg-gradient-to-br from-[var(--cor-primaria)] to-[var(--cor-secundaria)] text-white'
                            : 'bg-gray-800/50 text-gray-400 group-hover:text-[var(--cor-primaria)]'
                        }`}
                      >
                        {r.icon}
                      </div>
                      <h3 style={{ fontFamily: "'Sora', sans-serif" }} className={`text-xl font-bold transition-colors ${isActive ? 'text-white' : 'text-gray-400'}`}>
                        {r.titulo}
                      </h3>
                    </div>
                    <ChevronRight size={20} className={`transition-transform duration-300 ${isActive ? 'rotate-90 text-[var(--cor-primaria)]' : 'text-gray-600'}`} />
                  </div>

                  <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isActive ? 'mt-4 max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <p style={{ color: 'rgba(234,241,251,0.65)' }} className="mb-3 text-sm font-medium leading-relaxed">
                      {r.texto}
                    </p>
                    <p className="text-sm leading-relaxed text-gray-400">
                      {r.detalhe}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:w-1/2">
            <div className="sticky top-32 flex h-[500px] flex-col overflow-hidden rounded-3xl border border-[rgba(10,92,196,0.3)] bg-[#070C18]/80 p-2 shadow-[0_0_50px_rgba(10,92,196,0.1)] backdrop-blur-xl">
              <div className="flex items-center gap-2 rounded-t-2xl border-b border-gray-800 bg-black/40 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500/80"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
                <div className="h-3 w-3 rounded-full bg-green-500/80"></div>
                <div className="ml-4 font-mono text-xs text-gray-500">miseon.com/admin</div>
              </div>
              <div className="relative flex-1 bg-black/20 p-6">
                <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-transparent to-[#070C18] opacity-50" />
                <div className="relative z-10 h-full w-full animate-in fade-in zoom-in-95 transition-all duration-500">
                  {RECURSOS.find((r) => r.id === activeTab)?.mockup}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
