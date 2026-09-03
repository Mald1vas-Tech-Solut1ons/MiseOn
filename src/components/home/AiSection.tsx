import { Bot, Database, Clock, UserCheck, ShieldCheck } from 'lucide-react';
import { RotuloSecao } from './shared';

import { useI18n } from '../../contexts/I18nContext';
const PILARES_IA = [
  {
    icon: <Database size={18} />,
    titulo: 'Ela lê o seu banco de dados',
    texto: 'Antes de responder, a IA consulta seu cardápio real: nome, preço e disponibilidade de cada item, na hora. Se esgotou, ela avisa — não promete o que você não tem.',
  },
  {
    icon: <Clock size={18} />,
    titulo: 'Sabe quando a loja está aberta',
    texto: 'Cruza a mensagem do cliente com seus horários de funcionamento. Loja fechada? Ela informa educadamente em vez de deixar o cliente no vácuo.',
  },
  {
    icon: <UserCheck size={18} />,
    titulo: 'Humano assume quando quiser',
    texto: 'Um toque e você (ou sua equipe) entra na conversa. A IA silencia na hora e devolve o atendimento — sem brigar com o cliente nem com você.',
  },
  {
    icon: <ShieldCheck size={18} />,
    titulo: 'Não inventa preço',
    texto: 'Configurada para precisão, não para criatividade: ela só fala valores que estão cadastrados. Preço errado para cliente é quebra de confiança — e a gente leva isso a sério.',
  },
];

export function AiSection() {
  const { tDynamic } = useI18n();
  return (
    <section id="ia" style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: 'linear-gradient(180deg, rgba(10,92,196,0.06), rgba(7,12,24,0))' }} className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <RotuloSecao numero="03" texto="Inteligência artificial de verdade" />
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <h2 style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold leading-tight sm:text-4xl">
              {tDynamic('Uma atendente que')} <span style={{ color: '#FC5B24' }}>conhece seu cardápio</span> melhor que estagiário.
            </h2>
            <p style={{ color: '#AEB9CE' }} className="mt-5 max-w-xl text-base leading-relaxed">
              Todo sistema diz que "tem IA". A nossa você consegue testar: ela responde o cliente no chat
              da sua loja citando <b style={{ color: '#EAF1FB' }}>seus produtos, seus preços e seu estoque</b> —
              lidos do banco de dados em tempo real, não de um texto decorado.
            </p>
            <p style={{ color: '#AEB9CE' }} className="mt-4 max-w-xl text-base leading-relaxed">
              É o fim do "já te respondo": enquanto você produz, ela atende, recomenda o que tem em
              estoque e direciona o cliente para fechar o pedido no seu link.
            </p>

            <div className="mt-8 space-y-4">
              {PILARES_IA.map((p) => (
                <div key={p.titulo} className="flex items-start gap-4">
                  <div style={{ background: 'rgba(252,91,36,0.1)', color: '#FC5B24', border: '1px solid rgba(252,91,36,0.3)' }} className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    {p.icon}
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Sora', sans-serif", color: '#EAF1FB' }} className="font-bold">{p.titulo}</p>
                    <p style={{ color: '#AEB9CE' }} className="mt-1 text-sm leading-relaxed">{p.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mockup de conversa real */}
          <div style={{ border: '1px solid rgba(255,255,255,.09)', background: '#0B1120', borderRadius: 24 }} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gray-800 bg-black/40 px-5 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#FC5B24] to-[#0A5CC4] text-white">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{tDynamic('Atendente IA · Lanche da Praça')}</p>
                <p className="flex items-center gap-1.5 text-xs opacity-95 text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> respondendo em segundos
                </p>
              </div>
            </div>
            <div className="space-y-3 p-5">
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-gray-800/70 p-3 text-[13px] text-gray-300">
                boa noite, quanto ta o x-bacon duplo? e o milk shake ainda tem?
              </div>
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-blue-600/25 p-3 text-[13px] leading-relaxed text-gray-200">
                {tDynamic('Boa noite! 😊 O X-Bacon Duplo está')} <b>R$ 29,90</b>. O Milk Shake de Chocolate <b>acabou hoje</b>,
                mas temos o de Morango e Ovomaltine por <b>R$ 14,90</b>. Quer aproveitar e já montar seu pedido?
              </div>
              <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-gray-800/70 p-3 text-[13px] text-gray-300">
                pode ser o x-bacon e o de ovomaltine entao
              </div>
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-blue-600/25 p-3 text-[13px] leading-relaxed text-gray-200">
                Perfeito! Fica <b>R$ 44,80</b>. É pra entrega ou retirada? Se quiser, já te mando o link pra finalizar com Pix. 🚀
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs opacity-95 leading-relaxed text-gray-500">
                Tudo o que a IA disse acima veio do cadastro real da loja: preço do X-Bacon, milk shake de
                chocolate esgotado no estoque e sabores disponíveis. Se você mudar o preço agora, a próxima
                resposta já usa o valor novo.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
