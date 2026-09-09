export type EventoAssinaturaEfi = {
  chave: string;
  providerEventId: number | null;
  tipo: string;
  subscriptionId: string | null;
  chargeId: string | null;
  status: string;
  valorCentavos: number | null;
  ocorridoEm: string | null;
  payload: Record<string, unknown>;
};

const texto = (valor: unknown): string | null => {
  if (valor === null || valor === undefined || valor === '') return null;
  return String(valor);
};

const numeroInteiro = (valor: unknown): number | null => {
  const n = Number(valor);
  return Number.isSafeInteger(n) ? n : null;
};

/** Normaliza somente os campos documentados pela Efí; nunca inventa charge_id. */
export function normalizarEventoAssinaturaEfi(item: any): EventoAssinaturaEfi {
  const providerEventId = numeroInteiro(item?.id);
  const tipo = String(item?.type ?? '').trim().toLowerCase();
  const subscriptionId = texto(item?.identifiers?.subscription_id ?? item?.subscription_id);
  const chargeId = texto(item?.identifiers?.charge_id ?? item?.charge_id);
  const status = String(item?.status?.current ?? item?.status ?? '').trim().toLowerCase();
  const valorCentavos = numeroInteiro(item?.value ?? item?.total_value);
  const ocorridoEm = texto(item?.created_at);
  const partes = [tipo || 'sem-tipo', subscriptionId ?? '-', chargeId ?? '-', status || '-', ocorridoEm ?? '-'];

  return {
    chave: providerEventId === null ? `fallback:${partes.join(':')}` : `efi:${providerEventId}`,
    providerEventId,
    tipo,
    subscriptionId,
    chargeId,
    status,
    valorCentavos,
    ocorridoEm,
    payload: item && typeof item === 'object' ? item : { valor: item },
  };
}

export async function processarHistoricoAssinaturaEfi(
  supabase: any,
  notificationToken: string,
  itens: unknown[],
): Promise<{ processados: number; nfseAcionadas: number }> {
  let processados = 0;
  let nfseAcionadas = 0;

  for (const bruto of itens) {
    const evento = normalizarEventoAssinaturaEfi(bruto);
    const { data, error } = await supabase.rpc('fn_assinatura_processar_evento_efi', {
      p_notification_token: notificationToken,
      p_evento_chave: evento.chave,
      p_provider_event_id: evento.providerEventId,
      p_payload: evento.payload,
      p_tipo_evento: evento.tipo,
      p_subscription_id: evento.subscriptionId,
      p_charge_id: evento.chargeId,
      p_status: evento.status,
      p_valor_centavos: evento.valorCentavos,
      p_ocorrido_em: evento.ocorridoEm,
    });
    if (error) throw new Error(`Falha ao persistir evento Efí ${evento.chave}: ${error.message ?? error}`);

    const resultado = Array.isArray(data) ? data[0] : data;
    processados += 1;
    if (resultado?.acionar_nfse && resultado?.fatura_id) {
      const { error: erroNfse } = await supabase.functions.invoke('fiscal-emitir-nfse', {
        body: { fatura_id: resultado.fatura_id },
      });
      if (erroNfse) console.error('Falha ao acionar NFS-e da renovação (reconciliável):', erroNfse);
      else nfseAcionadas += 1;
    }
  }

  return { processados, nfseAcionadas };
}
