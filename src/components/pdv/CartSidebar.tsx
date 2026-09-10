import { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Loader2, UserPlus, Search, UserCheck, X, Wallet, Check, ChevronUp } from 'lucide-react';
import { fmt, fmtQtd, precoItem } from '../../types';
import type { CartSidebarProps, ClientePDV } from '../../types';
import { supabase } from '../../lib/supabase';
import { maskTelefone } from '../../lib/mascaras';
import { useI18n } from '../../contexts/I18nContext';

export function CartSidebar({
  lojaId, carrinho, limparVenda, mudarQtd, removerItem,
  nomeCliente, setNomeCliente, clienteSelecionado, setClienteSelecionado,
  desconto, setDesconto,
  subtotal, descontoNum, total, erro, modo, turno,
  mesaSelecionada, enviandoMesa, setEtapa, setMetodo, setErro, enviarParaMesa
}: CartSidebarProps) {
  const { tDynamic } = useI18n();
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [sugestoes, setSugestoes] = useState<ClientePDV[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [modalNovoCliente, setModalNovoCliente] = useState(false);

  // Sanfona do carrinho no mobile: recolhido mostra so a barra de resumo,
  // aberto vira uma folha rolavel. No desktop (lg+) o estado e ignorado --
  // la o carrinho continua sendo a coluna fixa de 340px.
  const [sheetAberto, setSheetAberto] = useState(false);

  // Form para modal novo cliente
  const [novoNome, setNovoNome] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [erroModal, setErroModal] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  // Busca reativa no Supabase de clientes da loja ao digitar
  useEffect(() => {
    if (!lojaId || clienteSelecionado || !nomeCliente.trim() || nomeCliente.trim().length < 2) {
      setSugestoes([]);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscando(true);
      const query = nomeCliente.trim();
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, telefone')
        .eq('loja_id', lojaId)
        .or(`nome.ilike.%${query}%,telefone.ilike.%${query}%`)
        .limit(5);

      if (data && data.length > 0) {
        // Busca o saldo de cashback de cada cliente encontrado
        const clienteIds = data.map((c) => c.id);
        const { data: saldos } = await supabase
          .from('cashback_saldos')
          .select('cliente_id, saldo')
          .in('cliente_id', clienteIds);

        const mapaSaldos = new Map((saldos ?? []).map((s) => [s.cliente_id, Number(s.saldo)]));
        const comSaldo: ClientePDV[] = data.map((c) => ({
          id: c.id,
          nome: c.nome || 'Cliente',
          telefone: c.telefone || '',
          saldoCashback: mapaSaldos.get(c.id) ?? 0,
        }));
        setSugestoes(comSaldo);
        setDropdownAberto(true);
      } else {
        setSugestoes([]);
        setDropdownAberto(true);
      }
      setBuscando(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [nomeCliente, lojaId, clienteSelecionado]);

  const selecionarCliente = (c: ClientePDV) => {
    setNomeCliente(c.nome);
    setClienteSelecionado?.(c);
    setDropdownAberto(false);
  };

  const desmarcarCliente = () => {
    setNomeCliente('');
    setClienteSelecionado?.(null);
    setDropdownAberto(false);
  };

  const aplicarCashback = () => {
    if (clienteSelecionado?.saldoCashback) {
      const valor = Math.min(clienteSelecionado.saldoCashback, subtotal);
      setDesconto(valor.toFixed(2).replace('.', ','));
    }
  };

  const cadastrarNovoCliente = async () => {
    if (!lojaId || !novoNome.trim() || !novoTelefone.trim()) {
      setErroModal('Preencha nome e WhatsApp.');
      return;
    }
    setSalvandoCliente(true);
    setErroModal('');

    try {
      const { data, error: err } = await supabase
        .from('clientes')
        .insert({
          loja_id: lojaId,
          nome: novoNome.trim(),
          telefone: novoTelefone.trim(),
        })
        .select('id, nome, telefone')
        .single();

      if (err || !data) throw err || new Error('Erro ao salvar cliente');

      const novoc: ClientePDV = {
        id: data.id,
        nome: data.nome,
        telefone: data.telefone,
        saldoCashback: 0,
      };

      selecionarCliente(novoc);
      setModalNovoCliente(false);
      setNovoNome('');
      setNovoTelefone('');
    } catch (e: any) {
      setErroModal(e?.message || 'Erro ao cadastrar cliente.');
    }
    setSalvandoCliente(false);
  };

  const qtdItens = carrinho.reduce((soma, i) => soma + i.quantidade, 0);

  // A acao principal (cobrar / enviar para a mesa) e a MESMA no rodape do
  // carrinho e na barra de resumo do mobile. Antes havia dois botoes com
  // regras proprias; agora ha uma regra so.
  const acaoBloqueada =
    carrinho.length === 0 ||
    (modo === 'BALCAO' ? !turno : !mesaSelecionada || enviandoMesa);

  const rotuloAcao = modo === 'BALCAO'
    ? (turno ? `${tDynamic('Cobrar')} ${fmt(total)}` : tDynamic('Abra o caixa para vender'))
    : (!mesaSelecionada
        ? tDynamic('Selecione uma mesa')
        : enviandoMesa
          ? tDynamic('Enviando…')
          : `${tDynamic('Enviar para a Mesa')} ${mesaSelecionada.numero}`);

  const rotuloAcaoCurto = modo === 'BALCAO'
    ? (turno ? tDynamic('Cobrar') : tDynamic('Abra o caixa'))
    : (!mesaSelecionada ? tDynamic('Escolha a mesa') : tDynamic('Enviar'));

  const dispararAcao = () => {
    if (acaoBloqueada) return;
    if (modo === 'BALCAO') {
      setEtapa('PAGANDO');
      setMetodo(null);
      setErro('');
    } else {
      enviarParaMesa();
    }
  };

  return (
    <>
      {/* Fundo escuro so enquanto a sanfona esta aberta no mobile */}
      {sheetAberto && (
        <div
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSheetAberto(false)}
        />
      )}

    <div className={`flex flex-col overflow-hidden bg-white dark:bg-gray-900
      fixed inset-x-0 bottom-[var(--app-nav-h)] z-40 rounded-t-3xl border-t border-gray-200 shadow-[0_-12px_35px_-12px_rgba(0,0,0,0.35)] transition-[height] duration-300 ease-out dark:border-gray-800
      ${sheetAberto ? 'h-[78dvh]' : 'h-[76px]'}
      lg:static lg:z-auto lg:h-auto lg:w-[340px] lg:shrink-0 lg:overflow-visible lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none`}>

      {/* ── BARRA DE RESUMO (SO MOBILE) ──
          E o gatilho da sanfona e, ao mesmo tempo, o botao de cobrar: com o
          carrinho recolhido o lojista continua vendo total e acao sem perder
          a grade de produtos. */}
      <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 lg:hidden">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
        <div className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => setSheetAberto((v) => !v)}
            aria-expanded={sheetAberto}
            aria-label={sheetAberto ? tDynamic('Recolher carrinho') : tDynamic('Abrir carrinho')}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <ChevronUp size={18} className={`shrink-0 text-gray-400 transition-transform duration-300 ${sheetAberto ? 'rotate-180' : ''}`} />
            <span className="flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full bg-[var(--cor-primaria)] px-1.5 text-xs font-black text-white">
              {qtdItens}
            </span>
            <span className="truncate text-sm font-black dark:text-gray-100">
              {carrinho.length === 0 ? tDynamic('Toque nos produtos') : fmt(total)}
            </span>
          </button>
          <button
            type="button"
            disabled={acaoBloqueada}
            onClick={dispararAcao}
            className="shrink-0 rounded-2xl bg-[var(--cor-primaria)] px-4 py-2.5 text-sm font-black text-white shadow-md transition active:scale-[0.97] disabled:opacity-40"
          >
            {rotuloAcaoCurto}
          </button>
        </div>
      </div>

      <div className="hidden items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800 lg:flex">
        <p className="flex items-center gap-2 text-sm font-black dark:text-gray-100"><ShoppingCart size={16} /> {tDynamic('Venda atual')}</p>
        {carrinho.length > 0 && <button onClick={limparVenda} className="text-xs font-bold text-red-500">{tDynamic('Limpar')}</button>}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {carrinho.length > 0 && (
          <button onClick={limparVenda} className="mb-2 text-xs font-bold text-red-500 lg:hidden">{tDynamic('Limpar')}</button>
        )}
        {carrinho.length === 0 && <p className="py-10 text-center text-sm text-gray-400">{tDynamic('Toque nos produtos')}<br />{tDynamic('para adicionar.')}</p>}
        <div className="space-y-2">
          {carrinho.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-gray-100 p-2.5 dark:border-gray-800">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold leading-tight dark:text-gray-100">{item.produto.nome}</p>
                  {item.assento_numero && (
                    <span className="inline-block rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-black text-blue-600 dark:text-blue-400 border border-blue-500/20 mt-0.5">
                      Cadeira #{item.assento_numero}
                    </span>
                  )}
                  {item.opcoesSelecionadas.map((o) => (
                    <p key={o.id} className="text-xs opacity-95 text-gray-400">+ {o.nome}</p>
                  ))}
                  {item.observacao && <p className="text-xs opacity-95 font-semibold text-red-500">⚠ {item.observacao}</p>}
                </div>
                <p className="shrink-0 text-[13px] font-black dark:text-gray-100">{fmt(precoItem(item))}</p>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {item.produto.tipo_venda === 'POR_PESO' ? (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                    {fmtQtd(item.quantidade, 'POR_PESO')}
                  </span>
                ) : (
                  <>
                    <button onClick={() => mudarQtd(idx, -1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Minus size={13} /></button>
                    <span className="w-6 text-center text-sm font-black dark:text-gray-100">{item.quantidade}</span>
                    <button onClick={() => mudarQtd(idx, 1)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800"><Plus size={13} /></button>
                  </>
                )}
                <button onClick={() => removerItem(idx)} className="ml-auto rounded-lg p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative shrink-0 border-t border-gray-100 p-3 dark:border-gray-800">
        
        {/* Campo de Cliente com Autocomplete & Cashback */}
        <div className="mb-2 space-y-1.5" ref={dropdownRef}>
          <div className="relative flex items-center">
            <input
              value={nomeCliente}
              onChange={(e) => {
                setNomeCliente(e.target.value);
                if (clienteSelecionado) setClienteSelecionado?.(null);
              }}
              onFocus={() => {
                if (sugestoes.length > 0 || nomeCliente.trim().length >= 2) setDropdownAberto(true);
              }}
              placeholder={tDynamic('Buscar ou cadastrar cliente...')}
              className={`w-full rounded-xl border p-2 pr-8 text-xs font-medium dark:bg-gray-950 dark:text-gray-100 transition-all ${
                clienteSelecionado
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-bold'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            />
            {clienteSelecionado ? (
              <button
                type="button"
                onClick={desmarcarCliente}
                className="absolute right-2 text-emerald-600 hover:text-red-500"
                title={tDynamic('Remover cliente')}
              >
                <X size={14} />
              </button>
            ) : buscando ? (
              <Loader2 size={14} className="absolute right-2 animate-spin text-gray-400" />
            ) : (
              <Search size={14} className="absolute right-2 text-gray-400 pointer-events-none" />
            )}
          </div>

          {/* Badge de Cashback disponível se cliente selecionado tiver saldo */}
          {clienteSelecionado && (clienteSelecionado.saldoCashback ?? 0) > 0 && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2 flex items-center justify-between text-xs animate-in fade-in">
              <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                <Wallet size={13} /> {tDynamic('Cashback:')} {fmt(clienteSelecionado.saldoCashback ?? 0)}
              </span>
              <button
                type="button"
                onClick={aplicarCashback}
                className="rounded-lg bg-emerald-600 px-2 py-0.5 text-xs opacity-90 font-black text-white hover:bg-emerald-700 shadow-sm"
              >
                {tDynamic('Usar')}
              </button>
            </div>
          )}

          {/* Dropdown de Resultados da Busca de Cliente */}
          {dropdownAberto && !clienteSelecionado && (
            <div className="absolute top-10 left-3 right-3 z-50 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95">
              {sugestoes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selecionarCliente(c)}
                  className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1">
                      <UserCheck size={12} className="text-emerald-500" /> {c.nome}
                    </p>
                    <p className="text-xs opacity-90 text-gray-400">{c.telefone || tDynamic('Sem telefone')}</p>
                  </div>
                  {(c.saldoCashback ?? 0) > 0 && (
                    <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-xs opacity-90 font-black text-emerald-600 dark:text-emerald-400">
                      💰 {fmt(c.saldoCashback ?? 0)}
                    </span>
                  )}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setNovoNome(nomeCliente);
                  setModalNovoCliente(true);
                  setDropdownAberto(false);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--cor-primaria)]/50 p-2 text-xs font-bold text-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)]/10 transition-colors mt-1"
              >
                <UserPlus size={14} /> {tDynamic('Cadastrar')} "{nomeCliente.trim() || tDynamic('Novo Cliente')}"
              </button>
            </div>
          )}
        </div>

        <div className="mb-2 grid grid-cols-1 gap-2">
          <input 
            value={desconto} 
            onChange={(e) => {
              const value = e.target.value;
              if (value.startsWith('-')) {
                setErro(tDynamic('Valor não pode ser negativo'));
                return;
              }
              const clean = value.replace(/[^\d,]/g, '').replace(/,+/g, ',');
              const parts = clean.split(',');
              if (parts[1] && parts[1].length > 2) {
                setDesconto(parts[0] + ',' + parts[1].slice(0, 2));
              } else {
                setDesconto(clean);
              }
            }}
            placeholder={tDynamic('Desconto R$')}
            className="rounded-xl border border-gray-200 p-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" 
          />
        </div>
        <div className="mb-1 flex justify-between text-xs text-gray-500"><span>{tDynamic('Subtotal')}</span><span>{fmt(subtotal)}</span></div>
        {descontoNum > 0 && <div className="mb-1 flex justify-between text-xs text-green-600"><span>{tDynamic('Desconto')}</span><span>-{fmt(descontoNum)}</span></div>}
        <div className="mb-3 flex justify-between text-lg font-black dark:text-gray-100"><span>{tDynamic('Total')}</span><span className="text-[var(--cor-primaria)]">{fmt(total)}</span></div>
        {erro && modo === 'MESA' && <p className="mb-2 text-center text-xs font-semibold text-red-500">{erro}</p>}
        <button disabled={acaoBloqueada} onClick={dispararAcao}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--cor-primaria)] py-4 text-base font-black text-white shadow-lg transition active:scale-[0.98] disabled:opacity-40">
          {enviandoMesa && <Loader2 size={16} className="animate-spin" />}
          {rotuloAcao}
        </button>
      </div>

      {/* Modal Rápido de Cadastro de Cliente */}
      {modalNovoCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm max-h-[85dvh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 dark:border dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black dark:text-white flex items-center gap-2">
                <UserPlus size={18} className="text-[var(--cor-primaria)]" /> Cadastrar Cliente
              </h3>
              <button onClick={() => setModalNovoCliente(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Nome Completo</label>
                <input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm font-medium focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400">WhatsApp / Telefone</label>
                <input
                  value={novoTelefone}
                  onChange={(e) => setNovoTelefone(maskTelefone(e.target.value))}
                  placeholder="(11) 90000-0000"
                  maxLength={15}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm font-medium focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </div>

              {erroModal && <p className="text-xs font-bold text-red-500 mt-1">{erroModal}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovoCliente(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-3 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={salvandoCliente}
                  onClick={cadastrarNovoCliente}
                  className="flex-1 rounded-xl bg-[var(--cor-primaria)] py-3 text-xs font-bold text-white shadow-md hover:brightness-110 flex items-center justify-center gap-1.5"
                >
                  {salvandoCliente ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar & Selecionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
