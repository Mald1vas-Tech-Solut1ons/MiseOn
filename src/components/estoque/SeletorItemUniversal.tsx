import { useMemo, useRef, useState, useEffect } from 'react';
import { Check, Search, X, Tag, Factory, Layers, AlertTriangle } from 'lucide-react';
import type { Insumo } from '../../types';
import { useI18n } from '../../contexts/I18nContext';
import {
  buscarCatalogo,
  itemPorSlug,
  montarNomeInsumo,
  normalizarTexto,
  type ItemCatalogo,
} from '../../lib/catalogoInsumos';

/**
 * Identidade do insumo, em três campos com papéis distintos.
 *
 * ─── POR QUE TRÊS CAMPOS E NÃO UM ─────────────────────────────────────────
 * O campo único de nome livre produzia "Tomate Italiano", "TOM DEBORA" e
 * "tomate salada" como três itens sem parentesco. Está certo serem três
 * insumos — preços e fornecedores diferentes, saldos diferentes —, mas errado
 * o sistema não saber que os três são tomate. Sem isso, "quanto gastei de
 * tomate no mês" não tem resposta, e o lojista ainda cadastra o quarto tomate
 * sem perceber que já tem três.
 *
 * Então: o GÊNERO vem do catálogo (e traz a unidade de compra junto, porque
 * tomate é kg em qualquer mercado do Brasil), a VARIEDADE distingue dentro do
 * gênero, e a MARCA distingue no eixo comercial. O nome final é montado à
 * vista do lojista — ele vê exatamente o que vai ser gravado, antes de gravar.
 *
 * ─── O QUE ISSO NÃO É ─────────────────────────────────────────────────────
 * Não é cerca. Quem vende algo que o catálogo não conhece digita o nome e
 * segue em frente; o gênero fica nulo e nada quebra. O catálogo acelera o
 * caminho comum sem bloquear o incomum.
 */
export interface IdentidadeForm {
  base: string;
  slug: string | null;
  variedade: string;
  marca: string;
}

interface Props {
  valor: IdentidadeForm;
  onChange: (patch: Partial<IdentidadeForm>) => void;
  /** Chamado ao escolher um gênero: o pai ajusta unidade e categoria. */
  onEscolherGenero: (item: ItemCatalogo, slug: string) => void;
  insumosExistentes: Insumo[];
  /** Id do insumo em edição — não conta como duplicata de si mesmo. */
  editandoId?: string;
}

export default function SeletorItemUniversal({
  valor, onChange, onEscolherGenero, insumosExistentes, editandoId,
}: Props) {
  const { tDynamic } = useI18n();
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const generoEscolhido = itemPorSlug(valor.slug);
  const sugestoes = useMemo(
    () => (generoEscolhido ? [] : buscarCatalogo(valor.base)),
    [valor.base, generoEscolhido],
  );

  // Clique fora fecha a lista. Sem isso ela fica pendurada sobre os campos
  // seguintes e o lojista não consegue chegar no preço.
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [aberto]);

  const nomeFinal = montarNomeInsumo({
    base: valor.base,
    variedade: valor.variedade,
    marca: valor.marca,
  });

  /**
   * Os irmãos: o que a loja já tem do MESMO gênero.
   *
   * É a informação que impede o quarto tomate acidental. Vem antes do erro de
   * duplicata, porque avisar depois de digitar tudo é punição, não ajuda.
   */
  const irmaos = useMemo(() => {
    if (!valor.slug) return [];
    return insumosExistentes.filter(
      (i) => i.id !== editandoId && (i.catalogo_ref === valor.slug),
    );
  }, [insumosExistentes, valor.slug, editandoId]);

  const duplicado = useMemo(() => {
    const alvo = normalizarTexto(nomeFinal);
    if (!alvo) return null;
    return insumosExistentes.find(
      (i) => i.id !== editandoId && normalizarTexto(i.nome) === alvo,
    ) ?? null;
  }, [insumosExistentes, nomeFinal, editandoId]);

  const escolher = (item: ItemCatalogo, slug: string) => {
    onChange({ base: item.nome, slug });
    onEscolherGenero(item, slug);
    setAberto(false);
  };

  const limparGenero = () => {
    onChange({ slug: null });
    setAberto(true);
  };

  return (
    <div className="space-y-3">
      {/* ── 1. O gênero ───────────────────────────────────────────────── */}
      <div ref={containerRef} className="relative">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {tDynamic('O que é este item?')}
        </span>

        {generoEscolhido ? (
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800/60 dark:bg-emerald-900/15">
            <Check size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-gray-900 dark:text-gray-100">
                {generoEscolhido.nome}
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                {generoEscolhido.categoria} · compra-se em <b>{generoEscolhido.unidade}</b>
              </p>
            </div>
            <button
              type="button"
              onClick={limparGenero}
              title={tDynamic('Escolher outro item')}
              className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-gray-600 dark:hover:bg-gray-800"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="relative mt-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="input-nome-insumo"
              value={valor.base}
              onChange={(e) => { onChange({ base: e.target.value, slug: null }); setAberto(true); }}
              onFocus={() => setAberto(true)}
              placeholder={tDynamic('Digite o item: tomate, cebola, queijo, refrigerante...')}
              autoComplete="off"
              className="w-full rounded-xl border border-gray-300 p-3 pl-9 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 focus:border-[var(--cor-primaria)] focus:outline-none transition-colors"
            />
          </div>
        )}

        {aberto && !generoEscolhido && sugestoes.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            {sugestoes.map(({ item, slug }) => (
              <li key={slug}>
                <button
                  type="button"
                  onClick={() => escolher(item, slug)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-orange-50 dark:hover:bg-gray-800"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                      {item.nome}
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {item.categoria}
                      {item.variedades?.length ? ` · ${item.variedades.length} variedades` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {item.unidade}
                  </span>
                </button>
              </li>
            ))}
            {/* O catálogo é atalho, não cerca: sempre dá para seguir com o que
                foi digitado, mesmo que ele não conheça o item. */}
            {valor.base.trim().length >= 2 && (
              <li className="border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => { onChange({ slug: null }); setAberto(false); }}
                  className="w-full px-3 py-2 text-left text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-gray-800"
                >
                  {tDynamic('Usar como item novo, fora do catálogo')}: “{valor.base.trim()}”
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* ── 2. Variedade e marca ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400">
            <Layers size={12} /> {tDynamic('Variedade / tipo')}
            <span className="font-normal text-gray-400">{tDynamic('(opcional)')}</span>
          </span>
          <input
            value={valor.variedade}
            onChange={(e) => onChange({ variedade: e.target.value })}
            placeholder={generoEscolhido?.variedades?.[0] ?? 'ex: Italiano, Asterix, Integral'}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 focus:border-[var(--cor-primaria)] focus:outline-none"
          />
          {/* Um toque em vez de digitação: o lojista lê a lista e reconhece a
              variedade que comprou, que é mais fácil do que lembrar o nome. */}
          {generoEscolhido?.variedades && generoEscolhido.variedades.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {generoEscolhido.variedades.map((v) => {
                const ativa = normalizarTexto(valor.variedade) === normalizarTexto(v);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => onChange({ variedade: ativa ? '' : v })}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                      ativa
                        ? 'bg-[var(--cor-primaria)] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          )}
        </label>

        <label className="block">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400">
            <Factory size={12} /> {tDynamic('Marca / fabricante')}
            <span className="font-normal text-gray-400">(opcional)</span>
          </span>
          <input
            value={valor.marca}
            onChange={(e) => onChange({ marca: e.target.value })}
            placeholder={tDynamic('ex: Tio João, Sadia, Ypê')}
            className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 focus:border-[var(--cor-primaria)] focus:outline-none"
          />
          <span className="mt-1 block text-[10px] text-gray-400 dark:text-gray-500">
            {tDynamic('Preencha quando a marca muda o preço ou o rendimento.')}
          </span>
        </label>
      </div>

      {/* ── 3. O nome que será gravado ────────────────────────────────── */}
      {nomeFinal && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/60">
          <Tag size={13} className="text-gray-400" />
          <span className="text-[11px] text-gray-500 dark:text-gray-400">{tDynamic('Vai ser salvo como')}</span>
          <span className="text-sm font-black text-gray-900 dark:text-gray-100">{nomeFinal}</span>
          {valor.slug && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              agrupa em {valor.slug}
            </span>
          )}
        </div>
      )}

      {duplicado && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertTriangle size={13} className="mt-px shrink-0" />
            {tDynamic('Você já tem este item no estoque. Mude a variedade ou a marca para diferenciar.')}{' '}
            <span className="font-black">“{duplicado.nome}”</span>
        </p>
      )}

      {!duplicado && irmaos.length > 0 && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-900/10">
          <p className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
            Você já controla {irmaos.length}{' '}
            {irmaos.length === 1 ? 'item deste gênero' : 'itens deste gênero'}:
          </p>
          <p className="mt-0.5 text-[11px] text-blue-600/80 dark:text-blue-300/70">
            {irmaos
              .map((i) => `${i.nome} (${Number(i.quantidade_atual ?? 0).toLocaleString('pt-BR')} ${i.unidade_medida})`)
              .join(' · ')}
          </p>
          <p className="mt-1 text-[10px] text-blue-600/70 dark:text-blue-300/60">
            {tDynamic('Todos somam no mesmo relatório de custo. Cadastre outro só se comprar separado de verdade.')}
          </p>
        </div>
      )}
    </div>
  );
}
