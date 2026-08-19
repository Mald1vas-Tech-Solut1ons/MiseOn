import { ShieldCheck, ArrowLeft, Cookie } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { PAGE_META } from '../../data/pageMeta';
import { abrirGerenciadorCookies } from '../../lib/cookieConsent';
import LanguageToggle from '../../components/LanguageToggle';
import { useI18n } from '../../contexts/I18nContext';

export default function Privacidade() {
  const { tDynamic } = useI18n();

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-[#070C18] dark:text-[#EAF1FB]">
      <SEO {...PAGE_META['/privacidade']} />
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-[var(--cor-primaria)] dark:text-gray-400"
          >
            <ArrowLeft size={16} /> {tDynamic('Voltar para a página inicial')}
          </Link>
          <LanguageToggle variant="pill" />
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900">
          <div className="bg-[var(--cor-secundaria)] px-8 py-10 text-center text-white">
            <ShieldCheck size={48} className="mx-auto mb-4 opacity-90" />
            <h1 className="font-['Sora'] text-3xl font-extrabold">{tDynamic('Política de Privacidade')}</h1>
            <p className="mt-2 text-white/80">
              {tDynamic('Conformidade com a LGPD (Lei nº 13.709/2018) · Última atualização: 22/07/2026')}
            </p>
          </div>

          <div className="space-y-8 p-8 text-gray-600 sm:p-12 dark:text-gray-300">

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">1. Controlador e Encarregado</h2>
              <p>
                O controlador dos dados pessoais tratados nesta plataforma é <strong>MiseOn</strong>,
                inscrito no CNPJ sob o nº <strong>63.310.253/0001-81</strong>, com sede em Manaus/AM, Brasil.
              </p>
              <p className="mt-3">
                Para qualquer assunto relacionado a dados pessoais — inclusive para exercer seus direitos
                como titular — fale com nosso encarregado pelo e-mail{' '}
                <a href="mailto:contato@miseon.app.br" className="font-semibold text-[var(--cor-secundaria)] hover:underline">
                  contato@miseon.app.br
                </a>.
              </p>
              <p className="mt-3">
                Em relação aos dados dos clientes finais dos restaurantes (consumidores que fazem pedidos),
                o Lojista atua como controlador e o MiseOn como operador, tratando os dados exclusivamente
                conforme as instruções do Lojista e esta Política.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">2. Dados que Coletamos</h2>

              <p className="mb-2"><strong>a) Dos Lojistas (restaurantes e seus usuários):</strong></p>
              <ul className="mb-4 list-disc space-y-1 pl-5">
                <li>Dados cadastrais: nome, e-mail, telefone/WhatsApp, CPF/CNPJ, endereço do estabelecimento;</li>
                <li>Dados financeiros: dados bancários e identificadores necessários ao split de pagamentos processado pela instituição de pagamento parceira (Efí);</li>
                <li>Dados de uso: logs de acesso, metadados de navegação e interações com a plataforma;</li>
                <li>Conteúdo operacional: cardápio, preços, fichas técnicas, estoque e configurações da loja.</li>
              </ul>

              <p className="mb-2"><strong>b) Dos clientes finais dos Lojistas (consumidores):</strong></p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Nome e telefone (WhatsApp) para identificação e autenticação do pedido;</li>
                <li>Endereço de entrega, quando o pedido é para delivery;</li>
                <li>Conteúdo das conversas realizadas no chat do cardápio digital e no WhatsApp da loja, incluindo mensagens trocadas com o atendente humano ou com a inteligência artificial;</li>
                <li>Histórico de pedidos e preferências de consumo, usado para o funcionamento do CRM do Lojista.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">3. Finalidades e Base Legal</h2>
              <p className="mb-2">Tratamos dados pessoais para as seguintes finalidades:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Execução de contrato</strong> (art. 7º, V, LGPD): viabilizar pedidos, entregas, pagamentos, cardápio digital, painel de gestão e atendimento automatizado;</li>
                <li><strong>Legítimo interesse</strong> (art. 7º, IX, LGPD): melhoria da plataforma, prevenção a fraudes, segurança da informação, métricas agregadas e anonimizadas de uso;</li>
                <li><strong>Cumprimento de obrigação legal ou regulatória</strong> (art. 7º, II, LGPD): emissão de documentos fiscais, guarda de registros exigida por lei e atendimento a autoridades competentes.</li>
              </ul>
              <p className="mt-3">
                Os dados dos clientes finais pertencem ao Lojista para o qual o pedido foi realizado.
                O MiseOn <strong>não vende</strong> dados pessoais e não compartilha a base de clientes
                de um Lojista com concorrentes.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">4. Operadores e Subprocessadores</h2>
              <p className="mb-2">
                Para operar a plataforma, compartilhamos dados com os seguintes operadores, sempre na
                medida do necessário e mediante obrigações contratuais de proteção:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Supabase</strong> — banco de dados, autenticação e armazenamento;</li>
                <li><strong>Vercel</strong> — hospedagem e entrega da aplicação web;</li>
                <li><strong>Meta Platforms</strong> — envio e recebimento de mensagens via WhatsApp Business Platform, quando o Lojista ativa a integração;</li>
                <li><strong>Groq</strong> — processamento de inteligência artificial para o atendimento automatizado (as mensagens são processadas para gerar respostas e não são usadas para treinar modelos de terceiros);</li>
                <li><strong>Efí</strong> — processamento de pagamentos Pix e cartão, com split direto para a conta do Lojista.</li>
              </ul>
              <p className="mt-3">
                Alguns desses operadores podem processar dados fora do Brasil. Nesses casos, a transferência
                internacional observa as garantias exigidas pelo art. 33 da LGPD.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">5. Retenção de Dados</h2>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Dados cadastrais e operacionais do Lojista:</strong> mantidos enquanto a conta estiver ativa e, após o encerramento, pelo prazo necessário ao cumprimento de obrigações legais e fiscais;</li>
                <li><strong>Conversas de chat e WhatsApp:</strong> retidas por até <strong>12 (doze) meses</strong>, prazo após o qual são eliminadas ou anonimizadas;</li>
                <li><strong>Logs de acesso:</strong> mantidos pelo prazo mínimo exigido pelo Marco Civil da Internet (Lei nº 12.965/2014);</li>
                <li><strong>Dados de pedidos e financeiros:</strong> mantidos pelos prazos legais de guarda fiscal e contábil.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">6. Direitos do Titular</h2>
              <p className="mb-2">
                Nos termos do art. 18 da LGPD, você pode solicitar, a qualquer tempo e de forma gratuita:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Confirmação da existência de tratamento e acesso aos seus dados;</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
                <li>Portabilidade dos dados, observados os segredos comercial e industrial;</li>
                <li>Eliminação dos dados tratados com consentimento e revogação do consentimento;</li>
                <li>Informação sobre as entidades com as quais os dados foram compartilhados.</li>
              </ul>
              <p className="mt-3">
                Para exercer seus direitos, escreva para{' '}
                <a href="mailto:contato@miseon.app.br" className="font-semibold text-[var(--cor-secundaria)] hover:underline">
                  contato@miseon.app.br
                </a>{' '}
                com o assunto "LGPD — Direitos do Titular". Responderemos nos prazos legais.
                Clientes finais de restaurantes também podem dirigir o pedido diretamente ao Lojista,
                que é o controlador dos seus dados. Você ainda pode apresentar reclamação à Autoridade
                Nacional de Proteção de Dados (ANPD).
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">7. Cookies e Tecnologias Semelhantes</h2>
              <p>
                Utilizamos cookies e armazenamento local divididos em três categorias:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li><strong>Essenciais:</strong> estritamente necessários para autenticação, sessão do carrinho e tema (sempre ativos).</li>
                <li><strong>Analíticos:</strong> utilizados para estatísticas de navegação e aperfeiçoamento contínuo da plataforma (GA4).</li>
                <li><strong>Marketing:</strong> utilizados para mensuração de anúncios e atribuição de conversões (Meta Pixel).</li>
              </ul>
              <p className="mt-3 text-sm">
                Você pode gerenciar ou alterar suas preferências de cookies a qualquer momento utilizando o botão abaixo:
              </p>
              <div className="mt-4 rounded-xl border border-gray-200/80 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <button
                  type="button"
                  onClick={abrirGerenciadorCookies}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--cor-primaria)] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:brightness-110 active:scale-95"
                >
                  <Cookie size={16} /> Gerenciar Minhas Preferências de Cookies
                </button>
              </div>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">8. Segurança</h2>
              <p>
                Adotamos medidas técnicas e organizacionais adequadas, incluindo criptografia em trânsito
                (TLS), isolamento de dados entre lojas com <em>Row Level Security</em> (RLS) no banco de
                dados, controle de acesso por perfil de usuário e armazenamento de senhas com hash seguro.
                Nenhum sistema é absolutamente inviolável; em caso de incidente de segurança relevante,
                notificaremos os titulares e a ANPD conforme exigido pela LGPD.
              </p>
            </section>

            <section>
              <h2 className="mb-3 font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">9. Alterações desta Política</h2>
              <p>
                Esta Política pode ser atualizada periodicamente para refletir melhorias na plataforma ou
                exigências legais. A versão vigente estará sempre disponível nesta página, com a data da
                última atualização no topo. Alterações relevantes serão comunicadas pelos canais de contato
                cadastrados. O uso continuado da plataforma após a atualização constitui ciência da nova versão.
              </p>
            </section>

            <div className="mt-10 rounded-xl border border-gray-100 bg-gray-50 p-6 text-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="mb-1 font-semibold text-gray-900 dark:text-white">Encarregado de Dados (DPO)</p>
              <p>
                MiseOn · CNPJ 63.310.253/0001-81 · Manaus/AM, Brasil<br />
                E-mail:{' '}
                <a href="mailto:contato@miseon.app.br" className="text-[var(--cor-secundaria)] hover:underline">
                  contato@miseon.app.br
                </a>{' '}
                · WhatsApp:{' '}
                <a href="https://wa.me/5511919889233" target="_blank" rel="noreferrer" className="text-[var(--cor-secundaria)] hover:underline">
                  (11) 91988-9233
                </a>
                <br />
                Última atualização desta Política: <strong>22/07/2026</strong>.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
