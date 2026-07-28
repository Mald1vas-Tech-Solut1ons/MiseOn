import { FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';

export default function Termos() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-[#070C18] dark:text-[#EAF1FB]">
      <SEO
        title="Termos de Uso e Serviço | MiseOn"
        description="Termos de uso e serviço da plataforma MiseOn: condições de assinatura, responsabilidades do lojista e do cliente final."
        canonicalUrl="https://miseon.app.br/termos"
      />
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-[var(--cor-primaria)] dark:text-gray-400"
        >
          <ArrowLeft size={16} /> Voltar para a página inicial
        </Link>

        <div className="overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900">
          <div className="bg-[var(--cor-primaria)] px-8 py-10 text-center text-white">
            <FileText size={48} className="mx-auto mb-4 opacity-90" />
            <h1 className="font-['Sora'] text-3xl font-extrabold">Termos de Uso e Serviço</h1>
            <p className="mt-2 text-white/80">Última atualização: 22 de julho de 2026</p>
          </div>

          <div className="space-y-8 p-8 text-gray-600 sm:p-12 dark:text-gray-300">

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">1. Partes e Aceitação</h2>
              <p>
                Estes Termos de Uso e Serviço ("Termos") regulam a relação entre <strong>MiseOn</strong>,
                pessoa jurídica de direito privado, inscrita no CNPJ sob o nº <strong>63.310.253/0001-81</strong>,
                com sede em Manaus/AM, Brasil ("MiseOn", "nós"), e a pessoa física ou jurídica que se cadastra
                na plataforma ("Lojista", "você").
              </p>
              <p className="mt-3">
                Ao criar uma conta, acessar ou utilizar a plataforma MiseOn, você declara que leu, compreendeu
                e concorda integralmente com estes Termos e com a nossa{' '}
                <Link to="/privacidade" className="font-semibold text-[var(--cor-secundaria)] hover:underline">
                  Política de Privacidade
                </Link>.
                Caso não concorde com qualquer disposição, você não deverá utilizar a plataforma.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">2. Objeto do Serviço</h2>
              <p>
                O MiseOn é uma plataforma de software como serviço (SaaS) de gestão para restaurantes e
                operações de food service, que inclui, conforme o plano contratado:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Cardápio digital com link próprio e QR Code (PWA);</li>
                <li>Painel de pedidos em tempo real e PDV de balcão;</li>
                <li>Tela de produção para cozinha (KDS) e gestão de mesas;</li>
                <li>Gestão de entregas e entregadores;</li>
                <li>Controle de estoque com ficha técnica e apuração de CMV;</li>
                <li>Módulo financeiro com recebimento via Pix e cartões, processado por instituição de pagamento parceira (Efí);</li>
                <li>Atendimento automatizado via inteligência artificial no WhatsApp, por meio da WhatsApp Business Platform (Meta).</li>
              </ul>
              <p className="mt-3">
                O MiseOn é um fornecedor de tecnologia. Não somos restaurante, não produzimos nem entregamos
                alimentos, e não somos parte na relação de consumo entre o Lojista e seus clientes finais.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">3. Assinatura, Cobrança e Cancelamento</h2>
              <ul className="list-disc space-y-2 pl-5">
                <li>O acesso à plataforma é concedido mediante assinatura mensal, conforme plano escolhido no cadastro. Os valores e condições vigentes são apresentados antes da contratação.</li>
                <li>A cobrança é recorrente e antecipada. O não pagamento poderá resultar em suspensão do acesso após período de carência informado no painel.</li>
                <li>Você pode cancelar a assinatura a qualquer momento, diretamente no painel administrativo, sem multa e sem fidelidade.</li>
                <li>Não realizamos reembolso proporcional de períodos já faturados; o acesso permanece ativo até o fim do ciclo pago.</li>
                <li>Após o cancelamento, seus dados permanecem disponíveis para exportação por prazo razoável, observada a nossa Política de Privacidade.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">4. Responsabilidades do Lojista</h2>
              <p>O Lojista é o único responsável pela sua operação e pelo conteúdo que publica na plataforma, incluindo:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Manter verídicas e atualizadas as informações do cardápio, incluindo descrições, ingredientes, preços, taxas de entrega e horários de funcionamento;</li>
                <li>Honrar ofertas, cupons, promoções e políticas de entrega cadastrados na plataforma;</li>
                <li>Cumprir a legislação sanitária, fiscal, trabalhista e de defesa do consumidor aplicável à sua atividade;</li>
                <li>Não utilizar a plataforma para venda de produtos ilícitos, proibidos ou que violem direitos de terceiros;</li>
                <li>Utilizar o atendimento automatizado do WhatsApp em conformidade com as políticas da Meta e da WhatsApp Business Platform, abstendo-se de envio de spam ou mensagens não solicitadas;</li>
                <li>Assumir integral responsabilidade civil, fiscal e criminal pelos produtos vendidos e serviços prestados por meio da plataforma;</li>
                <li>Manter a confidencialidade das suas credenciais de acesso e das contas dos membros da sua equipe.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">5. Pagamentos Processados por Terceiros</h2>
              <p>
                Os pagamentos online (Pix e cartões) são processados por instituição de pagamento parceira
                (Efí), diretamente para a conta do Lojista, por meio de split de pagamento. O MiseOn não
                custodia valores de vendas. Não nos responsabilizamos por falhas de aprovação das operadoras,
                estornos, contestações (chargebacks) ou indisponibilidades da instituição de pagamento.
                Taxas de processamento do parceiro podem ser retidas na fonte, conforme condições informadas
                na contratação.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">6. Disponibilidade e Suporte</h2>
              <p>
                Empregamos esforços tecnicamente razoáveis para manter a plataforma disponível de forma
                contínua. Contudo, não garantimos operação ininterrupta ou livre de erros, podendo ocorrer
                indisponibilidades por manutenção programada, falhas de infraestrutura de terceiros
                (hospedagem, banco de dados, Meta/WhatsApp, instituição de pagamento) ou caso fortuito e
                força maior. Manutenções programadas serão, sempre que possível, comunicadas com antecedência.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">7. Propriedade Intelectual</h2>
              <p>
                A plataforma MiseOn, incluindo código-fonte, marca, logotipos, interfaces, textos e
                documentação, é de titularidade exclusiva do MiseOn e protegida pela legislação de
                propriedade intelectual. A assinatura concede apenas uma licença de uso não exclusiva,
                intransferível e revogável, vedada a reprodução, engenharia reversa ou revenda do software.
              </p>
              <p className="mt-3">
                O conteúdo cadastrado pelo Lojista (cardápio, fotos, preços, logotipo da loja) permanece de
                titularidade do Lojista, que nos concede licença limitada para exibi-lo e processá-lo
                exclusivamente na medida necessária à prestação do serviço.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">8. Limitação de Responsabilidade</h2>
              <ul className="list-disc space-y-2 pl-5">
                <li>O MiseOn não responde por lucros cessantes, perda de receita ou danos indiretos decorrentes de indisponibilidade, falha de conexão à internet do estabelecimento ou uso indevido da plataforma.</li>
                <li>As respostas geradas por inteligência artificial são baseadas nos dados cadastrados pelo próprio Lojista; informações incorretas no cadastro podem gerar respostas incorretas, sendo o Lojista responsável pela revisão do seu conteúdo.</li>
                <li>O MiseOn não é parte nem garante as transações entre Lojista e clientes finais, incluindo qualidade dos alimentos, prazos de entrega e políticas de troca ou reembolso.</li>
                <li>Em qualquer hipótese, a responsabilidade total do MiseOn fica limitada ao valor das mensalidades efetivamente pagas pelo Lojista nos 3 (três) meses anteriores ao evento danoso.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">9. Rescisão</h2>
              <p>
                Podemos suspender ou encerrar contas que violem estes Termos, a legislação aplicável ou as
                políticas de parceiros essenciais (como as políticas da WhatsApp Business Platform), mediante
                aviso e, quando cabível, oportunidade de regularização. O Lojista pode encerrar sua conta a
                qualquer momento pelo painel, conforme a cláusula 3.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">10. Disposições Gerais e Foro</h2>
              <p>
                Estes Termos são regidos pelas leis da República Federativa do Brasil. Podemos atualizá-los
                periodicamente, mediante aviso na plataforma; o uso continuado após a atualização constitui
                aceitação. Fica eleito o foro da Comarca de <strong>Manaus/AM</strong> para dirimir quaisquer
                controvérsias oriundas destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja.
              </p>
            </section>

            <div className="mt-10 rounded-xl border border-gray-100 bg-gray-50 p-6 text-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="mb-1 font-semibold text-gray-900 dark:text-white">Contato</p>
              <p>
                MiseOn · CNPJ 63.310.253/0001-81 · Manaus/AM, Brasil<br />
                Dúvidas sobre estes Termos? Escreva para{' '}
                <a href="mailto:contato@miseon.app.br" className="text-[var(--cor-secundaria)] hover:underline">
                  contato@miseon.app.br
                </a>{' '}
                ou fale conosco pelo{' '}
                <a href="https://wa.me/5511919889233" target="_blank" rel="noreferrer" className="text-[var(--cor-secundaria)] hover:underline">
                  WhatsApp
                </a>.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
