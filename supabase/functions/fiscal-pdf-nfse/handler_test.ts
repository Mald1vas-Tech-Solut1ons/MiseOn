import { PDFDocument } from 'npm:pdf-lib@1.17.1';

// Transporte isolado: nunca consulta cliente real nem emite nota.
Deno.test('PDF usa cadastro, recusa nota não emitida e oferece consulta oficial', async () => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  const oldUrl = Deno.env.get('SUPABASE_URL');
  const oldKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  let handler: (req: Request) => Promise<Response> = () => Promise.reject('Handler ausente');
  let status = 'emitida';
  let cadastroConsultado = false;
  const prestador = {
    razao_social: 'EMPRESA DE TESTE COM RAZAO SOCIAL LONGA PARA VERIFICAR O LIMITE DO CAMPO LTDA',
    cnpj: '00000000000000', inscricao_municipal: '123456',
    logradouro: 'Avenida de Teste', numero: '42', complemento: 'Conjunto 1000',
    bairro: 'Bairro de Teste', cidade: 'São Paulo', uf: 'SP', cep: '01234000',
  };
  try {
    Deno.env.set('SUPABASE_URL', 'https://example.invalid');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fixture-sem-credencial');
    Object.defineProperty(Deno, 'serve', { configurable: true, value: (fn: typeof handler) => { handler = fn; } });
    globalThis.fetch = (input) => {
      const url = String(input);
      if (url.includes('/configuracoes_fiscais_plataforma')) {
        cadastroConsultado = true;
        if (url.includes('certificado') || url.includes('senha')) throw new Error('PDF consultou segredo');
        return Promise.resolve(Response.json(prestador));
      }
      if (!url.includes('/faturas_assinatura')) throw new Error('Chamada inesperada');
      return Promise.resolve(Response.json({
        id: '00000000-0000-0000-0000-000000000001', nfse_status: status, nfse_numero: '123',
        nfse_codigo_verificacao: 'ABCD1234', nfse_emitida_em: '2026-09-01T12:00:00Z',
        ciclo: 'mensal', valor_cobrado: 123.45, tomador_razao_social: 'Tomador de Teste',
        tomador_cpf_cnpj: '00000000000000', tomador_email: 'teste@example.invalid',
      }));
    };
    await import('./index.ts');
    const resposta = await handler(new Request('https://example.invalid?id=fixture'));
    if (resposta.status !== 200 || !cadastroConsultado) throw new Error('Falha ao gerar PDF com cadastro');
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    const pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() !== 1 || !pdf.getPage(0).node.Annots()) throw new Error('PDF sem página ou consulta');
    const destino = Deno.env.get('NFSE_QA_PDF');
    if (destino) await Deno.writeFile(destino, bytes);
    for (const estado of ['testada_ok', 'cancelada', 'erro', 'processando']) {
      status = estado;
      if ((await handler(new Request('https://example.invalid?id=fixture'))).status !== 400) {
        throw new Error(`PDF liberado para ${estado}`);
      }
    }
    if ((await handler(new Request('https://example.invalid', { method: 'POST' }))).status !== 405) {
      throw new Error('Método indevido aceito');
    }
  } finally {
    Object.defineProperty(Deno, 'serve', { configurable: true, value: originalServe });
    globalThis.fetch = originalFetch;
    for (const [chave, valor] of [['SUPABASE_URL', oldUrl], ['SUPABASE_SERVICE_ROLE_KEY', oldKey]]) {
      if (valor === undefined) Deno.env.delete(chave!); else Deno.env.set(chave!, valor);
    }
  }
});
