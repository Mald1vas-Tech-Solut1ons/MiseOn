/** Mantém a chave após recarga: resposta perdida não vira uma segunda venda. */
export function chaveTentativaPdv(lojaId: string, nova = false): string {
  const nome = `miseon_pdv_tentativa_v1_${lojaId}`;
  try {
    const anterior = sessionStorage.getItem(nome);
    if (!nova && anterior) return anterior;
  } catch { /* usa memória do componente quando storage está bloqueado */ }
  const chave = crypto.randomUUID();
  try { sessionStorage.setItem(nome, chave); } catch { /* memória */ }
  return chave;
}
