import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  LifeBuoy, ChevronDown, Landmark, QrCode, CreditCard, Check,
  ExternalLink, MessageCircle, ShieldCheck, Wallet, HelpCircle, ClipboardList,
  Settings, BarChart3, Users, PhoneCall, PlayCircle, MonitorSmartphone, LayoutDashboard, Mail,
  Compass, Sparkles, ArrowRight
} from 'lucide-react';
import { EFI_TARIFAS, EFI_LINKS } from '../../lib/efiInfo';

import { useI18n } from '../../contexts/I18nContext';
import { HorizontalScrollContainer } from '../../components/ui';
const WHATSAPP_SUPORTE = '5511919889233';
const zapSuporte = (msg: string) => `https://wa.me/${WHATSAPP_SUPORTE}?text=${encodeURIComponent(msg)}`;

/* ── Bloco expansível (acordeão) ── */
function Expansivel({ titulo, icone, aberto_inicial = false, children }: {
  titulo: string; icone?: ReactNode; aberto_inicial?: boolean; children: ReactNode;
}) {
  const [aberto, setAberto] = useState(aberto_inicial);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-sm transition-all hover:shadow-md">
      <button onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-gray-50 dark:hover:bg-white/5">
        <span className="flex items-center gap-2.5 text-sm font-bold dark:text-gray-100">
          {icone}{titulo}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className="border-t border-gray-100 px-4 py-4 text-sm leading-relaxed text-gray-600 dark:border-gray-800 dark:text-gray-300">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Passo numerado do guia ── */
function Passo({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 shadow-sm">
      <div className="absolute -left-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--cor-primaria)] font-black text-white shadow-md">{n}</div>
      <h4 className="mb-2 pl-3 text-sm font-black dark:text-gray-100">{titulo}</h4>
      <div className="space-y-2 pl-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{children}</div>
    </div>
  );
}

export default function Ajuda() {
  const { tDynamic } = useI18n();
  const [tabAtiva, setTabAtiva] = useState<'sistema' | 'integracoes' | 'financeiro' | 'indicadores' | 'especialista'>('sistema');

  const dispararTour = () => {
    window.dispatchEvent(new CustomEvent('iniciar-guided-tour'));
  };

  return (
    <div className="mx-auto max-w-4xl p-4 pb-16">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-[var(--cor-primaria)]/10 p-3 text-[var(--cor-primaria)] shadow-inner">
            <LifeBuoy size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight dark:text-gray-100">{tDynamic('Central de Ajuda')}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{tDynamic('Tudo explicado sem tecniquês para você dominar o MiseOn.')}</p>
          </div>
        </div>
        <a href={zapSuporte('Olá! Preciso de uma ajuda com o sistema.')} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-2 text-sm font-bold text-green-600 transition hover:bg-green-500/20 dark:text-green-400">
          <MessageCircle size={16} /> {tDynamic('Suporte Rápido')}
        </a>
      </div>

      {/* ── BANNER HERO: TOUR COMPLETO DO SISTEMA (20 PASSOS) ── */}
      <div className="mb-8 overflow-hidden rounded-3xl border-2 border-orange-500/50 bg-gradient-to-r from-gray-900 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl relative">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 border border-orange-500/40 px-3 py-1 text-xs font-black uppercase tracking-wider text-orange-400">
              <Sparkles size={14} /> {tDynamic('Treinamento Interativo Completo')}
            </span>
            <h3 className="font-['Sora'] text-xl sm:text-2xl font-black leading-snug">
              🚀 {tDynamic('Tour Completo do Sistema (20 Passos)')}
            </h3>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              {tDynamic('Percorra todos os módulos do MiseOn de ponta a ponta: do recebimento de pedidos no Balcão, baixa de estoque, Custo 3D, Salão 3D, KDS até a conciliação Efí Bank.')}
            </p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('iniciar-guided-tour-completo'))}
            className="shrink-0 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-6 py-3.5 text-sm sm:text-base font-black text-white shadow-[0_0_25px_rgba(249,115,22,0.5)] hover:scale-105 transition-all"
          >
            <Compass size={20} />
            <span>{tDynamic('Iniciar Tour Completo (20 Passos)')}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <HorizontalScrollContainer className="mb-8 rounded-2xl bg-white p-1.5 shadow-sm dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
        <button onClick={() => setTabAtiva('sistema')}
          className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
            tabAtiva === 'sistema' ? 'bg-[var(--cor-primaria)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}>
          <Settings size={18} /> {tDynamic('Como Funciona')}
        </button>
        <button onClick={() => setTabAtiva('integracoes')}
          className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
            tabAtiva === 'integracoes' ? 'bg-[var(--cor-primaria)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}>
          <MessageCircle size={18} /> {tDynamic('Integrações')}
        </button>
        <button onClick={() => setTabAtiva('financeiro')}
          className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
            tabAtiva === 'financeiro' ? 'bg-[var(--cor-primaria)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}>
          <Wallet size={18} /> {tDynamic('Pagamentos Efí')}
        </button>
        <button onClick={() => setTabAtiva('indicadores')}
          className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
            tabAtiva === 'indicadores' ? 'bg-[var(--cor-primaria)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}>
          <BarChart3 size={18} /> {tDynamic('Indicadores')}
        </button>
        <button onClick={() => setTabAtiva('especialista')}
          className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
            tabAtiva === 'especialista' ? 'bg-[var(--cor-primaria)] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}>
          <Users size={18} /> {tDynamic('Especialista')}
        </button>
      </HorizontalScrollContainer>

      {/* ── TAB: SISTEMA ── */}
      {tabAtiva === 'sistema' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* BANNER HERO: TOUR GUIADO INTERATIVO */}
          <div className="relative mb-8 overflow-hidden rounded-3xl border border-orange-500/30 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 shadow-xl text-white sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-500/20 blur-3xl" />
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-orange-500/30 bg-orange-500/20 p-3.5 text-orange-400 backdrop-blur-md shrink-0">
                  <Compass size={32} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-orange-500/20 border border-orange-500/30 px-2.5 py-0.5 text-xs opacity-90 font-extrabold uppercase tracking-wider text-orange-400">
                      {tDynamic('Novo Recurso Interativo')}
                    </span>
                  </div>
                  <h3 className="text-xl font-black tracking-tight text-white">{tDynamic('Tour Guiado Completo pelo Sistema')}</h3>
                  <p className="mt-1 text-sm text-slate-300 leading-relaxed max-w-xl">
                    {tDynamic('Aprenda na prática! O assistente conduz você pelas telas de')} <b>{tDynamic('Pedidos')}</b>, <b>{tDynamic('Estoque (Insumos, Receitas e 3D)')}</b>, <b>{tDynamic('KDS Cozinha')}</b>, <b>{tDynamic('iFood')}</b> {tDynamic('e')} <b>{tDynamic('WhatsApp IA')}</b> {tDynamic('iluminando exatamente o que você precisa clicar.')}
                  </p>
                </div>
              </div>

              <button
                onClick={dispararTour}
                className="shrink-0 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all"
              >
                <Sparkles size={18} /> {tDynamic('Iniciar Tour Guiado')} <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="mb-8 rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-50 to-indigo-50/30 p-6 dark:border-blue-900/30 dark:from-blue-900/10 dark:to-indigo-900/10">
             <div className="flex items-start gap-4">
               <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
                  <PlayCircle size={24} className="text-blue-600 dark:text-blue-400" />
               </div>
               <div>
                  <h3 className="mb-2 text-lg font-black text-blue-900 dark:text-blue-100">{tDynamic('Bem-vindo ao MiseOn!')}</h3>
                  <p className="text-sm leading-relaxed text-blue-800/80 dark:text-blue-200/80">
                    {tDynamic('O sistema foi desenhado para ser rápido e à prova de falhas. Aqui você entende a lógica por trás de cada tela e como aproveitar ao máximo a operação do seu restaurante.')}
                  </p>
               </div>
             </div>
          </div>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <ClipboardList size={18} className="text-[var(--cor-primaria)]" /> {tDynamic('O caminho de um pedido (e por que ele existe)')}
          </h3>
          <div className="space-y-3 mb-10">
            <Expansivel titulo={tDynamic("As 5 etapas de um pedido")} icone={<MonitorSmartphone size={16} className="text-purple-500"/>} aberto_inicial>
              <p>{tDynamic('Todo pedido passa por uma fila organizada. Cada etapa tem um dono — assim nada se perde:')}</p>
              <ol className="list-decimal space-y-2 pl-5 mt-2">
                <li><b>{tDynamic('Novo:')}</b> {tDynamic('o pedido acabou de chegar (site, iFood ou PDV) e toca um aviso no painel;')}</li>
                <li><b>{tDynamic('Aceito:')}</b> {tDynamic('alguém do balcão confirmou o pedido —')} <b>{tDynamic('aqui o estoque é baixado automaticamente')}</b>;</li>
                <li><b>{tDynamic('Na cozinha:')}</b> {tDynamic('o pedido foi enviado para o preparo e aparece na tela')} <b>{tDynamic('Cozinha (KDS)')}</b>;</li>
                <li><b>{tDynamic('Pronto:')}</b> {tDynamic('a cozinha terminou. O pedido volta para o balcão conferir e entregar;')}</li>
                <li><b>{tDynamic('Finalizado:')}</b> {tDynamic('entregue ao cliente. A venda entra no seu Financeiro.')}</li>
              </ol>
              <div className="mt-4 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/10">
                <p className="text-xs text-purple-800 dark:text-purple-300">
                  💡 {tDynamic('O sistema')} <b>{tDynamic('bloqueia pulos de etapa')}</b> {tDynamic('de propósito: é a garantia de que nenhum pedido sai sem passar pelo preparo ou sem baixar o estoque corretamente.')}
                </p>
              </div>
            </Expansivel>
            <Expansivel titulo={tDynamic("Por que não consigo confirmar/finalizar um pedido?")}>
              <p>{tDynamic('Os motivos mais comuns — todos com solução rápida:')}</p>
              <ul className="list-disc space-y-2 pl-5 mt-2">
                <li><b>{tDynamic('Estoque insuficiente:')}</b> {tDynamic('algum ingrediente da ficha técnica está zerado. Corrija em')} <Link to="/admin/estoque" className="font-semibold text-[var(--cor-primaria)] hover:underline">{tDynamic('Estoque')}</Link> {tDynamic('e confirme de novo;')}</li>
                <li><b>{tDynamic('Falta enviar para a cozinha:')}</b> {tDynamic('pedido com itens de preparo precisa ir para a cozinha antes de ficar pronto;')}</li>
                <li><b>{tDynamic('Pedido de entrega:')}</b> {tDynamic('precisa sair para rota (tela')} <Link to="/admin/entregas" className="font-semibold text-[var(--cor-primaria)] hover:underline">{tDynamic('Entregas')}</Link>{tDynamic(') antes de finalizar.')}</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {tDynamic('Quando algo bloqueia, o aviso vermelho na tela já mostra o motivo e o botão para resolver.')}
              </p>
            </Expansivel>
            <Expansivel titulo={tDynamic("Como funciona a integração com o iFood")}>
              <p>{tDynamic('Depois de vinculada em')} <Link to="/admin/ifood" className="font-semibold text-[var(--cor-primaria)] hover:underline">{tDynamic('Integração iFood')}</Link>{tDynamic(', o processo é mágico:')}</p>
              <ol className="list-decimal space-y-1.5 pl-5 mt-2">
                <li>{tDynamic('O cliente pede no app do iFood e o pedido')} <b>{tDynamic('cai sozinho')}</b> {tDynamic('no seu Painel de Pedidos, com selo vermelho "iFood";')}</li>
                <li>{tDynamic('Você confirma e produz normalmente — o fluxo é o mesmo dos outros pedidos;')}</li>
                <li>{tDynamic('No Financeiro, a')} <b>{tDynamic('taxa do iFood já vem descontada')}</b>{tDynamic(': você vê o bruto, a taxa retida e o líquido real.')}</li>
              </ol>
              <div className="mt-3 border-l-2 border-red-500 pl-3">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{tDynamic('Para os itens baterem certinho e baixar estoque:')}</p>
                <p className="text-sm mt-1">
                  {tDynamic('Cada produto seu precisa do')} <b>{tDynamic('Código iFood (PDV)')}</b> {tDynamic('preenchido — o mesmo código que está no Portal do Parceiro. Faça isso na aba')} <b>{tDynamic('De-Para de Produtos')}</b>{tDynamic('. Itens sem código entram no pedido, mas não baixam estoque automaticamente.')}
                </p>
              </div>
            </Expansivel>
            <Expansivel titulo={tDynamic("Gestão de Estoque, Fichas Técnicas e 3D")}>
              <p>
                {tDynamic('O coração do MiseOn é a ficha técnica com rastreabilidade 3D e fracionamento automático de insumos.')}
              </p>
              <ul className="list-disc space-y-1.5 pl-5 mt-2">
                <li><b>{tDynamic('Insumos & Fracionamento:')}</b> {tDynamic('Compre em fardo/pacote e converta automaticamente para gramas, ml ou fatias;')}</li>
                <li><b>{tDynamic('Receitas & Preparos:')}</b> {tDynamic('Crie preparos intermediários (blends, molhos) com controle de tempo de validade por lote;')}</li>
                <li><b>{tDynamic('Observabilidade 3D:')}</b> {tDynamic('Visualize no gráfico 3D o capital investido e os lotes no espaço da sua cozinha.')}</li>
              </ul>
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{tDynamic('Guia Visual Completo com Imagens e Passos do Estoque 3D:')}</span>
                <Link to="/gestao-de-estoque-3d" target="_blank" className="inline-flex items-center gap-1 text-xs font-black text-[var(--cor-primaria)] hover:underline bg-[var(--cor-primaria)]/10 px-3 py-1.5 rounded-lg">
                  {tDynamic('Abrir Guia de Estoque 3D 🌐')}
                </Link>
              </div>
            </Expansivel>
          </div>
        </div>
      )}

      {/* ── TAB: INTEGRAÇÕES ── */}
      {tabAtiva === 'integracoes' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="relative mb-8 overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#052e16] p-6 shadow-xl shadow-emerald-950/40 sm:p-8">
             {/* brilhos decorativos */}
             <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
             <div className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-teal-300/10 blur-3xl" />

             <div className="relative flex items-start gap-4">
               <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
                  <MessageCircle size={26} className="text-emerald-300" />
               </div>
               <div>
                  <h3 className="mb-2 text-lg font-black text-white sm:text-xl">{tDynamic('Seu WhatsApp atendendo sozinho — de verdade')}</h3>
                  <p className="text-sm leading-relaxed text-emerald-100/85">
                    {tDynamic('A IA do MiseOn responde seus clientes no WhatsApp usando os dados')} <b className="text-white">{tDynamic('reais')}</b> {tDynamic('da sua loja — cardápio, preços, estoque e horário.')}
                    {tDynamic('Quando o cliente quer pedir, ele finaliza no seu cardápio digital e o pedido cai direto no seu painel, com selo verde.')}
                  </p>
               </div>
             </div>
             <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md transition-colors hover:bg-white/15">
                  <MessageCircle size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                  <div>
                    <p className="text-sm font-bold text-white">{tDynamic('Responde dúvidas')}</p>
                    <p className="text-xs text-emerald-100/70 mt-0.5">{tDynamic('Preço, ingredientes, taxa de entrega, horário — tudo lido do seu cadastro.')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md transition-colors hover:bg-white/15">
                  <QrCode size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                  <div>
                    <p className="text-sm font-bold text-white">{tDynamic('Manda o cardápio')}</p>
                    <p className="text-xs text-emerald-100/70 mt-0.5">{tDynamic('Na hora de pedir, o cliente recebe o link e monta o carrinho com preço real.')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-md transition-colors hover:bg-white/15">
                  <ClipboardList size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                  <div>
                    <p className="text-sm font-bold text-white">{tDynamic('Pedido no painel')}</p>
                    <p className="text-xs text-emerald-100/70 mt-0.5">{tDynamic('Cai como "Novo" com selo WhatsApp. Você aceita como qualquer pedido.')}</p>
                  </div>
                </div>
              </div>
          </div>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <MessageCircle size={18} className="text-[var(--cor-primaria)]" /> {tDynamic('WhatsApp com IA — como funciona')}
          </h3>
          <div className="space-y-3 mb-10">
            <Expansivel titulo={tDynamic("O que a IA faz (e o que ela NUNCA faz)")} aberto_inicial>
              <p><b>{tDynamic('Ela responde, você vende.')}</b> {tDynamic('A IA é uma recepcionista: tira dúvidas e apresenta o cardápio. Quem fecha o pedido é o cliente, no seu site.')}</p>
              <ul className="list-disc space-y-1.5 pl-5 mt-2">
                <li><b>{tDynamic('Responde com dados reais:')}</b> {tDynamic('preço, ingredientes, ficha técnica, taxa de entrega e horário vêm direto do seu cadastro — se está esgotado no estoque, ela avisa;')}</li>
                <li><b>{tDynamic('Nunca inventa preço nem desconto:')}</b> {tDynamic('valores só aparecem se existirem no sistema. Isso protege você de ter que honrar uma "promoção" que não existe;')}</li>
                <li><b>{tDynamic('Não fecha pedido sozinha:')}</b> {tDynamic('o cliente recebe o link do cardápio e finaliza no site. O pedido chega no painel para')} <b>{tDynamic('você aceitar')}</b>{tDynamic(', como sempre;')}</li>
                <li><b>{tDynamic('Alergia é com você:')}</b> {tDynamic('se o cliente mencionar alergia ou intolerância, a IA coloca um aviso de segurança e')} <b>{tDynamic('te chama na hora')}</b> {tDynamic('— assunto de saúde nunca é automatizado;')}</li>
                <li><b>{tDynamic('Áudio e imagem:')}</b> {tDynamic('por enquanto ela avisa que não entende e te chama para assumir.')}</li>
              </ul>
            </Expansivel>
            <Expansivel titulo={tDynamic("Você continua no controle da conversa")}>
              <p>{tDynamic('Todas as conversas — WhatsApp e chat do site — chegam na mesma caixa de entrada, em')} <b>{tDynamic('Conversas')}</b>:</p>
              <ul className="list-disc space-y-1.5 pl-5 mt-2">
                <li>{tDynamic('Cada conversa tem')} <b>{tDynamic('selo de origem')}</b> {tDynamic('(🟢 WhatsApp ou 🌐 Site), nome e telefone do cliente;')}</li>
                <li><b>{tDynamic('Assumiu, a IA cala:')}</b> {tDynamic('basta você responder que a IA silencia naquela conversa na hora;')}</li>
                <li>{tDynamic('Quer a IA de volta? Um clique devolve a conversa para ela;')}</li>
                <li><b>{tDynamic('Botão de emergência:')}</b> {tDynamic('desligar a IA não desliga o recebimento — as mensagens continuam chegando para você atender manualmente.')}</li>
              </ul>
            </Expansivel>
            <Expansivel titulo={tDynamic("O que você precisa para conectar")}>
              <p><b>{tDynamic('Opção A — disponível hoje: número dedicado.')}</b> {tDynamic('Você usa um chip novo só para o atendimento automático (qualquer pré-pago serve). O assistente de conexão te guia em 4 passos, com imagem de cada tela, e valida tudo sozinho.')}</p>
              <p className="mt-2"><b>{tDynamic('Opção B — em breve: manter seu número atual.')}</b> {tDynamic('Conexão com Facebook em poucos cliques, mantendo o WhatsApp que você já usa no celular. Estamos finalizando a homologação com a Meta para liberar essa opção.')}</p>
              <div className="mt-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/10">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  ⚠️ <b>{tDynamic('Importante:')}</b> {tDynamic('na Opção A, o número escolhido sai do WhatsApp comum e passa a ser só do atendimento automático. Por isso recomendamos um chip dedicado — nunca o número que você já usa para falar com clientes.')}
                </p>
              </div>
            </Expansivel>
            <Expansivel titulo={tDynamic("Quanto custa")}>
              <ul className="list-disc space-y-1.5 pl-5">
                <li><b>{tDynamic('Sem mensalidade de integração')}</b> {tDynamic('— está incluído no seu plano MiseOn;')}</li>
                <li><b>{tDynamic('Cliente mandou mensagem primeiro?')}</b> {tDynamic('Você tem 24h para responder livremente, sem custo por conversa*;')}</li>
                <li><b>{tDynamic('Fora da janela de 24h')}</b> {tDynamic('(ex.: avisar um cliente do dia anterior) só é possível com mensagens-modelo pagas —')} <b>{tDynamic('desligadas por padrão')}</b>{tDynamic('. Se um dia você quiser ligar, o custo estimado aparece na tela antes de confirmar;')}</li>
                <li>{tDynamic('Você pode desligar tudo quando quiser, sem multa e sem burocracia.')}</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {tDynamic('*A Meta (dona do WhatsApp) anunciou que passará a cobrar alguns centavos por mensagem a partir de outubro/2026. Avisaremos com antecedência — e a decisão de manter ligado será sempre sua.')}
              </p>
            </Expansivel>
            <Expansivel titulo={tDynamic("Como acompanhar se está funcionando")}>
              <ul className="list-disc space-y-1.5 pl-5">
                <li><b>{tDynamic('Saúde da conexão:')}</b> {tDynamic('a tela de integração mostra o semáforo (conectado/pendente/erro) e o motivo em português claro se algo falhar;')}</li>
                <li><b>{tDynamic('Pedidos com selo 🟢:')}</b> {tDynamic('todo pedido vindo do WhatsApp aparece marcado no Painel de Pedidos, com link para ver a conversa;')}</li>
                <li><b>{tDynamic('Resultado no Dashboard:')}</b> {tDynamic('conversas atendidas, % resolvidas sem você intervir e pedidos gerados — a prova do retorno.')}</li>
              </ul>
            </Expansivel>
          </div>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <MonitorSmartphone size={18} className="text-[var(--cor-primaria)]" /> {tDynamic('Outras integrações')}
          </h3>
          <div className="space-y-3 mb-10">
            <Expansivel titulo={tDynamic("iFood")}>
              <p>
                {tDynamic('A integração com o iFood já está disponível e explicada na aba')} <b>{tDynamic('Como Funciona')}</b> —
                {tDynamic('pedidos caindo sozinhos no painel e taxas descontadas no Financeiro. Configure em')} <Link to="/admin/ifood" className="font-semibold text-[var(--cor-primaria)] hover:underline">{tDynamic('Integração iFood')}</Link>.
              </p>
            </Expansivel>
          </div>
        </div>
      )}

      {/* ── TAB: FINANCEIRO (EFI) ── */}
      {tabAtiva === 'financeiro' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 rounded-3xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-50/30 p-6 dark:border-emerald-900/30 dark:from-emerald-900/10 dark:to-teal-900/10">
             <div className="flex items-start gap-4">
               <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/30">
                  <Wallet size={24} className="text-emerald-600 dark:text-emerald-400" />
               </div>
               <div>
                  <h3 className="mb-2 text-lg font-black text-emerald-900 dark:text-emerald-100">{tDynamic('Como o dinheiro chega até você')}</h3>
                  <p className="text-sm leading-relaxed text-emerald-800/80 dark:text-emerald-200/80">
                    {tDynamic('Quando seu cliente paga')} <b>{tDynamic('online')}</b>{tDynamic(', o valor vai')} <b>{tDynamic('direto para sua conta Efí')}</b>{tDynamic('. O MiseOn não segura o seu dinheiro. Configure em 3 passos simples.')}
                  </p>
               </div>
             </div>
             <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-4 shadow-sm dark:bg-black/20 backdrop-blur">
                  <QrCode size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{tDynamic('Pix Inteligente')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{tDynamic('Cai na sua conta na mesma hora. Conciliação automática.')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-white/70 p-4 shadow-sm dark:bg-black/20 backdrop-blur">
                  <CreditCard size={20} className="mt-0.5 shrink-0 text-blue-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{tDynamic('Cartões')}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{tDynamic('Escolha receber no prazo padrão (~31 dias) ou antecipado (2 dias).')}</p>
                  </div>
                </div>
              </div>
          </div>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <Landmark size={18} className="text-[var(--cor-primaria)]" /> {tDynamic('Guia: configurando seus recebimentos')}
          </h3>
          <div className="space-y-4 mb-10">
            <Passo n={1} titulo={tDynamic("Abra sua conta no Efí Bank (é grátis)")}>
              <p>{tDynamic('A conta Efí é')} <b>{tDynamic('sua')}</b> {tDynamic('e não tem mensalidade. É nela que o dinheiro das vendas cai.')}</p>
              <ul className="list-disc space-y-1 pl-5 mt-2">
                <li><b>{tDynamic('CNPJ ativo')}</b> {tDynamic('(MEI serve!) e documento com foto;')}</li>
                <li>{tDynamic('Baixe o app')} <b>{tDynamic('Efí Bank')}</b>{tDynamic(', vá em "Abrir conta" → "Efí Empresas";')}</li>
                <li>{tDynamic('Aprovação costuma sair no mesmo dia.')}</li>
              </ul>
              <a href={EFI_LINKS.abrirConta} target="_blank" rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] px-4 py-2 text-xs font-bold text-white transition hover:brightness-110">
                {tDynamic('Abrir minha conta Efí')} <ExternalLink size={13} />
              </a>
            </Passo>

            <Passo n={2} titulo={tDynamic("Copie o Identificador de conta")}>
              <p>{tDynamic('É um código seguro que só serve para depositar dinheiro na sua conta.')}</p>
              <ol className="list-decimal space-y-1 pl-5 mt-2">
                <li>{tDynamic('Acesse o painel Efí no computador;')}</li>
                <li>{tDynamic('No menu lateral, clique em')} <b>API</b> → <b>{tDynamic('Identificador de conta')}</b> {tDynamic('(topo direito);')}</li>
                <li>{tDynamic('Copie e cole aqui em')} <b>{tDynamic('Configurações da Loja → Pagamentos')}</b>.</li>
              </ol>
            </Passo>

            <Passo n={3} titulo={tDynamic("Informe CPF/CNPJ e Conta para o Pix")}>
              <p>{tDynamic('Para o Pix cair direto (Split), preencha em')} <b>{tDynamic('Configurações da Loja → Pagamentos')}</b>:</p>
              <ul className="list-disc space-y-1 pl-5 mt-2">
                <li><b>{tDynamic('CPF ou CNPJ')}</b> {tDynamic('do titular da conta Efí;')}</li>
                <li><b>{tDynamic('Número da conta Efí')}</b> {tDynamic('(veja no app em Perfil → Dados da conta).')}</li>
              </ul>
            </Passo>
          </div>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <Wallet size={18} className="text-[var(--cor-primaria)]" /> {tDynamic('Taxas do Efí Bank (por venda)')}
          </h3>
          <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 mb-2">
            {[
              { forma: tDynamic('Pix'), detalhe: tDynamic('cai na hora'), taxa: EFI_TARIFAS.pix },
              { forma: tDynamic('Crédito à vista'), detalhe: tDynamic('prazo padrão ou antecipado'), taxa: EFI_TARIFAS.creditoAVista },
              { forma: tDynamic('Crédito parcelado 2–6x'), detalhe: tDynamic('prazo padrão (1 parcela / ~31 dias)'), taxa: EFI_TARIFAS.creditoParcelado2a6 },
              { forma: tDynamic('Crédito parcelado 7–12x'), detalhe: tDynamic('prazo padrão (1 parcela / ~31 dias)'), taxa: EFI_TARIFAS.creditoParcelado7a12 },
              { forma: tDynamic('Antecipação ⚡'), detalhe: tDynamic('recebe tudo em ~2 dias úteis'), taxa: `${EFI_TARIFAS.creditoAVista} + ${EFI_TARIFAS.antecipacaoPorParcela}/parcela` },
              { forma: tDynamic('Dinheiro / maquininha na entrega'), detalhe: tDynamic('fora do sistema'), taxa: tDynamic('sem taxa MiseOn') },
            ].map((linha, i) => (
              <div key={linha.forma} className={`flex items-center justify-between gap-3 bg-white px-4 py-3.5 dark:bg-gray-900 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}>
                <div>
                  <p className="text-sm font-semibold dark:text-gray-100">{linha.forma}</p>
                  <p className="text-xs opacity-95 text-gray-400 mt-0.5">{linha.detalhe}</p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-black text-gray-700 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">{linha.taxa}</span>
              </div>
            ))}
          </div>
          <p className="text-xs opacity-95 text-gray-400 mb-8">
            {tDynamic('Taxas públicas do Efí Bank (base')} {EFI_TARIFAS.referencia}{tDynamic('). Sujeito a alteração.')} <a href={EFI_LINKS.tarifas} target="_blank" rel="noreferrer" className="underline">{tDynamic('Confira no site oficial')}</a>.
          </p>

          <h3 className="mb-4 flex items-center gap-2 text-base font-black dark:text-gray-100">
            <HelpCircle size={18} className="text-[var(--cor-primaria)]" /> {tDynamic('Dúvidas Frequentes (Financeiro)')}
          </h3>
          <div className="space-y-3 mb-10">
             <Expansivel titulo={tDynamic("O MiseOn segura meu dinheiro?")} icone={<ShieldCheck size={16} className="text-emerald-500" />}>
                <p><b>{tDynamic('Não.')}</b> {tDynamic('O repasse é automático pelo Efí Bank, direto para sua conta (split de pagamento). O MiseOn cobra apenas a mensalidade fixa.')}</p>
             </Expansivel>
             <Expansivel titulo={tDynamic("Débito e dinheiro passam pelo sistema?")}>
                <p>{tDynamic('Pagamentos na entrega (dinheiro/maquininha do motoboy) não passam pela Efí. O sistema apenas registra, mas')} <b>{tDynamic('não há taxa do MiseOn nem da Efí')}</b>.</p>
             </Expansivel>
             <Expansivel titulo={tDynamic("E se eu não configurar a Efí agora?")}>
                <p>{tDynamic('Suas vendas')} <b>{tDynamic('não travam')}</b>{tDynamic(', mas você precisará aceitar apenas dinheiro/maquininha, ou os valores online ficam pendentes de repasse manual da plataforma. É altamente recomendado configurar logo.')}</p>
             </Expansivel>
          </div>
        </div>
      )}

      {/* ── TAB: INDICADORES ── */}
      {tabAtiva === 'indicadores' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 rounded-3xl border border-orange-200/60 bg-gradient-to-br from-orange-50 to-amber-50/30 p-6 dark:border-orange-900/30 dark:from-orange-900/10 dark:to-amber-900/10">
             <div className="flex items-start gap-4">
               <div className="rounded-full bg-orange-100 p-3 dark:bg-orange-900/30">
                  <LayoutDashboard size={24} className="text-orange-600 dark:text-orange-400" />
               </div>
               <div>
                  <h3 className="mb-2 text-lg font-black text-orange-900 dark:text-orange-100">{tDynamic('Lendo seus resultados')}</h3>
                  <p className="text-sm leading-relaxed text-orange-800/80 dark:text-orange-200/80">
                    {tDynamic('O Dashboard do MiseOn foi feito para você tomar decisões. Aprenda a interpretar os gráficos e métricas para maximizar seu lucro.')}
                  </p>
               </div>
             </div>
          </div>

          <div className="space-y-3 mb-10">
            <Expansivel titulo={tDynamic("Ticket Médio: O que é e como melhorar?")} aberto_inicial>
              <p>{tDynamic('O')} <b>{tDynamic('Ticket Médio')}</b> {tDynamic('é o valor médio que cada cliente gasta em um pedido (Faturamento Total / Nº de Pedidos).')}</p>
              <div className="mt-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
                <h5 className="font-bold text-sm mb-2">{tDynamic('Como aumentar:')}</h5>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>{tDynamic('Ofereça adicionais (bacon, extra queijo) bem visíveis nos produtos.')}</li>
                  <li>{tDynamic('Crie "Combos" (Lanche + Bebida + Frita) com desconto atrativo.')}</li>
                  <li>{tDynamic('Treine o atendente do balcão para sempre sugerir uma bebida ou sobremesa.')}</li>
                </ul>
              </div>
            </Expansivel>
            <Expansivel titulo={tDynamic("Taxa de Cancelamento e Rejeição")}>
              <p>{tDynamic('A')} <b>{tDynamic('Taxa de Cancelamento')}</b> {tDynamic('mostra quantos pedidos não foram concluídos. Se estiver acima de 5%, é um sinal de alerta.')}</p>
              <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                <li><b>{tDynamic('Cancelado pelo restaurante:')}</b> {tDynamic('Geralmente por falta de estoque ou tempo de espera alto. Ajuste suas fichas técnicas!')}</li>
                <li><b>{tDynamic('Cancelado pelo cliente:')}</b> {tDynamic('Pode indicar demora na aceitação. Aceite pedidos o mais rápido possível no Painel.')}</li>
              </ul>
            </Expansivel>
            <Expansivel titulo={tDynamic("Horários de Pico (Mapa de Calor)")}>
              <p>{tDynamic('No Dashboard, você verá quais horários e dias da semana concentram mais vendas.')}</p>
              <p className="mt-2 text-sm">
                <b>{tDynamic('Dica de Ouro:')}</b> {tDynamic('Se terça-feira às 19h é o seu horário mais fraco, crie uma')} <i>{tDynamic('Promoção Relâmpago')}</i> {tDynamic('específica para esse dia para atrair demanda. Se sexta às 21h é o pico, reforce a equipe da cozinha e entregadores.')}
              </p>
            </Expansivel>
            <Expansivel titulo={tDynamic("Produtos Mais Vendidos vs. Mais Lucrativos")}>
              <p>{tDynamic('Muitas vezes o seu produto mais vendido não é o que dá mais lucro. O MiseOn cruza as vendas com o CMV (Custo da Mercadoria Vendida) definido na Ficha Técnica.')}</p>
              <p className="mt-2 text-sm">
                {tDynamic('Sempre coloque os produtos')} <b>{tDynamic('mais lucrativos')}</b> {tDynamic('em destaque no seu cardápio digital, e não apenas os que saem mais.')}
              </p>
            </Expansivel>
          </div>
        </div>
      )}

      {/* ── TAB: ESPECIALISTA ── */}
      {tabAtiva === 'especialista' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="relative mb-6">
                 <div className="absolute -inset-1 animate-pulse rounded-full bg-[var(--cor-primaria)]/20 blur-xl"></div>
                 <img 
                   src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop" 
                   alt="Especialista" 
                   className="relative h-28 w-28 rounded-full border-4 border-white object-cover shadow-xl dark:border-gray-800"
                 />
                 <div className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-green-500 p-2 shadow-sm dark:border-gray-800">
                    <PhoneCall size={14} className="text-white" />
                 </div>
              </div>
              
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">{tDynamic('Fale com um Especialista')}</h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {tDynamic('Nós sabemos que a operação de um restaurante é complexa. Não perca tempo batendo cabeça: nosso time de sucesso do cliente está pronto para te ajudar a configurar seu cardápio, estoque e finanças.')}
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                 <a href={zapSuporte('Olá! Gostaria de falar com um especialista sobre o MiseOn.')} target="_blank" rel="noreferrer"
                   className="flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-8 py-4 font-bold text-white shadow-lg shadow-green-500/30 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-green-500/40">
                   <MessageCircle size={20} />
                   {tDynamic('Chamar no WhatsApp agora')}
                 </a>
                 <a href="mailto:suporte@miseon.app.br?subject=Suporte%20MiseOn"
                   className="flex items-center justify-center gap-2 rounded-2xl border-2 border-gray-200 bg-white px-8 py-4 font-bold text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                   <Mail size={20} />
                   suporte@miseon.app.br
                 </a>
              </div>

              <div className="mt-12 grid max-w-3xl gap-4 sm:grid-cols-3 text-left">
                 <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-800/50 border border-transparent hover:border-[var(--cor-primaria)]/30 transition-colors">
                    <Settings size={20} className="mb-3 text-[var(--cor-primaria)]" />
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">{tDynamic('Configuração Inicial')}</h4>
                    <p className="mt-1 text-xs text-gray-500">{tDynamic('Ajuda com cardápio, fichas técnicas e taxas de entrega.')}</p>
                 </div>
                 <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-800/50 border border-transparent hover:border-[var(--cor-primaria)]/30 transition-colors">
                    <BarChart3 size={20} className="mb-3 text-[var(--cor-primaria)]" />
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">{tDynamic('Análise de Vendas')}</h4>
                    <p className="mt-1 text-xs text-gray-500">{tDynamic('Como ler os relatórios e melhorar a margem de lucro.')}</p>
                 </div>
                 <div className="rounded-2xl bg-gray-50 p-5 dark:bg-gray-800/50 border border-transparent hover:border-[var(--cor-primaria)]/30 transition-colors">
                    <LifeBuoy size={20} className="mb-3 text-[var(--cor-primaria)]" />
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">{tDynamic('Dúvidas Gerais')}</h4>
                    <p className="mt-1 text-xs text-gray-500">{tDynamic('Treinamento para equipe de balcão e entregadores.')}</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-center gap-2 text-xs opacity-95 text-gray-400 opacity-60">
        <Check size={12} className="text-emerald-500" /> {tDynamic('Base de conhecimento atualizada')}
      </div>
    </div>
  );
}
