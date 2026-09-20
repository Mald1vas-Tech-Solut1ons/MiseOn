import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  BadgeInfo,
  Calculator,
  Download,
  PackageSearch,
  Percent,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '../../contexts/I18nContext';

interface LinhaDRE {
  descricao: string;
  valor: number;
  porcentagem: number;
  tipo: 'receita' | 'deducao' | 'subtotal' | 'custo_variavel' | 'margem' | 'custo_fixo' | 'resultado';
  ajuda?: string;
}

interface EtapaPonte {
  nome: string;
  base: number;
  faixa: number;
  valor: number;
  cor: string;
  natureza: string;
}

const brl = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const brlCompacto = (valor: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(valor);

export default function DreGerencial() {
  const { tDynamic } = useI18n();

  // Cenário fixo EXCLUSIVAMENTE demonstrativo. Não vem do ledger, dos pedidos
  // ou do estoque da loja. Enquanto não houver uma RPC conciliada e testada,
  // esta tela não pode se apresentar como resultado operacional.
  const receitaBruta = 84_500;
  const impostosDeducoes = 4_225;
  const receitaLiquida = receitaBruta - impostosDeducoes;
  const cmvInsumos = 27_885;
  const taxasAdquirentes = 3_380;
  const custosVariaveisTotais = cmvInsumos + taxasAdquirentes;
  const margemContribuicao = receitaLiquida - custosVariaveisTotais;
  const margemPorcentagem = (margemContribuicao / receitaLiquida) * 100;
  const custosFixos = 18_500;
  const resultadoOperacional = margemContribuicao - custosFixos;
  const margemOperacional = (resultadoOperacional / receitaLiquida) * 100;

  const linhas: LinhaDRE[] = [
    {
      descricao: '(+) RECEITA BRUTA DE VENDAS',
      valor: receitaBruta,
      porcentagem: 100,
      tipo: 'receita',
      ajuda: 'Total bruto de vendas dos canais incluídos no cenário',
    },
    {
      descricao: '(-) DEDUÇÕES DE RECEITA E IMPOSTOS',
      valor: -impostosDeducoes,
      porcentagem: 5,
      tipo: 'deducao',
    },
    {
      descricao: '(=) RECEITA LÍQUIDA',
      valor: receitaLiquida,
      porcentagem: 95,
      tipo: 'subtotal',
    },
    {
      descricao: '(-) CUSTO DE MERCADORIA VENDIDA (CMV)',
      valor: -cmvInsumos,
      porcentagem: 33,
      tipo: 'custo_variavel',
      ajuda: 'Insumos consumidos por ficha técnica e custeio de preparos',
    },
    {
      descricao: '(-) TAXAS DE ADQUIRENTES E CANAIS',
      valor: -taxasAdquirentes,
      porcentagem: 4,
      tipo: 'custo_variavel',
      ajuda: 'Taxas de meios de pagamento e canais no cenário demonstrativo',
    },
    {
      descricao: '(=) MARGEM DE CONTRIBUIÇÃO',
      valor: margemContribuicao,
      porcentagem: margemPorcentagem,
      tipo: 'margem',
      ajuda: 'Valor disponível para cobrir os custos fixos da operação',
    },
    {
      descricao: '(-) CUSTOS FIXOS OPERACIONAIS',
      valor: -custosFixos,
      porcentagem: 21.9,
      tipo: 'custo_fixo',
      ajuda: 'Aluguel, folha, utilidades e sistemas no cenário demonstrativo',
    },
    {
      descricao: '(=) RESULTADO OPERACIONAL DEMONSTRATIVO',
      valor: resultadoOperacional,
      porcentagem: margemOperacional,
      tipo: 'resultado',
      ajuda: 'Não equivale automaticamente ao lucro contábil',
    },
  ];

  const dadosPonte = useMemo<EtapaPonte[]>(() => {
    const depoisDeducoes = receitaBruta - impostosDeducoes;
    const depoisCmv = depoisDeducoes - cmvInsumos;
    const depoisTaxas = depoisCmv - taxasAdquirentes;
    const depoisFixos = depoisTaxas - custosFixos;

    return [
      { nome: 'Receita bruta', base: 0, faixa: receitaBruta, valor: receitaBruta, cor: '#0A5CC4', natureza: 'Total' },
      { nome: 'Deduções', base: depoisDeducoes, faixa: impostosDeducoes, valor: -impostosDeducoes, cor: '#D97706', natureza: 'Redução' },
      { nome: 'Receita líquida', base: 0, faixa: depoisDeducoes, valor: depoisDeducoes, cor: '#334155', natureza: 'Subtotal' },
      { nome: 'CMV', base: depoisCmv, faixa: cmvInsumos, valor: -cmvInsumos, cor: '#FC5B24', natureza: 'Redução' },
      { nome: 'Taxas', base: depoisTaxas, faixa: taxasAdquirentes, valor: -taxasAdquirentes, cor: '#DC2626', natureza: 'Redução' },
      { nome: 'Contribuição', base: 0, faixa: depoisTaxas, valor: depoisTaxas, cor: '#4F46E5', natureza: 'Subtotal' },
      { nome: 'Custos fixos', base: depoisFixos, faixa: custosFixos, valor: -custosFixos, cor: '#BE123C', natureza: 'Redução' },
      { nome: 'Resultado', base: 0, faixa: depoisFixos, valor: depoisFixos, cor: '#059669', natureza: 'Resultado' },
    ];
  }, [cmvInsumos, custosFixos, impostosDeducoes, receitaBruta, taxasAdquirentes]);

  const cards = [
    {
      rotulo: tDynamic('Receita bruta demonstrativa'),
      valor: brl(receitaBruta),
      detalhe: tDynamic('Ponto de partida do cenário'),
      Icone: TrendingUp,
      cor: 'text-blue-600 dark:text-blue-400',
      fundo: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      rotulo: tDynamic('CMV demonstrativo'),
      valor: brl(cmvInsumos),
      detalhe: '33,0% da receita líquida',
      Icone: PackageSearch,
      cor: 'text-orange-600 dark:text-orange-400',
      fundo: 'bg-orange-50 dark:bg-orange-950/30',
    },
    {
      rotulo: tDynamic('Margem de contribuição'),
      valor: brl(margemContribuicao),
      detalhe: `${margemPorcentagem.toFixed(1)}% da receita líquida`,
      Icone: Percent,
      cor: 'text-indigo-600 dark:text-indigo-400',
      fundo: 'bg-indigo-50 dark:bg-indigo-950/30',
    },
    {
      rotulo: tDynamic('Resultado operacional demonstrativo'),
      valor: brl(resultadoOperacional),
      detalhe: `${margemOperacional.toFixed(1)}% da receita líquida`,
      Icone: WalletCards,
      cor: 'text-emerald-600 dark:text-emerald-400',
      fundo: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
  ];

  return (
    <div className="space-y-6">
      <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-black">{tDynamic('Dados demonstrativos — não usar para decisão financeira')}</p>
            <p className="mt-1 text-sm leading-relaxed opacity-90">
              {tDynamic('Os valores abaixo são um cenário fixo para visualizar o formato da DRE. Eles não representam pedidos, custos, impostos ou resultado real desta loja.')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300">
            <Calculator size={14} /> {tDynamic('Cenário de demonstração')}
          </div>
          <h2 className="flex items-center gap-2 font-['Sora'] text-2xl font-black tracking-tight text-gray-950 dark:text-white">
            {tDynamic('Demonstrativo do Resultado do Exercício')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-slate-400">
            {tDynamic('Ponte gerencial para entender como receita, custos e despesas formam o resultado. A integração contábil com dados reais ainda não está concluída.')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <Download size={16} /> {tDynamic('Imprimir demonstração')}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ rotulo, valor, detalhe, Icone, cor, fundo }) => (
          <article key={rotulo} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${fundo} ${cor}`}>
              <Icone size={20} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">{rotulo}</p>
            <p className={`mt-1 font-['Sora'] text-xl font-black ${cor}`}>{valor}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{detalhe}</p>
          </article>
        ))}
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.75fr)]">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-['Sora'] text-base font-black text-gray-950 dark:text-white">
                {tDynamic('Ponte do resultado demonstrativo')}
              </h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {tDynamic('Cada redução mostra quanto do valor anterior foi consumido até chegar ao resultado operacional.')}
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600 dark:bg-white/10 dark:text-gray-300">
              {tDynamic('Valores de exemplo')}
            </span>
          </div>

          <div
            role="img"
            aria-label={tDynamic('Gráfico demonstrativo da formação do resultado operacional')}
            className="h-[350px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosPonte} layout="vertical" margin={{ top: 8, right: 22, bottom: 12, left: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.16)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={brlCompacto} />
                <YAxis dataKey="nome" type="category" width={104} tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                  content={({ active, payload }) => {
                    const etapa = payload?.[0]?.payload as EtapaPonte | undefined;
                    if (!active || !etapa) return null;
                    return (
                      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-xl dark:border-white/10 dark:bg-gray-950">
                        <p className="font-black text-gray-900 dark:text-white">{etapa.nome}</p>
                        <p className={etapa.valor < 0 ? 'font-bold text-red-600' : 'font-bold text-emerald-600'}>
                          {etapa.valor < 0 ? '− ' : ''}{brl(Math.abs(etapa.valor))}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400">{etapa.natureza}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine x={0} stroke="#94A3B8" />
                <Bar dataKey="base" stackId="ponte" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="faixa" stackId="ponte" radius={[0, 7, 7, 0]} isAnimationActive={false}>
                  {dadosPonte.map((etapa) => <Cell key={etapa.nome} fill={etapa.cor} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <aside className="rounded-3xl border border-gray-200 bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-orange-400">
            <ArrowDownRight size={20} />
          </div>
          <h3 className="mt-4 font-['Sora'] text-base font-black">{tDynamic('Leitura da ponte')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {tDynamic('Neste cenário, CMV e taxas consomem a maior parte da receita líquida antes dos custos fixos.')}
          </p>
          <dl className="mt-5 space-y-4">
            <div className="border-b border-white/10 pb-3">
              <dt className="text-xs uppercase tracking-wide text-slate-400">{tDynamic('Custos variáveis')}</dt>
              <dd className="mt-1 font-['Sora'] text-lg font-black">{brl(custosVariaveisTotais)}</dd>
            </div>
            <div className="border-b border-white/10 pb-3">
              <dt className="text-xs uppercase tracking-wide text-slate-400">{tDynamic('Custos fixos')}</dt>
              <dd className="mt-1 font-['Sora'] text-lg font-black">{brl(custosFixos)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{tDynamic('Resultado operacional')}</dt>
              <dd className="mt-1 font-['Sora'] text-2xl font-black text-emerald-400">{brl(resultadoOperacional)}</dd>
            </div>
          </dl>
          <div className="mt-6 flex items-start gap-2 rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-slate-300">
            <BadgeInfo size={16} className="mt-0.5 shrink-0 text-blue-300" />
            <span>{tDynamic('Uma DRE operacional não substitui a escrituração nem a apuração do contador.')}</span>
          </div>
        </aside>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-white/10">
          <h3 className="font-['Sora'] text-base font-black text-gray-950 dark:text-white">
            {tDynamic('Estrutura do cenário demonstrativo')}
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            {tDynamic('A tabela explica a composição; o gráfico mostra a formação do resultado.')}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-5 py-3">{tDynamic('Conta da DRE')}</th>
                <th className="px-5 py-3 text-right">{tDynamic('Valor')}</th>
                <th className="px-5 py-3 text-right">{tDynamic('Percentual')}</th>
                <th className="px-5 py-3">{tDynamic('Leitura gerencial')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {linhas.map((linha) => {
                const destaque = ['receita', 'subtotal', 'margem', 'resultado'].includes(linha.tipo);
                return (
                  <tr key={linha.descricao} className={linha.tipo === 'resultado' ? 'bg-emerald-50 font-bold text-emerald-800 dark:bg-emerald-950/25 dark:text-emerald-300' : destaque ? 'bg-slate-50 font-bold text-gray-950 dark:bg-white/5 dark:text-white' : 'text-gray-700 dark:text-slate-300'}>
                    <td className="px-5 py-3.5">{linha.descricao}</td>
                    <td className={`px-5 py-3.5 text-right font-['JetBrains_Mono'] font-bold ${linha.valor < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {linha.valor < 0 ? '− ' : ''}{brl(Math.abs(linha.valor))}
                    </td>
                    <td className="px-5 py-3.5 text-right font-['JetBrains_Mono']">{linha.porcentagem.toFixed(1)}%</td>
                    <td className="max-w-sm px-5 py-3.5 text-xs leading-relaxed text-gray-500 dark:text-slate-400">{linha.ajuda || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
