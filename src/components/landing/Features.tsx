import {
  QrCode, Zap, CreditCard, Timer, Store, Map as MapIcon, Bike, Boxes,
  ClipboardList, ShoppingCart, Gift, TrendingUp, Truck, Scissors,
} from 'lucide-react';

const FEATURES = [
  { icon: <QrCode size={20} />, titulo: 'Cardápio digital white-label', texto: 'Seu link, seu visual, sua marca. O cliente pede do celular sem instalar nada.' },
  { icon: <Zap size={20} />, titulo: 'Pedidos em tempo real', texto: 'Do cliente ao painel em segundos, sem impressora e sem retranscrever comanda.' },
  { icon: <CreditCard size={20} />, titulo: 'Pix e cartão via Efí', texto: 'Split de pagamento: o dinheiro cai direto na conta da sua loja, não na nossa.' },
  { icon: <Timer size={20} />, titulo: 'KDS com cronômetros', texto: 'Cada pedido cronometrado e ordenado por prioridade na tela da cozinha.' },
  { icon: <Store size={20} />, titulo: 'PDV de balcão', texto: 'Venda presencial rápida, integrada ao mesmo estoque e ao mesmo caixa.' },
  { icon: <MapIcon size={20} />, titulo: 'Mapa de mesas', texto: 'Salão visual: mesa livre, ocupada ou fechando conta num relance.' },
  { icon: <Bike size={20} />, titulo: 'Entrega com rota ao vivo', texto: 'Despache para o motoboy com um clique e acompanhe a rota em tempo real.' },
  { icon: <Boxes size={20} />, titulo: 'Estoque com ficha técnica', texto: 'Vendeu um combo? Baixa automática do pão, da carne e da embalagem.' },
  { icon: <ClipboardList size={20} />, titulo: 'Produção com lotes e validade', texto: 'Preparos organizados por lote, com validade e rendimento controlados.' },
  { icon: <ShoppingCart size={20} />, titulo: 'Compras que pensam', texto: 'A lista sai do giro real dos últimos 30 dias e do prazo do seu fornecedor.' },
  { icon: <Truck size={20} />, titulo: 'Recebimento conferido', texto: 'Veio menos, de outra marca, mais caro? Registra o que chegou de verdade.' },
  { icon: <Scissors size={20} />, titulo: 'Desmonte com rateio de custo', texto: 'Frango inteiro vira peito e carcaça — cada corte com o seu custo real.' },
  { icon: <Gift size={20} />, titulo: 'Cupons, cashback e carrinho', texto: 'Fidelize com cashback e recupere automaticamente carrinhos abandonados.' },
  { icon: <TrendingUp size={20} />, titulo: 'Financeiro com gráficos', texto: 'Faturamento, custo e lucro por período — com a equipe em papéis definidos.' },
];

export function Features() {
  return (
    <section style={{ borderTop: '1px solid rgba(10,92,196,0.15)' }} className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#FC5B24', textTransform: 'uppercase', marginBottom: 14 }}>
            Plataforma
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Tudo que a sua operação precisa, num login só
          </h2>
          <p style={{ color: 'rgba(234,241,251,0.55)' }} className="mx-auto mt-4 max-w-2xl text-base">
            E ainda é um PWA instalável: vira app no celular da equipe sem passar por loja de aplicativo.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.titulo}
              className="group rounded-2xl border border-gray-800 bg-[#0B1120]/50 p-6 transition-all hover:border-[rgba(10,92,196,0.45)] hover:bg-[#0B1120]/90"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(10,92,196,0.12)] text-[#6B9EFF] transition-colors group-hover:bg-[rgba(252,91,36,0.12)] group-hover:text-[#FC5B24]">
                {f.icon}
              </div>
              <h3 style={{ fontFamily: "'Sora', sans-serif" }} className="mt-4 text-base font-bold text-white">
                {f.titulo}
              </h3>
              <p style={{ color: 'rgba(234,241,251,0.55)' }} className="mt-1.5 text-sm leading-relaxed">
                {f.texto}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
