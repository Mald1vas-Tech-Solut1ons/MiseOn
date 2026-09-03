import { AlertTriangle, Ban, Flame } from 'lucide-react';
import type { PedidoHeaderProps } from '../../types';
import { FLUXO, STATUS_LABEL, resumoCancelamento } from './constants';

import { useI18n } from '../../contexts/I18nContext';
export function PedidoHeader({ pedido: p }: PedidoHeaderProps) {
  const { tDynamic } = useI18n();
  const fluxo = FLUXO[p.status] ?? FLUXO.CANCELADO;
  const hora = new Date(p.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const naCozinha = p.estacao_atual === 'COZINHA';
  const cancelamento = p.status === 'CANCELADO' ? resumoCancelamento(p) : null;

  return (
    <>
      {/* ── Header azul ── */}
      <div style={{ background: '#004198', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#fff', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <img src="/icon.png" alt="MiseOn" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 800,
                fontSize: 18,
                color: '#EAF1FB',
                letterSpacing: '.02em',
              }}>
                {p.senha != null ? `SENHA ${p.senha}` : `#${p.numero}`}
              </span>
              {/* Com senha, o `#numero` continua visivel — menor — porque e ele
                  que casa com o cupom fiscal, o financeiro e o suporte. Sem
                  senha (delivery), o numero ja e o titulo acima. */}
              {p.senha != null && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#94a3b8' }}>
                  #{p.numero}
                </span>
              )}
              {p.origem === 'ifood' && (
                <span className="rounded bg-red-600 px-1.5 py-0.5 font-['JetBrains_Mono'] text-xs opacity-90 font-bold text-white shadow-sm">
                  iFood
                </span>
              )}
              {p.origem === 'whatsapp' && (
                <span className="rounded bg-[#25D366] px-1.5 py-0.5 font-['JetBrains_Mono'] text-xs opacity-90 font-bold text-white shadow-sm flex items-center gap-1">
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-current"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.83 9.83 0 0 0 12.04 2m0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23m4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28"/></svg>
                  WhatsApp
                </span>
              )}
            </div>
            {p.origem === 'ifood' && p.ifood_order_id && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#94a3b8' }}>
                ID: {p.ifood_order_id.split('-')[0]}
              </span>
            )}
          </div>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          padding: '4px 10px',
          borderRadius: 8,
          background: fluxo.bg,
          color: fluxo.color,
          border: `1px solid ${fluxo.color}40`,
        }}>
          {STATUS_LABEL[p.status] || p.status}
        </span>
      </div>

      {/* ── Info cliente ── */}
      <div className="border-b border-gray-100 px-4 py-3 dark:border-white/5">
        <p className="m-0 font-['Sora'] text-sm font-semibold text-gray-900 dark:text-[#EAF1FB]">
          {p.identificador_cliente}
        </p>
        <div className="mt-1 flex justify-between">
          <span className="font-['JetBrains_Mono'] text-xs opacity-95 text-gray-500 dark:text-[#6C7A96]">{p.telefone_contato}</span>
          <span className="rounded-md bg-gray-100 px-2 py-[1px] font-['JetBrains_Mono'] text-xs opacity-95 text-gray-500 dark:bg-white/5 dark:text-[#6C7A96]">{hora}</span>
        </div>
      </div>

      {/* ── Status em destaque ── */}
      {/* Cancelado precisa dizer QUEM cancelou e POR QUÊ. Um pedido que some do
          fluxo sem explicação vira discussão no balcão meia hora depois. */}
      {cancelamento && (
        <div className="mx-4 mt-3 rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Ban size={15} className="shrink-0 text-red-500" />
            <p className="font-['Sora'] text-sm font-bold text-red-500">{tDynamic(cancelamento.quem)}</p>
          </div>
          {cancelamento.motivo && (
            <p className="mt-1 pl-[23px] text-xs opacity-95 leading-snug text-gray-500 dark:text-[#AEB9CE]">
              {cancelamento.motivo}
            </p>
          )}
          {cancelamento.recusa && (
            <p className="mt-2 flex gap-1.5 rounded-lg bg-red-500/15 px-2 py-1.5 text-xs opacity-95 font-semibold leading-snug text-red-500">
              <AlertTriangle size={13} className="mt-px shrink-0" />
              {cancelamento.recusa}
            </p>
          )}
        </div>
      )}
      {p.status === 'NOVO' && (
        <div style={{ margin: '12px 16px 0', background: 'rgba(252,91,36,.1)', border: '1px solid rgba(252,91,36,.35)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, color: '#FE7A47' }}>Aguardando aceite</div>
        </div>
      )}
      {naCozinha && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-orange-300/40 bg-orange-500/10 px-3.5 py-2.5" style={{ animation: 'pulse 1.8s infinite' }}>
          <Flame size={16} className="shrink-0 text-orange-500" />
          <div>
            <p className="font-['Sora'] text-sm font-bold text-orange-500">Na cozinha</p>
            <p className="text-xs opacity-95 text-gray-400 dark:text-[#AEB9CE]">{tDynamic('Só a cozinha avança este pedido agora.')}</p>
          </div>
        </div>
      )}
      {p.status === 'ACEITO' && !naCozinha && p.requer_cozinha && (
        <div style={{ margin: '12px 16px 0', background: 'rgba(252,91,36,.1)', border: '1px solid rgba(252,91,36,.35)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, color: '#FE7A47' }}>{tDynamic('Aceito — pronto para ir à cozinha')}</div>
          <div style={{ fontSize: 12, color: '#AEB9CE', marginTop: 4 }}>{tDynamic('Estoque baixado por ficha técnica ✓')}</div>
        </div>
      )}
    </>
  );
}
