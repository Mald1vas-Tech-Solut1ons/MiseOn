/**
 * Rastreio3D — wrapper React do Rastreio de Estoque 3D.
 *
 * Divisão de trabalho: a engine desenha o corredor 3D; o React cuida de tudo
 * que é negócio — setores (chips coloridos), busca, paginação, painel de
 * detalhe do item, checagem de receitas e os cartões-resumo (a versão
 * acessível da cena, para quem não interage com 3D).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, AlertTriangle, PackageX, TrendingUp, ChefHat, X } from 'lucide-react';
import { RastreioEngine } from './RastreioEngine';
import { verificarReceita, type DadosReceitas, type ReceitaCheck } from './receitas';
import { SETORES, type SetorId } from './setores';
import type { ItemRastreio, SetorRastreio } from './carregarRastreio';
import './Rastreio3D.css';

import { useI18n } from '../../../contexts/I18nContext';
interface Props {
  setores: SetorRastreio[];
  dadosReceitas: DadosReceitas | null;
  altura?: number | string;
}

const ITENS_POR_PAGINA = 10;

const brl = (v: number, casas = 2) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: casas });

const fmtQtd = (q: number) => q.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const ESTADO_UI: Record<ItemRastreio['estado'], { rotulo: string; classe: string }> = {
  ok: { rotulo: 'Em dia', classe: 'ok' },
  critico: { rotulo: 'Crítico', classe: 'critico' },
  sem_estoque: { rotulo: 'Sem estoque', classe: 'sem-estoque' },
  sem_custo: { rotulo: 'Sem custo', classe: 'sem-custo' },
  alerta_desvio: { rotulo: 'Desvio de custo', classe: 'desvio' },
};

export function Rastreio3D({ setores, dadosReceitas, altura = 620 }: Props) {
  const { tDynamic } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RastreioEngine | null>(null);

  const [setorId, setSetorId] = useState<SetorId>(() => setores[0]?.setor.id ?? 'geladeira');
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<ItemRastreio | null>(null);
  const [receitaId, setReceitaId] = useState('');
  const [erroEngine, setErroEngine] = useState<string | null>(null);

  const setorAtual = setores.find((s) => s.setor.id === setorId) ?? setores[0];

  const itensFiltrados = useMemo(() => {
    if (!setorAtual) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return setorAtual.itens;
    return setorAtual.itens.filter((i) => i.nome.toLowerCase().includes(q) || i.categoria.toLowerCase().includes(q));
  }, [setorAtual, busca]);

  const totalPaginas = Math.max(1, Math.ceil(itensFiltrados.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const itensPagina = itensFiltrados.slice(paginaSegura * ITENS_POR_PAGINA, (paginaSegura + 1) * ITENS_POR_PAGINA);

  // Checagem da receita selecionada (puro, instantâneo).
  const receitaCheck: ReceitaCheck | null = useMemo(() => {
    if (!receitaId || !dadosReceitas) return null;
    const receita = dadosReceitas.receitas.find((r) => r.id === receitaId);
    if (!receita) return null;
    return verificarReceita(receita, dadosReceitas.fichasTecnicas, dadosReceitas.fichasPreparos, dadosReceitas.insumos);
  }, [receitaId, dadosReceitas]);

  // Monta a engine uma única vez — e nunca deixa uma falha de WebGL derrubar
  // a tela (a tela azul original foi uma exceção não tratada no efeito).
  useEffect(() => {
    if (!containerRef.current) return;
    try {
      const engine = new RastreioEngine(containerRef.current, { onSelecionar: setSelecionado });
      engineRef.current = engine;
      return () => { engine.dispose(); engineRef.current = null; };
    } catch (e) {
      setErroEngine(e instanceof Error ? e.message : String(e));
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!engineRef.current || !setorAtual) return;
    try {
      engineRef.current.setSetor(setorAtual, itensPagina);
    } catch (e) {
      setErroEngine(e instanceof Error ? e.message : String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setorId, paginaSegura, busca, setores]);

  // Modo receita: destaca ingredientes na cena (ou limpa).
  useEffect(() => {
    if (!engineRef.current) return;
    try {
      engineRef.current.destacarIngredientes(receitaCheck ? receitaCheck.ingredientes : null);
    } catch { /* destaque é enfeite — nunca derruba */ }
  }, [receitaCheck]);

  if (erroEngine) {
    return (
      <div className="mo-r3d-falha" style={{ height: altura }} role="alert">
        <AlertTriangle size={22} />
        <strong>{tDynamic('O módulo 3D não pôde ser exibido neste dispositivo.')}</strong>
        <span>{erroEngine}</span>
        <span>{tDynamic('Os números continuam disponíveis nas abas Matérias-Primas e Custo 3D.')}</span>
      </div>
    );
  }

  if (!setorAtual) return null;

  return (
    <div className="mo-r3d" style={{ height: altura }}>
      <div
        ref={containerRef}
        className="mo-r3d-canvas"
        role="application"
        aria-label="Rastreio 3D do estoque: linhas de itens por setor, da compra ao uso"
      />

      {/* Setores — o mapa de cores do armazenamento */}
      <div className="mo-r3d-setores" role="tablist" aria-label="Setores do estoque">
        {setores.map((s) => (
          <button
            key={s.setor.id}
            role="tab"
            aria-selected={s.setor.id === setorId}
            className={`mo-r3d-setor ${s.setor.id === setorId ? 'ativo' : ''}`}
            style={{ ['--cor-setor' as string]: s.setor.cor }}
            onClick={() => { setSetorId(s.setor.id); setPagina(0); setSelecionado(null); }}
          >
            {s.setor.icone} {s.setor.rotulo}
            <span className="mo-r3d-setor-n">{s.itens.length}</span>
            {s.alertas > 0 && <span className="mo-r3d-setor-alerta">{s.alertas}⚠</span>}
          </button>
        ))}
      </div>

      {/* HUD superior: resumo do setor + busca + receita */}
      <div className="mo-r3d-hud">
        <div className="mo-r3d-resumo">
          <span><TrendingUp size={13} aria-hidden /> {brl(setorAtual.totalInvestido)} no setor</span>
          <span>{setorAtual.itens.length} itens</span>
          {setorAtual.alertas > 0 && (
            <span className="mo-r3d-hud-alerta"><AlertTriangle size={13} aria-hidden /> {setorAtual.alertas} pedem atenção</span>
          )}
        </div>
        <div className="mo-r3d-acoes">
          <label className="mo-r3d-busca">
            <Search size={14} aria-hidden />
            <input
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
              placeholder="Buscar item ou categoria…"
              aria-label="Buscar item ou categoria"
            />
          </label>
          {dadosReceitas && dadosReceitas.receitas.length > 0 && (
            <label className="mo-r3d-receita-sel">
              <ChefHat size={14} aria-hidden />
              <select
                value={receitaId}
                onChange={(e) => setReceitaId(e.target.value)}
                aria-label="Verificar receita contra o estoque"
              >
                <option value="">Verificar receita…</option>
                {dadosReceitas.receitas.map((r) => (
                  <option key={r.id} value={r.id}>{r.tipo === 'preparo' ? '🥣 ' : '🍽️ '}{r.nome}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {/* Paginação do setor */}
      {totalPaginas > 1 && (
        <div className="mo-r3d-paginas">
          {Array.from({ length: totalPaginas }, (_, p) => (
            <button
              key={p}
              className={`mo-r3d-pagina ${p === paginaSegura ? 'ativa' : ''}`}
              onClick={() => setPagina(p)}
              aria-label={`Página ${p + 1} de ${totalPaginas}`}
            >
              {p + 1}
            </button>
          ))}
        </div>
      )}

      {/* Legenda */}
      <div data-tour="tour-estoque-3d-legenda-rastreio" className="mo-r3d-legenda">
        <span><i className="mo-r3d-dot" style={{ background: '#22d3ee' }} /> etapa física (automática)</span>
        <span><i className="mo-r3d-dot" style={{ background: '#f59e0b' }} /> etapa humana ⚠️ (rendimento declarado)</span>
        <span><i className="mo-r3d-dot" style={{ background: '#ef4444' }} /> crítico</span>
      </div>

      {/* Painel da receita checada */}
      {receitaCheck && (
        <aside className={`mo-r3d-recpanel ${receitaCheck.completa ? 'ok' : 'falta'}`} aria-live="polite">
          <header>
            <strong>{receitaCheck.tipo === 'preparo' ? '🥣' : '🍽️'} {receitaCheck.nome}</strong>
            <button onClick={() => setReceitaId('')} aria-label="Fechar checagem de receita"><X size={15} /></button>
          </header>
          {receitaCheck.ingredientes.length === 0 ? (
            <p className="mo-r3d-rec-linha">{tDynamic('Receita sem ficha técnica cadastrada.')}</p>
          ) : (
            <>
              <p className={`mo-r3d-rec-veredito ${receitaCheck.completa ? 'ok' : 'falta'}`}>
                {receitaCheck.completa
                  ? `✅ Dá para produzir — rende até ${receitaCheck.maxPorcoes} porç${receitaCheck.maxPorcoes === 1 ? 'ão' : 'ões'}.`
                  : receitaCheck.maxPorcoes > 0
                    ? `⚠️ Rende só ${receitaCheck.maxPorcoes} porç${receitaCheck.maxPorcoes === 1 ? 'ão' : 'ões'} — limita: ${receitaCheck.gargalo}.`
                    : `❌ Não rende nenhuma porção — falta: ${receitaCheck.gargalo}.`}
              </p>
              <ul className="mo-r3d-rec-lista">
                {receitaCheck.ingredientes.map((ing) => (
                  <li key={`${ing.insumoId}-${ing.viaPreparo ?? ''}`} className={ing.cobre ? 'ok' : 'falta'}>
                    <span className="mo-r3d-rec-nome">
                      {ing.cobre ? '✅' : '❌'} {ing.nome}
                      {ing.viaPreparo && <em> (via {ing.viaPreparo})</em>}
                    </span>
                    <span className="mo-r3d-rec-num">
                      {fmtQtd(ing.disponivel)} / {fmtQtd(ing.necessario)} {ing.unidadeBase}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      )}

      {/* Painel de detalhe do item selecionado */}
      {selecionado && (
        <aside className="mo-r3d-painel" aria-live="polite">
          <header>
            <strong>{selecionado.nome}</strong>
            <button onClick={() => setSelecionado(null)} aria-label="Fechar detalhe"><X size={15} /></button>
          </header>
          <p className="mo-r3d-painel-meta">
            {SETORES[selecionado.setor].icone} {SETORES[selecionado.setor].rotulo} · {selecionado.categoria}
            <span className={`mo-r3d-badge ${ESTADO_UI[selecionado.estado].classe}`}>{ESTADO_UI[selecionado.estado].rotulo}</span>
          </p>
          <dl>
            <div><dt>Estoque atual</dt><dd>{fmtQtd(selecionado.quantidadeAtual)} {selecionado.unidadeBase}</dd></div>
            <div>
              <dt>Custo por {selecionado.unidadeBase}</dt>
              <dd>{selecionado.custoBase != null ? brl(selecionado.custoBase, 4) : '—'}{selecionado.origemCusto && <i> ({selecionado.origemCusto})</i>}</dd>
            </div>
            <div><dt>Investido</dt><dd>{selecionado.totalInvestido != null ? brl(selecionado.totalInvestido) : '—'}</dd></div>
            <div><dt>Lotes ativos (PEPS)</dt><dd>{selecionado.lotesAtivos}</dd></div>
            <div><dt>Estoque mínimo</dt><dd>{fmtQtd(selecionado.estoqueMinimo)} {selecionado.unidadeBase}</dd></div>
            {selecionado.desvioPct != null && (
              <div><dt>Desvio cadastro × lotes</dt><dd className={selecionado.estado === 'alerta_desvio' ? 'mo-r3d-dd-alerta' : ''}>{selecionado.desvioPct > 0 ? '+' : ''}{fmtQtd(selecionado.desvioPct)}%</dd></div>
            )}
          </dl>
          <ul className="mo-r3d-painel-cadeia">
            {selecionado.estagios.map((e, i) => (
              <li key={i}>
                <span>{e.rotulo}{i > 0 && (e.tipo === 'humana' ? ' ⚠️' : ' ✓')}</span>
                <span>{fmtQtd(e.quantidade)} {e.unidade}{e.custoUnitario != null ? ` · ${brl(e.custoUnitario, 4)}/${e.unidade}` : ''}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {/* Cartões-resumo — a versão acessível da cena */}
      <div data-tour="tour-estoque-3d-cartoes" className="mo-r3d-cartoes">
        {itensPagina.map((item) => (
          <button
            key={item.insumoId}
            className={`mo-r3d-cartao ${selecionado?.insumoId === item.insumoId ? 'selecionado' : ''}`}
            style={{ ['--cor-setor' as string]: SETORES[item.setor].cor }}
            onClick={() => setSelecionado(item)}
          >
            <span className="mo-r3d-cartao-topo">
              <strong>{item.nome}</strong>
              <span className={`mo-r3d-badge ${ESTADO_UI[item.estado].classe}`}>{ESTADO_UI[item.estado].rotulo}</span>
            </span>
            <span className="mo-r3d-cartao-cadeia">
              {item.estagios.map((e, i) => (
                <span key={i} className="mo-r3d-cartao-estagio">
                  {i > 0 && <i className="mo-r3d-cartao-seta">{e.tipo === 'humana' ? '⚠️' : '→'}</i>}
                  {fmtQtd(e.quantidade)} {e.unidade}
                  {e.custoUnitario != null && <em> {brl(e.custoUnitario)}/{e.unidade}</em>}
                </span>
              ))}
            </span>
          </button>
        ))}
        {itensPagina.length === 0 && (
          <p className="mo-r3d-vazio-busca"><PackageX size={16} aria-hidden /> Nenhum item encontrado neste setor.</p>
        )}
      </div>

      <p className="mo-r3d-nota">
        Quantidades e custos são os valores reais do estoque (lotes PEPS + cadastro), convertidos por nível.
        Cena simbólica: até 10 objetos por etapa.
      </p>
    </div>
  );
}

export default Rastreio3D;
