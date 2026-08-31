import { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, ArrowRight, CheckCircle2, AlertTriangle, X, Loader2, Building2, Calendar, DollarSign, Sparkles, TrendingUp, TrendingDown, CalendarClock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, fmt } from '../../types';
import { getUnidade } from '../../lib/unidades';
import {
  sugerirDaNota,
  fatorPara,
  normalizarTexto,
  unidadeSegura,
  GRUPOS_UNIDADE_COMPRA,
  CATALOGO,
  slugDoItem,
  type SugestaoImportacao,
} from '../../lib/catalogoInsumos';
import { aplicarClassificacao, type ClassificacaoIA } from '../../lib/classificacaoIA';
import { compararPreco, idadeDaNota, type UltimoCusto } from '../../lib/variacaoPreco';
import {
  sugerirValidade, ehPerecivel, avaliarValidade, recomendarModo, type ModoEntrada,
} from '../../lib/cicloDeVida';

import { useI18n } from '../../contexts/I18nContext';
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

/**
 * Casa o gênero reconhecido com um insumo já cadastrado.
 *
 * Compara sobre o nome canônico ("Ovos"), não sobre a descrição do mercado
 * ("APP1 OVOS EXTRA BRANCO PVC 20UN") — é o que faz a segunda nota reencontrar
 * o insumo que a primeira criou, em vez de fundar um sinônimo novo. Exige
 * palavra inteira: sem isso "Sal" casaria com "Salada".
 */
function casarInsumoPorNome(nome: string, insumos: Insumo[]): Insumo | undefined {
  const alvo = normalizarTexto(nome);
  if (!alvo) return undefined;
  const exato = insumos.find((i) => normalizarTexto(i.nome) === alvo);
  if (exato) return exato;
  return insumos.find((i) => {
    const dele = ` ${normalizarTexto(i.nome)} `;
    return dele.includes(` ${alvo} `) || ` ${alvo} `.includes(dele);
  });
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
  valor_produtos?: number;
  desconto?: number;
  itens: ItemLidoNFCe[];
}

/**
 * Quanto cada item custou de verdade, com o desconto da nota abatido.
 *
 * O cupom do atacado fecha assim: produtos 472,37, desconto 14,88, pago 457,49.
 * Lançar 472,37 no estoque infla o CMV em 3% — e o erro é invisível, porque
 * cada linha isolada está certa; só o total é que não foi isso que saiu do
 * caixa. O rateio é proporcional ao valor de cada linha, que é como o desconto
 * de nota se distribui contabilmente.
 *
 * O rateio usa TODOS os itens da nota como base, não só os marcados: a fatia de
 * desconto de um item pertence a ele, e desmarcar um sabonete não pode baratear
 * o quilo do tomate.
 */
function custoComDesconto(item: ItemLidoNFCe, nota: DadosNotaNFCe): number {
  const bruto = Number(item.valor_total) || 0;
  const desconto = Number(nota.desconto) || 0;
  if (desconto <= 0) return bruto;

  const somaItens = nota.itens.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);
  if (somaItens <= 0) return bruto;

  const proporcional = bruto - desconto * (bruto / somaItens);
  // Desconto maior que a nota é dado torto; nunca gerar custo negativo.
  return proporcional > 0 ? Number(proporcional.toFixed(4)) : bruto;
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
  /** Validade do item — sugerida pelo gênero, confirmada pelo lojista. */
  venceEm: string;
  confiancaMatch: 'ALTA' | 'MEDIA' | 'NENHUMA';
  /** O que o sistema entendeu da linha — mostrado para o lojista conferir. */
  sugestao: SugestaoImportacao;
}

interface Props {
  lojaId: string;
  dadosNota: DadosNotaNFCe;
  insumosExistentes: Insumo[];
  onFechar: () => void;
  onSucesso: (mensagem: string) => void;
}

export default function ModalImportarNFCe({ lojaId, dadosNota, insumosExistentes, onFechar, onSucesso }: Props) {
  const { tDynamic } = useI18n();
  const [linhas, setLinhas] = useState<LinhaDePara[]>([]);
  const [carregandoMatch, setCarregandoMatch] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Nota já lançada antes: só repete com confirmação explícita do lojista.
  const [podeRepetir, setPodeRepetir] = useState(false);
  const [repetirNota, setRepetirNota] = useState(false);
  /**
   * Como esta nota entra: somando ao saldo ou só como histórico de preço.
   *
   * Compra recente é saldo. Nota velha é decisão do lojista — só ele sabe se o
   * que veio nela ainda está na prateleira ou já virou prato vendido.
   */
  const [modoEntrada, setModoEntrada] = useState<ModoEntrada>('SOMAR');

  // Mapa rápido de insumos existentes por ID
  const porId = useMemo(() => new Map(insumosExistentes.map(i => [i.id, i])), [insumosExistentes]);

  // Carregar histórico de De-Para da loja e fazer auto-matching
  useEffect(() => {
    async function executarAutoMatch() {
      setCarregandoMatch(true);

      // Buscar histórico de De-Para gravado
      const [{ data: historico }, { data: custos }] = await Promise.all([
        supabase.from('compras_depara_itens').select('*').eq('loja_id', lojaId),
        supabase.from('vw_ultimo_custo_insumo')
          .select('insumo_id, custo_unitario, comprado_em')
          .eq('loja_id', lojaId),
      ]);

      setUltimosCustos(new Map(
        (custos ?? []).map((c: UltimoCusto) => [c.insumo_id, {
          insumo_id: c.insumo_id,
          custo_unitario: Number(c.custo_unitario) || 0,
          comprado_em: c.comprado_em,
        }]),
      ));

      const mapaHistorico = new Map<string, { insumo_id: string; fator_conversao: number }>();
      (historico || []).forEach(h => {
        mapaHistorico.set(h.chave_item_fornecedor, {
          insumo_id: h.insumo_id,
          fator_conversao: Number(h.fator_conversao) || 1
        });
      });

      const novasLinhas: LinhaDePara[] = dadosNota.itens.map(item => {
        const chaveChave = chaveDoItem(item, dadosNota.emitente?.cnpj);

        // O que o sistema entende da linha antes de olhar o cadastro: qual
        // gênero é, em que unidade ele se compra e quanto vem na embalagem.
        // É esse raciocínio que resolve as 53 decisões que sobravam para o
        // lojista tomar uma a uma no celular.
        const sugestao = sugerirDaNota({
          descricao: item.descricao,
          unidade: item.unidade,
          qtd: item.qtd,
        });

        /** Vincular a insumo existente: a unidade é a DELE, o fator se ajusta. */
        const vincular = (ins: Insumo, fator: number, confianca: LinhaDePara['confiancaMatch']): LinhaDePara => ({
          itemNota: item,
          importar: true,
          insumoId: ins.id,
          criarNovo: false,
          nomeNovoInsumo: sugestao.nome,
          unidadeInsumo: unidadeSegura(ins.unidade_medida),
          fatorConversao: fator,
          venceEm: sugerirValidade(sugestao.slug, dadosNota.data_emissao)?.vence_em ?? '',
          confiancaMatch: confianca,
          sugestao,
        });

        // 1. Nível 1: Match por Histórico — o de-para que o lojista já ensinou
        //    vale mais que qualquer palpite nosso.
        const hist = mapaHistorico.get(chaveChave) || mapaHistorico.get(item.descricao.trim().toUpperCase());
        if (hist && porId.has(hist.insumo_id)) {
          return vincular(porId.get(hist.insumo_id)!, hist.fator_conversao, 'ALTA');
        }

        // 2. Nível 2: Match por GTIN/EAN no cadastro existente
        if (item.gtin) {
          const matchEan = insumosExistentes.find(
            i => i.gtin === item.gtin || (i as any).detalhes_rendimento?.gtin === item.gtin,
          );
          if (matchEan) {
            // Mesmo código de barras: a embalagem é idêntica, então o conteúdo
            // lido na descrição vale se a unidade do insumo for a mesma.
            const fator = unidadeSegura(matchEan.unidade_medida) === sugestao.unidade ? sugestao.fator : 1;
            return vincular(matchEan, fator, 'ALTA');
          }
        }

        // 3. Nível 3: Match pelo gênero reconhecido. Casa "APP1 OVOS EXTRA
        //    BRANCO PVC 20UN" com o insumo "Ovos" que já existe — o nome do
        //    mercado nunca casaria sozinho.
        const matchNome = casarInsumoPorNome(sugestao.nome, insumosExistentes);
        if (matchNome) {
          const fator = unidadeSegura(matchNome.unidade_medida) === sugestao.unidade ? sugestao.fator : 1;
          return vincular(matchNome, fator, 'MEDIA');
        }

        // 4. Nada no cadastro: nasce insumo novo, já na medida em que o gênero
        //    é comprado no Brasil — e nunca na sigla crua da nota.
        return {
          itemNota: item,
          importar: true,
          insumoId: '',
          criarNovo: true,
          nomeNovoInsumo: sugestao.nome,
          unidadeInsumo: unidadeSegura(sugestao.unidade),
          fatorConversao: sugestao.fator,
          venceEm: sugerirValidade(sugestao.slug, dadosNota.data_emissao)?.vence_em ?? '',
          confiancaMatch: 'NENHUMA',
          sugestao,
        };
      });

      setLinhas(novasLinhas);
      setCarregandoMatch(false);
    }

    executarAutoMatch();
  }, [lojaId, dadosNota, insumosExistentes, porId]);

  /**
   * Organização por IA do que o catálogo não reconheceu.
   *
   * Roda sozinha, em segundo plano, assim que o cruzamento determinístico
   * termina — e SÓ para as linhas que sobraram sem gênero. O catálogo resolve o
   * que se repete toda semana de graça e na hora; mandar tudo para a IA seria
   * pagar e esperar por resposta que já se tinha.
   *
   * Enquanto ela pensa, a tela continua utilizável: as sugestões chegam por
   * cima do que já está lá, sem apagar nada que o lojista tenha mexido.
   */
  const [classificandoIA, setClassificandoIA] = useState(false);
  const [organizadosIA, setOrganizadosIA] = useState(0);
  const [jaClassificou, setJaClassificou] = useState(false);
  /**
   * Último custo pago por insumo, para comparar com o desta nota.
   *
   * Carregado junto com o de-para, numa consulta só: o alerta de aumento tem
   * que estar na tela quando o lojista olha a linha, não depois que ele
   * confirmou a entrada.
   */
  const [ultimosCustos, setUltimosCustos] = useState<Map<string, UltimoCusto>>(new Map());

  useEffect(() => {
    if (carregandoMatch || jaClassificou || linhas.length === 0) return;

    // Sem gênero reconhecido é o que a IA tem a acrescentar. O resto já está
    // decidido por regra, e regra não se troca por palpite.
    const pendentes = linhas
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.criarNovo && !l.sugestao.slug);

    if (pendentes.length === 0) {
      setJaClassificou(true);
      return;
    }

    let cancelado = false;
    setJaClassificou(true);
    setClassificandoIA(true);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('nfe-classificar-itens', {
          body: {
            loja_id: lojaId,
            itens: pendentes.map(({ l, i }) => ({
              indice: i, descricao: l.itemNota.descricao, unidade: l.itemNota.unidade,
            })),
            generos: CATALOGO.map((c) => ({ slug: slugDoItem(c), nome: c.nome, unidade: c.unidade })),
          },
        });

        const classificacoes = (data as { itens?: ClassificacaoIA[] } | null)?.itens;
        if (cancelado || error || !classificacoes?.length) return;

        setLinhas((prev) => {
          const proximo = [...prev];
          let aplicados = 0;
          for (const c of classificacoes) {
            const linha = proximo[c.indice];
            // A linha pode ter sido editada enquanto a IA pensava: o que o
            // lojista mexeu com a própria mão vale mais que a sugestão.
            if (!linha || !linha.criarNovo || linha.sugestao.slug) continue;
            const sugerido = aplicarClassificacao(linha.itemNota, c);
            proximo[c.indice] = {
              ...linha,
              nomeNovoInsumo: sugerido.nomeCompleto || linha.nomeNovoInsumo,
              unidadeInsumo: unidadeSegura(sugerido.unidade),
              fatorConversao: sugerido.fator,
              sugestao: sugerido,
            };
            aplicados++;
          }
          setOrganizadosIA(aplicados);
          return proximo;
        });
      } catch {
        // Falha de IA não pode travar a importação: a nota segue com o que o
        // catálogo já decidiu, e o lojista ajusta o que precisar.
      } finally {
        if (!cancelado) setClassificandoIA(false);
      }
    })();

    return () => { cancelado = true; };
  }, [carregandoMatch, jaClassificou, linhas, lojaId]);

  const idade = useMemo(() => idadeDaNota(dadosNota.data_emissao), [dadosNota.data_emissao]);
  const recomendacao = useMemo(() => recomendarModo(idade?.dias ?? null), [idade]);

  const marcados = useMemo(() => linhas.filter((l) => l.importar), [linhas]);
  const totalMarcado = useMemo(
    () => marcados.reduce((acc, l) => acc + (Number(l.itemNota.valor_total) || 0), 0),
    [marcados],
  );
  const contagem = useMemo(() => ({
    alta: linhas.filter((l) => l.confiancaMatch === 'ALTA').length,
    media: linhas.filter((l) => l.confiancaMatch === 'MEDIA').length,
    novos: linhas.filter((l) => l.criarNovo).length,
    conferir: linhas.filter((l) => l.importar && l.sugestao.confianca === 'baixa').length,
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

  /**
   * Trocar a unidade obriga a refazer a conta do rendimento. Manter o fator
   * antigo transformaria "bandeja com 20 ovos" em "20 kg de ovo" — erro que só
   * apareceria no CMV, semanas depois.
   */
  const trocarUnidade = (index: number, codigo: string) => {
    setLinhas(prev => {
      const linha = prev[index];
      if (!linha) return prev;
      const unidade = unidadeSegura(codigo);
      const proximo = [...prev];
      proximo[index] = {
        ...linha,
        unidadeInsumo: unidade,
        fatorConversao: fatorPara(linha.itemNota, unidade).fator,
      };
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
          // Última barreira antes do banco. `insumos.unidade_medida` tem chave
          // estrangeira para o catálogo: uma sigla de nota que escape até aqui
          // não erra um item, derruba a nota inteira — foi o que aconteceu com
          // "bd" e os 53 itens.
          const unidade = unidadeSegura(
            l.unidadeInsumo || porId.get(insumoExistente ?? '')?.unidade_medida,
          );
          return {
            criar_novo: !insumoExistente,
            insumo_id: insumoExistente,
            nome: l.nomeNovoInsumo.trim() || l.itemNota.descricao,
            unidade,
            // Mesmo gênero que o cadastro manual grava: um tomate que entra
            // pela nota e outro digitado à mão têm que somar no mesmo
            // relatório, senão o agrupamento só vale para metade do estoque.
            catalogo_ref: l.sugestao.slug,
            // Troca de unidade de insumo existente: a RPC so aplica com saldo
            // zerado, senao o saldo antigo passaria a significar outra coisa.
            trocar_unidade: !!insumoExistente && unidade !== porId.get(insumoExistente)?.unidade_medida,
            qtd_nota: Number(l.itemNota.qtd) || 0,
            fator: Number(l.fatorConversao) || 1,
            custo_total: custoComDesconto(l.itemNota, dadosNota),
            chave_depara: chaveDoItem(l.itemNota, dadosNota.emitente?.cnpj),
            descricao_nota: l.itemNota.descricao,
            gtin: l.itemNota.gtin || null,
            // Validade sustenta o alerta de vencimento e o PVPS: entre lotes
            // do mesmo dia, sai primeiro o que vence antes.
            vence_em: l.venceEm || null,
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
        // A entrada é registrada na data da COMPRA. Sem isto, cupom guardado
        // na gaveta entra como se tivesse chegado hoje e desordena o PEPS.
        p_data_emissao: dadosNota.data_emissao || null,
        p_modo: modoEntrada,
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
                <h3 className="font-black text-xl text-gray-900 dark:text-gray-100">{tDynamic('Conferência de Cupom Fiscal (NFC-e)')}</h3>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 uppercase tracking-wider">
                  SEFAZ {dadosNota.uf}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1 font-semibold"><Building2 size={13} /> {dadosNota.emitente.razao_social}</span>
                {dadosNota.data_emissao && (
                  <span className={`flex items-center gap-1 ${idade?.antiga ? 'font-bold text-amber-600 dark:text-amber-400' : ''}`}>
                    <Calendar size={13} /> {new Date(dadosNota.data_emissao).toLocaleDateString('pt-BR')}
                  </span>
                )}
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
              <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{tDynamic('Cruzando itens da nota com o seu estoque...')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tDynamic('Verificando memória de De-Para e sugestões por nome.')}</p>
            </div>
          ) : (
            <div>
              {/*
                Barra de controle. Cupom de mercado vem com dezenas de linhas e
                mistura insumo da cozinha com compra pessoal — revisar item a
                item no celular é justamente o trabalho que a importação
                deveria eliminar. Daqui o lojista resolve tudo em dois toques.
              */}
              {/*
                Cupom guardado na gaveta entra com a data da compra, não com a
                de hoje — mas o lojista precisa saber disso antes de conferir o
                saldo contra uma prateleira que já mudou desde então.
              */}
              {recomendacao.perguntar && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/15">
                  <div className="flex items-start gap-2">
                    <Calendar size={15} className="mt-px shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-xs font-black text-amber-800 dark:text-amber-300">
                        {tDynamic(recomendacao.titulo)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400/90">
                        {recomendacao.explicacao}
                      </p>
                    </div>
                  </div>
                  {/*
                    A pergunta só o lojista responde: o sistema não sabe se o
                    arroz de três semanas atrás ainda está na prateleira ou já
                    virou marmita vendida.
                  */}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setModoEntrada('SOMAR')}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                        modoEntrada === 'SOMAR'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'border border-gray-300 text-gray-600 hover:bg-white dark:border-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {tDynamic('Ainda tenho: somar ao estoque')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoEntrada('HISTORICO')}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                        modoEntrada === 'HISTORICO'
                          ? 'bg-blue-600 text-white shadow'
                          : 'border border-gray-300 text-gray-600 hover:bg-white dark:border-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {tDynamic('Já usei: registrar só o preço')}
                    </button>
                  </div>
                </div>
              )}

              {modoEntrada === 'HISTORICO' && (
                <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-900/15">
                  <p className="text-[11px] font-bold text-blue-800 dark:text-blue-300">
                    {tDynamic('Modo histórico: o saldo do estoque não muda. O sistema guarda o preço desta compra para comparar com as próximas.')}
                  </p>
                </div>
              )}

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
                      {tDynamic('Só os já cadastrados')}
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                  <span><b className="text-emerald-600 dark:text-emerald-400">{contagem.alta}</b> reconhecidos automaticamente</span>
                  <span><b className="text-amber-600 dark:text-amber-400">{contagem.media}</b> por sugestão de nome</span>
                  <span><b className="text-blue-600 dark:text-blue-400">{contagem.novos}</b> vão virar insumo novo</span>
                  {contagem.conferir > 0 && (
                    <span><b className="text-orange-600 dark:text-orange-400">{contagem.conferir}</b> {tDynamic('pedem conferência')}</span>
                  )}
                  {/* A IA trabalha sozinha no que o catálogo não conhecia; o
                      lojista só precisa saber que está acontecendo. */}
                  {classificandoIA && (
                    <span className="flex items-center gap-1 font-bold text-violet-600 dark:text-violet-400">
                      <Loader2 size={11} className="animate-spin" /> {tDynamic('organizando os itens novos com IA...')}
                    </span>
                  )}
                  {!classificandoIA && organizadosIA > 0 && (
                    <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400">
                      <Sparkles size={11} />
                      <b>{organizadosIA}</b> {tDynamic('organizados pela IA')}
                    </span>
                  )}
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
                  const custoUnitFinal = qtdFinal > 0 ? custoComDesconto(l.itemNota, dadosNota) / qtdFinal : 0;
                  // A unidade de destino é escolha do lojista: ao criar insumo
                  // novo, a que ele selecionou; ao vincular, a do insumo dele.
                  const unidadeDestino = l.unidadeInsumo || insumoSelecionado?.unidade_medida || 'un';
                  const unidadeNota = l.itemNota.unidade || 'un';
                  const mesmaUnidade = l.sugestao.unidadeNota === unidadeDestino;
                  const saldoDoInsumo = Number(insumoSelecionado?.quantidade_atual ?? 0);
                  const unidadeTrocada = !l.criarNovo && !!insumoSelecionado
                    && l.unidadeInsumo !== insumoSelecionado.unidade_medida;
                  // A sigla da nota NÃO entra na lista. Ela não existe no
                  // catálogo do banco, e oferecê-la era o que quebrava a
                  // importação inteira. Ela continua visível como informação —
                  // logo abaixo, em "na nota veio como" — só não é escolhível.
                  // Insumo legado cadastrado numa quebra semântica ("porção",
                  // "rodela") não pode sumir do seletor: some do select e o
                  // React trocaria a unidade dele sozinho, sem ninguém pedir.
                  // Compara com o que este insumo custou da última vez. Só
                  // existe para item já cadastrado — no insumo novo não há
                  // história, e inventar comparação seria ruído.
                  const variacao = compararPreco(
                    custoUnitFinal,
                    l.insumoId ? ultimosCustos.get(l.insumoId) : null,
                    unidadeDestino,
                  );

                  const alertaValidade = avaliarValidade(l.venceEm, ehPerecivel(l.sugestao.slug));

                  const unidadeLegada = !GRUPOS_UNIDADE_COMPRA.some(g =>
                    g.unidades.some(u => u.codigo === unidadeDestino))
                    ? getUnidade(unidadeDestino)
                    : undefined;

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
                                {/* O que o sistema não conseguiu deduzir sozinho vem marcado: o
                                    lojista confere só essas linhas, não as 53. */}
                                {(l.sugestao as { daIA?: boolean }).daIA && (
                                  <span className="flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-black text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                    <Sparkles size={9} /> IA
                                  </span>
                                )}
                                {l.importar && l.sugestao.confianca === 'baixa' && (
                                  <span className="rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[9px] font-black px-1.5 py-0.5">{tDynamic('CONFIRA')}</span>
                                )}
                                {!l.importar && <span className="rounded-full bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400 text-[9px] font-black px-1.5 py-0.5">{tDynamic('FORA DA IMPORTAÇÃO')}</span>}
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
                                // Trocar o destino muda a unidade de chegada, e
                                // o rendimento tem que acompanhar: 20 ovos por
                                // bandeja não vira 20 kg só porque o lojista
                                // apontou para outro insumo.
                                if (v === 'NOVO') {
                                  atualizarLinha(i, {
                                    criarNovo: true,
                                    insumoId: '',
                                    nomeNovoInsumo: l.sugestao.nome,
                                    unidadeInsumo: unidadeSegura(l.sugestao.unidade),
                                    fatorConversao: l.sugestao.fator,
                                  });
                                } else {
                                  const ins = porId.get(v);
                                  const unidade = unidadeSegura(ins?.unidade_medida);
                                  atualizarLinha(i, {
                                    criarNovo: false,
                                    insumoId: v,
                                    unidadeInsumo: unidade,
                                    fatorConversao: fatorPara(l.itemNota, unidade).fator,
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

                          {l.criarNovo ? (
                            <div className="flex gap-2 mb-2">
                              <input
                                value={l.nomeNovoInsumo}
                                onChange={e => atualizarLinha(i, { nomeNovoInsumo: e.target.value })}
                                placeholder="Nome do Insumo"
                                className="flex-1 p-2 rounded-lg border border-blue-300 dark:border-blue-800 text-xs dark:bg-gray-950 dark:text-gray-100 font-bold"
                              />
                              <select
                                value={l.unidadeInsumo}
                                onChange={e => trocarUnidade(i, e.target.value)}
                                title="Como você quer controlar este item no estoque"
                                className="w-40 p-2 rounded-lg border border-blue-300 dark:border-blue-800 text-xs dark:bg-gray-950 dark:text-gray-100 font-bold"
                              >
                                {unidadeLegada && (
                                  <option value={unidadeLegada.codigo}>{unidadeLegada.rotulo}</option>
                                )}
                                {GRUPOS_UNIDADE_COMPRA.map(g => (
                                  <optgroup key={g.rotulo} label={tDynamic(g.rotulo)}>
                                    {g.unidades.map(u => (
                                      <option key={u.codigo} value={u.codigo}>{u.rotulo}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </div>
                          ) : (
                            /*
                              Vincular a insumo existente nao pode significar
                              aceitar a unidade dele calada. Tomate cadastrado
                              em "rodela" nao obriga a compra em quilo a virar
                              rodela — quem manda na unidade e o dono da
                              cozinha, aqui tambem.
                            */
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                {tDynamic('Controlar no estoque em:')}
                              </span>
                              <select
                                value={l.unidadeInsumo}
                                onChange={e => trocarUnidade(i, e.target.value)}
                                disabled={saldoDoInsumo > 0}
                                title={saldoDoInsumo > 0
                                  ? 'Zere o saldo deste insumo para poder trocar a unidade'
                                  : 'Unidade em que este insumo passa a ser controlado'}
                                className="w-44 p-2 rounded-lg border border-gray-300 dark:border-gray-700 text-xs dark:bg-gray-950 dark:text-gray-100 font-bold disabled:opacity-60"
                              >
                                {unidadeLegada && (
                                  <option value={unidadeLegada.codigo}>{unidadeLegada.rotulo}</option>
                                )}
                                {GRUPOS_UNIDADE_COMPRA.map(g => (
                                  <optgroup key={g.rotulo} label={tDynamic(g.rotulo)}>
                                    {g.unidades.map(u => (
                                      <option key={u.codigo} value={u.codigo}>{u.rotulo}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              {saldoDoInsumo > 0 && unidadeTrocada && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                  tem {saldoDoInsumo} {insumoSelecionado?.unidade_medida} em estoque — zere antes de trocar
                                </span>
                              )}
                              {saldoDoInsumo === 0 && unidadeTrocada && (
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                  o insumo passa a ser controlado em {l.unidadeInsumo}
                                </span>
                              )}
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
                            {/*
                              O sistema mostra o que entendeu antes de pedir
                              qualquer coisa. Ler "a embalagem diz 20UN" é o que
                              faz o lojista confiar no número — e conferir 53
                              linhas com o olho, em vez de digitar 53 vezes.
                            */}
                            <span className="w-full text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                              {l.sugestao.explicacao}
                              <span className="ml-1 text-gray-400 dark:text-gray-500">
                                {tDynamic('Na nota veio como')} <b>{unidadeNota}</b>.
                              </span>
                            </span>
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
                            {/*
                              O aumento do fornecedor aparece aqui, e não num
                              relatório de fim de mês: este é o único momento em
                              que o lojista ainda pode ligar para o vendedor,
                              trocar de fornecedor ou repensar o preço de venda.
                            */}
                            {variacao && variacao.relevante && (
                              <span className={`flex w-full items-center gap-1 text-[11px] font-bold ${
                                variacao.direcao === 'alta'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}>
                                {variacao.direcao === 'alta'
                                  ? <TrendingUp size={12} className="shrink-0" />
                                  : <TrendingDown size={12} className="shrink-0" />}
                                {variacao.texto}
                              </span>
                            )}
                            {variacao && !variacao.relevante && (
                              <span className="w-full text-[11px] text-gray-400 dark:text-gray-500">
                                {variacao.texto}
                              </span>
                            )}

                            {/*
                              Validade: sugerida pelo gênero, confirmada em um
                              toque. Ninguém digita 53 datas — e é por isso que
                              hoje o controle de vencimento não avisa nada.
                            */}
                            {modoEntrada === 'SOMAR' && (
                              <span className="flex w-full flex-wrap items-center gap-2 border-t border-gray-100 pt-1.5 dark:border-gray-800">
                                <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                  <CalendarClock size={12} /> {tDynamic('Vence em')}
                                </span>
                                <input
                                  type="date"
                                  value={l.venceEm}
                                  onChange={e => atualizarLinha(i, { venceEm: e.target.value })}
                                  className={`rounded border p-1 text-[11px] dark:bg-gray-900 dark:text-gray-100 ${
                                    alertaValidade.critico
                                      ? 'border-amber-400 dark:border-amber-600'
                                      : 'border-gray-300 dark:border-gray-700'
                                  }`}
                                />
                                <span className={`text-[11px] ${
                                  alertaValidade.situacao === 'vencido'
                                    ? 'font-bold text-red-600 dark:text-red-400'
                                    : alertaValidade.critico
                                      ? 'font-bold text-amber-600 dark:text-amber-400'
                                      : 'text-gray-400 dark:text-gray-500'
                                }`}>
                                  {alertaValidade.texto}
                                </span>
                              </span>
                            )}
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
              {/*
                O desconto da nota não é detalhe de exibição: ele muda o custo
                que entra no estoque. Mostrar aqui é o que permite ao lojista
                conferir contra o papel — soma dos itens menos desconto tem que
                bater com o que ele pagou.
              */}
              {Number(dadosNota.desconto) > 0 && (
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {tDynamic('desconto de')} {fmt(Number(dadosNota.desconto))} {tDynamic('já abatido no custo de cada item')}
                </p>
              )}
            </div>
            <button
              onClick={confirmarImportacao}
              disabled={salvando || carregandoMatch || marcados.length === 0}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg transition disabled:opacity-50"
            >
              {salvando
                ? <><Loader2 size={16} className="animate-spin" /> {tDynamic('Lançando no Estoque...')}</>
                : modoEntrada === 'HISTORICO'
                  ? <><CheckCircle2 size={18} /> {tDynamic('Registrar preço de')} {marcados.length} {marcados.length === 1 ? 'item' : 'itens'}</>
                  : <><CheckCircle2 size={18} /> Dar entrada em {marcados.length} {marcados.length === 1 ? 'item' : 'itens'}</>}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
