/**
 * Mesas3DHUD — Camada de interface 2D estilo AR projetada sobre as coordenadas 3D da tela.
 */

import type { PosicaoTelaMesa, Mesa3DPosicionada } from '../../lib/mesas3d/types';
import { fmt } from '../../types';

interface Props {
  posicoes: PosicaoTelaMesa[];
  mesas3D: Mesa3DPosicionada[];
  onSelecionar: (mesa3d: Mesa3DPosicionada) => void;
}

export function Mesas3DHUD({ posicoes, mesas3D, onSelecionar }: Props) {
  const mesaMap = new Map(mesas3D.map((m) => [m.mesa.id, m]));

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {posicoes.map((pos) => {
        if (!pos.visivel) return null;
        const m3d = mesaMap.get(pos.mesaId);
        if (!m3d) return null;

        const ocupada = m3d.status3D !== 'LIVRE';
        const assentosOcupadosCount = m3d.assentos.filter((a) => a.ocupado).length;

        return (
          <button
            key={pos.mesaId}
            onClick={() => onSelecionar(m3d)}
            style={{ left: pos.telaX, top: pos.telaY }}
            className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-1.5 shadow-xl transition-all duration-150 active:scale-95 ${
              ocupada
                ? 'border-orange-500/50 bg-gray-950/85 text-white backdrop-blur-md hover:border-orange-400'
                : 'border-emerald-500/40 bg-gray-950/70 text-emerald-300 backdrop-blur-sm hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-['Sora'] text-sm font-black">
                Mesa {pos.numero}
              </span>

              {ocupada ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-orange-400 text-xs">
                    {fmt(m3d.totalParcial - m3d.totalPago)}
                  </span>
                  <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-xs opacity-80 font-bold text-gray-300">
                    {assentosOcupadosCount}/{m3d.capacidade}
                  </span>
                  {m3d.tempoMinutos > 0 && (
                    <span className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-xs opacity-80 font-bold text-orange-300">
                      ⏱️ {m3d.tempoMinutos >= 60 ? `${Math.floor(m3d.tempoMinutos / 60)}h ${m3d.tempoMinutos % 60}m` : `${m3d.tempoMinutos}m`}
                    </span>
                  )}
                </div>
              ) : (
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-xs opacity-90 font-bold text-emerald-400">
                  Livre
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
