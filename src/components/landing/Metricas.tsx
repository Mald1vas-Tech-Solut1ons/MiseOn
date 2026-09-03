const METRICAS = [
  { valor: '1 dia', rotulo: 'para colocar sua loja no ar' },
  { valor: '0%', rotulo: 'de comissão por pedido' },
  { valor: '< 2 s', rotulo: 'do pedido do cliente à tela da cozinha' },
  { valor: 'R$ 150', rotulo: 'por mês, tudo incluso' },
];

export function Metricas() {
  return (
    <section style={{ borderTop: '1px solid rgba(10,92,196,0.15)', background: 'rgba(10,92,196,0.04)' }} className="py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {METRICAS.map((m) => (
            <div key={m.rotulo} className="text-center">
              <div style={{ fontFamily: "'Sora', sans-serif" }} className="text-3xl font-extrabold text-white sm:text-4xl">
                {m.valor}
              </div>
              <div style={{ color: 'rgba(234,241,251,0.55)' }} className="mt-1 text-sm">
                {m.rotulo}
              </div>
            </div>
          ))}
        </div>
        <p style={{ color: 'rgba(234,241,251,0.3)' }} className="mt-6 text-center text-xs opacity-95">
          * Tempos de setup e de atualização de tela são valores de referência, medidos em condições normais de uso.
        </p>
      </div>
    </section>
  );
}
