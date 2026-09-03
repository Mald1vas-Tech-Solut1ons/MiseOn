/**
 * Mesas3DCanvas — Wrapper React para a engine Three.js do Salão de Mesas.
 *
 * Responsabilidades:
 *  - Monta/desmonta a `Mesas3DEngine` sem memory leaks de GPU.
 *  - Transmite os dados processados do salão para a engine.
 *  - Atualiza periodicamente as posições projetadas em 2D para renderizar o HUD flutuante sobreposto.
 */

import { useEffect, useRef, useState } from 'react';
import { Mesas3DEngine } from './Mesas3DEngine';
import type { Mesa3DPosicionada, InfoHoverMesa, PosicaoTelaMesa } from './types';
import { Mesas3DHUD } from '../../components/mesas3d/Mesas3DHUD';

interface Props {
  mesas3D: Mesa3DPosicionada[];
  altura?: number | string;
  corFundo?: number;
  modoEdicao?: boolean;
  onSelecionarMesa?: (mesa3d: Mesa3DPosicionada, assentoNumero?: number | null) => void;
  onLayoutChange?: (mesaId: string, novaPos: { x: number; z: number; rotacao: number }) => void;
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Mesas3DCanvas({
  mesas3D,
  altura = '680px',
  corFundo,
  modoEdicao = false,
  onSelecionarMesa,
  onLayoutChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Mesas3DEngine | null>(null);

  const [hover, setHover] = useState<InfoHoverMesa | null>(null);
  const [posicoesTela, setPosicoesTela] = useState<PosicaoTelaMesa[]>([]);

  // Inicialização da Engine Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new Mesas3DEngine(containerRef.current, {
      corFundo,
      modoEdicao,
      onHover: setHover,
      onSelectMesa: (m, assentoNum) => onSelecionarMesa?.(m, assentoNum),
      onLayoutChange: (mesaId, novaPos) => onLayoutChange?.(mesaId, novaPos),
    });

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza modo edição na engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setModoEdicao(modoEdicao);
    }
  }, [modoEdicao]);

  // Envia os dados atualizados das mesas para a GPU
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setData(mesas3D);
    }
  }, [mesas3D]);

  // Atualiza as coordenadas 2D do HUD no viewport a cada frame
  useEffect(() => {
    let animId = 0;
    const atualizarPosicoes = () => {
      if (engineRef.current) {
        setPosicoesTela(engineRef.current.obterPosicoesTelaMesas());
      }
      animId = requestAnimationFrame(atualizarPosicoes);
    };
    animId = requestAnimationFrame(atualizarPosicoes);
    return () => cancelAnimationFrame(animId);
  }, []);

  const posTooltip = (() => {
    if (!hover || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return { left: hover.telaX - rect.left, top: hover.telaY - rect.top };
  })();

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-gray-800 bg-[#0b0f19] shadow-2xl" style={{ height: altura }}>
      {/* Canvas WebGL do Three.js */}
      <div ref={containerRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {/* Camada HUD AR Flutuante de Placas sobre as Mesas */}
      <Mesas3DHUD
        posicoes={posicoesTela}
        mesas3D={mesas3D}
        onSelecionar={(m) => onSelecionarMesa?.(m)}
      />

      {/* Tooltip HTML no Hover do Ponteiro */}
      {hover && posTooltip && (
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full rounded-2xl border border-gray-700 bg-gray-900/95 p-3 text-xs shadow-2xl backdrop-blur-md transition-all duration-75"
          style={{ left: posTooltip.left, top: posTooltip.top - 12 }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-800 pb-1.5 font-bold text-gray-100">
            <span>Mesa {hover.mesa3d.mesa.numero} {hover.mesa3d.mesa.nome ? `(${hover.mesa3d.mesa.nome})` : ''}</span>
            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs opacity-90 font-black text-orange-400 uppercase">
              {hover.mesa3d.status3D}
            </span>
          </div>

          <div className="mt-2 space-y-1 text-gray-300">
            {hover.assentoHover ? (
              <p className="font-bold text-blue-400">
                🪑 Assento #{hover.assentoHover} {hover.mesa3d.assentos[hover.assentoHover - 1]?.valorConsumido > 0 ? `· Consumo: ${brl(hover.mesa3d.assentos[hover.assentoHover - 1].valorConsumido)}` : '· (Livre)'}
              </p>
            ) : (
              <>
                <p>Lugares: <strong className="text-gray-100">{hover.mesa3d.capacidade} assentos</strong></p>
                <p>Consumo total: <strong className="text-emerald-400">{brl(hover.mesa3d.totalParcial)}</strong></p>
                {hover.mesa3d.tempoMinutos > 0 && (
                  <p className="text-xs opacity-95 text-gray-400">Permanência: {hover.mesa3d.tempoMinutos} minutos</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Legenda de Status Visual */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-wrap gap-2 rounded-2xl border border-gray-800 bg-gray-950/80 px-3 py-2 text-xs opacity-95 backdrop-blur-md">
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> Livre</span>
        <span className="flex items-center gap-1.5 text-orange-400 font-semibold"><i className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" /> Ocupada</span>
        <span className="flex items-center gap-1.5 text-blue-400 font-semibold"><i className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" /> Em Preparo</span>
        <span className="flex items-center gap-1.5 text-yellow-400 font-semibold"><i className="h-2.5 w-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.8)]" /> Aguardando Conta</span>
      </div>
    </div>
  );
}

export default Mesas3DCanvas;
