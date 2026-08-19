import { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, ArrowRight, CheckCircle2, AlertTriangle, X, Loader2, Building2, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, fmt } from '../../types';
import { UNIDADES } from '../../lib/unidades';

interface ItemLidoNFCe {
  num_item: number;
  descricao: string;
  gtin?: string | null;
  codigo_fornecedor?: string | null;
  qtd: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
}

/**
 * Chave do De-Para. O código interno do mercado só é único dentro do CNPJ dele —
 * sem esse escopo, o código 123 de dois mercados vira o mesmo insumo.
 */
function chaveDoItem(item: ItemLidoNFCe, cnpjEmitente?: string | null): string {
  if (item.gtin) return `EAN_${item.gtin}`;
  const cnpj = (cnpjEmitente || '').replace(/\D/g, '');
  if (item.codigo_fornecedor && cnpj) return `CPROD_${cnpj}_${item.codigo_fornecedor}`;
  return item.descricao.trim().toUpperCase();
}

interface DadosNotaNFCe {
  chave: string;
  uf: string;
  emitente: {
    razao_social: string;
    cnpj?: string | null;
  };
  data_emissao?: string | null;
  valor_total: number;
  itens: ItemLidoNFCe[];
}

interface LinhaDePara {
  itemNota: ItemLidoNFCe;
  /** Cupom de mercado mistura insumo com item pessoal. O lojista decide. */
  importar: boolean;
  insumoId: string; // '' se novo insumo
  criarNovo: boolean;
  nomeNovoInsumo: string;
  unidadeInsumo: string;
  fatorConversao: number;
  confiancaMatch: 'ALTA' | 'MEDIA' | 'NENHUMA';
}

interface Props {
  lojaId: string;
  dadosNota: DadosNotaNFCe;
  insumosExistentes: Insumo[];
  onFechar: () => void;
  onSucesso: (mensagem: string) => void;
}

export default function ModalImportarNFCe({ lojaId, dadosNota, insumosExistentes, onFechar, onSucesso }: Props) {
  const [linhas, setLinhas] = useState<LinhaDePara[]>([]);
  const [carregandoMatch, setCarregandoMatch] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Nota já lançada antes: só repete com confirmação explícita do lojista.
  const [podeRepetir, setPodeRepetir] = useState(false);
  const [repetirNota, setRepetirNota] = useState(false);

  // Mapa rápido de insumos existentes por ID
  const porId = useMemo(() => new Map(insumosExistentes.map(i => [i.id, i])), [insumosExistentes]);

  // Carregar histórico de De-Para da loja e fazer auto-matching
  useEffect(() => {
    async function executarAutoMatch() {
      setCarregandoMatch(true);

      // Buscar histórico de De-Para gravado
      const { data: historico } = await supabase
        .from('compras_depara_itens')
        .select('*')
        .eq('loja_id', lojaId);

      const mapaHistorico = new Map<string, { insumo_id: string; fator_conversao: number }>();
      (historico || []).forEach(h => {
        mapaHistorico.set(h.chave_item_fornecedor, {
          insumo_id: h.insumo_id,
          fator_conversao: Number(h.fator_conversao) || 1
        });
      });

      const novasLinhas: LinhaDePara[] = dadosNota.itens.map(item => {
        const chaveChave = chaveDoItem(item, dadosNota.emitente?.cnpj);

        // 1. Nível 1: Match por Histórico
        const hist = mapaHistorico.get(chaveChave) || mapaHistorico.get(item.descricao.trim().toUpperCase());
        if (hist && porId.has(hist.insumo_id)) {
          const ins = porId.get(hist.insumo_id)!;
          return {
            itemNota: item,
            importar: true,
            insumoId: hist.insumo_id,
            criarNovo: false,
            nomeNovoInsumo: item.descricao,
            unidadeInsumo: ins.unidade_medida,
            fatorConversao: hist.fator_conversao,
            confiancaMatch: 'ALTA'
          };
        }

        // 2. Nível 2: Match por GTIN/EAN no cadastro existente
        if (item.gtin) {
          const matchEan = insumosExistentes.find(i => (i as any).detalhes_rendimento?.gtin === item.gtin);
          if (matchEan) {
            return {
              itemNota: item,
              importar: true,
              insumoId: matchEan.id,
              criarNovo: false,
              nomeNovoInsumo: item.descricao,
              unidadeInsumo: matchEan.unidade_medida,
              fatorConversao: 1,
              confiancaMatch: 'ALTA'
            };
          }
        }

        // 3. Nível 3: Match por Similaridade de Nome
        const nomeNorm = item.descricao.toLowerCase();
        const matchNome = insumosExistentes.find(i => {
          const iNome = i.nome.toLowerCase();
          return iNome.includes(nomeNorm) || nomeNorm.includes(iNome);
        });

        if (matchNome) {
          return {
            itemNota: item,
            importar: true,
            insumoId: matchNome.id,
            criarNovo: false,
            nomeNovoInsumo: item.descricao,
            unidadeInsumo: matchNome.unidade_medida,
            fatorConversao: 1,
            confiancaMatch: 'MEDIA'
          };
        }

        // 4. Se não achou nenhum match, sugere criar novo insumo
        return {
          itemNota: item,
          importar: true,
          insumoId: '',
          criarNovo: true,
          nomeNovoInsumo: item.descricao,
          unidadeInsumo: item.unidade || 'un',
          fatorConversao: 1,
          confiancaMatch: 'NENHUMA'
        };
      });

      setLinhas(novasLinhas);
      setCarregandoMatch(false);
    }

    executarAutoMatch();
  }, [lojaId, dadosNota, insumosExistentes, porId]);

  const marcados = useMemo(() => linhas.filter((l) => l.importar), [linhas]);
  const totalMarcado = useMemo(
    () => marcados.reduce((acc, l) => acc + (Number(l.itemNota.valor_total) || 0), 0),
    [marcados],
  );
  const contagem = useMemo(() => ({
    alta: linhas.filter((l) => l.confiancaMatch === 'ALTA').length,
    media: linhas.filter((l) => l.confiancaMatch === 'MEDIA').length,
    novos: linhas.filter((l) => l.criarNovo).length,
  }), [linhas]);

  const marcarTodos = (valor: boolean) =>
    setLinhas((prev) => prev.map((l) => ({ ...l, importar: valor })));

  /** Atalho para quem só quer repor o que já controla, sem inflar o cadastro. */
  const marcarSomenteConhecidos = () =>
    setLinhas((prev) => prev.map((l) => ({ ...l, importar: !l.criarNovo })));

  const atualizarLinha = (index: number, patch: Partial<LinhaDePara>) => {
    setLinhas(prev => {
      const proximo = [...prev];
      proximo[index] = { ...proximo[index], ...patch };
      return proximo;
    });
  };

  const confirmarImportacao = async () => {
    setErro(null);
    setSalvando(true);

    try {
      // Uma unica chamada transacional. Antes eram tres idas soltas (cria
      // insumo, lanca movimentacao, grava De-Para) e qualquer falha no meio
      // deixava insumo criado sem entrada de estoque. E faltava o passo que
      // realmente importa: somar em insumos.quantidade_atual — sem ele a nota
      // "importava" e o saldo continuava igual.
      const itens = linhas
        .filter((l) => l.importar)
        .map((l) => {
          const insumoExistente = !l.criarNovo && l.insumoId ? l.insumoId : null;
          return {
            criar_novo: !insumoExistente,
            insumo_id: insumoExistente,
            nome: l.nomeNovoInsumo.trim() || l.itemNota.descricao,
            unidade: (insumoExistente ? porId.get(insumoExistente)?.unidade_medida : l.unidadeInsumo) || 'un',
            qtd_nota: Number(l.itemNota.qtd) || 0,
            fator: Number(l.fatorConversao) || 1,
            custo_total: Number(l.itemNota.valor_total) || 0,
            chave_depara: chaveDoItem(l.itemNota, dadosNota.emitente?.cnpj),
            descricao_nota: l.itemNota.descricao,
            gtin: l.itemNota.gtin || null,
          };
        })
        .filter((i) => i.qtd_nota * i.fator > 0);

      if (itens.length === 0) {
        setErro('Nenhum item marcado para importar. Marque ao menos um item da nota.');
        return;
      }

      const { data: resultado, error: errImportar } = await supabase.rpc('fn_importar_nfce', {
        p_loja_id: lojaId,
        p_chave: dadosNota.chave || '',
        p_emitente: dadosNota.emitente?.razao_social || '',
        p_itens: itens,
        p_repetir: repetirNota,
      });

      if (errImportar) throw errImportar;

      const r = resultado as {
        ja_importada?: boolean;
        importado_em?: string;
        itens_lancados?: number;
        insumos_criados?: number;
        insumos_reaproveitados?: number;
      } | null;

      // Cupom já lançado antes: não duplica nada por conta própria. Duplicar
      // estoque em silêncio estraga o CMV e ninguém percebe na hora.
      if (r?.ja_importada) {
        const quando = r.importado_em ? new Date(r.importado_em).toLocaleString('pt-BR') : 'antes';
        setErro(
          `Esta nota já foi importada em ${quando}. Nada foi lançado agora. ` +
          'Se você realmente quer lançar de novo, marque "importar mesmo assim" abaixo.',
        );
        setPodeRepetir(true);
        return;
      }

      const lancados = r?.itens_lancados ?? itens.length;
      const criados = r?.insumos_criados ?? 0;
      const reaproveitados = r?.insumos_reaproveitados ?? 0;
      const detalhes = [
        criados > 0 ? `${criados} insumo(s) novo(s)` : '',
        reaproveitados > 0 ? `${reaproveitados} vinculado(s) a insumo já existente` : '',
      ].filter(Boolean).join(', ');

      onSucesso(`Importação concluída! ${lancados} itens lançados no estoque${detalhes ? ` — ${detalhes}` : ''}.`);
    } catch (e) {
      console.error(e);
      // Erro do Supabase é objeto simples, não Error: com `instanceof` a tela
      // mostrava sempre "Falha ao processar" e escondia a causa real.
      const detalhe =
        (e as { message?: string; hint?: string; details?: string } | null)?.message ??
        (typeof e === 'string' ? e : '');
      setErro(detalhe ? `Falha ao importar: ${detalhe}` : 'Falha ao processar importação da nota.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Cabeçalho */}
        <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 p-5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-500 p-3 text-white shadow-md shadow-orange-500/20">
              <ShoppingBag size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-xl text-gray-900 dark:text-gray-100">Conferência de Cupom Fiscal (NFC-e)</h3>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider">
                  SEFAZ {dadosNota.uf}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1 font-semibold"><Building2 size={13} /> {dadosNota.emitente.razao_social}</span>
                {dadosNota.data_emissao && <span className="flex items-center gap-1"><Calendar size={13} /> {new Date(dadosNota.data_emissao).toLocaleDateString('pt-BR')}</span>}
                <span className="flex items-center gap-1 font-bold text-gray-900 dark:text-gray-200"><DollarSign size={13} /> Total: {fmt(dadosNota.valor_total)}</span>
              </div>
            </div>
          </div>
          <button onClick={onFechar} className="rounded-full p-2 text-gray-400 hover:bg-white hover:text-gray-600 dark:hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        {/* Corpo Tabela */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {carregandoMatch ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 size={36} className="animate-spin text-orange-600 mb-3" />
              <p className="font-bold text-sm text-gray-900 dark:text-gray-100">Cruzando itens da nota com o seu estoque...</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Verificando memória de De-Para e sugestões por nome.</p>
            </div>
          ) : (
            <div>
              {/*
                Barra de controle. Cupom de mercado vem com dezenas de linhas e
                mistura insumo da cozinha com compra pessoal — revisar item a
                item no celular é justamente o trabalho que a importação
                deveria eliminar. Daqui o lojista resolve tudo em dois toques.
              */}
              <div className="mb-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    {marcados.length} de {linhas.length} itens marcados
                    <span className="ml-2 font-medium text-gray-400">·</span>
                    <span className="ml-2 font-black text-emerald-600 dark:text-emerald-400">{fmt(totalMarcado)}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => marcarTodos(true)}
                      className="rounded-lg border border-gray-300 dark:border-gray-700 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900"
                    >
                      Marcar todos
                    </button>
                    <button
                      onClick={() => marcarTodos(false)}
                      className="rounded-lg border border-gray-300 dark:border-gray-700 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900"
                    >
                      Desmarcar todos
                    </button>
                    <button
                      onClick={marcarSomenteConhecidos}
                      title="Deixa marcados só os itens que já existem no seu estoque"
                      className="rounded-lg border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    >
                      Só os já cadastrados
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                  <span><b className="text-emerald-600 dark:text-emerald-400">{contagem.alta}</b> reconhecidos automaticamente</span>
                  <span><b className="text-amber-600 dark:text-amber-400">{contagem.media}</b> por sugestão de nome</span>
                  <span><b className="text-blue-600 dark:text-blue-400">{contagem.novos}</b> vão virar insumo novo</span>
                </div>
                {totalMarcado < dadosNota.valor_total - 0.01 && (
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                    Desmarcado: {fmt(dadosNota.valor_total - totalMarcado)} — itens que não entram no estoque
                    (compra pessoal, material de limpeza, o que você decidir).
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {linhas.map((l, i) => {
                  const insumoSelecionado = porId.get(l.insumoId);
                  const qtdFinal = l.itemNota.qtd * (l.fatorConversao || 1);
                  const custoUnitFinal = qtdFinal > 0 ? l.itemNota.valor_total / qtdFinal : 0;
                  // A unidade de destino é escolha do lojista: ao criar insumo
                  // novo, a que ele selecionou; ao vincular, a do insumo dele.
                  const unidadeDestino = l.criarNovo ? (l.unidadeInsumo || 'un') : (insumoSelecionado?.unidade_medida || 'un');
                  const unidadeNota = l.itemNota.unidade || 'un';
                  const mesmaUnidade = unidadeNota.toLowerCase() === unidadeDestino.toLowerCase();
                  // A unidade impressa na nota (bd, fr, pct...) nem sempre está
                  // no catálogo. Sem isso ela some da lista e o lojista perde a
                  // informação de como a compra realmente veio.
                  const opcoesUnidade = UNIDADES.some(u => u.codigo.toLowerCase() === unidadeNota.toLowerCase())
                    ? UNIDADES.map(u => ({ codigo: u.codigo, rotulo: u.rotulo }))
                    : [{ codigo: unidadeNota, rotulo: `${unidadeNota} — como veio na nota` },
                       ...UNIDADES.map(u => ({ codigo: u.codigo, rotulo: u.rotulo }))];

                  return (
                    <div key={i} className={`rounded-xl border p-4 transition-all ${l.confiancaMatch === 'ALTA' ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-900/10' : l.criarNovo ? 'border-blue-200 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-900/10' : 'border-amber-200 bg-amber-50/30 dark:border-amber-900/30 dark:bg-amber-900/10'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        
                        {/* Item da Nota */}
                        <div className="md:col-span-5">
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={l.importar}
                              onChange={e => atualizarLinha(i, { importar: e.target.checked })}
                              aria-label={`Importar ${l.itemNota.descricao}`}
                              className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                {l.confiancaMatch === 'ALTA' && <span className="rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black px-1.5 py-0.5">AUTO MATCH</span>}
                                {l.confiancaMatch === 'MEDIA' && <span className="rounded-full bg-amber-100 text-amber-700 text-[9px] font-black px-1.5 py-0.5">SUGESTÃO</span>}
                                {l.criarNovo && <span className="rounded-full bg-blue-100 text-blue-700 text-[9px] font-black px-1.5 py-0.5">+ NOVO INSUMO</span>}
                                {!l.importar && <span className="rounded-full bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[9px] font-black px-1.5 py-0.5">FORA DA IMPORTAÇÃO</span>}
                              </div>
                              <p className={`font-bold text-sm ${l.importar ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 line-through dark:text-gray-600'}`}>
                                {l.itemNota.descricao}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Nota: <b>{l.itemNota.qtd} {l.itemNota.unidade}</b> · Total: <b>{fmt(l.itemNota.valor_total)}</b>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Seta */}
                        <div className="hidden md:flex md:col-span-1 items-center justify-center text-gray-400">
                          <ArrowRight size={18} />
                        </div>

                        {/* Vínculo Insumo MiseOn */}
                        <div className="md:col-span-6 space-y-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={l.criarNovo ? 'NOVO' : l.insumoId}
                              onChange={e => {
                                const v = e.target.value;
                                if (v === 'NOVO') {
                                  atualizarLinha(i, { criarNovo: true, insumoId: '' });
                                } else {
                                  const ins = porId.get(v);
                                  atualizarLinha(i, {
                                    criarNovo: false,
                                    insumoId: v,
                                    unidadeInsumo: ins?.unidade_medida || 'un'
                                  });
                                }
                              }}
                              className="flex-1 rounded-xl border border-gray-300 dark:border-gray-700 p-2.5 text-xs font-bold bg-white dark:bg-gray-950 dark:text-gray-100 focus:border-orange-500 outline-none"
                            >
                              <option value="NOVO">+ Criar Como Novo Insumo</option>
                              <optgroup label="Vincular a Insumo Existente">
                                {insumosExistentes.map(ins => (
                                  <option key={ins.id} value={ins.id}>{ins.nome} ({ins.unidade_medida})</option>
                                ))}
                              </optgroup>
                            </select>
                          </div>

                          {l.criarNovo && (
                            <div className="flex gap-2 mb-2">
                              <input
                                value={l.nomeNovoInsumo}
                                onChange={e => atualizarLinha(i, { nomeNovoInsumo: e.target.value })}
                                placeholder="Nome do Insumo"
                                className="flex-1 p-2 rounded-lg border border-blue-300 dark:border-blue-800 text-xs dark:bg-gray-950 dark:text-gray-100 font-bold"
                              />
                              <select
                                value={l.unidadeInsumo}
                                onChange={e => atualizarLinha(i, { unidadeInsumo: e.target.value })}
                                title="Como você quer controlar este item no estoque"
                                className="w-40 p-2 rounded-lg border border-blue-300 dark:border-blue-800 text-xs dark:bg-gray-950 dark:text-gray-100 font-bold"
                              >
                                {opcoesUnidade.map(u => (
                                  <option key={u.codigo} value={u.codigo}>{u.rotulo}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/*
                            Conversão da unidade da nota para a unidade de uso —
                            agora também ao criar insumo novo. O mercado vende
                            bandeja de ovo e tomate por quilo; quem decide se
                            aquilo vira unidade, grama ou porção é o lojista, não
                            o sistema.
                          */}
                          <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-800 text-xs">
                            <span className="text-gray-500 font-medium">
                              {mesmaUnidade
                                ? `Entra direto em ${unidadeDestino}. Ajuste se 1 ${unidadeNota} render outra quantidade:`
                                : `1 ${unidadeNota} rende quantos ${unidadeDestino}?`}
                            </span>
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={l.fatorConversao}
                              onChange={e => atualizarLinha(i, { fatorConversao: parseFloat(e.target.value) || 1 })}
                              className="w-20 p-1 rounded border border-gray-300 dark:border-gray-700 text-center font-bold dark:bg-gray-900 dark:text-gray-100"
                            />
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              = {Number(qtdFinal.toFixed(3))} {unidadeDestino} ({fmt(custoUnitFinal)}/{unidadeDestino})
                            </span>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {erro && (
            <p className="flex items-center gap-1.5 p-3 rounded-xl bg-red-50 text-xs font-bold text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle size={15} /> {erro}
            </p>
          )}
        </div>

        {/* Rodapé com Ação */}
        <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 p-4 bg-white dark:bg-gray-900">
          {podeRepetir && (
            <label className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
              <input
                type="checkbox"
                checked={repetirNota}
                onChange={e => setRepetirNota(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-amber-600"
              />
              <span>
                <b>Importar mesmo assim.</b> Esta nota já foi lançada antes — marcar isto soma tudo de novo
                ao estoque. Use só se a primeira importação foi desfeita.
              </span>
            </label>
          )}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400">
                {marcados.length === linhas.length ? 'Total da nota' : 'Total selecionado'}
              </p>
              <p className="text-xl font-black text-gray-900 dark:text-gray-100">{fmt(totalMarcado)}</p>
              {marcados.length !== linhas.length && (
                <p className="text-[10px] text-gray-400">nota inteira: {fmt(dadosNota.valor_total)}</p>
              )}
            </div>
            <button
              onClick={confirmarImportacao}
              disabled={salvando || carregandoMatch || marcados.length === 0}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg transition disabled:opacity-50"
            >
              {salvando
                ? <><Loader2 size={16} className="animate-spin" /> Lançando no Estoque...</>
                : <><CheckCircle2 size={18} /> Dar entrada em {marcados.length} {marcados.length === 1 ? 'item' : 'itens'}</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
