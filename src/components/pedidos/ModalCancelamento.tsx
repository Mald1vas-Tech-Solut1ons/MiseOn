import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, Loader2, RefreshCw, ShieldAlert, XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cancelarNoIfood, motivosDeCancelamento } from '../../lib/ifood';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { fmt, type Pedido } from '../../types';
import { useI18n } from '../../contexts/I18nContext';

/**
 * Cancelamento de pedido — a tela inteira do ato.
 *
 * POR QUE ISTO EXISTE (e por que não é só um `confirm()`):
 * Cancelar era `if (!confirm('Cancelar pedido?')) return;` seguido de um UPDATE
 * de status. Três buracos, todos sentidos na homologação do iFood:
 *
 *   1. Ninguém registrava o MOTIVO. O pedido sumia do painel sem história.
 *   2. Num pedido do iFood, o motivo não é texto livre: tem que ser um código
 *      da lista que o PRÓPRIO iFood devolve para aquele pedido, e a lista muda
 *      conforme o estágio. Chutar o primeiro item da lista é o que o código
 *      fazia — e o lojista cancelava "sistema com problema" sem saber.
 *   3. O aviso ao iFood saía por gatilho, sem retorno. Se o iFood recusasse, o
 *      MiseOn dizia CANCELADO e o cliente continuava com o pedido de pé no app.
 *
 * A ordem aqui é deliberada e não pode ser invertida:
 *   consulta os motivos -> lojista escolhe -> cancela NO IFOOD -> só então
 *   grava CANCELADO no MiseOn.
 * Falhou no iFood, nada é gravado: os dois sistemas continuam concordando que o
 * pedido está vivo, e a tela diz por quê. Divergência silenciosa entre sistemas
 * é o pior estado possível para quem está no balcão.
 */

type Motivo = { codigo: string; descricao: string };

/**
 * Motivos para pedido que não é do iFood. Espelham as categorias do iFood de
 * propósito: quem opera o balcão vê a mesma lista nos dois canais, e o relatório
 * de cancelamento fica comparável entre eles.
 */
const MOTIVOS_LOJA: Motivo[] = [
  { codigo: 'CLIENTE_DESISTIU', descricao: 'O cliente desistiu do pedido' },
  { codigo: 'ITEM_INDISPONIVEL', descricao: 'Item indisponível / acabou o insumo' },
  { codigo: 'FORA_DE_AREA', descricao: 'Endereço fora da área de entrega' },
  { codigo: 'SEM_ENTREGADOR', descricao: 'Sem entregador disponível' },
  { codigo: 'PROBLEMA_PAGAMENTO', descricao: 'Problema no pagamento' },
  { codigo: 'PEDIDO_DUPLICADO', descricao: 'Pedido duplicado' },
  { codigo: 'TROTE', descricao: 'Suspeita de trote' },
  { codigo: 'OUTRO', descricao: 'Outro motivo' },
];

type Fase =
  | { nome: 'escolhendo' }
  | { nome: 'enviando'; passo: 'ifood' | 'miseon' }
  | { nome: 'erro'; mensagem: string; tecnico?: string }
  | { nome: 'concluido'; motivo: string };

export function ModalCancelamento({
  pedido,
  onFechar,
  onCancelado,
}: {
  /** null fecha o modal. O pedido inteiro entra para o resumo do cabeçalho. */
  pedido: Pedido | null;
  onFechar: () => void;
  onCancelado: () => void;
}) {
  const { tDynamic } = useI18n();
  const ehIfood = pedido?.origem === 'ifood' && !!pedido?.ifood_order_id;
  // O id, e não o objeto, é a identidade que interessa aos efeitos: o Painel
  // recarrega a lista depois do cancelamento e devolveria um objeto novo para o
  // mesmo pedido — o reset abaixo apagaria a tela de sucesso no meio dela.
  const pedidoId = pedido?.id;

  const [motivos, setMotivos] = useState<Motivo[]>(MOTIVOS_LOJA);
  const [carregandoMotivos, setCarregandoMotivos] = useState(false);
  const [erroMotivos, setErroMotivos] = useState<string | null>(null);
  /** true = o iFood não respondeu a lista e estamos com o catálogo padrão dele. */
  const [listaPadrao, setListaPadrao] = useState(false);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [observacao, setObservacao] = useState('');
  const [fase, setFase] = useState<Fase>({ nome: 'escolhendo' });
  const [verTecnico, setVerTecnico] = useState(false);
  const fecharDepoisRef = useRef<number | undefined>(undefined);

  /**
   * A lista vem do iFood a cada abertura, nunca de cache: entre um pedido e
   * outro (e entre um estágio e outro do mesmo pedido) ela muda.
   */
  const buscarMotivos = useCallback(async () => {
    if (!pedidoId || !ehIfood) return;
    setCarregandoMotivos(true);
    setErroMotivos(null);
    const data = await motivosDeCancelamento(pedidoId);
    setCarregandoMotivos(false);

    if (!data.ok) {
      setErroMotivos(data.erro ?? 'O iFood não devolveu os motivos deste pedido.');
      return;
    }
    if (!data.motivos?.length) {
      setErroMotivos(
        'O iFood não oferece motivo de cancelamento para este pedido agora — sinal de que ele já não pode ser cancelado por aqui.',
      );
      return;
    }
    setListaPadrao(data.origem === 'padrao');
    setMotivos(data.motivos);
  }, [pedidoId, ehIfood]);

  // Reset a cada pedido: modal reaproveitado não pode herdar escolha do anterior.
  useEffect(() => {
    if (!pedidoId) return;
    setEscolhido(null);
    setObservacao('');
    setFase({ nome: 'escolhendo' });
    setVerTecnico(false);
    setListaPadrao(false);
    if (ehIfood) {
      setMotivos([]);
      buscarMotivos();
    } else {
      setMotivos(MOTIVOS_LOJA);
      setErroMotivos(null);
    }
  }, [pedidoId, ehIfood, buscarMotivos]);

  useEffect(() => () => window.clearTimeout(fecharDepoisRef.current), []);

  const confirmar = async () => {
    if (!pedido || !escolhido) return;
    const motivo = motivos.find((m) => m.codigo === escolhido);
    if (!motivo) return;

    // O texto que vai para o histórico: descrição do motivo + o que o lojista
    // escreveu. Guardar só o código deixaria o relatório ilegível daqui a um mês.
    const texto = observacao.trim()
      ? `${motivo.descricao} — ${observacao.trim()}`
      : motivo.descricao;

    // ── 1. iFood primeiro ───────────────────────────────────────────────────
    if (ehIfood) {
      setFase({ nome: 'enviando', passo: 'ifood' });
      // Só o código vai para o iFood: a observação do lojista fica no MiseOn.
      // O `reason` da API tem que ser o código; texto livre ali faz o
      // cancelamento ser recusado depois, por evento.
      const data = await cancelarNoIfood(pedido.id, motivo.codigo);

      if (!data.ok) {
        setFase({
          nome: 'erro',
          mensagem: data.erro ?? 'O iFood recusou o cancelamento.',
          tecnico: data.tecnico,
        });
        return;
      }
    }

    // ── 2. Só agora o MiseOn ────────────────────────────────────────────────
    setFase({ nome: 'enviando', passo: 'miseon' });
    const { error: erroRpc } = await supabase.rpc('fn_cancelar_pedido', {
      p_pedido_id: pedido.id,
      p_motivo: texto,
    });

    if (erroRpc) {
      setFase({
        nome: 'erro',
        mensagem: ehIfood
          ? 'O cancelamento já foi enviado ao iFood, mas o MiseOn recusou a baixa. Atualize a tela: se o pedido continuar aberto aqui, chame o suporte.'
          : 'O MiseOn recusou o cancelamento deste pedido.',
        tecnico: erroRpc.message,
      });
      return;
    }

    setFase({ nome: 'concluido', motivo: motivo.descricao });
    onCancelado();
    fecharDepoisRef.current = window.setTimeout(onFechar, 2200);
  };

  if (!pedido) return null;

  const bloqueado = fase.nome === 'enviando' || fase.nome === 'concluido';

  return (
    <Modal
      aberto
      onFechar={bloqueado ? undefined : onFechar}
      titulo={`Cancelar pedido #${pedido.numero}`}
      largura="max-w-lg"
    >
      {/* ── Resumo: confirma para quem olha QUAL pedido está prestes a cair ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--cor-borda)] bg-[var(--cor-surface)] px-4 py-3">
        {ehIfood && (
          <span className="rounded-md bg-red-600 px-1.5 py-0.5 font-['JetBrains_Mono'] text-[10px] font-bold text-white">
            iFood
          </span>
        )}
        <span className="font-['Sora'] text-sm font-black text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">
          #{pedido.numero}
        </span>
        <span className="truncate text-xs text-[var(--cor-texto-fraco)]">{pedido.identificador_cliente}</span>
        <span className="ml-auto font-['JetBrains_Mono'] text-sm font-bold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">
          {fmt(Number(pedido.valor_total))}
        </span>
      </div>

      {/* ══ ENVIANDO ══════════════════════════════════════════════════════ */}
      {fase.nome === 'enviando' && (
        <div className="space-y-3 py-2">
          {ehIfood && (
            <PassoEnvio
              feito={fase.passo === 'miseon'}
              ativo={fase.passo === 'ifood'}
              texto={tDynamic('Enviando o cancelamento ao iFood')}
            />
          )}
          <PassoEnvio
            feito={false}
            ativo={fase.passo === 'miseon'}
            texto={tDynamic('Baixando o pedido no MiseOn e estornando o estoque')}
          />
          {/* Título do passo do iFood é "enviando", não "cancelando": o que
              sai daqui é um pedido de cancelamento que eles confirmam depois. */}
          <p className="pt-1 text-center text-[11px] text-[var(--cor-texto-fraco)]">
            {tDynamic('Não feche esta janela.')}
          </p>
        </div>
      )}

      {/* ══ CONCLUÍDO ═════════════════════════════════════════════════════ */}
      {fase.nome === 'concluido' && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
            <Check size={28} strokeWidth={3} />
          </div>
          <p className="font-['Sora'] text-base font-bold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">
            {tDynamic('Pedido cancelado')} #{pedido.numero}
          </p>
          <p className="max-w-sm text-xs text-[var(--cor-texto-fraco)]">
            {tDynamic('Motivo registrado:')}{' '}
            <strong className="text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">{fase.motivo}</strong>
          </p>
          {/* O iFood responde ao cancelamento por evento, não na hora: o POST
              volta "recebido" e a confirmação (ou a recusa) chega depois. Dizer
              "cancelado no iFood" aqui seria prometer o que ainda não aconteceu. */}
          {ehIfood && (
            <p className="max-w-sm text-[11px] leading-relaxed text-[var(--cor-texto-fraco)]">
              {tDynamic('O pedido de cancelamento foi enviado ao iFood. A confirmação deles chega em instantes — se for recusada, o cartão do pedido avisa.')}
            </p>
          )}
        </div>
      )}

      {/* ══ ERRO ══════════════════════════════════════════════════════════ */}
      {fase.nome === 'erro' && (
        <div className="space-y-3">
          <div className="flex gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <XCircle size={20} className="mt-0.5 shrink-0 text-red-500" />
            <div className="min-w-0">
              <p className="font-['Sora'] text-sm font-bold text-red-600 dark:text-red-400">
                {tDynamic('O cancelamento não foi concluído')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--cor-texto-suave)]">{fase.mensagem}</p>
              {fase.tecnico && (
                <>
                  <button
                    onClick={() => setVerTecnico((v) => !v)}
                    className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[var(--cor-texto-fraco)] hover:underline"
                  >
                    <ChevronDown size={12} className={verTecnico ? 'rotate-180 transition' : 'transition'} />
                    {tDynamic('Detalhe técnico (para o suporte)')}
                  </button>
                  {verTecnico && (
                    <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 font-['JetBrains_Mono'] text-[10px] text-[var(--cor-texto-fraco)]">
                      {fase.tecnico}
                    </pre>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secundario" onClick={onFechar}>
              {tDynamic('Fechar')}
            </Button>
            <Button variant="perigo" onClick={() => setFase({ nome: 'escolhendo' })}>
              {tDynamic('Tentar de novo')}
            </Button>
          </div>
        </div>
      )}

      {/* ══ ESCOLHENDO O MOTIVO ═══════════════════════════════════════════ */}
      {fase.nome === 'escolhendo' && (
        <>
          <div className="mb-4 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="text-xs leading-relaxed text-[var(--cor-texto-suave)]">
              <p className="font-bold text-amber-600 dark:text-amber-400">
                {tDynamic('O que acontece ao confirmar')}
              </p>
              <ul className="mt-1 space-y-0.5">
                {ehIfood && <li>{tDynamic('· O cliente é avisado no app do iFood, com este motivo.')}</li>}
                <li>{tDynamic('· O estoque consumido pelo pedido volta para o seu saldo.')}</li>
                <li>{tDynamic('· O valor sai do faturamento do dia.')}</li>
                <li className="font-semibold">{tDynamic('· Não dá para desfazer.')}</li>
              </ul>
            </div>
          </div>

          <p className="mb-1 font-['Sora'] text-sm font-bold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">
            {tDynamic('Por que este pedido está sendo cancelado?')}
          </p>
          <p className="mb-2.5 text-[11px] text-[var(--cor-texto-fraco)]">
            {ehIfood
              ? tDynamic('Lista fornecida pelo iFood para este pedido — só estes motivos são aceitos por lá.')
              : tDynamic('O motivo fica registrado no histórico do pedido.')}
          </p>

          {/* A lista ao vivo é a autoridade. Quando ela não vem, o lojista tem
              que saber que está escolhendo do catálogo padrão — e que por isso
              o iFood ainda pode recusar o código. */}
          {listaPadrao && !carregandoMotivos && !erroMotivos && (
            <p className="mb-2.5 flex gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-400">
              <AlertTriangle size={13} className="mt-px shrink-0" />
              {tDynamic('O iFood não respondeu a lista deste pedido agora — estes são os motivos padrão dele. O cancelamento segue normalmente; se o iFood recusar o código, avisamos aqui.')}
            </p>
          )}

          {/* Carregando os motivos do iFood */}
          {carregandoMotivos && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--cor-borda)] px-4 py-6 text-sm text-[var(--cor-texto-fraco)]">
              <Loader2 size={16} className="animate-spin text-orange-500" />
              {tDynamic('Consultando os motivos no iFood…')}
            </div>
          )}

          {/* iFood não respondeu / não tem motivo aplicável */}
          {!carregandoMotivos && erroMotivos && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex gap-2.5">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                <p className="text-xs leading-relaxed text-[var(--cor-texto-suave)]">{erroMotivos}</p>
              </div>
              <Button variant="secundario" size="sm" className="mt-3" icone={<RefreshCw size={13} />} onClick={buscarMotivos}>
                {tDynamic('Consultar de novo')}
              </Button>
            </div>
          )}

          {!carregandoMotivos && !erroMotivos && (
            <div className="max-h-[38dvh] space-y-1.5 overflow-y-auto pr-1">
              {motivos.map((m) => {
                const ativo = escolhido === m.codigo;
                return (
                  <button
                    key={m.codigo}
                    onClick={() => setEscolhido(m.codigo)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                      ativo
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-[var(--cor-borda)] hover:border-red-500/40 hover:bg-[var(--cor-destaque)]'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        ativo ? 'border-red-500 bg-red-500' : 'border-[var(--cor-borda)]'
                      }`}
                    >
                      {ativo && <Check size={10} strokeWidth={4} className="text-white" />}
                    </span>
                    <span
                      className={`text-sm ${
                        ativo
                          ? 'font-semibold text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]'
                          : 'text-[var(--cor-texto-suave)]'
                      }`}
                    >
                      {m.descricao}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!carregandoMotivos && !erroMotivos && (
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold text-[var(--cor-texto-fraco)]">
                {tDynamic('Observação (opcional) — entra no histórico do pedido')}
              </span>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder={tDynamic('Ex.: cliente ligou pedindo para cancelar')}
                className="mt-1 w-full resize-none rounded-xl border border-[var(--cor-borda)] bg-[var(--cor-surface)] px-3 py-2 text-sm text-[var(--cor-texto)] outline-none placeholder:text-[var(--cor-texto-fraco)] focus:border-orange-500 dark:text-[var(--cor-texto-claro)]"
              />
            </label>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secundario" onClick={onFechar}>
              {tDynamic('Voltar')}
            </Button>
            <Button
              variant="perigo"
              disabled={!escolhido}
              onClick={confirmar}
              icone={<XCircle size={16} />}
            >
              {ehIfood ? tDynamic('Cancelar no iFood e no MiseOn') : tDynamic('Cancelar pedido')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

/** Uma linha do progresso do envio. Mostrar os passos evita a tela "travada". */
function PassoEnvio({ feito, ativo, texto }: { feito: boolean; ativo: boolean; texto: string }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
        ativo
          ? 'border-orange-500/40 bg-orange-500/10'
          : feito
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : 'border-[var(--cor-borda)] opacity-50'
      }`}
    >
      {feito ? (
        <Check size={16} className="shrink-0 text-emerald-500" strokeWidth={3} />
      ) : ativo ? (
        <Loader2 size={16} className="shrink-0 animate-spin text-orange-500" />
      ) : (
        <span className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--cor-borda)]" />
      )}
      <span className="text-sm text-[var(--cor-texto-suave)]">{texto}</span>
    </div>
  );
}
