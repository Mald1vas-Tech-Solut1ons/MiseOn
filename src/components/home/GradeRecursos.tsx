import {
  ShoppingBag, Bike, Boxes, QrCode, TrendingUp, Percent, Receipt,
  ChefHat, LayoutGrid, MessageSquare, Megaphone, Users, ShieldCheck, Store, Bot,
} from 'lucide-react';
import { RotuloSecao } from './shared';

import { useI18n } from '../../contexts/I18nContext';
const GRADE = [
  { icon: <QrCode size={20} />, titulo: 'Cardápio digital com seu link', texto: 'Sua loja no ar com sua marca, suas cores e seu endereço. QR Code para mesa e balcão.' },
  { icon: <ShoppingBag size={20} />, titulo: 'PDV frente de caixa', texto: 'Venda de balcão rápida, com abertura e fechamento de caixa, sangria e múltiplas formas de pagamento.' },
  { icon: <LayoutGrid size={20} />, titulo: 'Mesas e comandas', texto: 'Mapa de mesas em tempo real, comanda por cliente, divisão de conta e fechamento sem confusão.' },
  { icon: <ChefHat size={20} />, titulo: 'KDS para a cozinha', texto: 'Tela de produção com cronômetro, meta de preparo e ranking da equipe. Adeus, comanda de papel.' },
  { icon: <Bike size={20} />, titulo: 'Gestão de entregas', texto: 'Rotas, app do entregador e acompanhamento de status do fogão até a porta do cliente.' },
  { icon: <Store size={20} />, titulo: 'Integração iFood', texto: 'Pedidos do iFood na mesma tela dos seus, com taxa retida calculada e estoque sincronizado.' },
  { icon: <Bot size={20} />, titulo: 'IA atendente 24h', texto: 'Responde o cliente com seu cardápio e preços reais, direto do banco de dados. Humano assume quando quiser.' },
  { icon: <Receipt size={20} />, titulo: 'Nota fiscal (NFC-e)', texto: 'Emissão de cupom fiscal direto do sistema, em homologação ou produção. Sem software extra.' },
  { icon: <Boxes size={20} />, titulo: 'Estoque e compras', texto: 'Ficha técnica, baixa automática por venda, alerta de estoque mínimo e central de compras.' },
  { icon: <TrendingUp size={20} />, titulo: 'Financeiro de verdade', texto: 'DRE mensal, extrato de caixa estilo bancário e lucro real por produto — não só faturamento.' },
  { icon: <Percent size={20} />, titulo: 'Cashback e cupons', texto: 'Fidelize com cashback automático, cupons de desconto e campanhas de recuperação de clientes.' },
  { icon: <Megaphone size={20} />, titulo: 'Marketing integrado', texto: 'Promoções por dia, horário e canal. Traga de volta quem não compra há tempo.' },
  { icon: <MessageSquare size={20} />, titulo: 'Central de atendimento', texto: 'Todas as conversas dos clientes dentro do painel, com a IA ajudando nas respostas.' },
  { icon: <Users size={20} />, titulo: 'Equipe com permissões', texto: 'Admin, operador, garçom e entregador — cada um vê só o que precisa, com ações auditadas.' },
  { icon: <ShieldCheck size={20} />, titulo: 'Erros explicados em português', texto: 'Quando algo trava, o sistema diz o motivo e o que fazer — sem tecniquês e sem pânico.' },
];

export function GradeRecursos() {
  const { tDynamic } = useI18n();
  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,.08)' }} className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <RotuloSecao numero="05" texto="Sem módulo escondido" />
        <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-4xl">
          {tDynamic('Tudo isso está incluído.')} <span style={{ color: '#FC5B24' }}>{tDynamic('Nada é "plano superior".')}</span>
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GRADE.map((g) => (
            <div
              key={g.titulo}
              style={{ border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)' }}
              className="rounded-2xl p-5 transition hover:border-[rgba(252,91,36,0.35)] hover:bg-[rgba(252,91,36,0.04)]"
            >
              <div style={{ color: '#FC5B24' }} className="mb-3">{g.icon}</div>
              <p style={{ fontFamily: "'Sora', sans-serif" }} className="text-sm font-bold text-white">{g.titulo}</p>
              <p style={{ color: '#AEB9CE' }} className="mt-1.5 text-[13px] leading-relaxed">{g.texto}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
