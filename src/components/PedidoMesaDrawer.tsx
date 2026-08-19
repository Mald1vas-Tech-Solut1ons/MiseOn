import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2, UtensilsCrossed } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmt, precoItem, type Loja, type Mesa, type ItemCarrinho } from '../types';
import { useI18n } from '../contexts/I18nContext';

interface Props {
  loja: Loja;
  mesa: Mesa;
  carrinho: ItemCarrinho[];
  setCarrinho: (c: ItemCarrinho[]) => void;
  onClose: () => void;
  onSucesso: (numero: number) => void;
}

export default function PedidoMesaDrawer({ loja, mesa, carrinho, setCarrinho, onClose, onSucesso }: Props) {
  const { tDynamic } = useI18n();
  const chaveNome = `miseon_nome_mesa_${loja.slug}`;
  const [nome, setNome] = useState(() => localStorage.getItem(chaveNome) ?? '');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const subtotal = carrinho.reduce((s, i) => s + precoItem(i), 0);

  const enviar = async () => {
    if (carrinho.length === 0) return;
    setEnviando(true); setErro('');
    try {
      if (nome.trim()) localStorage.setItem(chaveNome, nome.trim());
      // Pedido de mesa nasce 100% no servidor (RPC security definer):
      // anônimo não tem SELECT em pedidos/itens_pedido, então o
      // INSERT..RETURNING direto falhava na RLS — e de quebra os preços
      // são recalculados no banco, nunca confiados ao cliente.
      const { data, error: erroPedido } = await supabase.rpc('fn_pedido_mesa_criar', {
        p_loja_id: loja.id,
        p_mesa_id: mesa.id,
        // Identificador vai GRAVADO no banco e o garçom lê na comanda: fica
        // sempre em pt-BR. Traduzido aqui, quem estivesse com o navegador em
        // inglês gravava "Table 7" e o salão via os dois formatos misturados.
        p_identificador: nome.trim() || `Mesa ${mesa.numero}`,
        p_observacao: observacao.trim() || null,
        p_itens: carrinho.map((i) => ({
          produto_id: i.produto.id,
          quantidade: i.quantidade,
          observacao: i.observacao ?? null,
          opcoes: i.opcoesSelecionadas.map((o) => ({ opcao_id: o.id })),
        })),
      });
      const pedido = (data as { pedido_id: string; numero: number }[] | null)?.[0];
      if (erroPedido || !pedido) throw erroPedido ?? new Error(tDynamic('Falha ao enviar o pedido'));

      setCarrinho([]);
      onSucesso(pedido.numero);
    } catch (e) {
      console.error(e);
      setErro(tDynamic('Não deu para enviar o pedido: ') + String((e as Error)?.message ?? e));
    }
    setEnviando(false);
  };

  // Portal no body: fixed dentro de ancestral com transform seria posicionado errado.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={() => !enviando && onClose()}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl"
        style={{ background: 'var(--cor-card)' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 font-black" style={{ color: 'var(--cor-texto)' }}>
            <UtensilsCrossed size={18} style={{ color: 'var(--cor-primaria)' }} /> {tDynamic('Enviar para a Mesa')} {mesa.numero}
          </p>
          <button onClick={onClose} style={{ color: 'var(--cor-texto-fraco)' }}><X size={20} /></button>
        </div>

        <div className="mb-4 space-y-1.5 rounded-2xl border p-3" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
          {carrinho.map((i, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              {/* Nome de produto é conteúdo do lojista — não passa por
                  tradução automática, que quebraria "Combo Total" no meio. */}
              <span style={{ color: 'var(--cor-texto-suave)' }}>{i.quantidade}× {i.produto.nome}</span>
              <span className="font-bold" style={{ color: 'var(--cor-texto)' }}>{fmt(precoItem(i))}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1.5 text-sm font-black" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }}>
            <span>{tDynamic('Total')}</span><span style={{ color: 'var(--cor-primaria)' }}>{fmt(subtotal)}</span>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-semibold" style={{ color: 'var(--cor-texto-suave)' }}>{tDynamic('Seu nome (opcional)')}</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={tDynamic('ex: João')}
            className="mt-1 w-full rounded-xl border p-2.5 text-sm outline-none"
            style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }} />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-semibold" style={{ color: 'var(--cor-texto-suave)' }}>{tDynamic('Observação (opcional)')}</span>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder={tDynamic('ex: sem cebola, ponto da carne…')}
            className="mt-1 w-full rounded-xl border p-2.5 text-sm outline-none"
            style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }} />
        </label>

        <p className="mt-3 text-[11px]" style={{ color: 'var(--cor-texto-fraco)' }}>
          {tDynamic('A conta é fechada pelo garçom no final — não é preciso pagar agora.')}
        </p>

        {erro && <p className="mt-2 text-sm font-semibold text-red-500">{erro}</p>}

        <button onClick={enviar} disabled={enviando || carrinho.length === 0}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white shadow-lg disabled:opacity-50"
          style={{ background: 'var(--cor-primaria)' }}>
          {enviando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {enviando ? tDynamic('Enviando…') : `${tDynamic('Enviar pedido para a Mesa')} ${mesa.numero}`}
        </button>
      </div>
    </div>,
    document.body
  );
}
