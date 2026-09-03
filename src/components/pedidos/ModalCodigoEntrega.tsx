import { useEffect, useRef, useState } from 'react';
import { Bike, Check, ChevronDown, HelpCircle, KeyRound, Loader2, PackageCheck, XCircle } from 'lucide-react';
import { validarCodigoIfood } from '../../lib/ifood';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { Pedido } from '../../types';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Validação do código do pedido — os dois momentos em que o iFood pede conferência.
 *
 *   tipo="coleta"  → o entregador DO IFOOD chega na loja para retirar a sacola e
 *                    apresenta um código. Confere e libera. Não encerra o pedido:
 *                    quem conclui depois é o iFood.
 *
 *   tipo="entrega" → a sacola chega em quem pediu (entrega própria) ou o cliente
 *                    retira no balcão. Este passo CONCLUI o pedido no iFood — é a
 *                    etapa 5 da homologação ("Conclua um pedido").
 *
 * O código NUNCA é mostrado na tela, mesmo estando no pedido. Ele existe para
 * provar que a sacola chegou em quem devia: se aparecesse aqui, o atendente
 * digitaria sozinho e a conferência viraria teatro.
 */

type Fase =
  | { nome: 'digitando'; erro?: string }
  | { nome: 'enviando' }
  | { nome: 'falha'; mensagem: string; tecnico?: string }
  | { nome: 'ok'; soLocal?: boolean };

export function ModalCodigoEntrega({
  pedido,
  tipo,
  onFechar,
  onValidado,
}: {
  /** null fecha o modal. */
  pedido: Pedido | null;
  tipo: 'coleta' | 'entrega';
  onFechar: () => void;
  /** Chamado só depois do iFood aceitar o código. */
  onValidado: () => void | Promise<void>;
}) {
  const { tDynamic } = useI18n();
  const [codigo, setCodigo] = useState('');
  const [fase, setFase] = useState<Fase>({ nome: 'digitando' });
  const [verAjuda, setVerAjuda] = useState(false);
  const [verTecnico, setVerTecnico] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pedidoId = pedido?.id;

  useEffect(() => {
    if (!pedidoId) return;
    setCodigo('');
    setFase({ nome: 'digitando' });
    setVerAjuda(false);
    setVerTecnico(false);
    // Quem está com o cliente na frente não deveria precisar clicar no campo.
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [pedidoId]);

  const enviar = async () => {
    if (!pedido || codigo.length < 3) return;
    setFase({ nome: 'enviando' });

    const r = await validarCodigoIfood(pedido.id, tipo, codigo);

    // Código errado é o caso comum e não é "erro do sistema": volta para o
    // campo com o aviso, sem tirar o atendente do fluxo.
    if (!r.ok && r.codigoInvalido) {
      setFase({ nome: 'digitando', erro: r.erro });
      setCodigo('');
      inputRef.current?.focus();
      return;
    }
    // A loja desligou o aviso ao iFood nas preferências. Não é falha: ela
    // escolheu tocar o iFood pelo Portal do Parceiro. Travar a baixa aqui
    // deixaria o entregador na porta do cliente sem conseguir fechar a entrega.
    if (!r.ok && r.desligado) {
      setFase({ nome: 'ok', soLocal: true });
      await onValidado();
      window.setTimeout(onFechar, 2200);
      return;
    }
    if (!r.ok) {
      setFase({ nome: 'falha', mensagem: r.erro ?? 'O iFood recusou a validação.', tecnico: r.tecnico });
      return;
    }

    setFase({ nome: 'ok' });
    await onValidado();
    window.setTimeout(onFechar, 1400);
  };

  if (!pedido) return null;

  const coleta = tipo === 'coleta';
  const bloqueado = fase.nome === 'enviando' || fase.nome === 'ok';

  return (
    <Modal
      aberto
      onFechar={bloqueado ? undefined : onFechar}
      titulo={coleta ? `Conferir coleta · #${pedido.numero}` : `Confirmar entrega · #${pedido.numero}`}
      largura="max-w-md"
    >
      {fase.nome === 'ok' ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <Check size={28} strokeWidth={3} />
          </div>
          <p className="font-['Sora'] text-base font-bold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">
            {coleta ? tDynamic('Código confere — pode liberar') : tDynamic('Entrega confirmada')}
          </p>
          <p className="max-w-xs text-xs text-[var(--cor-texto-fraco)]">
            {fase.soLocal
              ? tDynamic('Concluído aqui. O aviso ao iFood está desligado nas preferências da loja — dê a baixa no Portal do Parceiro.')
              : coleta
                ? tDynamic('O entregador é o certo para este pedido.')
                : tDynamic('O pedido foi concluído no iFood e no MiseOn.')}
          </p>
        </div>
      ) : fase.nome === 'falha' ? (
        <div className="space-y-3">
          <div className="flex gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <XCircle size={20} className="mt-0.5 shrink-0 text-red-500" />
            <div className="min-w-0">
              <p className="font-['Sora'] text-sm font-bold text-red-600 dark:text-red-400">
                {tDynamic('Não deu para validar')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--cor-texto-suave)]">{fase.mensagem}</p>
              {fase.tecnico && (
                <>
                  <button
                    onClick={() => setVerTecnico((v) => !v)}
                    className="mt-2 flex items-center gap-1 text-xs opacity-95 font-semibold text-[var(--cor-texto-fraco)] hover:underline"
                  >
                    <ChevronDown size={12} className={verTecnico ? 'rotate-180 transition' : 'transition'} />
                    {tDynamic('Detalhe técnico (para o suporte)')}
                  </button>
                  {verTecnico && (
                    <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 font-['JetBrains_Mono'] text-xs opacity-90 text-[var(--cor-texto-fraco)]">
                      {fase.tecnico}
                    </pre>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secundario" onClick={onFechar}>{tDynamic('Fechar')}</Button>
            <Button variant="primario" onClick={() => setFase({ nome: 'digitando' })}>
              {tDynamic('Tentar de novo')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-3 rounded-2xl border border-[var(--cor-borda)] bg-[var(--cor-surface)] p-3.5">
            {coleta ? (
              <Bike size={18} className="mt-0.5 shrink-0 text-blue-500" />
            ) : (
              <PackageCheck size={18} className="mt-0.5 shrink-0 text-emerald-500" />
            )}
            <div className="text-xs leading-relaxed text-[var(--cor-texto-suave)]">
              <p className="font-bold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">
                {coleta
                  ? tDynamic('Peça o código ao entregador do iFood')
                  : pedido.tipo_pedido === 'DELIVERY'
                    ? tDynamic('Peça o código a quem recebeu o pedido')
                    : tDynamic('Peça o código ao cliente que veio retirar')}
              </p>
              <p className="mt-1">
                {coleta
                  ? tDynamic('É a conferência de que a sacola vai com o entregador certo.')
                  : tDynamic('Confirmando aqui, o pedido é concluído no iFood na hora.')}
              </p>
            </div>
          </div>

          <label className="block">
            <span className="text-xs opacity-95 font-semibold uppercase tracking-wider text-[var(--cor-texto-fraco)]">
              {coleta ? tDynamic('Código de coleta') : tDynamic('Código de entrega')}
            </span>
            <div className="relative mt-1.5">
              <KeyRound
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--cor-texto-fraco)]"
              />
              <input
                ref={inputRef}
                value={codigo}
                onChange={(e) => {
                  setCodigo(e.target.value.replace(/\D/g, '').slice(0, 12));
                  if (fase.nome === 'digitando' && fase.erro) setFase({ nome: 'digitando' });
                }}
                onKeyDown={(e) => e.key === 'Enter' && enviar()}
                inputMode="numeric"
                autoComplete="off"
                placeholder="••••"
                disabled={bloqueado}
                className={`w-full rounded-2xl border-2 bg-[var(--cor-surface)] py-4 pl-12 pr-4 text-center font-['JetBrains_Mono'] text-2xl font-black tracking-[0.35em] text-[var(--cor-texto)] outline-none transition placeholder:tracking-[0.35em] placeholder:text-[var(--cor-texto-fraco)] disabled:opacity-60 dark:text-[var(--cor-texto-claro)] ${
                  fase.nome === 'digitando' && fase.erro
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-[var(--cor-borda)] focus:border-orange-500'
                }`}
              />
            </div>
          </label>

          {fase.nome === 'digitando' && fase.erro && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-500">
              <XCircle size={13} className="shrink-0" /> {fase.erro}
            </p>
          )}

          <button
            onClick={() => setVerAjuda((v) => !v)}
            className="mt-3 flex items-center gap-1.5 text-xs opacity-95 font-semibold text-[var(--cor-texto-fraco)] hover:underline"
          >
            <HelpCircle size={13} /> {tDynamic('E se o cliente não tiver o código?')}
          </button>
          {verAjuda && (
            <p className="mt-1.5 rounded-xl border border-[var(--cor-borda)] bg-[var(--cor-surface)] p-3 text-xs opacity-95 leading-relaxed text-[var(--cor-texto-suave)]">
              {coleta
                ? tDynamic('O código aparece no app do entregador, na tela da coleta. Se ele não conseguir mostrar, não libere a sacola: acione o suporte do iFood pelo Portal do Parceiro.')
                : tDynamic('O código fica no acompanhamento do pedido, no app do iFood. Sem ele, não confirme por aqui — o iFood conclui o pedido sozinho depois do prazo de entrega, e forçar a baixa aqui faria os dois sistemas discordarem.')}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secundario" onClick={onFechar} disabled={bloqueado}>
              {tDynamic('Voltar')}
            </Button>
            <Button
              variant="sucesso"
              onClick={enviar}
              disabled={codigo.length < 3 || bloqueado}
              icone={fase.nome === 'enviando' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            >
              {fase.nome === 'enviando'
                ? tDynamic('Validando no iFood…')
                : coleta
                  ? tDynamic('Conferir código')
                  : tDynamic('Confirmar entrega')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
