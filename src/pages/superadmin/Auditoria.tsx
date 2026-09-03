import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface Log { id: string; acao: string; detalhes: any; criado_em: string; lojas: { nome: string } | null }

export default function Auditoria() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('auditoria')
        .select('id, acao, detalhes, criado_em, lojas(nome)')
        .order('criado_em', { ascending: false })
        .limit(200);
      setLogs((data as any) ?? []);
      setCarregando(false);
    })();
  }, []);

  if (carregando) return <div className="p-8 text-center text-gray-400">Carregando…</div>;

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold">Auditoria</h2>
      <div className="space-y-1.5">
        {logs.map((l) => (
          <div key={l.id} className="rounded-xl bg-white dark:bg-gray-900 dark:border-gray-800 p-3 text-xs shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{l.acao}</span>
              <span className="text-gray-400">{new Date(l.criado_em).toLocaleString('pt-BR')}</span>
            </div>
            <p className="mt-0.5 text-gray-500 dark:text-gray-400">{l.lojas?.nome ?? 'Plataforma'}</p>
            {l.detalhes && <pre className="mt-1 whitespace-pre-wrap break-all text-xs opacity-90 text-gray-400">{JSON.stringify(l.detalhes)}</pre>}
          </div>
        ))}
        {logs.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum evento registrado ainda.</p>}
      </div>
    </div>
  );
}
