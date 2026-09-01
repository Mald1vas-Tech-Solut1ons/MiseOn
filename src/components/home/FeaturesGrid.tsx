import { Check, MonitorSmartphone, Receipt, DollarSign, Store, Box, Boxes, Tv } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
export default function FeaturesGrid() {
  const { tDynamic } = useI18n();
  return (
    <section style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: '#0B1120' }} className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.3em', color: '#0A5CC4', textTransform: 'uppercase', marginBottom: 18 }}>
          Ecossistema All-in-One
        </div>
        <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="max-w-4xl text-3xl font-black leading-tight sm:text-5xl text-white">
          {tDynamic('A infraestrutura tecnológica que os grandes restaurantes usam.')}
        </h2>
        <p className="mt-6 text-xl text-gray-400 max-w-3xl">
          Outros sistemas vendem módulos fragmentados. O MiseOn foi desenhado desde o primeiro dia como uma suíte completa de gestão, preparada para escalar a sua marca.
        </p>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <Box size={24} className="text-orange-500" />,
              titulo: 'Salão 3D & Divisão por Assento',
              deles: 'Mesas genéricas em 2D que não identificam qual cliente pediu o quê, gerando confusão no fechamento da conta.',
              nosso: 'MiseOn: Engine 3D realista com assentos numerados, cronômetro de permanência do cliente e 3 modalidades de divisão de comanda (individual por cadeira, igualitária ou parcial).',
            },
            {
              icon: <Boxes size={24} className="text-orange-500" />,
              titulo: 'Grafo 3D PEPS & Custeio Real',
              deles: 'Estoque amador baseado em planilhas ou contagens manuais sem rastreabilidade de lotes.',
              nosso: 'MiseOn: Visualização gráfica em 3D da movimentação de lotes por PEPS, cálculo automático de rendimento e CMV exato grama por grama.',
            },
            {
              icon: <DollarSign size={24} className="text-blue-500" />,
              titulo: 'Loja Própria Premium',
              deles: 'Sistemas que cobram taxa percentual sobre o seu próprio link de vendas.',
              nosso: 'MiseOn: Cardápio digital de alta conversão, com domínio próprio e ZERO taxas por pedido.',
            },
            {
              icon: <Store size={24} className="text-blue-500" />,
              titulo: 'Integração Oficial iFood',
              deles: 'Gestores de pedidos lentos que exigem duas telas para aceitar vendas e não unificam os dados.',
              nosso: 'MiseOn: O iFood flui naturalmente no nosso sistema. Sincronização de estoque e métricas exatas de repasse em tempo real.',
            },
            {
              icon: <MonitorSmartphone size={24} className="text-blue-500" />,
              titulo: 'KDS (Monitor de Cozinha)',
              deles: 'Impressoras de papel que engasgam, perdem comandas e geram atrasos invisíveis.',
              nosso: 'MiseOn: Telas sincronizadas para a equipe de produção. Controle exato de tempo por pedido e organização absoluta no rush.',
            },
            {
              icon: <Tv size={24} className="text-orange-500" />,
              titulo: 'Painel de Senhas na TV & Menu Board 4K',
              deles: 'Atendente gritando o nome do pedido no barulho, ou um painel de senha vendido à parte, com equipamento próprio e mensalidade separada.',
              nosso: 'MiseOn: A TV do balcão chama a senha sozinha, com gongo e o nome do cliente em voz alta — e vira cardápio digital 4K com QR Code quando não há ninguém na fila. É só um link na Smart TV, sem hardware extra.',
            },
            {
              icon: <Receipt size={24} className="text-blue-500" />,
              titulo: 'NFC-e Integrada',
              deles: 'Cobrança de mensalidade extra apenas para emitir obrigações fiscais.',
              nosso: 'MiseOn: Emissor NFC-e nativo. Emita os cupons fiscais com um clique, sem sair do PDV e sem taxas escondidas.',
            },
          ].map((c, i) => (
            <div key={i} style={{ border: '1px solid rgba(255,255,255,.05)', background: '#111827' }} className="rounded-3xl p-8 relative hover:border-[rgba(10,92,196,0.3)] transition-all">
              <div className="mb-4 bg-blue-500/10 inline-block p-3 rounded-2xl">{c.icon}</div>
              <h3 style={{ fontFamily: "'Sora', sans-serif" }} className="text-xl font-bold text-white">{c.titulo}</h3>
              
              <div className="mt-6 flex flex-col gap-4">
                <div className="bg-gray-800/50 p-4 rounded-2xl border border-gray-700/50">
                  <p className="text-sm text-gray-400 leading-relaxed font-medium"><strong className="text-gray-300">O Mercado Comum:</strong> {c.deles}</p>
                </div>
                
                <div className="bg-blue-900/10 p-4 rounded-2xl border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <Check size={18} className="mt-0.5 shrink-0 text-blue-500 font-bold" />
                    <p className="text-sm text-white font-bold leading-relaxed">{c.nosso}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
