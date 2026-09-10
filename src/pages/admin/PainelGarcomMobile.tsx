import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Smartphone, CheckCircle, Volume2, Divide, ChevronRight, Zap, Receipt, Clock, Plus, X, Minus, WalletCards } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useGarcomPush } from '../../hooks/useGarcomPush';
import { fecharComandaBuffet, lancarItemAvulsoComanda } from '../../lib/comandas';
import type { CtxLoja } from './AdminLayout';
import type { Mesa, Produto, Comanda, MetodoPgto } from '../../types';
import { ModalDivisaoItemGarcom } from '../../components/mesas/ModalDivisaoItemGarcom';

import { useI18n } from '../../contexts/I18nContext';

function tempoDecorrido(desde: string): string {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(desde).getTime()) / 60000));
  if (minutos < 1) return 'agora há pouco';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `há ${horas}h${resto > 0 ? ` ${resto}min` : ''}`;
}

export function PainelGarcomMobile() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();
  const {
    chamadosPendentes,
    pushHabilitado,
    solicitarPermissaoPush,
    atenderChamado,
    concluirChamado,
  } = useGarcomPush(lojaId);

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [comandasBuffet, setComandasBuffet] = useState<Comanda[]>([]);
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  const [produtoParaFracionar, setProdutoParaFracionar] = useState<Produto | null>(null);
  const [comandaParaLancar, setComandaParaLancar] = useState<Comanda | null>(null);
  const [comandaParaFechar, setComandaParaFechar] = useState<Comanda | null>(null);
  const [observacaoMesa, setObservacaoMesa] = useState('');

  const carregarMesasEProdutos = useCallback(async () => {
    if (!lojaId) return;
    const [{ data: ms }, { data: ps }, { data: cs }] = await Promise.all([
      supabase.from('mesas').select('*').eq('loja_id', lojaId).eq('ativo', true).order('numero'),
      // Com os grupos de opções: é assim que "ponto da carne" e "com gelo e
      // limão" chegam ao garçom. São modificadores do cardápio (com preço,
      // disponibilidade e insumo próprio), não texto que ele digita de memória.
      supabase.from('produtos').select('*, grupos_opcoes(*, opcoes(*))')
        .eq('loja_id', lojaId).eq('disponivel', true),
      supabase
        .from('comandas')
        .select('*')
        .eq('loja_id', lojaId)
        .eq('status', 'ABERTA')
        .eq('tipo_comanda', 'INDIVIDUAL')
        .order('aberta_em', { ascending: false }),
    ]);

    setMesas((ms as Mesa[]) || []);
    setProdutos((ps as Produto[]) || []);
    setComandasBuffet((cs as Comanda[]) || []);
  }, [lojaId]);

  useEffect(() => {
    carregarMesasEProdutos();
  }, [carregarMesasEProdutos]);

  const lancarItemNaComandaBuffet = async (
    produto: Produto,
    quantidade: number,
    observacao: string,
    opcoes: { id: string }[],
  ) => {
    if (!comandaParaLancar || !lojaId) return;
    try {
      await lancarItemAvulsoComanda({
        lojaId,
        comandaId: comandaParaLancar.id,
        produtoId: produto.id,
        nomeProduto: produto.nome,
        precoUnitario: produto.preco,
        quantidade,
        observacao: observacao.trim() || null,
        opcoes,
      });
      setComandaParaLancar(null);
      await carregarMesasEProdutos();
    } catch (err: any) {
      console.error('Erro ao lançar item na comanda do buffet:', err);
      alert(err?.message || 'Falha ao lançar item na comanda.');
    }
  };

  const receberEFecharComanda = async (metodo: Exclude<MetodoPgto, 'IFOOD'>) => {
    if (!comandaParaFechar) return;
    try {
      await fecharComandaBuffet(comandaParaFechar.id, metodo);
      setComandaParaFechar(null);
      await carregarMesasEProdutos();
    } catch (err: any) {
      console.error('Erro ao receber e fechar comanda:', err);
      alert(err?.message || 'Falha ao fechar a comanda. Confira o recebimento e tente novamente.');
    }
  };

  const lancarItemFracionado = async (produto: Produto, assentos: number[]) => {
    if (!mesaSelecionada || !lojaId) return;

    try {
      // Buscar ou criar comanda aberta da mesa
      let { data: comanda } = await supabase
        .from('comandas')
        .select('*')
        .eq('loja_id', lojaId)
        .eq('mesa_id', mesaSelecionada.id)
        .eq('status', 'ABERTA')
        .maybeSingle();

      if (!comanda) {
        const { data: novaCom, error: errCom } = await supabase
          .from('comandas')
          .insert({
            loja_id: lojaId,
            mesa_id: mesaSelecionada.id,
            status: 'ABERTA',
            taxa_servico_pct: 10,
            valor_servico: 0,
          })
          .select()
          .single();

        if (errCom) throw errCom;
        comanda = novaCom;
      }

      // Buscar ou criar pedido vinculado
      let { data: pedido } = await supabase
        .from('pedidos')
        .select('*')
        .eq('comanda_id', comanda.id)
        .neq('status', 'CANCELADO')
        .maybeSingle();

      if (!pedido) {
        const { data: novoPed, error: errPed } = await supabase
          .from('pedidos')
          .insert({
            loja_id: lojaId,
            comanda_id: comanda.id,
            mesa_numero: mesaSelecionada.numero,
            tipo_pedido: 'SALAO',
            status: 'ACEITO',
            identificador_cliente: `Mesa #${mesaSelecionada.numero}`,
            subtotal: 0,
            taxa_entrega: 0,
            desconto: 0,
            valor_total: 0,
            origem: 'garcom_mobile',
          })
          .select()
          .single();

        if (errPed) throw errPed;
        pedido = novoPed;
      }

      // Fracionar e inserir 1 registro para cada assento selecionado
      const fracao = 1 / assentos.length;
      const precoFracionado = Number((produto.preco * fracao).toFixed(2));

      const inserts = assentos.map((assentoNum) => ({
        pedido_id: pedido.id,
        produto_id: produto.id,
        nome_produto: `${produto.nome} (1/${assentos.length})`,
        preco_unitario: precoFracionado,
        quantidade: 1,
        fracionado: true,
        participantes_assentos: assentos,
        assento_numero: assentoNum,
        // Ponto da carne, "sem cebola": o que o cliente fala na mesa só chega
        // em quem prepara se viajar no item. Sem isto, a cozinha adivinha.
        observacao: observacaoMesa.trim() || null,
      }));

      const { error: errItens } = await supabase.from('itens_pedido').insert(inserts);
      if (errItens) throw errItens;

      // Recalcular total do pedido
      const { data: todosItens } = await supabase
        .from('itens_pedido')
        .select('preco_unitario, quantidade')
        .eq('pedido_id', pedido.id);

      const novoSubtotal = (todosItens || []).reduce(
        (acc, item) => acc + Number(item.preco_unitario) * Number(item.quantidade),
        0
      );

      await supabase
        .from('pedidos')
        .update({ subtotal: novoSubtotal, valor_total: novoSubtotal })
        .eq('id', pedido.id);

      setProdutoParaFracionar(null);
      setObservacaoMesa('');
      alert(`✅ ${produto.nome} fracionado com sucesso entre os assentos [${assentos.join(', ')}]!`);
    } catch (err: any) {
      console.error('Erro ao fracionar item no lançamento:', err);
      alert('Falha ao lançar item fracionado.');
    }
  };

  return (
    <div className="mx-auto max-w-md p-4 space-y-6 pb-24">
      {/* Header Garçom Mobile */}
      <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-slate-950 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Smartphone size={22} />
            <span>{tDynamic('Garçom Mobile PWA')}</span>
          </div>
          <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-xs font-bold">
            Ao Vivo
          </span>
        </div>

        <p className="text-xs font-medium text-slate-900 opacity-90">
          {tDynamic('Receba chamados com vibração e lance pedidos com fracionamento automático na mesa.')}
        </p>

        {!pushHabilitado && (
          <button
            onClick={solicitarPermissaoPush}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 py-2.5 text-xs font-bold text-orange-400 shadow-md hover:bg-slate-900 transition"
          >
            <Volume2 size={16} /> {tDynamic('Ativar Vibração & Notificações Push')}
          </button>
        )}
      </div>

      {/* Seção de Chamados com Alerta Hálptico */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Bell size={14} className="text-orange-400" />
          Chamados Pendentes no Salão ({chamadosPendentes.length})
        </h2>

        {chamadosPendentes.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center text-xs text-slate-400 space-y-1">
            <CheckCircle size={28} className="mx-auto text-emerald-500/60 mb-2" />
            <div className="font-semibold text-slate-300">{tDynamic('Nenhum chamado no momento')}</div>
            <div>{tDynamic('O dispositivo vibrará quando um cliente solicitar atendimento.')}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {chamadosPendentes.map((chamado) => (
              <div
                key={chamado.id}
                className={`rounded-2xl p-4 border shadow-lg space-y-3 animate-pulse ${
                  chamado.tipo === 'FECHAMENTO'
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                    : 'bg-orange-500/10 border-orange-500/40 text-orange-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-base flex items-center gap-1.5">
                    <Zap size={16} className="text-amber-400" />
                    {chamado.mesa_numero
                      ? `Mesa #${chamado.mesa_numero}`
                      : chamado.comanda_numero_cartao
                        ? `Comanda #${chamado.comanda_numero_cartao}`
                        : 'Geral'}
                  </span>
                  <span className="text-xs font-mono font-semibold rounded-full bg-slate-950/60 px-2.5 py-0.5 border border-slate-800">
                    {chamado.tipo}
                  </span>
                </div>

                <p className="text-xs opacity-90">
                  {chamado.mensagem ||
                    (chamado.tipo === 'FECHAMENTO'
                      ? 'Cliente solicitou o fechamento da conta!'
                      : 'Cliente solicita garçom para atendimento.')}
                </p>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => atenderChamado(chamado.id)}
                    className="flex-1 rounded-xl bg-orange-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-orange-400 transition"
                  >
                    Atender Agora
                  </button>
                  <button
                    onClick={() => concluirChamado(chamado.id)}
                    className="rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção de Comandas do Buffet — nascem sozinhas na balança, o garçom
          entra em cena para lançar bebida, sobremesa ou repique de prato. */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Receipt size={14} className="text-amber-400" />
          {tDynamic('Comandas do Buffet Abertas')} ({comandasBuffet.length})
        </h2>

        {comandasBuffet.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-5 text-center text-xs text-slate-500">
            {tDynamic('Nenhuma comanda de buffet aberta no momento.')}
          </div>
        ) : (
          <div className="space-y-2.5">
            {comandasBuffet.map((comanda) => (
              <div
                key={comanda.id}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
                      #{comanda.numero_cartao ?? 'sem número'}
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> {tDynamic('Viva')}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock size={12} /> {tempoDecorrido(comanda.aberta_em)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setComandaParaLancar(comanda)}
                    className="flex items-center justify-center gap-1 rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-bold text-orange-400 hover:bg-slate-700"
                  >
                    <Plus size={14} /> {tDynamic('Lançar item')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setComandaParaFechar(comanda)}
                    className="flex items-center justify-center gap-1 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                  >
                    <WalletCards size={14} /> {tDynamic('Receber e fechar')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seção de Lançamento de Itens por Mesa com Fracionamento */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Divide size={14} className="text-amber-400" />
          {tDynamic('Lançar Pedido / Método 1 (Fracionado)')}
        </h2>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Selecione a Mesa
            </label>
            <select
              value={mesaSelecionada?.id || ''}
              onChange={(e) => {
                const m = mesas.find((x) => x.id === e.target.value) || null;
                setMesaSelecionada(m);
              }}
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:border-orange-500 focus:outline-none"
            >
              <option value="">Selecione a mesa...</option>
              {mesas.map((m) => (
                <option key={m.id} value={m.id}>
                  Mesa #{m.numero} {m.nome ? `(${m.nome})` : ''}
                </option>
              ))}
            </select>
          </div>

          {mesaSelecionada && (
            <div className="space-y-2">
              {/* O ponto da carne é dito na mesa, não na chapa. Se não sair
                  daqui junto com o item, a cozinha adivinha. */}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">
                  {tDynamic('Observação para a cozinha (vai junto com o item)')}
                </span>
                <input
                  value={observacaoMesa}
                  onChange={(e) => setObservacaoMesa(e.target.value)}
                  placeholder="ex: ao ponto, sem cebola, alergia a amendoim…"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
                />
              </label>

              <label className="block text-xs font-medium text-slate-400">
                Toque no produto para fracionar entre os assentos da Mesa #{mesaSelecionada.numero}:
              </label>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {produtos.map((prod) => (
                  <button
                    key={prod.id}
                    onClick={() => setProdutoParaFracionar(prod)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-orange-500/50 text-left transition"
                  >
                    <div>
                      <div className="font-semibold text-slate-200 text-xs">{prod.nome}</div>
                      <div className="text-xs opacity-95 text-slate-400 font-mono">
                        R$ {Number(prod.preco).toFixed(2)}
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-bold text-orange-400">
                      Rachar <ChevronRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Método 1: Garçom Fraciona no Lançamento */}
      {produtoParaFracionar && mesaSelecionada && (
        <ModalDivisaoItemGarcom
          produto={produtoParaFracionar}
          capacidadeMesa={mesaSelecionada.capacidade || 6}
          onCancelar={() => setProdutoParaFracionar(null)}
          onConfirmar={(assentos) => lancarItemFracionado(produtoParaFracionar, assentos)}
        />
      )}

      {/* Modal: Lançar item avulso (bebida, sobremesa, repique) na comanda do buffet */}
      {comandaParaLancar && (
        <ModalLancarItemComanda
          comanda={comandaParaLancar}
          produtos={produtos}
          onCancelar={() => setComandaParaLancar(null)}
          onConfirmar={lancarItemNaComandaBuffet}
        />
      )}

      {comandaParaFechar && (
        <ModalFecharComanda
          comanda={comandaParaFechar}
          onCancelar={() => setComandaParaFechar(null)}
          onConfirmar={receberEFecharComanda}
        />
      )}
    </div>
  );
}

function ModalFecharComanda({
  comanda,
  onCancelar,
  onConfirmar,
}: {
  comanda: Comanda;
  onCancelar: () => void;
  onConfirmar: (metodo: Exclude<MetodoPgto, 'IFOOD'>) => Promise<void>;
}) {
  const { tDynamic } = useI18n();
  const [metodo, setMetodo] = useState<Exclude<MetodoPgto, 'IFOOD'>>('PIX');
  const [processando, setProcessando] = useState(false);
  const metodos: { id: Exclude<MetodoPgto, 'IFOOD'>; label: string }[] = [
    { id: 'PIX', label: 'Pix' },
    { id: 'CREDITO', label: 'Crédito' },
    { id: 'DEBITO', label: 'Débito' },
    { id: 'DINHEIRO', label: 'Dinheiro' },
  ];

  const confirmar = async () => {
    setProcessando(true);
    try { await onConfirmar(metodo); } finally { setProcessando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onCancelar}>
      <div className="w-full max-w-md rounded-t-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100">{tDynamic('Receber e fechar comanda')}</h3>
            <p className="text-xs text-slate-500">Comanda #{comanda.numero_cartao ?? 'sem número'}</p>
          </div>
          <button onClick={onCancelar} disabled={processando} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800"><X size={18} /></button>
        </div>
        <p className="mb-3 text-xs text-amber-300">{tDynamic('Confirme somente depois que o pagamento presencial tiver sido recebido.')}</p>
        <div className="grid grid-cols-2 gap-2">
          {metodos.map((item) => (
            <button key={item.id} type="button" onClick={() => setMetodo(item.id)} className={`rounded-xl border px-3 py-3 text-xs font-bold ${metodo === item.id ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-slate-800 bg-slate-950 text-slate-300'}`}>
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={confirmar} disabled={processando} className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-sm font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-60">
          {processando ? tDynamic('Fechando…') : tDynamic('Confirmar recebimento e fechar')}
        </button>
      </div>
    </div>
  );
}

function ModalLancarItemComanda({
  comanda,
  produtos,
  onCancelar,
  onConfirmar,
}: {
  comanda: Comanda;
  produtos: Produto[];
  onCancelar: () => void;
  onConfirmar: (produto: Produto, quantidade: number, observacao: string, opcoes: { id: string }[]) => Promise<void>;
}) {
  const { tDynamic } = useI18n();
  const [produtoEscolhido, setProdutoEscolhido] = useState<Produto | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState('');
  const [opcoesEscolhidas, setOpcoesEscolhidas] = useState<Record<string, string[]>>({});
  const [enviando, setEnviando] = useState(false);

  const grupos = produtoEscolhido?.grupos_opcoes ?? [];
  // min_escolhas > 0 é escolha obrigatória: ponto da carne não pode ir em
  // branco para a chapa. Bloqueia o envio em vez de deixar a cozinha adivinhar.
  const grupoPendente = grupos.find(
    (g) => (g.min_escolhas ?? 0) > 0 && (opcoesEscolhidas[g.id]?.length ?? 0) < (g.min_escolhas ?? 0),
  );

  const alternarOpcao = (grupoId: string, opcaoId: string, maxEscolhas: number) => {
    setOpcoesEscolhidas((atual) => {
      const jaEscolhidas = atual[grupoId] ?? [];
      if (jaEscolhidas.includes(opcaoId)) {
        return { ...atual, [grupoId]: jaEscolhidas.filter((id) => id !== opcaoId) };
      }
      // Grupo de escolha única (max 1) troca a seleção em vez de acumular.
      const proximas = maxEscolhas === 1 ? [opcaoId] : [...jaEscolhidas, opcaoId];
      if (maxEscolhas > 0 && proximas.length > maxEscolhas) return atual;
      return { ...atual, [grupoId]: proximas };
    });
  };

  const confirmar = async () => {
    if (!produtoEscolhido || grupoPendente) return;
    setEnviando(true);
    try {
      const opcoes = Object.values(opcoesEscolhidas).flat().map((id) => ({ id }));
      await onConfirmar(produtoEscolhido, quantidade, observacao, opcoes);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onCancelar}>
      {/* max-h + rolagem: depois de escolher o produto a folha passa a listar
          TODOS os grupos de modificadores do item, mais quantidade e observacao.
          Com dois ou tres grupos ela ja passava da altura do celular e o botao
          de confirmar o lancamento ficava fora da tela, sem como rolar. */}
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Lançar item na comanda</h3>
            <p className="text-xs text-slate-500">#{comanda.numero_cartao ?? 'sem número'}</p>
          </div>
          <button onClick={onCancelar} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <X size={18} />
          </button>
        </div>

        {!produtoEscolhido ? (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {produtos.map((prod) => (
              <button
                key={prod.id}
                onClick={() => setProdutoEscolhido(prod)}
                className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3 text-left transition hover:border-orange-500/50"
              >
                <span className="text-xs font-semibold text-slate-200">{prod.nome}</span>
                <span className="text-xs font-mono text-emerald-400">R$ {Number(prod.preco).toFixed(2)}</span>
              </button>
            ))}
            {produtos.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-500">Nenhum produto disponível para lançamento.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
              <p className="text-sm font-bold text-slate-100">{produtoEscolhido.nome}</p>
              <p className="text-xs font-mono text-orange-400">R$ {Number(produtoEscolhido.preco).toFixed(2)} / un</p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                className="rounded-full bg-slate-800 p-2.5 text-slate-200 hover:bg-slate-700"
              >
                <Minus size={16} />
              </button>
              <span className="w-10 text-center text-xl font-black text-slate-100">{quantidade}</span>
              <button
                type="button"
                onClick={() => setQuantidade((q) => q + 1)}
                className="rounded-full bg-slate-800 p-2.5 text-slate-200 hover:bg-slate-700"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Modificadores do cardápio: ponto da carne, com gelo e limão.
                Vêm do produto (com preço, disponibilidade e insumo próprio) —
                o garçom escolhe, não digita de memória. */}
            {grupos.map((grupo) => {
              const escolhidas = opcoesEscolhidas[grupo.id] ?? [];
              const obrigatorio = (grupo.min_escolhas ?? 0) > 0;
              return (
                <div key={grupo.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="mb-2 text-xs font-bold text-slate-300">
                    {grupo.nome}
                    {obrigatorio && <span className="ml-1.5 text-orange-400">*</span>}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(grupo.opcoes ?? []).filter((o) => o.disponivel !== false).map((opcao) => {
                      const ativa = escolhidas.includes(opcao.id);
                      return (
                        <button
                          key={opcao.id}
                          type="button"
                          onClick={() => alternarOpcao(grupo.id, opcao.id, grupo.max_escolhas ?? 0)}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                            ativa
                              ? 'border-orange-500 bg-orange-500/15 text-orange-300'
                              : 'border-slate-700 text-slate-400 hover:border-slate-600'
                          }`}
                        >
                          {opcao.nome}
                          {Number(opcao.preco_adicional) > 0 && (
                            <span className="ml-1 opacity-80">+R$ {Number(opcao.preco_adicional).toFixed(2)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* O que não cabe num modificador (alergia, pedido específico do
                cliente) ainda precisa de um lugar — e viaja no mesmo ticket. */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-400">
                {tDynamic('Observação para a cozinha / bar')}
              </span>
              <input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="ex: ao ponto, sem cebola, gelo à parte…"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-orange-500 focus:outline-none"
              />
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setProdutoEscolhido(null)}
                className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmar}
                disabled={enviando || !!grupoPendente}
                title={grupoPendente ? `Escolha: ${grupoPendente.nome}` : undefined}
                className="flex-[2] rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {enviando
                  ? 'Lançando…'
                  : grupoPendente
                    ? `Escolha: ${grupoPendente.nome}`
                    : `Lançar na comanda (R$ ${(produtoEscolhido.preco * quantidade).toFixed(2)})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
