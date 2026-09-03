import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock, Loader2, MessageSquareWarning, ThumbsDown, XCircle } from 'lucide-react';
import {
  MOTIVOS_REJEICAO,
  ROTULO_ACAO,
  ROTULO_TIPO,
  aceitarNegociacao,
  consequenciaDoSilencio,
  negociacoesAbertas,
  rejeitarNegociacao,
  type DisputaIfood,
} from '../../lib/ifoodDisputa';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { fmt } from '../../types';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Negociações pós-entrega do iFood, no topo do Painel de Pedidos.
 *
 * POR QUE FICA AQUI, E NÃO NUMA ABA:
 * A negociação tem prazo curto e consequência automática — sem resposta, o
 * iFood decide sozinho, e em cancelamento pós-entrega isso significa a loja
 * perdendo o valor do pedido. Colocar numa aba que ninguém abre é o mesmo que
 * não ter feito: o lojista fica no Painel, então a pendência vai até ele.
 *
 * Não é notificação. Notificação some; isto tem que continuar na frente até
 * alguém decidir.
 */

function restante(expiraEm: string | null): { texto: string; critico: boolean; acabou: boolean } {
  if (!expiraEm) return { texto: '—', critico: false, acabou: false };
  const ms = new Date(expiraEm).getTime() - Date.now();
  if (ms <= 0) return { texto: 'prazo estourado', critico: true, acabou: true };
  const min = Math.floor(ms / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  return {
    texto: `${min}min ${String(seg).padStart(2, '0')}s`,
    critico: ms < 120000,
    acabou: false,
  };
}

export function PainelNegociacoes({ lojaId }: { lojaId: string }) {
  const { tDynamic } = useI18n();
  const [disputas, setDisputas] = useState<DisputaIfood[]>([]);
  const [aberta, setAberta] = useState<DisputaIfood | null>(null);
  // Só para forçar o recálculo do relógio a cada segundo.
  const [, setTique] = useState(0);

  const carregar = useCallback(async () => {
    setDisputas(await negociacoesAbertas(lojaId));
  }, [lojaId]);

  useEffect(() => {
    carregar();
    // Realtime para a negociação aparecer sem ninguém apertar nada: quando ela
    // chega, o relógio já está correndo.
    const canal = supabase
      .channel(`disputas-${lojaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ifood_disputas', filter: `loja_id=eq.${lojaId}` },
        () => carregar(),
      )
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [lojaId, carregar]);

  // O relógio precisa andar na tela. Sem isto o lojista vê "6min 00s" parado e
  // não sente a urgência que existe de verdade.
  useEffect(() => {
    if (disputas.length === 0) return;
    const t = window.setInterval(() => setTique((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [disputas.length]);

  if (disputas.length === 0) return null;

  return (
    <>
      <div className="mb-4 space-y-2">
        {disputas.map((d) => {
          const tempo = restante(d.expira_em);
          return (
            <div
              key={d.id}
              className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 p-3.5 ${
                tempo.critico
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-amber-400 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'
              }`}
            >
              <MessageSquareWarning size={20} className={tempo.critico ? 'shrink-0 text-red-500' : 'shrink-0 text-amber-500'} />

              <div className="min-w-0 flex-1">
                <p className="font-['Sora'] text-sm font-bold text-gray-900 dark:text-gray-100">
                  {tDynamic('O cliente abriu uma reclamação')}
                  {d.pedidos?.numero ? ` · #${d.pedidos.numero}` : ''}
                  {d.acao ? ` · ${tDynamic(ROTULO_ACAO[d.acao] ?? d.acao)}` : ''}
                  {d.tipo ? ` ${tDynamic(ROTULO_TIPO[d.tipo] ?? '')}` : ''}
                </p>
                {d.mensagem && (
                  <p className="mt-0.5 truncate text-xs italic text-gray-600 dark:text-gray-300">"{d.mensagem}"</p>
                )}
                <p className="mt-0.5 text-xs opacity-95 font-semibold text-red-600 dark:text-red-400">
                  {tDynamic(consequenciaDoSilencio(d.acao_no_prazo))}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-['JetBrains_Mono'] text-xs font-black ${
                    tempo.critico ? 'bg-red-500 text-white' : 'bg-amber-400/30 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <Clock size={12} /> {tempo.texto}
                </span>
                <Button variant="primario" size="sm" onClick={() => setAberta(d)} disabled={tempo.acabou}>
                  {tDynamic('Responder')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <ModalNegociacao
        disputa={aberta}
        onFechar={() => setAberta(null)}
        onRespondida={() => { setAberta(null); carregar(); }}
      />
    </>
  );
}

type Fase =
  | { nome: 'escolhendo' }
  | { nome: 'enviando' }
  | { nome: 'erro'; mensagem: string }
  | { nome: 'pronto'; resultado: string };

function ModalNegociacao({
  disputa,
  onFechar,
  onRespondida,
}: {
  disputa: DisputaIfood | null;
  onFechar: () => void;
  onRespondida: () => void;
}) {
  const { tDynamic } = useI18n();
  const [decisao, setDecisao] = useState<'aceitar' | 'rejeitar' | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState('');
  const [fase, setFase] = useState<Fase>({ nome: 'escolhendo' });
  const disputaId = disputa?.id;

  useEffect(() => {
    if (!disputaId) return;
    setDecisao(null);
    setMotivo(null);
    setDetalhe('');
    setFase({ nome: 'escolhendo' });
  }, [disputaId]);

  if (!disputa) return null;

  // A lista de ACEITE vem dentro do evento: são os motivos que o iFood aceita
  // para ESTA negociação. Se ele não mandou, o aceite fica sem motivo válido e
  // a tela avisa em vez de inventar um código.
  const motivosAceite = ((disputa.metadados?.acceptCancellationReasons as string[]) ?? []).map((c) => ({
    codigo: c,
    descricao: c.replace(/_/g, ' ').toLowerCase(),
  }));

  const lista = decisao === 'aceitar' ? motivosAceite : MOTIVOS_REJEICAO;
  const valorEmJogo = Number(disputa.pedidos?.valor_total ?? 0);

  const enviar = async () => {
    if (!decisao || !motivo) return;
    setFase({ nome: 'enviando' });
    const r = decisao === 'aceitar'
      ? await aceitarNegociacao(disputa.id, motivo, detalhe.trim() || undefined)
      : await rejeitarNegociacao(disputa.id, motivo);

    if (!r.ok) {
      setFase({ nome: 'erro', mensagem: r.erro ?? 'O iFood recusou a resposta.' });
      return;
    }
    setFase({
      nome: 'pronto',
      resultado: decisao === 'aceitar'
        ? 'Cancelamento aceito. O valor sai do seu faturamento.'
        : 'Reclamação rejeitada. O iFood analisa e devolve o desfecho.',
    });
    window.setTimeout(onRespondida, 1800);
  };

  const bloqueado = fase.nome === 'enviando' || fase.nome === 'pronto';

  return (
    <Modal
      aberto
      onFechar={bloqueado ? undefined : onFechar}
      titulo={`${tDynamic('Reclamação do cliente')}${disputa.pedidos?.numero ? ` · #${disputa.pedidos.numero}` : ''}`}
      largura="max-w-lg"
    >
      {fase.nome === 'pronto' ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <Check size={28} strokeWidth={3} />
          </div>
          <p className="font-['Sora'] text-base font-bold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">
            {tDynamic('Resposta enviada ao iFood')}
          </p>
          <p className="max-w-xs text-xs text-[var(--cor-texto-fraco)]">{tDynamic(fase.resultado)}</p>
        </div>
      ) : (
        <>
          {/* O que o cliente disse, com as palavras dele. */}
          <div className="mb-4 rounded-2xl border border-[var(--cor-borda)] bg-[var(--cor-surface)] p-3.5">
            <p className="text-xs opacity-95 font-semibold uppercase tracking-wider text-[var(--cor-texto-fraco)]">
              {tDynamic('O que o cliente relatou')}
            </p>
            <p className="mt-1 text-sm italic text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">
              "{disputa.mensagem || tDynamic('Sem descrição')}"
            </p>
            {valorEmJogo > 0 && (
              <p className="mt-2 text-xs text-[var(--cor-texto-suave)]">
                {tDynamic('Valor em jogo')}: <strong>{fmt(valorEmJogo)}</strong>
              </p>
            )}
          </div>

          <div className="mb-4 flex gap-2.5 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-xs leading-relaxed text-[var(--cor-texto-suave)]">
              {tDynamic(consequenciaDoSilencio(disputa.acao_no_prazo))}
            </p>
          </div>

          {/* Decisão primeiro, motivo depois: escolher o motivo antes de saber
              se aceita ou rejeita é pedir para o lojista errar. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setDecisao('rejeitar'); setMotivo(null); }}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition ${
                decisao === 'rejeitar'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-[var(--cor-borda)] hover:border-emerald-500/40'
              }`}
            >
              <ThumbsDown size={18} className="text-emerald-600" />
              <span className="text-sm font-bold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">
                {tDynamic('Rejeitar')}
              </span>
              <span className="text-xs opacity-90 text-[var(--cor-texto-fraco)]">{tDynamic('mantenho o valor')}</span>
            </button>

            <button
              onClick={() => { setDecisao('aceitar'); setMotivo(null); }}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition ${
                decisao === 'aceitar'
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-[var(--cor-borda)] hover:border-red-500/40'
              }`}
            >
              <XCircle size={18} className="text-red-500" />
              <span className="text-sm font-bold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">
                {tDynamic('Aceitar')}
              </span>
              <span className="text-xs opacity-90 text-[var(--cor-texto-fraco)]">{tDynamic('abro mão do valor')}</span>
            </button>
          </div>

          {decisao && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-bold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">
                {tDynamic('Por quê?')}
              </p>

              {lista.length === 0 ? (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-[var(--cor-texto-suave)]">
                  {tDynamic('O iFood não ofereceu motivo de aceite para esta negociação. Rejeite por aqui ou trate no Portal do Parceiro.')}
                </p>
              ) : (
                <div className="max-h-[32dvh] space-y-1.5 overflow-y-auto pr-1">
                  {lista.map((m) => (
                    <button
                      key={m.codigo}
                      onClick={() => setMotivo(m.codigo)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                        motivo === m.codigo
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-[var(--cor-borda)] hover:border-orange-500/40'
                      }`}
                    >
                      <span className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${motivo === m.codigo ? 'border-orange-500 bg-orange-500' : 'border-[var(--cor-borda)]'}`} />
                      <span className="text-sm capitalize text-[var(--cor-texto-suave)]">{m.descricao}</span>
                    </button>
                  ))}
                </div>
              )}

              {decisao === 'aceitar' && lista.length > 0 && (
                <label className="mt-3 block">
                  <span className="text-xs opacity-95 font-semibold text-[var(--cor-texto-fraco)]">
                    {tDynamic('Detalhe (opcional) — vai junto para o iFood')}
                  </span>
                  <textarea
                    value={detalhe}
                    onChange={(e) => setDetalhe(e.target.value)}
                    rows={2}
                    maxLength={250}
                    className="mt-1 w-full resize-none rounded-xl border border-[var(--cor-borda)] bg-[var(--cor-surface)] px-3 py-2 text-sm text-[var(--cor-texto)] outline-none focus:border-orange-500 dark:text-[var(--cor-texto-claro)]"
                  />
                </label>
              )}
            </div>
          )}

          {fase.nome === 'erro' && (
            <p className="mt-3 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-400">
              <XCircle size={14} className="mt-px shrink-0" /> {fase.mensagem}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secundario" onClick={onFechar} disabled={bloqueado}>
              {tDynamic('Voltar')}
            </Button>
            <Button
              variant={decisao === 'aceitar' ? 'perigo' : 'sucesso'}
              onClick={enviar}
              disabled={!decisao || !motivo || bloqueado}
              icone={fase.nome === 'enviando' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            >
              {fase.nome === 'enviando' ? tDynamic('Enviando ao iFood…') : tDynamic('Enviar resposta')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
