import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bike, Calculator, CheckCircle2, Layers, Loader2, LocateFixed, MapPin, Plus, Ruler, Tag, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { aplicarRegraEntrega } from '../../../lib/geo';
import { localizarEnderecoLoja } from '../../../lib/entregaCotacao';
import type { ConfigEntregaForm, FaixaEntregaForm } from '../../../lib/entregaConfig';
import type { EntregaModo } from '../../../types';
import { fmt } from '../../../types';
import { useI18n } from '../../../contexts/I18nContext';

/**
 * Configuração de entrega do lojista.
 *
 * Três jeitos de cobrar, que é o que o mercado usa: faixas de distância
 * (padrão — "até 2 km R$ 6"), taxa única e valor por km. A distância é medida
 * pelo caminho de carro, a partir do pino da loja; o círculo no mapa é só
 * referência visual. O simulador usa os valores EM EDIÇÃO, antes de salvar.
 */

type CampoEntrega = 'entrega_taxa_base' | 'entrega_taxa_km' | 'entrega_raio_km' | 'frete_gratis_valor_minimo';

interface Props {
  enderecoLoja: string;
  config: ConfigEntregaForm;
  onAceitaEntrega: (v: boolean) => void;
  onModo: (m: EntregaModo) => void;
  onCampo: (campo: CampoEntrega, valor: string) => void;
  onLocalizacao: (lat: number, lng: number) => void;
  faixas: FaixaEntregaForm[];
  onFaixas: (f: FaixaEntregaForm[]) => void;
}

const CORES_FAIXA = ['#16a34a', '#2563eb', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];

const pinoLoja = L.divIcon({
  className: '',
  html: '<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--cor-primaria,#FC5B24);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

function Enquadrar({ centro, raioKm }: { centro: [number, number]; raioKm: number }) {
  const map = useMap();
  useEffect(() => {
    const r = Math.max(raioKm, 1) * 1000;
    const b = L.latLng(centro[0], centro[1]).toBounds(r * 2.2);
    map.fitBounds(b, { animate: false });
  }, [map, centro, raioKm]);
  return null;
}

const inputCls =
  'mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[var(--cor-primaria)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

export function ConfiguracaoEntrega({
  enderecoLoja, config, onAceitaEntrega, onModo, onCampo, onLocalizacao, faixas, onFaixas,
}: Props) {
  const { tDynamic } = useI18n();
  const lat = config.lat.trim() === '' ? null : Number(config.lat);
  const lng = config.lng.trim() === '' ? null : Number(config.lng);
  const localizada = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

  const [localizando, setLocalizando] = useState(false);
  const [erroLocal, setErroLocal] = useState('');

  const localizar = async () => {
    setErroLocal('');
    if (!enderecoLoja.trim()) {
      setErroLocal(tDynamic('Preencha o endereço da loja na aba Identidade.'));
      return;
    }
    setLocalizando(true);
    try {
      const r = await localizarEnderecoLoja(enderecoLoja);
      onLocalizacao(r.lat, r.lng);
    } catch (e) {
      setErroLocal((e as Error).message);
    } finally {
      setLocalizando(false);
    }
  };

  // ── Faixas ──────────────────────────────────────────────────────────────
  const faixasOrdenadas = useMemo(
    () => faixas.map((f, i) => ({ f, i })).sort((a, b) => (Number(a.f.km_ate) || 999) - (Number(b.f.km_ate) || 999)),
    [faixas],
  );
  const alterarFaixa = (i: number, campo: keyof FaixaEntregaForm, valor: string | boolean) =>
    onFaixas(faixas.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  const adicionarFaixa = () => {
    const maior = Math.max(0, ...faixas.map((f) => Number(f.km_ate) || 0));
    onFaixas([...faixas, {
      nome: '', km_ate: String(maior + 2), taxa_fixa: '', taxa_por_km: '', pedido_minimo: '', ordem: faixas.length + 1, ativo: true,
    }]);
  };

  const raioVisual = config.entrega_modo === 'HIBRIDO'
    ? Math.max(0, ...faixas.filter((f) => f.ativo).map((f) => Number(f.km_ate) || 0))
    : Number(config.entrega_raio_km) || 0;

  // ── Simulador ───────────────────────────────────────────────────────────
  const [simCep, setSimCep] = useState('');
  const [simNumero, setSimNumero] = useState('');
  const [simSubtotal, setSimSubtotal] = useState('50');
  const [simulando, setSimulando] = useState(false);
  const [simErro, setSimErro] = useState('');
  const [simDist, setSimDist] = useState<{ km: number; metodo: string; endereco: string; destino: { lat: number; lng: number } } | null>(null);

  const simular = async () => {
    setSimErro(''); setSimDist(null);
    if (!localizada) { setSimErro(tDynamic('Localize a loja no mapa primeiro.')); return; }
    setSimulando(true);
    const { data, error } = await supabase.functions.invoke('entrega-cotar', {
      body: { acao: 'distancia', origem: { lat, lng }, cep: simCep, numero: simNumero },
    });
    setSimulando(false);
    if (error) { setSimErro(error.message); return; }
    setSimDist({ km: Number(data.distancia_km), metodo: data.metodo, endereco: data.endereco, destino: data.destino });
  };

  const simResultado = simDist
    ? aplicarRegraEntrega(
        {
          aceita_entrega: config.aceita_entrega, entrega_modo: config.entrega_modo, lat, lng,
          entrega_taxa_base: Number(config.entrega_taxa_base || 0), entrega_taxa_km: Number(config.entrega_taxa_km || 0),
          entrega_raio_km: config.entrega_raio_km ? Number(config.entrega_raio_km) : null,
          frete_gratis_valor_minimo: Number(config.frete_gratis_valor_minimo || 0),
        },
        faixas.map((f) => ({
          nome: f.nome || null, km_ate: Number(f.km_ate), ativo: f.ativo,
          taxa_fixa: f.taxa_fixa !== '' ? Number(f.taxa_fixa) : null,
          taxa_por_km: f.taxa_por_km !== '' ? Number(f.taxa_por_km) : null,
          pedido_minimo: Number(f.pedido_minimo || 0),
        })),
        simDist.km,
        Number(simSubtotal || 0),
      )
    : null;

  const MODOS: { id: EntregaModo; titulo: string; texto: string; icone: typeof Layers; selo?: string }[] = [
    { id: 'HIBRIDO', titulo: tDynamic('Por faixas de distância'), texto: tDynamic('Até 2 km um valor, até 4 km outro. O cliente entende na hora.'), icone: Layers, selo: tDynamic('Recomendado') },
    { id: 'FIXA', titulo: tDynamic('Taxa única'), texto: tDynamic('O mesmo valor para qualquer endereço dentro do limite.'), icone: Tag },
    { id: 'DISTANCIA', titulo: tDynamic('Por km rodado'), texto: tDynamic('Valor de saída mais um valor por km. Bom para entregas longas.'), icone: Ruler },
  ];

  const motivoTexto = (m: string | null) =>
    m === 'FORA_DA_AREA' ? tDynamic('Fora da área de entrega')
    : m === 'ABAIXO_DO_MINIMO_DA_FAIXA' ? tDynamic('Abaixo do pedido mínimo desta faixa')
    : m === 'ENTREGA_NAO_CONFIGURADA' ? tDynamic('Entrega ainda não configurada')
    : tDynamic('Não entrega');

  return (
    <div className="space-y-4">
      {/* Liga/desliga */}
      <div className="flex items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold dark:text-gray-100"><Bike size={15} /> {tDynamic('Faço entrega')}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {tDynamic('Desligado, o cardápio oferece só retirada no balcão.')}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.aceita_entrega}
          onClick={() => onAceitaEntrega(!config.aceita_entrega)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${config.aceita_entrega ? 'bg-[var(--cor-primaria)]' : 'bg-gray-300 dark:bg-gray-600'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${config.aceita_entrega ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {config.aceita_entrega && (
        <>
          {/* 1. Onde fica a loja */}
          <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold dark:text-gray-100">1. {tDynamic('Onde fica a loja')}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {tDynamic('A distância de cada entrega é medida pelo caminho de carro a partir deste ponto. Se o pino não estiver na porta da loja, arraste.')}
                </p>
              </div>
              <button type="button" onClick={localizar} disabled={localizando}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-[var(--cor-primaria-texto)] disabled:opacity-60 dark:border-gray-700">
                {localizando ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
                {localizada ? tDynamic('Localizar de novo pelo endereço') : tDynamic('Localizar pelo endereço')}
              </button>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <MapPin size={12} /> {enderecoLoja || tDynamic('Endereço não preenchido (aba Identidade)')}
            </p>
            {erroLocal && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{erroLocal}</p>}

            {localizada ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700" style={{ height: 300 }}>
                <MapContainer center={[lat!, lng!]} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                  <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Enquadrar centro={[lat!, lng!]} raioKm={raioVisual || 3} />
                  {config.entrega_modo === 'HIBRIDO'
                    ? faixasOrdenadas.filter(({ f }) => f.ativo && Number(f.km_ate) > 0).reverse().map(({ f }, k, arr) => (
                        <Circle key={`${f.km_ate}-${k}`} center={[lat!, lng!]} radius={Number(f.km_ate) * 1000}
                          pathOptions={{ color: CORES_FAIXA[(arr.length - 1 - k) % CORES_FAIXA.length], weight: 2, fillOpacity: 0.07 }} />
                      ))
                    : raioVisual > 0 && (
                        <Circle center={[lat!, lng!]} radius={raioVisual * 1000} pathOptions={{ color: '#2563eb', weight: 2, fillOpacity: 0.07 }} />
                      )}
                  {simDist && (
                    <Circle center={[simDist.destino.lat, simDist.destino.lng]} radius={60}
                      pathOptions={{ color: '#111827', fillColor: '#111827', fillOpacity: 0.9 }} />
                  )}
                  <Marker
                    position={[lat!, lng!]}
                    icon={pinoLoja}
                    draggable
                    eventHandlers={{
                      dragend: (e) => {
                        const p = (e.target as L.Marker).getLatLng();
                        onLocalizacao(Number(p.lat.toFixed(7)), Number(p.lng.toFixed(7)));
                      },
                    }}
                  />
                </MapContainer>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                {tDynamic('Loja ainda sem localização: enquanto isso, o cardápio não oferece entrega.')}
              </div>
            )}
            {localizada && (
              <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                {tDynamic('Os círculos são referência. A taxa usa a distância pela rua, que costuma ser maior que a linha reta.')}
              </p>
            )}
          </section>

          {/* 2. Como cobra */}
          <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm font-semibold dark:text-gray-100">2. {tDynamic('Como você cobra a entrega')}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup">
              {MODOS.map(({ id, titulo, texto, icone: Icone, selo }) => {
                const ativo = config.entrega_modo === id;
                return (
                  <button key={id} type="button" role="radio" aria-checked={ativo} onClick={() => onModo(id)}
                    className={`relative rounded-2xl border-2 p-3 text-left transition ${ativo
                      ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)]/5'
                      : 'border-gray-200 hover:border-gray-400 dark:border-gray-700'}`}>
                    {selo && <span className="absolute right-2 top-2 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white">{selo}</span>}
                    <Icone size={18} className={ativo ? 'text-[var(--cor-primaria-texto)]' : 'text-gray-400'} />
                    <p className="mt-1.5 text-sm font-bold dark:text-gray-100">{titulo}</p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{texto}</p>
                  </button>
                );
              })}
            </div>

            {/* Campos do modo */}
            {config.entrega_modo === 'HIBRIDO' && (
              <div className="mt-4 space-y-2">
                <div className="hidden grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 sm:grid">
                  <span>{tDynamic('Até (km)')}</span><span>{tDynamic('Taxa (R$)')}</span><span>{tDynamic('Pedido mínimo (opcional)')}</span><span />
                </div>
                {faixasOrdenadas.map(({ f, i }, k) => (
                  <div key={f.id ?? `nova-${i}`} className="grid grid-cols-2 gap-2 rounded-xl border border-gray-100 p-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:border-0 sm:p-0 dark:border-gray-800">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-gray-500 sm:hidden">{tDynamic('Até (km)')}</span>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: CORES_FAIXA[k % CORES_FAIXA.length] }} />
                        <input type="number" inputMode="decimal" step="0.5" min="0" value={f.km_ate}
                          onChange={(e) => alterarFaixa(i, 'km_ate', e.target.value)} className={inputCls} aria-label={tDynamic('Até (km)')} />
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-gray-500 sm:hidden">{tDynamic('Taxa (R$)')}</span>
                      <input type="number" inputMode="decimal" step="0.5" min="0" value={f.taxa_fixa} placeholder={f.taxa_por_km ? `${f.taxa_por_km}/km` : '0,00'}
                        onChange={(e) => alterarFaixa(i, 'taxa_fixa', e.target.value)} className={inputCls} aria-label={tDynamic('Taxa (R$)')} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-gray-500 sm:hidden">{tDynamic('Pedido mínimo (opcional)')}</span>
                      <input type="number" inputMode="decimal" step="1" min="0" value={f.pedido_minimo === '0' ? '' : f.pedido_minimo} placeholder="—"
                        onChange={(e) => alterarFaixa(i, 'pedido_minimo', e.target.value)} className={inputCls} aria-label={tDynamic('Pedido mínimo (opcional)')} />
                    </label>
                    <button type="button" onClick={() => onFaixas(faixas.filter((_, j) => j !== i))}
                      className="self-end rounded-xl p-3 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" aria-label={tDynamic('Remover faixa')}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={adicionarFaixa}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)]/10 px-3 py-2 text-xs font-bold text-[var(--cor-primaria-texto)]">
                  <Plus size={14} /> {tDynamic('Adicionar faixa')}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {raioVisual > 0
                    ? `${tDynamic('A última faixa é o limite: acima de')} ${raioVisual} km ${tDynamic('a loja não entrega.')}`
                    : tDynamic('Cadastre as faixas. A última faixa é o limite de entrega.')}
                </p>
              </div>
            )}

            {config.entrega_modo === 'FIXA' && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{tDynamic('Taxa de entrega (R$)')}</span>
                  <input type="number" inputMode="decimal" step="0.5" min="0" value={config.entrega_taxa_base}
                    onChange={(e) => onCampo('entrega_taxa_base', e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{tDynamic('Entrega até (km)')}</span>
                  <input type="number" inputMode="decimal" step="0.5" min="0" value={config.entrega_raio_km}
                    onChange={(e) => onCampo('entrega_raio_km', e.target.value)} className={inputCls} />
                </label>
              </div>
            )}

            {config.entrega_modo === 'DISTANCIA' && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{tDynamic('Valor de saída (R$)')}</span>
                  <input type="number" inputMode="decimal" step="0.5" min="0" value={config.entrega_taxa_base}
                    onChange={(e) => onCampo('entrega_taxa_base', e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{tDynamic('Por km (R$)')}</span>
                  <input type="number" inputMode="decimal" step="0.25" min="0" value={config.entrega_taxa_km}
                    onChange={(e) => onCampo('entrega_taxa_km', e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{tDynamic('Entrega até (km)')}</span>
                  <input type="number" inputMode="decimal" step="0.5" min="0" value={config.entrega_raio_km}
                    onChange={(e) => onCampo('entrega_raio_km', e.target.value)} className={inputCls} />
                </label>
                <p className="text-xs text-gray-500 sm:col-span-3 dark:text-gray-400">
                  {tDynamic('Exemplo com os seus valores: 3 km =')} {fmt(Number(config.entrega_taxa_base || 0) + 3 * Number(config.entrega_taxa_km || 0))}
                </p>
              </div>
            )}

            <label className="mt-4 block max-w-xs">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{tDynamic('Frete grátis a partir de (R$, opcional)')}</span>
              <input type="number" inputMode="decimal" step="5" min="0"
                value={config.frete_gratis_valor_minimo === '0' ? '' : config.frete_gratis_valor_minimo} placeholder="—"
                onChange={(e) => onCampo('frete_gratis_valor_minimo', e.target.value)} className={inputCls} />
            </label>
          </section>

          {/* 3. Simulador */}
          <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-blue-900 dark:text-blue-200">
              <Calculator size={15} /> 3. {tDynamic('Teste com um endereço real')}
            </p>
            <p className="mt-1 text-xs text-blue-900/70 dark:text-blue-200/70">
              {tDynamic('Usa os valores desta tela, mesmo antes de salvar.')}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_0.7fr_0.8fr_auto]">
              <input value={simCep} onChange={(e) => setSimCep(e.target.value)} inputMode="numeric" placeholder="CEP"
                className={inputCls} aria-label="CEP" />
              <input value={simNumero} onChange={(e) => setSimNumero(e.target.value)} placeholder={tDynamic('Número')}
                className={inputCls} aria-label={tDynamic('Número')} />
              <input value={simSubtotal} onChange={(e) => setSimSubtotal(e.target.value)} inputMode="decimal"
                placeholder={tDynamic('Pedido (R$)')} className={inputCls} aria-label={tDynamic('Pedido (R$)')} />
              <button type="button" onClick={simular} disabled={simulando || simCep.replace(/\D/g, '').length !== 8}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
                {simulando ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />} {tDynamic('Calcular')}
              </button>
            </div>
            {simErro && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{simErro}</p>}
            {simDist && simResultado && (
              <div className="mt-3 rounded-xl bg-white p-3 text-sm dark:bg-gray-900">
                <p className="text-xs text-gray-500 dark:text-gray-400">{simDist.endereco}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="font-semibold dark:text-gray-100">
                    {simDist.km.toFixed(1).replace('.', ',')} km {simDist.metodo === 'ROTA' ? tDynamic('pela rua') : tDynamic('(estimado)')}
                    {simResultado.faixaNome ? ` · ${simResultado.faixaNome}` : ''}
                  </span>
                  {simResultado.atende ? (
                    <span className="flex items-center gap-1 font-black text-green-700 dark:text-green-400">
                      <CheckCircle2 size={15} /> {simResultado.taxa ? fmt(simResultado.taxa) : tDynamic('Grátis')}
                    </span>
                  ) : (
                    <span className="font-black text-red-600">{motivoTexto(simResultado.motivo)}</span>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default ConfiguracaoEntrega;
