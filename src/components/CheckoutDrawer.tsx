import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@supabase/supabase-js';
import {
  ShoppingBag, Plus, Minus, X, MapPin, LogIn, Lock,
  Trash2, ChevronRight, Loader2, CalendarClock, Wallet,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import EnderecoMixin, { EnderecoFormData } from './EnderecoMixin';
import {
  Loja, Cupom, TaxaEntrega, ItemCarrinho, Cliente, FaixaEntrega, HorarioFuncionamento,
  MetodoPgto, fmt, precoItem,
} from '../types';
import { maskTelefone } from '../lib/mascaras';
import { calcularEntrega, ResultadoEntrega } from '../lib/geo';
import { enderecoParaLabel, salvarLocalizacaoCliente } from '../lib/localizacao-cliente';
import { useI18n } from '../contexts/I18nContext';

const entrarComGoogle = (url: string) =>
  supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: url } });

const ROTULO_PGTO: Record<MetodoPgto, string> = {
  PIX: 'Pix', CREDITO: 'Crédito', DEBITO: 'Débito', DINHEIRO: 'Dinheiro', IFOOD: 'iFood'
};

const mensagemErroSupabase = (fallback: string, error?: { message?: string } | null) =>
  error?.message ? `${fallback} ${error.message}` : fallback;

interface Props {
  loja: Loja;
  aberta: boolean;
  carrinho: ItemCarrinho[];
  taxas: TaxaEntrega[];
  faixasDistancia: FaixaEntrega[];
  horarios: HorarioFuncionamento[];
  user: User | null;
  setCarrinho: (c: ItemCarrinho[]) => void;
  onClose: () => void;
  onSucesso: (numero: number, pedidoId: string, metodo: MetodoPgto, pix?: { copia_e_cola: string; qr_imagem?: string } | null, total?: number) => void;
  onCartao?: (info: { pedidoId: string; numero: number; total: number }) => void;
  onAbrirAuth: () => void;
  waToken?: string | null;
}

export default function CheckoutDrawer({
  loja, aberta, carrinho, taxas, faixasDistancia, horarios, user,
  setCarrinho, onClose, onSucesso, onCartao, onAbrirAuth, waToken,
}: Props) {
  const { tDynamic } = useI18n();
  const [tipo, setTipo] = useState<'DELIVERY' | 'RETIRADA_BALCAO'>('DELIVERY');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [enderecoObj, setEnderecoObj] = useState<EnderecoFormData | null>(null);
  const [bairroManual, setBairroManual] = useState('');
  const [metodo, setMetodo] = useState<MetodoPgto>('PIX');
  const [trocoPara, setTrocoPara] = useState('');
  const [codCupom, setCodCupom] = useState('');
  const [cupom, setCupom] = useState<Cupom | null>(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [perfilCarregado, setPerfilCarregado] = useState(false);
  const [entrega, setEntrega] = useState<ResultadoEntrega | null>(null);
  const [calcTaxa, setCalcTaxa] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);

  // Agendamento (só aparece se a loja aceitar)
  const [quando, setQuando] = useState<'AGORA' | 'AGENDADO'>('AGORA');
  const [diaAgendado, setDiaAgendado] = useState('');
  const [horaAgendada, setHoraAgendada] = useState('');

  // Cashback (saldo do cliente logado nesta loja)
  const [saldoCashback, setSaldoCashback] = useState(0);
  const [usarCashback, setUsarCashback] = useState(false);

  // Foco automatico no campo nome quando o perfil carrega
  useEffect(() => {
    if (perfilCarregado && user) {
      setTimeout(() => nomeRef.current?.focus(), 200);
    }
  }, [perfilCarregado, user]);

  // Carrega perfil do cliente logado
  useEffect(() => {
    if (!user) { setPerfilCarregado(true); return; }
    (async () => {
      const { data } = await supabase
        .from('clientes').select('*')
        .eq('loja_id', loja.id).eq('user_id', user.id).maybeSingle();
      const c = data as Cliente | null;
      if (c) {
        setNome(c.nome ?? '');
        setTelefone(c.telefone ?? '');
        supabase.from('cashback_saldos').select('saldo').eq('cliente_id', c.id).maybeSingle()
          .then(({ data: sc }) => setSaldoCashback(Number(sc?.saldo ?? 0)));
        supabase.from('enderecos_cliente').select('*')
          .eq('cliente_id', c.id).eq('padrao', true).maybeSingle()
          .then(({ data: end }) => {
            if (end) {
              setEnderecoObj({
                cep: end.cep, logradouro: end.logradouro,
                numero: end.numero || '', complemento: end.complemento || '',
                bairro: end.bairro, cidade: end.cidade, uf: end.uf,
                ponto_referencia: end.ponto_referencia || '',
                sem_numero: !end.numero || end.numero === 'SN',
              });
              setBairroManual(end.bairro);
            } else {
              setEnderecoObj(null);
              setBairroManual(c.bairro ?? '');
            }
          });
        if (c.forma_pagamento_preferida) setMetodo(c.forma_pagamento_preferida);
      } else if (user.user_metadata?.full_name || user.user_metadata?.name) {
        setNome(user.user_metadata.full_name ?? user.user_metadata.name);
      }
      setPerfilCarregado(true);
    })();
  }, [user, loja.id]);

  // --- Calculo da entrega (distancia -> bairro -> padrao), reativo e com debounce ---
  const bairroAtual = enderecoObj?.bairro || bairroManual;
  const enderecoQuery = enderecoObj
    ? [enderecoObj.logradouro, enderecoObj.numero, enderecoObj.bairro, enderecoObj.cidade, enderecoObj.uf, enderecoObj.cep, 'Brasil']
        .filter(Boolean).join(', ')
    : '';
  const subtotal = carrinho.reduce((s, i) => s + precoItem(i), 0);
  const prontoParaCalcular =
    tipo === 'DELIVERY' &&
    ((!!enderecoObj?.logradouro && !!enderecoObj?.numero) || bairroAtual.trim().length > 0);

  useEffect(() => {
    if (tipo !== 'DELIVERY') { setEntrega(null); return; }
    if (!prontoParaCalcular) { setEntrega(null); return; }
    let cancelado = false;
    setCalcTaxa(true);
    const id = setTimeout(async () => {
      const res = await calcularEntrega(loja, {
        enderecoQuery,
        bairro: bairroAtual,
        subtotal,
        taxasBairro: taxas.map((t) => ({ bairro: t.bairro, valor: t.valor })),
        faixasDistancia,
      });
      if (!cancelado) {
        setEntrega(res);
        if (res.geo) {
          salvarLocalizacaoCliente({
            origem: 'endereco',
            lat: res.geo.lat,
            lng: res.geo.lng,
            label: enderecoParaLabel(enderecoObj ?? undefined) || bairroAtual,
          });
        }
        setCalcTaxa(false);
      }
    }, 700);
    return () => { cancelado = true; clearTimeout(id); setCalcTaxa(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipo, enderecoQuery, bairroAtual, subtotal, loja.id, faixasDistancia]);

  // --- Calculos financeiros ---
  const taxa = tipo === 'DELIVERY' ? (entrega?.taxa ?? 0) : 0;
  const foraDeArea = tipo === 'DELIVERY' && !!entrega?.foraDeArea;
  // Espelha fn_recalcular_pedido: no cupom FIXO o desconto nunca passa do
  // subtotal (o servidor usa least(valor, subtotal)). Sem esse limite, cupom de
  // R$5 num carrinho de R$3 mostrava total negativo antes do clamp.
  const desconto = cupom
    ? cupom.tipo === 'FIXO'
      ? Math.min(Number(cupom.valor), subtotal)
      : (subtotal * Number(cupom.valor)) / 100
    : 0;
  const totalAntesCashback = Math.max(0, subtotal + taxa - desconto);
  const cashbackAplicavel = Math.min(saldoCashback, totalAntesCashback);
  const cashbackAplicado = usarCashback ? cashbackAplicavel : 0;
  const total = Math.max(0, totalAntesCashback - cashbackAplicado);

  // --- Agendamento: dias e horários derivados do funcionamento da loja ---
  const antecedenciaMin = loja.agendamento_antecedencia_min ?? 30;
  const diasDisponiveis = (() => {
    if (!loja.aceita_agendamento || horarios.length === 0) return [] as { data: string; label: string; diaSemana: number }[];
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias: { data: string; label: string; diaSemana: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(hoje.getTime() + i * 86400000);
      const diaSemana = d.getDay();
      if (horarios.some((h) => h.dia_semana === diaSemana)) {
        dias.push({
          data: d.toISOString().slice(0, 10),
          label: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
          diaSemana,
        });
      }
    }
    return dias;
  })();
  const slotsDoDia = (() => {
    const diaInfo = diasDisponiveis.find((d) => d.data === diaAgendado);
    if (!diaInfo) return [] as string[];
    const agora = new Date();
    const ehHoje = diaInfo.data === agora.toISOString().slice(0, 10);
    const minimoHoje = new Date(agora.getTime() + antecedenciaMin * 60000);
    const slots: string[] = [];
    for (const h of horarios.filter((x) => x.dia_semana === diaInfo.diaSemana)) {
      const [abreH, abreM] = h.abre.slice(0, 5).split(':').map(Number);
      const [fechaH, fechaM] = h.fecha.slice(0, 5).split(':').map(Number);
      let cursor = new Date(`${diaInfo.data}T00:00:00`); cursor.setHours(abreH, abreM, 0, 0);
      const fim = new Date(`${diaInfo.data}T00:00:00`); fim.setHours(fechaH, fechaM, 0, 0);
      while (cursor <= fim) {
        if (!ehHoje || cursor >= minimoHoje) slots.push(`${String(cursor.getHours()).padStart(2, '0')}:${String(cursor.getMinutes()).padStart(2, '0')}`);
        cursor = new Date(cursor.getTime() + 30 * 60000);
      }
    }
    return slots;
  })();
  useEffect(() => {
    if (quando === 'AGENDADO' && !diaAgendado && diasDisponiveis.length > 0) setDiaAgendado(diasDisponiveis[0].data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quando]);
  useEffect(() => { setHoraAgendada(''); }, [diaAgendado]);

  // Formas de pagamento conforme as flags da loja
  const aceitaOnline = loja.aceita_online !== false;
  const aceitaEntrega = loja.aceita_entrega !== false;
  const cartaoOnlineConfigurado = !!loja.efi_configurado;
  const metodosOnline: MetodoPgto[] = aceitaOnline
    ? ['PIX', ...(cartaoOnlineConfigurado ? (['CREDITO'] as MetodoPgto[]) : [])]
    : [];
  const metodosEntrega: MetodoPgto[] = aceitaEntrega ? ['DINHEIRO', 'DEBITO'] : [];
  const metodosDisponiveis = [...metodosOnline, ...metodosEntrega];
  useEffect(() => {
    if (metodosDisponiveis.length && !metodosDisponiveis.includes(metodo)) setMetodo(metodosDisponiveis[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aceitaOnline, aceitaEntrega]);

  const cancelarPedidoPendente = async (pedidoId: string) => {
    await Promise.all([
      supabase.from('pagamentos').update({ status: 'CANCELADO' }).eq('pedido_id', pedidoId).eq('status', 'PENDENTE'),
      supabase.from('pedidos').update({ status: 'CANCELADO' }).eq('id', pedidoId).eq('status', 'NOVO'),
    ]);
  };

  // A tabela `cupons` não é mais legível pelo cliente: a policy pública lia
  // TODOS os cupons de TODAS as lojas (inclusive os de recuperação de carrinho,
  // que são gerados para uma pessoa específica). Agora manda-se o código e o
  // servidor responde válido/inválido, aplicando limite de uso, primeira
  // compra e método exigido — regras que antes só existiam no browser.
  const aplicarCupom = async () => {
    setErro('');
    const { data, error } = await supabase.rpc('fn_validar_cupom', {
      p_loja_id: loja.id,
      p_codigo: codCupom.trim().toUpperCase(),
      p_subtotal: subtotal,
      p_metodo: metodo,
    });
    const valido = (data as Cupom[] | null)?.[0];
    if (error || !valido) {
      return setErro(mensagemErroSupabase('Cupom inválido ou expirado.', error ?? undefined));
    }
    setCupom(valido);
  };

  const enviar = async () => {
    setErro('');
    if (!user) { onAbrirAuth(); return setErro('Faça login para finalizar.'); }
    if (!aberta && quando === 'AGORA') return setErro('A loja esta fechada no momento — agende um horário ou volte quando abrir.');
    if (quando === 'AGENDADO' && (!diaAgendado || !horaAgendada)) return setErro('Escolha o dia e o horário do agendamento.');
    if (!nome.trim() || !telefone.trim()) return setErro('Preencha nome e telefone.');
    if (tipo === 'DELIVERY' && (!enderecoObj?.logradouro || !enderecoObj?.numero))
      return setErro('Preencha o endereco completo com número.');
    if (foraDeArea)
      return setErro('Seu endereco esta fora da area de entrega desta loja.');
    if (subtotal < Number(loja.pedido_minimo))
      return setErro(`Pedido minimo: ${fmt(Number(loja.pedido_minimo))}.`);
    if (metodo === 'CREDITO' && (!cartaoOnlineConfigurado || !onCartao))
      return setErro('Cartão online ainda não está configurado para esta loja.');
    setEnviando(true);

    const ref = tipo === 'DELIVERY' ? (enderecoObj?.ponto_referencia || '').trim() : '';
    const enderecoFormatado = tipo === 'DELIVERY' && enderecoObj
      ? `${enderecoObj.logradouro}, ${enderecoObj.numero}${enderecoObj.complemento ? ` (${enderecoObj.complemento})` : ''}${ref ? ` - Ref: ${ref}` : ''}`
      : null;

    const agendadoParaISO = quando === 'AGENDADO' && diaAgendado && horaAgendada
      ? new Date(`${diaAgendado}T${horaAgendada}:00`).toISOString()
      : null;

    // O pedido inteiro nasce numa transacao no banco (fn_criar_pedido_completo).
    // Antes eram sete escritas sequenciais daqui — cliente, endereco, pedido,
    // cashback, itens, opcoes e pagamento — cada uma com o seu tratamento de
    // erro chamando descartarPedidoIncompleto() para desfazer na mao. O furo era
    // que essa limpeza roda NO CELULAR: o caso que ela precisava cobrir (a rede
    // caindo no meio do checkout) e exatamente o que a impedia de rodar, e
    // sobrava pedido sem item no painel do lojista. Agora ou nasce tudo, ou nao
    // nasce nada — e quem decide o preco final e o servidor.
    const { data: criado, error: erroCriacao } = await supabase.rpc('fn_criar_pedido_completo', {
      p_payload: {
        loja_id: loja.id,
        tipo_pedido: tipo,
        nome: nome.trim(),
        telefone,
        email: user.email ?? null,
        bairro_manual: bairroManual,
        metodo,
        endereco: tipo === 'DELIVERY' && enderecoObj ? enderecoObj : null,
        endereco_formatado: enderecoFormatado,
        distancia_km: entrega?.distanciaKm ?? null,
        lat: entrega?.geo?.lat ?? null,
        lng: entrega?.geo?.lng ?? null,
        taxa_entrega: taxa,
        cupom_id: cupom?.id ?? null,
        troco_para: metodo === 'DINHEIRO' && trocoPara ? Number(trocoPara) : null,
        agendado_para: agendadoParaISO,
        cashback_usado: cashbackAplicado,
        wa_token: waToken ?? null,
        itens: carrinho.map((item) => ({
          produto_id: item.produto.id,
          quantidade: item.quantidade,
          observacao: item.observacao ?? null,
          opcoes: item.opcoesSelecionadas.map((o) => ({ id: o.id })),
        })),
      },
    });

    if (erroCriacao || !criado) {
      setEnviando(false);
      return setErro(mensagemErroSupabase('Erro ao criar pedido.', erroCriacao));
    }

    const pedido = { id: String(criado.pedido_id), numero: Number(criado.numero) };
    // Valor cobrado dali para frente e o do servidor, nao o calculado na tela.
    const totalServidor = Number(criado.valor_total ?? total);

    // Cashback cobriu o pedido inteiro: quita e aceita via RPC (valida o dono).
    if (totalServidor <= 0 && cashbackAplicado > 0) {
      const { error: erroQuita } = await supabase.rpc('fn_quitar_pedido_cashback', { p_pedido_id: pedido.id });
      if (erroQuita) {
        await cancelarPedidoPendente(pedido.id);
        setEnviando(false);
        return setErro(mensagemErroSupabase('Erro ao confirmar o pagamento por cashback.', erroQuita));
      }
      setEnviando(false);
      onSucesso(pedido.numero, pedido.id, metodo, null, totalServidor);
      return;
    }

    // Cartao de credito online (Efi — tokenizacao no proximo modal)
    if (metodo === 'CREDITO') {
      setEnviando(false);
      onCartao?.({ pedidoId: pedido.id, numero: pedido.numero, total: totalServidor });
      return;
    }

    let pixInfo: { copia_e_cola: string; qr_imagem?: string } | null = null;
    if (metodo === 'PIX') {
      const { data: cob, error: e2 } = await supabase.functions.invoke('pix-criar-cobranca', {
        body: { pedido_id: pedido.id },
      });
      if (e2 || cob?.error) {
        await cancelarPedidoPendente(pedido.id);
        setEnviando(false);
        return setErro(`Falha na plataforma de pagamento: ${e2?.message || cob?.error || 'Erro desconhecido ao gerar Pix'}`);
      }
      if (cob?.copia_e_cola) pixInfo = cob;
    }

    setEnviando(false);
    onSucesso(pedido.numero, pedido.id, metodo, pixInfo, totalServidor);
  };

  // Portal no body: fixed dentro de ancestral com transform seria posicionado errado.
  return createPortal(
    // Overlay com backdrop
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* Gaveta lateral - clique nao fecha */}
      <div
        className="slide-left flex h-full w-full max-w-[440px] flex-col bg-white dark:bg-gray-950 shadow-2xl"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header fixo ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} className="text-[var(--cor-primaria-texto)]" />
            <span data-cy="checkout-titulo" className="text-base font-black dark:text-white">{tDynamic('Finalizar Pedido')}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Corpo scrollavel ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Lista de itens */}
          <div className="border-b border-gray-100 dark:border-gray-800 px-5 py-4 space-y-3">
            {carrinho.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight dark:text-gray-100 truncate">
                    {item.produto.nome}
                  </p>
                  {item.opcoesSelecionadas?.length > 0 && (
                    <p className="text-xs opacity-95 text-gray-400 truncate mt-0.5">
                      {item.opcoesSelecionadas.map((o) => o.nome).join(', ')}
                    </p>
                  )}
                  {item.observacao && (
                    <p className="text-xs opacity-95 italic text-gray-400 mt-0.5">"{item.observacao}"</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1">
                    <button
                      onClick={() => item.quantidade > 1
                        ? setCarrinho(carrinho.map((x, y) => y === idx ? { ...x, quantidade: x.quantidade - 1 } : x))
                        : setCarrinho(carrinho.filter((_, y) => y !== idx))}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-4 text-center text-xs font-bold dark:text-gray-200">{item.quantidade}</span>
                    <button
                      onClick={() => setCarrinho(carrinho.map((x, y) => y === idx ? { ...x, quantidade: x.quantidade + 1 } : x))}
                      className="text-gray-400 hover:text-[var(--cor-primaria-texto)] transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <p className="text-sm font-bold dark:text-gray-100 w-16 text-right">{fmt(precoItem(item))}</p>
                  <button
                    onClick={() => setCarrinho(carrinho.filter((_, x) => x !== idx))}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Formulario */}
          <div className="px-5 py-4 space-y-5">

            {!user ? (
              /* Nao logado */
              <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
                <ShoppingBag size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-bold dark:text-gray-200">{tDynamic('Faça login para finalizar')}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {tDynamic('Usamos sua conta Google para salvar seu endereço e histórico de pedidos.')}
                </p>
                <button
                  onClick={() => entrarComGoogle(window.location.href)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3 text-sm font-bold text-white hover:brightness-110 transition-all"
                >
                  <LogIn size={16} /> {tDynamic('Entrar com Google')}
                </button>
              </div>
            ) : !perfilCarregado ? (
              <p className="py-4 text-center text-sm text-gray-400">Carregando seus dados...</p>
            ) : (
              <>
                {/* Tipo de pedido */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    Tipo de pedido
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['DELIVERY', 'RETIRADA_BALCAO'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTipo(t)}
                        className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-bold transition-all ${
                          tipo === t
                            ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 text-[var(--cor-primaria-texto)]'
                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                        }`}
                      >
                        <ChevronRight size={14} className={tipo === t ? 'opacity-100' : 'opacity-0'} />
                        {t === 'DELIVERY' ? 'Entrega' : 'Retirada'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agendamento (só se a loja aceitar) */}
                {loja.aceita_agendamento && (
                  <div>
                    <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <CalendarClock size={12} /> {tDynamic('Quando você quer receber?')}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setQuando('AGORA')}
                        className={`rounded-xl border-2 py-3 text-sm font-bold transition-all ${quando === 'AGORA' ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 text-[var(--cor-primaria-texto)]' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}>
                        Agora
                      </button>
                      <button onClick={() => setQuando('AGENDADO')}
                        className={`rounded-xl border-2 py-3 text-sm font-bold transition-all ${quando === 'AGENDADO' ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 text-[var(--cor-primaria-texto)]' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}>
                        Agendar
                      </button>
                    </div>

                    {quando === 'AGENDADO' && (
                      <div className="mt-2 space-y-2">
                        {diasDisponiveis.length === 0 ? (
                          <p className="text-xs text-gray-400">{tDynamic('Nenhum horário de funcionamento cadastrado para agendamento.')}</p>
                        ) : (
                          <>
                            <div className="flex gap-1.5 overflow-x-auto pb-1">
                              {diasDisponiveis.map((d) => (
                                <button key={d.data} onClick={() => setDiaAgendado(d.data)}
                                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold capitalize transition-all ${diaAgendado === d.data ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)] text-white' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>
                                  {d.label}
                                </button>
                              ))}
                            </div>
                            {diaAgendado && (
                              slotsDoDia.length === 0 ? (
                                <p className="text-xs text-gray-400">{tDynamic('Sem horários disponíveis nesse dia — escolha outro.')}</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {slotsDoDia.map((h) => (
                                    <button key={h} onClick={() => setHoraAgendada(h)}
                                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${horaAgendada === h ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)] text-white' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>
                                      {h}
                                    </button>
                                  ))}
                                </div>
                              )
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Dados pessoais */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    Seus dados
                  </p>
                  <div className="space-y-2">
                    <input
                      ref={nomeRef}
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--cor-primaria)] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:bg-gray-800"
                    />
                    <input
                      value={telefone}
                      onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                      placeholder="WhatsApp (11) 90000-0000"
                      type="tel"
                      maxLength={15}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--cor-primaria)] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:bg-gray-800"
                    />
                  </div>
                </div>

                {/* Endereco (somente delivery) */}
                {tipo === 'DELIVERY' && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                      <MapPin size={11} /> {tDynamic('Endereco de entrega')}
                    </p>
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 dark:bg-gray-900">
                      <EnderecoMixin
                        valorInicial={enderecoObj ?? undefined}
                        onMudanca={setEnderecoObj}
                      />
                    </div>

                    {/* Taxa de entrega: distancia (geocoding) -> bairro -> padrao */}
                    <div className={`mt-3 rounded-2xl border p-4 transition-all ${
                      foraDeArea
                        ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-gray-700 dark:bg-gray-900'
                    }`}>
                      <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                        <MapPin size={11} /> {tDynamic('Taxa de entrega')}
                      </p>

                      {calcTaxa ? (
                        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Loader2 size={14} className="animate-spin" /> {tDynamic('Calculando pela distância…')}
                        </p>
                      ) : entrega?.origem === 'DISTANCIA' ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold dark:text-gray-200">
                              ~{entrega.distanciaKm} km da loja{entrega.faixaNome ? ` · ${entrega.faixaNome}` : ''}
                            </span>
                            <span className={`text-sm font-black ${foraDeArea ? 'text-red-600 dark:text-red-400' : 'text-[var(--cor-primaria-texto)]'}`}>
                              {foraDeArea ? 'Fora da área' : fmt(taxa)}
                            </span>
                          </div>
                          {!foraDeArea && entrega.faixaNome && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {tDynamic('Faixa aplicada automaticamente conforme a distância do cliente.')}
                            </p>
                          )}
                          {foraDeArea && entrega.raioConsideradoKm != null && (
                            <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">
                              Fora do raio de {Number(entrega.raioConsideradoKm)} km desta loja.
                            </p>
                          )}
                        </>
                      ) : taxas.length > 0 ? (
                        <>
                          <select
                            value={bairroAtual}
                            onChange={(e) => {
                              setBairroManual(e.target.value);
                              if (enderecoObj) setEnderecoObj({ ...enderecoObj, bairro: e.target.value });
                            }}
                            className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm font-semibold outline-none transition-colors focus:border-[var(--cor-primaria)] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          >
                            <option value="">{tDynamic('Selecione seu bairro…')}</option>
                            {taxas.map((t) => (
                              <option key={t.id} value={t.bairro}>{t.bairro} — {fmt(Number(t.valor))}</option>
                            ))}
                          </select>
                          {entrega?.origem === 'PADRAO' && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Não localizamos seu endereço — taxa padrão de {fmt(taxa)}.</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm font-semibold dark:text-gray-200">
                          {taxa > 0 ? fmt(taxa) : 'Informe o endereço para calcular'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Cupom */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    {tDynamic('Cupom de desconto')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={codCupom}
                      onChange={(e) => setCodCupom(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && aplicarCupom()}
                      placeholder="Código do cupom"
                      className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm uppercase outline-none focus:border-[var(--cor-primaria)] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                    <button
                      onClick={aplicarCupom}
                      className="rounded-xl border border-gray-200 px-4 text-sm font-bold dark:border-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                  {cupom && (
                    <p className="mt-1.5 text-xs font-bold text-green-600">
                      Cupom {cupom.codigo} aplicado — desconto de {fmt(desconto)}
                    </p>
                  )}
                </div>

                {/* Cashback disponível */}
                {saldoCashback > 0 && (
                  <button
                    data-cy="checkout-usar-cashback"
                    onClick={() => setUsarCashback((v) => !v)}
                    className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition-all ${
                      usarCashback ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5' : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Wallet size={16} style={{ color: 'var(--cor-primaria-texto)' }} />
                      <span>
                        <span className="block text-sm font-bold dark:text-gray-100">Usar meu cashback</span>
                        <span className="block text-xs opacity-95 text-gray-400">Você tem {fmt(saldoCashback)} de saldo nesta loja</span>
                      </span>
                    </span>
                    <span className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${usarCashback ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${usarCashback ? 'translate-x-5' : ''}`} />
                    </span>
                  </button>
                )}

                {/* Metodo de pagamento (agrupado por antecipado x na entrega) */}
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                    {tDynamic('Forma de pagamento')}
                  </p>

                  {metodosDisponiveis.length === 0 && (
                    <p className="text-sm text-gray-400">{tDynamic('A loja ainda não configurou formas de pagamento.')}</p>
                  )}

                  {metodosOnline.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1.5 flex items-center gap-1 text-xs opacity-95 font-bold text-emerald-600 dark:text-emerald-400">
                        <Lock size={11} /> Pague agora (online)
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {metodosOnline.map((m) => (
                          <button key={m} onClick={() => setMetodo(m)}
                            className={`rounded-xl border py-3 text-xs font-bold transition-all ${
                              metodo === m
                                ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 text-[var(--cor-primaria-texto)]'
                                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                            }`}>
                            {ROTULO_PGTO[m]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {metodosEntrega.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs opacity-95 font-bold text-gray-500 dark:text-gray-400">{tDynamic('Pague na entrega')}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {metodosEntrega.map((m) => (
                          <button key={m} onClick={() => setMetodo(m)}
                            className={`rounded-xl border py-3 text-xs font-bold transition-all ${
                              metodo === m
                                ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5 text-[var(--cor-primaria-texto)]'
                                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                            }`}>
                            {ROTULO_PGTO[m]}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {metodo === 'DINHEIRO' && (
                    <input
                      value={trocoPara}
                      onChange={(e) => setTrocoPara(e.target.value)}
                      placeholder="Troco para quanto?"
                      type="number"
                      className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  )}
                </div>

                {/* Resumo do pedido */}
                <div className="rounded-2xl bg-gray-50 dark:bg-gray-900 p-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-200">{fmt(subtotal)}</span>
                  </div>
                  {tipo === 'DELIVERY' && (
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>{tDynamic('Taxa de entrega')}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-200">
                        {calcTaxa ? '…' : taxa > 0 ? fmt(taxa) : '—'}
                      </span>
                    </div>
                  )}
                  {desconto > 0 && (
                    <div className="flex justify-between text-sm text-green-600 font-semibold">
                      <span>Desconto</span>
                      <span>-{fmt(desconto)}</span>
                    </div>
                  )}
                  {cashbackAplicado > 0 && (
                    <div className="flex justify-between text-sm font-semibold" style={{ color: 'var(--cor-primaria-texto)' }}>
                      <span className="flex items-center gap-1"><Wallet size={12} /> Cashback usado</span>
                      <span>-{fmt(cashbackAplicado)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                    <span className="text-base font-black dark:text-white">Total</span>
                    <span className="text-base font-black" style={{ color: 'var(--cor-primaria-texto)' }}>
                      {fmt(total)}
                    </span>
                  </div>
                  {(loja.cashback_pct ?? 0) > 0 && totalAntesCashback > 0 && (
                    <p className="pt-1 text-xs opacity-95 text-gray-400">
                      Você ganha {fmt(Math.round(totalAntesCashback * Number(loja.cashback_pct) / 100 * 100) / 100)} de cashback nesta compra.
                    </p>
                  )}
                </div>

                {/* Erro */}
                {erro && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
                    {erro}
                  </div>
                )}

                {/* Botao finalizar */}
                {/* data-cy: ancora estavel para o E2E. Sem ela, o teste
                    dependia de cy.contains('Finalizar Pedido'), que tambem
                    casa com o TITULO do drawer e escolhe o primeiro no do DOM
                    — passava local e quebrava no CI conforme a ordem de
                    render mudava. */}
                <button
                  data-cy="checkout-finalizar"
                  onClick={enviar}
                  disabled={enviando || carrinho.length === 0 || foraDeArea}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-black text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    foraDeArea
                      ? 'bg-gray-400 dark:bg-gray-700'
                      : 'bg-[var(--cor-primaria)] shadow-lg shadow-[var(--cor-primaria)]/30 hover:brightness-110 active:scale-[0.98]'
                  }`}
                >
                  <Lock size={16} />
                  {enviando
                    ? 'Processando...'
                    : foraDeArea
                    ? 'Bairro não atendido'
                    : quando === 'AGENDADO' && diaAgendado && horaAgendada
                    ? `Agendar para ${diasDisponiveis.find((d) => d.data === diaAgendado)?.label} ${horaAgendada} - ${fmt(total)}`
                    : `Finalizar Pedido - ${fmt(total)}`}
                </button>
                <p className="pb-4 text-center text-xs opacity-90 text-gray-400">
                  {tDynamic('Ao finalizar você concorda com os termos de uso.')}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
