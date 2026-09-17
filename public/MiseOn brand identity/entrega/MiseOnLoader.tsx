import './brand.css';

/**
 * Loader de dados MiseOn — anel de progresso + porcentagem, status e
 * skeleton de pedidos. Serve para telas carregando dados (pedidos,
 * estoque, relatórios).
 *
 * Determinado (barra segue o progresso real):
 *   <MiseOnLoader progress={pct} status="Sincronizando pedidos" />
 * Indeterminado (fica girando enquanto o fetch não resolve):
 *   <MiseOnLoader status="Carregando estoque" />
 *
 * Requer /public/brand/icon.png (PNG transparente do símbolo).
 */
const C = 289; // circunferência do anel (2·π·46)

export function MiseOnLoader({
  progress,
  status = 'Carregando',
  rows = 2,
}: {
  progress?: number;
  status?: string;
  rows?: number;
}) {
  const indeterminado = progress == null;
  const p = Math.min(100, Math.max(0, progress ?? 0));
  const offset = indeterminado ? C * 0.66 : C * (1 - p / 100);

  return (
    <div className="mo-loader">
      <div className="mo-ring">
        <svg viewBox="0 0 120 120" className={indeterminado ? 'mo-spin' : ''}>
          <defs>
            <linearGradient id="moLoad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0A5CC4" />
              <stop offset="1" stopColor="#FC5B24" />
            </linearGradient>
          </defs>
          <circle className="mo-track" cx="60" cy="60" r="46" />
          <circle
            className="mo-arc"
            cx="60"
            cy="60"
            r="46"
            strokeDasharray={C}
            strokeDashoffset={offset}
          />
        </svg>
        <img className="mo-ring-mark" src="/brand/icon.png" alt="" />
        {!indeterminado && (
          <div className="mo-pct">
            {Math.round(p)}
            <small>%</small>
          </div>
        )}
      </div>

      <div className="mo-status">{status}</div>

      <div className="mo-skel" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div className="mo-skel-row" key={i}>
            <div className="mo-skel-av" />
            <div className="mo-skel-lines">
              <div className="mo-skel-l1" />
              <div className="mo-skel-l2" />
            </div>
            <div className="mo-skel-price" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default MiseOnLoader;
