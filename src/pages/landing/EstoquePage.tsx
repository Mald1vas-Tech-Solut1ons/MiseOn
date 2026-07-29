import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes, Database, FlaskConical, Eye, ArrowRight, Sparkles,
  ShieldCheck, AlertTriangle, ChevronDown, Menu as MenuIcon, X, Wallet,
  HelpCircle, Layers, RefreshCw, BarChart3, Truck, Scissors, Scale,
  ClipboardCheck, TrendingDown
} from 'lucide-react';
import SEO from '../../components/SEO';
import FooterSEO from '../../components/FooterSEO';
import MiseOnLogo from '../../components/MiseOnLogo';

const IMG_CADASTRO = '/images/estoque/media__1784862998553.png';
const IMG_PEPS     = '/images/estoque/media__1784863023804.png';
const IMG_RECEITA  = '/images/estoque/media__1784863116232.png';
const IMG_PREPAROS = '/images/estoque/media__1784863162515.png';
const IMG_3D       = '/images/estoque/media__1784863268521.png';

// Fora do componente: as perguntas alimentam o accordion E o rich snippet do
// Google. Duas cópias da mesma pergunta acabariam divergindo na primeira edição.
const FAQS = [
  {
    p: 'Como funciona o fracionamento quando compro um fardo ou pacote?',
    r: 'No cadastro do insumo, você indica a "Unidade de Compra" (ex: Pacote) e a "Unidade de Armazenamento/Uso" (ex: Gramas). Ao digitar que 1 pacote rende 2000g, o MiseOn passa a controlar o saldo em gramas e realiza a baixa em tempo real a cada venda no cardápio ou PDV.',
  },
  {
    p: 'O que é o método PEPS e por que ele é importante?',
    r: 'PEPS significa "Primeiro que Entra, Primeiro que Sai". Ao realizar vendas ou produções, o sistema utiliza o valor de custo do lote mais antigo existente no estoque. Isso garante um DRE financeiro preciso e cálculo do CMV sem distorções de inflação.',
  },
  {
    p: 'Como funciona o controle de validade de preparos na cozinha?',
    r: 'Ao cadastrar uma Receita Base (ex: Blend de Carne ou Molho), você define a validade em horas ou dias (ex: 24h). Quando a cozinha clica em "Produzir", o lote é gerado com timestamp de validade. Se ultrapassar o prazo sem ser consumido, o sistema sinaliza como "LOTE VENCIDO" para descarte seguro.',
  },
  {
    p: 'E se o fornecedor entregar menos do que eu pedi, ou de outra marca?',
    r: 'É o caso normal, não a exceção. Na conferência do recebimento você informa o que realmente chegou: a quantidade, a unidade, a marca, o lote, a validade e o preço pago. O MiseOn marca o item como parcial ou substituído, dá entrada só do que veio e guarda a divergência no histórico daquele fornecedor. Nada é bloqueado e nada precisa ser "arredondado" para o sistema aceitar.',
  },
  {
    p: 'Comprei o alho no quilo, mas conto em cabeça e uso em dente. Como faço?',
    r: 'Você escolhe a unidade na hora de dar entrada, contar o inventário ou desmontar — o sistema converte usando a cadeia de rendimento do cadastro. Se aparecer uma unidade que ele ainda não conhece (como "cabeça"), ele pergunta uma única vez quanto ela rende e guarda essa conversão no insumo para as próximas vezes.',
  },
  {
    p: 'Compro carne e frango inteiros. Dá para saber o custo de cada corte?',
    r: 'Sim — é a função Monta & Desmonta. Você informa quanto saiu do insumo bruto e quais partes entraram, com um peso de rateio para cada uma (1 kg de filé não vale o mesmo que 1 kg de carcaça). O MiseOn retira o custo real do lote pelo PEPS e distribui entre as partes, fechando no centavo. Cada corte passa a ter custo próprio na ficha técnica.',
  },
  {
    p: 'Como o sistema sabe a hora certa de comprar?',
    r: 'A sugestão não olha só o estoque mínimo (um número digitado uma vez e esquecido). Ela lê o consumo real dos últimos 30 dias, projeta quantos dias o saldo ainda cobre e soma o prazo de entrega do fornecedor. Se o insumo acaba antes da mercadoria chegar, a tela avisa — o alerta mais útil de todos.',
  },
  {
    p: 'Como o gráfico de Observabilidade 3D auxilia a minha gestão?',
    r: 'A visualização 3D traduz dados numéricos complexos em elementos visuais interativos. Você enxerga no espaço tridimensional a proporção de capital investido em cada setor da cozinha, ajudando a identificar gargalos e excessos de compras.',
  },
];

export default function EstoquePage() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [faqAberto, setFaqAberto] = useState<number | null>(null);

  const schemaJson = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': 'MiseOn — Estoque, Compras e Desmonte com Custo Real',
      'operatingSystem': 'Web, Android, iOS, Windows, macOS',
      'applicationCategory': 'BusinessApplication',
      'offers': {
        '@type': 'Offer',
        'price': '99.90',
        'priceCurrency': 'BRL',
      },
      'description': 'Gestão de compras com fornecedor e recebimento conferido, desmonte de insumos com rateio de custo PEPS, inventário multiunidade, ficha técnica e mapa 3D do estoque para restaurantes.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': FAQS.map((f) => ({
        '@type': 'Question',
        'name': f.p,
        'acceptedAnswer': { '@type': 'Answer', 'text': f.r },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-[#070C18] font-sans text-[#EAF1FB] selection:bg-[#FC5B24] selection:text-white">
      <SEO
        title="Estoque, Compras e Desmonte de Insumos com Custo Real — MiseOn"
        description="Controle de compras com fornecedor, marca e recebimento parcial; desmonte de insumos com rateio de custo PEPS; inventário em qualquer unidade e mapa 3D do capital parado na cozinha."
        keywords="controle de compras restaurante, gestao de fornecedores food service, desmonte de insumos, rendimento de desossa, inventario de estoque restaurante, estoque 3d restaurante, ficha tecnica restaurante, custeio peps comida"
        canonicalUrl="https://miseon.app.br/gestao-de-estoque-3d"
        schemaJson={schemaJson}
      />

      {/* ══════════ 1. NAVBAR ══════════ */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070C18]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" aria-label="MiseOn - Início">
            <MiseOnLogo size={128} />
          </Link>

          <div className="hidden items-center gap-6 lg:flex text-sm font-semibold">
            <a href="#fracionamento" className="text-gray-300 hover:text-white transition">1. Insumos</a>
            <a href="#preparos" className="text-gray-300 hover:text-white transition">2. Preparos</a>
            <a href="#compras" className="text-gray-300 hover:text-white transition">3. Compras & Desmonte</a>
            <a href="#observabilidade-3d" className="text-gray-300 hover:text-white transition">4. Observabilidade 3D</a>
            <a href="#faq" className="text-gray-300 hover:text-white transition">Ajuda</a>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/acesso" className="rounded-full px-4 py-2 text-sm font-bold text-gray-200 hover:bg-white/10 transition">
              Entrar
            </Link>
            <Link
              to="/cadastre-se"
              className="rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-5 py-2.5 font-['Sora'] text-sm font-bold text-white shadow-lg shadow-[#FC5B24]/25 transition hover:scale-105"
            >
              Testar Grátis
            </Link>
          </div>

          <button
            onClick={() => setMenuAberto((a) => !a)}
            className="rounded-lg p-2 text-gray-300 hover:bg-white/10 lg:hidden"
          >
            {menuAberto ? <X size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>

        {menuAberto && (
          <div className="border-t border-white/10 bg-[#070C18]/95 px-4 pb-5 pt-3 lg:hidden">
            <div className="flex flex-col gap-2 font-semibold text-sm">
              <a href="#fracionamento" onClick={() => setMenuAberto(false)} className="py-2">1. Insumos & Fracionamento</a>
              <a href="#preparos" onClick={() => setMenuAberto(false)} className="py-2">2. Receitas & Preparos</a>
              <a href="#compras" onClick={() => setMenuAberto(false)} className="py-2">3. Compras & Desmonte</a>
              <a href="#observabilidade-3d" onClick={() => setMenuAberto(false)} className="py-2">4. Observabilidade 3D</a>
              <a href="#faq" onClick={() => setMenuAberto(false)} className="py-2">Ajuda & Dúvidas</a>
              <Link to="/cadastre-se" className="mt-2 rounded-xl bg-[var(--cor-primaria)] p-3 text-center text-white font-bold">
                Cadastrar Minha Loja
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════ 2. HERO SHOWCASE ══════════ */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#070C18] pb-20 pt-32 sm:pb-28 sm:pt-40">
        <div className="pointer-events-none absolute -top-24 right-[-8%] h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-10%] left-[-6%] h-80 w-80 rounded-full bg-[#FC5B24]/20 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-blue-300 backdrop-blur-md">
            <Boxes size={14} className="text-blue-400" />
            Engenharia de Suprimentos & Inteligência 3D
          </span>

          <h1 className="mx-auto mt-6 font-['Sora'] text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Gestão de Estoque Físico, Fichas Técnicas e{' '}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Observabilidade 3D em Tempo Real
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
            O módulo definitivo para cozinhas profissionais. Entenda como o MiseOn conecta o fracionamento de insumos brutos, a execução de ordens de serviço de preparos e o mapa gráfico tridimensional do capital investido na sua loja.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/cadastre-se"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-8 py-4 font-['Sora'] text-base font-bold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105 sm:w-auto"
            >
              Começar Agora Grátis <ArrowRight size={18} />
            </Link>
            <a
              href="#fracionamento"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-8 py-4 font-['Sora'] text-base font-bold text-white backdrop-blur-md transition hover:bg-white/15 sm:w-auto"
            >
              Ver Guia Visual <HelpCircle size={18} />
            </a>
          </div>
        </div>
      </header>

      {/* ══════════ PASSO 1: CADASTRO E FRACIONAMENTO DE INSUMOS ══════════ */}
      <section id="fracionamento" className="scroll-mt-24 py-20 border-t border-white/10 bg-[#0A101D]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-blue-400">
                <Database size={14} /> Passo 01 · Insumos & Fracionamento
              </span>
              <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold text-white sm:text-4xl">
                Compre em fardos ou pacotes.{' '}
                <span className="bg-gradient-to-r from-blue-400 to-teal-300 bg-clip-text text-transparent">
                  Use em gramas ou fatias.
                </span>
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                Chega de tentar adivinhar a margem do prato. No MiseOn você especifica exatamente a forma como compra no fornecedor e a conversão direta para o uso diário da cozinha.
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <Layers className="mt-1 text-blue-400 shrink-0" size={20} />
                  <div>
                    <h4 className="font-bold text-white text-sm">Categorias & Setores Físicos de Alocação</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Classifique insumos como <i>Ingrediente, Revenda Direta, Embalagem ou Limpeza</i> e defina onde ficam armazenados (<i>Geladeira, Freezer, Dispensa ou Armário</i>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <RefreshCw className="mt-1 text-emerald-400 shrink-0" size={20} />
                  <div>
                    <h4 className="font-bold text-white text-sm">Conversão Automática de Unidade</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Compro em <b>Pacote (pct)</b> por R$ 50,00 ➔ Rende <b>2000 Gramas (g)</b>. O sistema calcula a grama a R$ 0,025/g e faz a baixa automática em cada venda.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <AlertTriangle className="mt-1 text-amber-400 shrink-0" size={20} />
                  <div>
                    <h4 className="font-bold text-white text-sm">Custeio PEPS & Alerta de Estoque Crítico</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Método <b>PEPS (Primeiro que entra, primeiro que sai)</b> para garantir que a baixa use sempre o custo do lote mais antigo. Alerta automático de reabastecimento de risco!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Imagens do Passo 1 */}
            <div className="space-y-4">
              <div className="overflow-hidden rounded-3xl border border-white/15 bg-black/60 shadow-2xl transition hover:border-blue-500/50">
                <img src={IMG_CADASTRO} alt="Tela de Cadastro de Novo Insumo no MiseOn" className="w-full h-auto object-cover" />
                <div className="p-3.5 bg-slate-900/80 text-center text-xs font-bold text-slate-300 border-t border-white/10">
                  📸 Painel de Cadastro: Configuração de Unidade de Compra, Armazenamento e Alerta Crítico
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-white/15 bg-black/60 shadow-2xl transition hover:border-blue-500/50">
                <img src={IMG_PEPS} alt="Simulador de Custo PEPS e Lista de Insumos no MiseOn" className="w-full h-auto object-cover" />
                <div className="p-3.5 bg-slate-900/80 text-center text-xs font-bold text-slate-300 border-t border-white/10">
                  📸 Simulador de Custo PEPS e Visão Geral dos Insumos por Categoria
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ PASSO 2: RECEITAS BASE, PREPAROS E VALIDADE ══════════ */}
      <section id="preparos" className="scroll-mt-24 py-20 border-t border-white/10 bg-[#070C18]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            
            {/* Imagens do Passo 2 */}
            <div className="space-y-4 order-2 lg:order-1">
              <div className="overflow-hidden rounded-3xl border border-white/15 bg-black/60 shadow-2xl transition hover:border-orange-500/50">
                <img src={IMG_RECEITA} alt="Tela de Edição de Receita no MiseOn" className="w-full h-auto object-cover" />
                <div className="p-3.5 bg-slate-900/80 text-center text-xs font-bold text-slate-300 border-t border-white/10">
                  📸 Montagem da Ficha Técnica do Preparo com Validade Configurável (horas/dias)
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-white/15 bg-black/60 shadow-2xl transition hover:border-orange-500/50">
                <img src={IMG_PREPAROS} alt="Painel Cozinha & Preparos com Ordens de Serviço no MiseOn" className="w-full h-auto object-cover" />
                <div className="p-3.5 bg-slate-900/80 text-center text-xs font-bold text-slate-300 border-t border-white/10">
                  📸 Painel Cozinha & Preparos: Botão Produzir, Custo Unitário e Aviso de Lote Vencido
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-orange-400">
                <FlaskConical size={14} /> Passo 02 · Fichas Técnicas & Preparos
              </span>
              <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold text-white sm:text-4xl">
                Transforme insumos brutos em{' '}
                <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                  receitas base padronizadas.
                </span>
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-300">
                Hamburguerias moldam hambúrgueres (blends), pizzarias preparam molhos e massas, restaurantes preparam caldos. O MiseOn gerencia a transformação da matéria-prima em itens prontos para uso.
              </p>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <FlaskConical className="mt-1 text-orange-400 shrink-0" size={20} />
                  <div>
                    <h4 className="font-bold text-white text-sm">Ficha Técnica por Lote de Produção</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Defina quantos porções/unidades 1 lote rende (ex: <i>1800g de carne moída rende 10 hambúrgueres de 180g</i>). O sistema calcula o custo exato da porção individual!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <ShieldCheck className="mt-1 text-emerald-400 shrink-0" size={20} />
                  <div>
                    <h4 className="font-bold text-white text-sm">Controle de Validade de Lotes Produzidos</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Atribua a validade em horas ou dias (<i>24h, 2 dias, 3 dias, 5 dias</i>). Cada lote produzido ganha uma marcação temporal com alerta automático em caso de vencimento.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <Sparkles className="mt-1 text-amber-400 shrink-0" size={20} />
                  <div>
                    <h4 className="font-bold text-white text-sm">Execução de Ordens de Serviço (OS)</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Um toque no botão <b>"Produzir"</b> consome a matéria-prima bruta do estoque e incrementa imediatamente o saldo de lotes prontos na cozinha.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════ PASSO 3: COMPRAS, FORNECEDORES E DESMONTE ══════════ */}
      <section id="compras" className="scroll-mt-24 border-t border-white/10 bg-[#0A101D] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-emerald-300">
              <Truck size={14} /> Passo 03 · Compras & Fornecedores
            </span>
            <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold text-white sm:text-4xl">
              Comprou metade, de outra marca, mais caro?{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                O sistema registra o que aconteceu de verdade.
              </span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-300">
              Na vida real o fornecedor manda menos do que você pediu, troca a marca e muda o preço na
              hora da entrega. Sistema que só aceita "recebi tudo certo" obriga o lojista a mentir — e
              o custo do prato vira ficção. No MiseOn, <b className="text-white">pedido é intenção,
              recebimento é fato</b>, e a diferença entre os dois vira informação sobre o seu fornecedor.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:border-emerald-400/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">
                <ClipboardCheck size={20} />
              </div>
              <h3 className="mt-4 font-['Sora'] text-base font-bold text-white">Conferência de entrega</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                Marca, lote, validade, preço pago e nota fiscal item a item. Veio menos? Veio outro
                produto? Não veio? Tudo é registrado — e o estoque entra numa transação só, nunca pela metade.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:border-emerald-400/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-400/10 text-blue-400">
                <Scale size={20} />
              </div>
              <h3 className="mt-4 font-['Sora'] text-base font-bold text-white">Entre na unidade que quiser</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                Comprou o quilo, chegou em cabeça, usa em dente. Você digita na unidade que tem na mão e o
                sistema converte. Unidade nova? Ele pergunta o rendimento uma vez e nunca mais esquece.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:border-emerald-400/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
                <TrendingDown size={20} />
              </div>
              <h3 className="mt-4 font-['Sora'] text-base font-bold text-white">Lista que pensa</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                A sugestão lê o giro real dos últimos 30 dias e soma o prazo de entrega do fornecedor.
                Se o item acaba antes da mercadoria chegar, a tela avisa antes de você descobrir na panela.
              </p>
            </div>
          </div>

          {/* Desmonte — o argumento que nenhum concorrente tem */}
          <div className="mt-8 overflow-hidden rounded-3xl border border-orange-500/25 bg-gradient-to-br from-[#160D06] via-[#0F1524] to-[#0A101D]">
            <div className="grid gap-8 p-8 lg:grid-cols-2 lg:items-center lg:p-10">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-orange-400">
                  <Scissors size={14} /> Exclusivo · Monta & Desmonta
                </span>
                <h3 className="mt-4 font-['Sora'] text-2xl font-extrabold text-white sm:text-3xl">
                  Quem compra o frango inteiro precisa saber quanto custa o peito.
                </h3>
                <p className="mt-4 text-base leading-relaxed text-slate-300">
                  Desossar, filetar, fatiar: um insumo vira vários, cada um com preço, ficha e giro
                  próprios. O MiseOn puxa o custo do lote real pelo PEPS e distribui entre as partes
                  com o peso que cada uma merece — <b className="text-white">sem um centavo se perder
                  no caminho</b>. É a conta que a maioria dos restaurantes faz de cabeça, e erra.
                </p>
                <p className="mt-4 text-sm text-slate-400">
                  Também vale ao contrário: junte insumos e monte cestas, kits e combos com o custo somado.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 font-mono text-sm">
                <p className="text-xs uppercase tracking-widest text-slate-500">Exemplo real</p>
                <div className="mt-4 flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-slate-300">5 kg de frango inteiro</span>
                  <span className="font-bold text-white">R$ 50,00</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-orange-400">
                  <Scissors size={13} /> desmonta em
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2">
                    <span className="text-slate-200">3 kg de peito</span>
                    <span className="font-bold text-emerald-400">R$ 14,81/kg</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-blue-500/10 px-3 py-2">
                    <span className="text-slate-200">2 kg de carcaça</span>
                    <span className="font-bold text-blue-400">R$ 2,78/kg</span>
                  </div>
                </div>
                <p className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">
                  R$ 44,44 + R$ 5,56 = <b className="text-white">R$ 50,00</b>. Fecha no centavo, sempre.
                </p>
              </div>
            </div>
          </div>

          {/* Inventário */}
          <div className="mt-5 flex flex-col gap-4 rounded-3xl border border-purple-400/20 bg-purple-400/5 p-6 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-400/10 text-purple-300">
              <RefreshCw size={22} />
            </div>
            <div>
              <h3 className="font-['Sora'] text-base font-bold text-white">
                Inventário do jeito que a contagem acontece
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                Ninguém conta 540 dentes de alho — conta 3 cabeças. Você conta na unidade que estiver na
                prateleira e o sistema converte. O que sobrou entra com custo; o que sumiu vira perda
                precificada em reais, não um susto.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ PASSO 4: OBSERVABILIDADE 3D E RASTREABILIDADE ══════════ */}
      <section id="observabilidade-3d" className="scroll-mt-24 py-20 border-t border-white/10 bg-[#0A101D]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-400/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-purple-300">
              <Eye size={14} /> Passo 04 · Inovação Exclusiva MiseOn
            </span>
            <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
              Observabilidade 3D de Estoque Físico &{' '}
              <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-blue-400 bg-clip-text text-transparent">
                Rastreabilidade de Lotes
              </span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Enxergue seu estoque como ele é no mundo real. Uma representação gráfica tridimensional que mapeia volumes, custos e esteiras de conversão dos insumos no espaço físico da sua cozinha.
            </p>
          </div>

          {/* Imagem do 3D em Destaque */}
          <div className="mt-12 overflow-hidden rounded-3xl border border-purple-500/30 bg-black/80 shadow-2xl backdrop-blur-xl">
            <img src={IMG_3D} alt="Painel de Observabilidade 3D de Estoque Físico do MiseOn" className="w-full h-auto object-cover" />
            <div className="p-4 bg-slate-900/90 text-center text-xs font-bold text-purple-300 border-t border-white/10">
              📸 Mapeamento Tridimensional em Tempo Real: Esferas gráficas interativas representando lotes físicos, custos e alocação de caixa
            </div>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Wallet size={18} />
                <span>Capital Investido</span>
              </div>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Mapeamento financeiro automático: saiba exatamente o valor em Reais (R$) imobilizado em estoques ativos nas prateleiras.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                <Boxes size={18} />
                <span>Lotes Mapeados</span>
              </div>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Controle de lotes ativos divididos por esteira (<i>Ingredientes, Revenda Direta, Limpeza</i>).
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <BarChart3 size={18} />
                <span>Maior Custo Unitário</span>
              </div>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Identificação instantânea dos itens de maior impacto financeiro por unidade comprada para tomada de decisão em compras.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Layers size={18} />
                <span>Maior Alocação</span>
              </div>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                Sinalização dos insumos que concentram a maior fatia do capital da empresa no momento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FAQ ACCORDION DE ESTOQUE ══════════ */}
      <section id="faq" className="scroll-mt-24 py-20 border-t border-white/10 bg-[#070C18]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">Guia de Ajuda & FAQ</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold text-white">
              Dúvidas Frequentes sobre a Engenharia de Estoque
            </h2>
          </div>

          <div className="mt-10 space-y-4">
            {FAQS.map((faq, idx) => {
              const aberto = faqAberto === idx;
              return (
                <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                  <button
                    onClick={() => setFaqAberto(aberto ? null : idx)}
                    className="flex w-full items-center justify-between p-5 text-left font-['Sora'] font-bold text-white"
                  >
                    <span>{faq.p}</span>
                    <ChevronDown size={18} className={`transition-transform duration-300 ${aberto ? 'rotate-180 text-[var(--cor-primaria)]' : ''}`} />
                  </button>
                  {aberto && (
                    <p className="border-t border-white/10 p-5 text-sm leading-relaxed text-slate-300">
                      {faq.r}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ CTA FINAL ══════════ */}
      <section className="bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] py-16 text-white text-center">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="font-['Sora'] text-3xl font-extrabold sm:text-4xl">
            Sua cozinha com estoque profissional, Fichas Técnicas e 3D
          </h2>
          <p className="mt-4 text-base text-orange-100">
            Experimente a plataforma de gestão de suprimentos mais avançada do mercado.
          </p>
          <Link
            to="/cadastre-se"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-['Sora'] text-base font-bold text-gray-900 shadow-2xl transition hover:scale-105"
          >
            Cadastrar Minha Loja Gratuitamente <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <FooterSEO />
    </div>
  );
}
