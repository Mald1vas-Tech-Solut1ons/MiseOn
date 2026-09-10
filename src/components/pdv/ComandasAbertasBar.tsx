import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, HandCoins, Clock, UserRound, QrCode, RefreshCw, ReceiptText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmt } from '../../types';
import { useI18n } from '../../contexts/I18nContext';

/* ============================================================================
   COMANDAS ABERTAS — a ponte que faltava entre o salão e o caixa.

   POR QUE ISTO EXISTE: quem opera o caixa é quem tem a gaveta, o turno aberto
   e a obrigação de conferir o dinheiro no fim do dia. Mas o PDV só sabia
   MANDAR rodada pra mesa: não havia, em lugar nenhum da tela do caixa, a
   resposta pra pergunta mais básica do salão — "quais mesas estão abertas,
   quanto tem em cada uma, quem está atendendo e qual delas já pediu a conta?".
   O caixa tinha que sair do PDV, abrir o Mapa de Mesas e ir clicando mesa por
   mesa. Com o salão cheio, isso é o cliente esperando de pé no balcão.

   As três cabeças:
   - cliente: pede a conta e quer pagar rápido — o chamado de FECHAMENTO
     aparece aqui em vermelho, no mesmo lugar onde o dinheiro é recebido;
   - garçom: lança a rodada e some pro salão — o nome de quem abriu fica na
     comanda (migration 20260910120000), então dá pra saber a quem perguntar;
   - lojista: precisa saber quanto está "solto" no salão sem fechar o caixa
     pra descobrir — o total em aberto fica no cabeçalho, sempre visível.

   O RECEBIMENTO em si NÃO foi duplicado aqui de propósito: fechar conta tem
   pagamento parcial, divisão por assento, taxa de serviço e impressão, tudo
   já implementado no Mapa de Mesas. Duplicar essa lógica seria criar um
   segundo lugar onde o dinheiro pode divergir. O botão leva direto pra conta
   daquela mesa, já aberta (`/admin/mesas?conta=<mesaId>`).
   ========================================================================== */

type ComandaAberta = {
  id: string;
  mesaId: string | null;
  rotulo: string;
  abertaEm: string;
  abertaPorNome: string | null;
  temAutor: boolean;
  itens: number;
  total: number;
  pago: number;
  pedindoConta: boolean;
};

function tempoDecorrido(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
}

export function ComandasAbertasBar({ lojaId }: { lojaId?: string }) {
  const { tDynamic } = useI18n();
  const navigate = useNavigate();
  const [comandas, setComandas] = useState<ComandaAberta[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  // só para recalcular "há quanto tempo" sem refazer as consultas
  const [, setTique] = useState(0);

  const carregar = useCallback(async () => {
    if (!lojaId) return;
    setCarregando(true);

    const [{ data: comandasCruas }, { data: chamados }] = await Promise.all([
      supabase
        .from('comandas')
        .select('id, mesa_id, aberta_em, aberta_por, aberta_por_nome, numero_cartao, nome_cliente, mesas(numero)')
        .eq('loja_id', lojaId)
        .eq('status', 'ABERTA')
        .order('aberta_em'),
      supabase
        .from('chamados_garcom')
        .select('comanda_id, mesa_id, tipo')
        .eq('loja_id', lojaId)
        .eq('status', 'PENDENTE'),
    ]);

    const lista = (comandasCruas as any[]) ?? [];
    const ids = lista.map((c) => c.id);

    // Totais por comanda: valor lançado x valor já pago (a conta pode ter sido
    // paga parcialmente — dividida entre os clientes da mesa).
    const acumulado = new Map<string, { total: number; pago: number; itens: number }>();
    if (ids.length > 0) {
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('comanda_id, valor_total, itens_pedido(quantidade), pagamentos(valor_pago, status)')
        .in('comanda_id', ids)
        .neq('status', 'CANCELADO');

      for (const p of ((pedidos as any[]) ?? [])) {
        const atual = acumulado.get(p.comanda_id) ?? { total: 0, pago: 0, itens: 0 };
        atual.total += Number(p.valor_total ?? 0);
        atual.itens += (p.itens_pedido ?? []).reduce((s: number, i: any) => s + Number(i.quantidade ?? 0), 0);
        atual.pago += (p.pagamentos ?? [])
          .filter((pg: any) => pg.status === 'PAGO')
          .reduce((s: number, pg: any) => s + Number(pg.valor_pago ?? 0), 0);
        acumulado.set(p.comanda_id, atual);
      }
    }

    const fechamentos = (chamados as any[] ?? []).filter((c) => c.tipo === 'FECHAMENTO');
    const comandasPedindo = new Set(fechamentos.map((c) => c.comanda_id).filter(Boolean));
    const mesasPedindo = new Set(fechamentos.map((c) => c.mesa_id).filter(Boolean));

    setComandas(lista.map((c) => {
      const soma = acumulado.get(c.id) ?? { total: 0, pago: 0, itens: 0 };
      const numeroMesa = c.mesas?.numero;
      return {
        id: c.id,
        mesaId: c.mesa_id ?? null,
        rotulo: numeroMesa
          ? `${tDynamic('Mesa')} ${numeroMesa}`
          : c.numero_cartao
            ? `${tDynamic('Comanda')} #${c.numero_cartao}`
            : c.nome_cliente || tDynamic('Comanda avulsa'),
        abertaEm: c.aberta_em,
        abertaPorNome: c.aberta_por_nome ?? null,
        temAutor: Boolean(c.aberta_por),
        itens: soma.itens,
        total: soma.total,
        pago: soma.pago,
        pedindoConta: comandasPedindo.has(c.id) || (c.mesa_id ? mesasPedindo.has(c.mesa_id) : false),
      };
    }));
    setCarregando(false);
  }, [lojaId, tDynamic]);

  useEffect(() => { carregar(); }, [carregar]);

  // Realtime: rodada nova do garçom, conta paga no Mapa de Mesas ou cliente
  // chamando pra fechar têm que aparecer no caixa sem ninguém apertar F5.
  useEffect(() => {
    if (!lojaId) return;
    const canal = supabase
      .channel(`pdv-comandas-abertas-${lojaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados_garcom', filter: `loja_id=eq.${lojaId}` }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [lojaId, carregar]);

  // relógio do "há quanto tempo" — 1 min basta, é o que o garçom enxerga
  useEffect(() => {
    const t = setInterval(() => setTique((v) => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const totalSalao = useMemo(() => comandas.reduce((s, c) => s + (c.total - c.pago), 0), [comandas]);
  const pedindoConta = useMemo(() => comandas.filter((c) => c.pedindoConta).length, [comandas]);

  if (comandas.length === 0) return null;

  return (
    <div className="shrink-0 border-b border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 px-3 py-2 text-left sm:px-4"
      >
        <ReceiptText size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-black text-amber-800 dark:text-amber-300">
          {comandas.length} {comandas.length === 1 ? tDynamic('comanda aberta') : tDynamic('comandas abertas')}
        </span>
        <span className="truncate text-xs font-bold text-amber-700/80 dark:text-amber-400/80">
          · {fmt(totalSalao)} {tDynamic('no salão')}
        </span>
        {pedindoConta > 0 && (
          <span className="shrink-0 animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
            {pedindoConta} {tDynamic('pedindo a conta')}
          </span>
        )}
        <ChevronDown size={16} className={`ml-auto shrink-0 text-amber-600 transition-transform duration-300 ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="max-h-[38dvh] space-y-2 overflow-y-auto px-3 pb-3 sm:px-4">
          <button
            type="button"
            onClick={carregar}
            className="flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:underline dark:text-amber-400"
          >
            <RefreshCw size={11} className={carregando ? 'animate-spin' : ''} /> {tDynamic('Atualizar')}
          </button>

          {comandas.map((c) => {
            const saldo = c.total - c.pago;
            return (
              <div
                key={c.id}
                className={`rounded-2xl border bg-white p-3 dark:bg-gray-900 ${
                  c.pedindoConta
                    ? 'border-red-300 shadow-[0_0_0_2px_rgba(239,68,68,0.15)] dark:border-red-800'
                    : 'border-amber-200 dark:border-amber-900/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-black dark:text-gray-100">
                      {c.rotulo}
                      {c.pedindoConta && (
                        <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-black text-red-600 dark:text-red-400">
                          {tDynamic('PEDIU A CONTA')}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1"><Clock size={11} /> {tempoDecorrido(c.abertaEm)}</span>
                      <span className="flex items-center gap-1">
                        {c.abertaPorNome
                          ? <><UserRound size={11} /> {c.abertaPorNome}</>
                          : c.temAutor
                            ? <><QrCode size={11} /> {tDynamic('pelo cliente (QR)')}</>
                            : <><UserRound size={11} /> {tDynamic('autor não registrado')}</>}
                      </span>
                      <span>{c.itens} {c.itens === 1 ? tDynamic('item') : tDynamic('itens')}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-[var(--cor-primaria)]">{fmt(saldo)}</p>
                    {c.pago > 0 && (
                      <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        {tDynamic('já pago')} {fmt(c.pago)}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(c.mesaId ? `/admin/mesas?conta=${c.mesaId}` : '/admin/garcom-mobile')}
                  className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] py-2.5 text-xs font-black text-white transition active:scale-[0.98]"
                >
                  <HandCoins size={14} /> {tDynamic('Receber esta conta')}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
