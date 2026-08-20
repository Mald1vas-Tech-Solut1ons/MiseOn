import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

import { useI18n } from '../../contexts/I18nContext';
interface Loja { id: string; slug: string; nome: string; status_assinatura: string; trial_termina_em: string | null }
interface Metrica { loja_id: string; ultimo_pedido: string | null }

export default function Churn() {
  const { tDynamic } = useI18n();
  const [risco, setRisco] = useState<{ loja: Loja; motivos: string[] }[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: lojas }, { data: m }] = await Promise.all([
        supabase.from('lojas').select('id, slug, nome, status_assinatura, trial_termina_em').eq('ativo', true),
        supabase.functions.invoke('superadmin-metricas'),
      ]);
      const metricas: Record<string, Metrica> = {};
      (m?.metricas ?? []).forEach((x: Metrica) => { metricas[x.loja_id] = x; });

      const agora = Date.now();
      const lista = ((lojas as Loja[]) ?? []).map((l) => {
        const motivos: string[] = [];
        if (l.status_assinatura === 'atrasada') motivos.push('Assinatura atrasada');
        if (l.trial_termina_em) {
          const dias = (new Date(l.trial_termina_em).getTime() - agora) / 86400000;
          if (l.status_assinatura === 'trial' && dias <= 3) motivos.push(dias < 0 ? 'Trial expirado' : `Trial acaba em ${Math.ceil(dias)}d`);
        }
        const ultimo = metricas[l.id]?.ultimo_pedido;
        const semPedidoHa = ultimo ? (agora - new Date(ultimo).getTime()) / 86400000 : Infinity;
        if (semPedidoHa > 14) motivos.push(ultimo ? `Sem pedidos há ${Math.floor(semPedidoHa)}d` : 'Nunca recebeu pedido');
        return { loja: l, motivos };
      }).filter((x) => x.motivos.length > 0);

      setRisco(lista);
      setCarregando(false);
    })();
  }, []);

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando…</div>;

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">{tDynamic('Lojas em risco de churn')}</h2>
      <div className="space-y-2">
        {risco.map(({ loja, motivos }) => (
          <div key={loja.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-1.5 font-bold text-amber-800"><AlertTriangle size={15} /> {loja.nome}</p>
            <ul className="mt-1 text-xs text-amber-700">
              {motivos.map((m) => <li key={m}>• {m}</li>)}
            </ul>
          </div>
        ))}
        {risco.length === 0 && <p className="py-10 text-center text-sm text-gray-400">{tDynamic('Nenhuma loja em risco no momento. 🎉')}</p>}
      </div>
    </div>
  );
}
