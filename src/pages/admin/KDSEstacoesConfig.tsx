/**
 * Cadastro de ESTAÇÕES e FLUXOS do KDS.
 *
 * ─── POR QUE ESTA TELA EXISTE ──────────────────────────────────────────────
 * O banco sempre suportou quantas ilhas o restaurante quisesse — `kds_estacoes`
 * tem nome, cor, ordem e ativo, e `kds_workflows` guarda as etapas em JSON,
 * livres. Mas NÃO HAVIA UM ÚNICO INSERT NO FRONTEND INTEIRO: tudo que existia
 * tinha nascido do seed.
 *
 * O resultado, medido em 11/09/2026: as 8 lojas em produção tinham exatamente
 * as mesmas duas estações — "Cozinha" e "Bar" — com os mesmos fluxos, em todos
 * os nichos. Uma cantina não conseguia criar "Ilha de Massas"; uma confeitaria
 * não conseguia criar "Sobremesas". O KDS parecia engessado porque estava.
 *
 * ─── EDITAR FLUXO COM A CASA CHEIA É SEGURO ────────────────────────────────
 * `kds_tickets.workflow_snapshot` guarda a cópia do fluxo no momento em que o
 * ticket nasceu. Mudar as etapas aqui não mexe em pedido que já está na praça:
 * ele termina pelo caminho com que começou, e só os próximos usam o novo. Sem
 * isso, mexer no fluxo no meio do almoço embaralharia a cozinha.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  ChefHat, Plus, Trash2, GripVertical, ArrowUp, ArrowDown,
  Save, Loader2, AlertTriangle, Eye, EyeOff, ArrowLeft,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../contexts/I18nContext';
import type { CtxLoja } from './AdminLayout';
import MiseOnLoader from '../../components/MiseOnLoader';
import type { KdsEstacao, EtapaKdsWorkflow } from '../../types';

/** Paleta curta: cor de estação serve para reconhecer de longe, não para decorar. */
const CORES = ['#FC5B24', '#8B5CF6', '#0EA5E9', '#22C55E', '#EAB308', '#EC4899', '#64748B'];

/** Fluxo padrão de uma estação nova — três etapas é o mínimo que faz sentido. */
const ETAPAS_PADRAO: EtapaKdsWorkflow[] = [
  { id: 'fila', nome: 'Fila de Entrada', ordem: 0 },
  { id: 'preparo', nome: 'Em Preparo', ordem: 1 },
  { id: 'expedicao', nome: 'Expedição', ordem: 2 },
];

type WorkflowDaEstacao = { id: string | null; nome: string; etapas: EtapaKdsWorkflow[] };

/** `id` da etapa é usado no ticket: precisa ser estável e sem acento/espaço. */
function idDeEtapa(nome: string, usados: Set<string>): string {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'etapa';
  let id = base;
  let n = 2;
  while (usados.has(id)) { id = `${base}-${n}`; n += 1; }
  return id;
}

export default function KDSEstacoesConfig() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();

  const [carregando, setCarregando] = useState(true);
  const [estacoes, setEstacoes] = useState<KdsEstacao[]>([]);
  const [fluxos, setFluxos] = useState<Record<string, WorkflowDaEstacao>>({});
  const [ticketsPorEstacao, setTicketsPorEstacao] = useState<Record<string, number>>({});
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(async () => {
    if (!lojaId) return;
    const [{ data: est }, { data: wf }, { data: tks }] = await Promise.all([
      supabase.from('kds_estacoes').select('*').eq('loja_id', lojaId).order('ordem'),
      supabase.from('kds_workflows').select('id, estacao_id, nome, etapas').eq('loja_id', lojaId),
      // Quantos tickets ABERTOS cada estação tem. É o que decide se apagar é
      // seguro: apagar estação com ticket na praça derruba pedido em produção.
      supabase.from('kds_tickets').select('estacao_id, status').eq('loja_id', lojaId).neq('status', 'PRONTO'),
    ]);

    const listaEst = (est ?? []) as KdsEstacao[];
    setEstacoes(listaEst);

    const mapa: Record<string, WorkflowDaEstacao> = {};
    for (const e of listaEst) {
      const achado = (wf ?? []).find((w: { estacao_id: string }) => w.estacao_id === e.id) as
        { id: string; nome: string; etapas: EtapaKdsWorkflow[] } | undefined;
      mapa[e.id] = achado
        ? { id: achado.id, nome: achado.nome, etapas: [...achado.etapas].sort((a, b) => a.ordem - b.ordem) }
        : { id: null, nome: `Fluxo ${e.nome}`, etapas: ETAPAS_PADRAO.map((x) => ({ ...x })) };
    }
    setFluxos(mapa);

    const contagem: Record<string, number> = {};
    for (const t of (tks ?? []) as { estacao_id: string }[]) {
      contagem[t.estacao_id] = (contagem[t.estacao_id] ?? 0) + 1;
    }
    setTicketsPorEstacao(contagem);
    setCarregando(false);
  }, [lojaId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const novaEstacao = async () => {
    setErro(''); setAviso('');
    const ordem = estacoes.length ? Math.max(...estacoes.map((e) => e.ordem)) + 1 : 0;
    const { data, error } = await supabase.from('kds_estacoes').insert({
      loja_id: lojaId,
      nome: `Ilha ${estacoes.length + 1}`,
      cor: CORES[estacoes.length % CORES.length],
      ativo: true,
      ordem,
    }).select('*').single();
    if (error) { setErro(`Não consegui criar a estação: ${error.message}`); return; }

    const est = data as KdsEstacao;
    setEstacoes((l) => [...l, est]);
    setFluxos((f) => ({
      ...f,
      [est.id]: { id: null, nome: `Fluxo ${est.nome}`, etapas: ETAPAS_PADRAO.map((x) => ({ ...x })) },
    }));
    setAviso('Estação criada. Dê um nome e salve o fluxo dela.');
  };

  const alterarEstacao = (id: string, campos: Partial<KdsEstacao>) =>
    setEstacoes((l) => l.map((e) => (e.id === id ? { ...e, ...campos } : e)));

  const salvarEstacao = async (est: KdsEstacao) => {
    setErro(''); setAviso(''); setSalvando(est.id);
    const fluxo = fluxos[est.id];

    if (!est.nome.trim()) { setErro('A estação precisa de um nome.'); setSalvando(null); return; }
    if (!fluxo || fluxo.etapas.length === 0) {
      setErro('O fluxo precisa de pelo menos uma etapa — senão o ticket nasce sem para onde ir.');
      setSalvando(null); return;
    }
    if (fluxo.etapas.some((e) => !e.nome.trim())) {
      setErro('Toda etapa precisa de nome: é o que o cozinheiro lê na tela.');
      setSalvando(null); return;
    }

    const { error: erroEst } = await supabase.from('kds_estacoes')
      .update({ nome: est.nome.trim(), cor: est.cor, ativo: est.ativo, ordem: est.ordem })
      .eq('id', est.id);
    if (erroEst) { setErro(`Não consegui salvar a estação: ${erroEst.message}`); setSalvando(null); return; }

    // Reescreve a ordem a partir da posição na lista: o campo `ordem` é o que
    // o KDS usa para desenhar as colunas, e deixá-lo com buraco embaralha a tela.
    const etapas = fluxo.etapas.map((e, i) => ({ ...e, nome: e.nome.trim(), ordem: i }));

    const { error: erroWf } = fluxo.id
      ? await supabase.from('kds_workflows')
          .update({ nome: fluxo.nome.trim() || `Fluxo ${est.nome}`, etapas }).eq('id', fluxo.id)
      : await supabase.from('kds_workflows')
          .insert({ loja_id: lojaId, estacao_id: est.id, nome: fluxo.nome.trim() || `Fluxo ${est.nome}`, etapas });

    if (erroWf) { setErro(`Não consegui salvar o fluxo: ${erroWf.message}`); setSalvando(null); return; }

    setSalvando(null);
    setAviso(`"${est.nome}" salva. Pedidos novos já entram por este fluxo; os que estão na praça terminam pelo antigo.`);
    void carregar();
  };

  const apagarEstacao = async (est: KdsEstacao) => {
    setErro(''); setAviso('');
    const abertos = ticketsPorEstacao[est.id] ?? 0;
    if (abertos > 0) {
      setErro(`"${est.nome}" tem ${abertos} ticket(s) em andamento. Desative em vez de apagar — apagar agora derrubaria pedido que está sendo feito.`);
      return;
    }
    if (!confirm(`Apagar a estação "${est.nome}" e o fluxo dela? O histórico de tickets já concluídos é preservado.`)) return;

    const fluxo = fluxos[est.id];
    if (fluxo?.id) await supabase.from('kds_workflows').delete().eq('id', fluxo.id);
    const { error } = await supabase.from('kds_estacoes').delete().eq('id', est.id);
    if (error) { setErro(`Não consegui apagar: ${error.message}`); return; }
    setAviso(`"${est.nome}" apagada.`);
    void carregar();
  };

  const moverEstacao = async (index: number, direcao: -1 | 1) => {
    const outra = index + direcao;
    if (outra < 0 || outra >= estacoes.length) return;
    const lista = [...estacoes];
    [lista[index], lista[outra]] = [lista[outra], lista[index]];
    const comOrdem = lista.map((e, i) => ({ ...e, ordem: i }));
    setEstacoes(comOrdem);
    await Promise.all(comOrdem.map((e) =>
      supabase.from('kds_estacoes').update({ ordem: e.ordem }).eq('id', e.id)));
  };

  // ── Etapas do fluxo ──────────────────────────────────────────────────────
  const alterarEtapa = (estId: string, idx: number, nome: string) =>
    setFluxos((f) => ({
      ...f,
      [estId]: { ...f[estId], etapas: f[estId].etapas.map((e, i) => (i === idx ? { ...e, nome } : e)) },
    }));

  const addEtapa = (estId: string) =>
    setFluxos((f) => {
      const atual = f[estId];
      const usados = new Set(atual.etapas.map((e) => e.id));
      const nome = 'Nova etapa';
      return {
        ...f,
        [estId]: {
          ...atual,
          etapas: [...atual.etapas, { id: idDeEtapa(`${nome}-${atual.etapas.length + 1}`, usados), nome, ordem: atual.etapas.length }],
        },
      };
    });

  const removerEtapa = (estId: string, idx: number) =>
    setFluxos((f) => ({
      ...f,
      [estId]: { ...f[estId], etapas: f[estId].etapas.filter((_, i) => i !== idx) },
    }));

  const moverEtapa = (estId: string, idx: number, direcao: -1 | 1) =>
    setFluxos((f) => {
      const etapas = [...f[estId].etapas];
      const outro = idx + direcao;
      if (outro < 0 || outro >= etapas.length) return f;
      [etapas[idx], etapas[outro]] = [etapas[outro], etapas[idx]];
      return { ...f, [estId]: { ...f[estId], etapas } };
    });

  if (carregando) {
    return <div className="flex justify-center pt-24"><MiseOnLoader status="Carregando estações" rows={3} /></div>;
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-600/25">
            <ChefHat size={24} />
          </div>
          <div>
            <h1 className="font-['Sora'] text-2xl font-extrabold text-gray-900 dark:text-white">
              {tDynamic('Estações e Fluxos da Cozinha')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tDynamic('Cada ilha tem a própria fila e as próprias etapas. Massas, sobremesas, chapa, bar — do jeito que a sua cozinha trabalha.')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/kds" className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2 text-sm font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300">
            <ArrowLeft size={15} /> {tDynamic('Voltar ao KDS')}
          </Link>
          <button type="button" onClick={novaEstacao}
            className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-sm font-black text-white transition hover:brightness-110">
            <Plus size={16} /> {tDynamic('Nova estação')}
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {erro}
        </div>
      )}
      {aviso && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300">
          {aviso}
        </div>
      )}

      {estacoes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{tDynamic('Nenhuma estação ainda')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
            {tDynamic('Sem estação, tudo cai numa fila só. Com estações, cada praça enxerga apenas o que é dela e trabalha no próprio ritmo.')}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {estacoes.map((est, i) => {
          const fluxo = fluxos[est.id];
          const abertos = ticketsPorEstacao[est.id] ?? 0;
          return (
            <div key={est.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              {/* Cabeçalho da estação */}
              <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <span className="h-8 w-2 shrink-0 rounded-full" style={{ backgroundColor: est.cor }} />
                <input
                  value={est.nome}
                  onChange={(e) => alterarEstacao(est.id, { nome: e.target.value })}
                  placeholder="Ilha de Massas"
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <div className="flex shrink-0 gap-1">
                  {CORES.map((c) => (
                    <button key={c} type="button" onClick={() => alterarEstacao(est.id, { cor: c })}
                      title={`Cor ${c}`}
                      className={`h-6 w-6 rounded-full border-2 transition ${est.cor === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <button type="button" onClick={() => alterarEstacao(est.id, { ativo: !est.ativo })}
                  title={est.ativo ? 'Desativar' : 'Ativar'}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black ${est.ativo
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400'}`}>
                  {est.ativo ? <Eye size={14} /> : <EyeOff size={14} />}
                  {est.ativo ? tDynamic('Ativa') : tDynamic('Inativa')}
                </button>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => moverEstacao(i, -1)} disabled={i === 0} title="Subir"
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 disabled:opacity-30 dark:border-gray-700"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => moverEstacao(i, 1)} disabled={i === estacoes.length - 1} title="Descer"
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 disabled:opacity-30 dark:border-gray-700"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => apagarEstacao(est)} title="Apagar estação"
                    className="rounded-lg border border-red-200 p-2 text-red-600 dark:border-red-900/50"><Trash2 size={14} /></button>
                </div>
              </div>

              {/* Etapas */}
              <div className="px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {tDynamic('Etapas — viram as colunas do KDS desta ilha')}
                  </p>
                  {abertos > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {abertos} {tDynamic('em andamento — terminam pelo fluxo antigo')}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {fluxo?.etapas.map((etapa, idx) => (
                    <div key={etapa.id} className="flex items-center gap-2">
                      <GripVertical size={15} className="shrink-0 text-gray-300 dark:text-gray-600" />
                      <span className="w-6 shrink-0 text-center font-mono text-xs text-gray-400">{idx + 1}</span>
                      <input
                        value={etapa.nome}
                        onChange={(e) => alterarEtapa(est.id, idx, e.target.value)}
                        placeholder="Em preparo"
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <button type="button" onClick={() => moverEtapa(est.id, idx, -1)} disabled={idx === 0} title="Subir"
                        className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 disabled:opacity-30 dark:border-gray-700"><ArrowUp size={13} /></button>
                      <button type="button" onClick={() => moverEtapa(est.id, idx, 1)} disabled={idx === fluxo.etapas.length - 1} title="Descer"
                        className="shrink-0 rounded-lg border border-gray-200 p-2 text-gray-500 disabled:opacity-30 dark:border-gray-700"><ArrowDown size={13} /></button>
                      <button type="button" onClick={() => removerEtapa(est.id, idx)} title="Remover etapa"
                        className="shrink-0 rounded-lg border border-red-200 p-2 text-red-500 dark:border-red-900/50"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={() => addEtapa(est.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-bold text-gray-600 transition hover:border-orange-500 hover:text-orange-600 dark:border-gray-600 dark:text-gray-300">
                    <Plus size={14} /> {tDynamic('Adicionar etapa')}
                  </button>
                  <button type="button" onClick={() => salvarEstacao(est)} disabled={salvando === est.id}
                    className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-xs font-black text-white transition hover:brightness-110 disabled:opacity-60">
                    {salvando === est.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {tDynamic('Salvar esta estação')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
