import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { hashToken } from '../_shared/nfse-acesso.ts';

// Transporte isolado: nunca consulta cliente real nem emite nota.
Deno.test('PDF exige token/JWT autorizado, usa snapshot do emissor e recusa nota não emitida', async () => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  const oldUrl = Deno.env.get('SUPABASE_URL');
  const oldKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const oldAnon = Deno.env.get('SUPABASE_ANON_KEY');
  let handler: (req: Request) => Promise<Response> = () => Promise.reject('Handler ausente');

  const TOKEN_VALIDO = 'a'.repeat(64);
  const HASH_TOKEN_VALIDO = await hashToken(TOKEN_VALIDO);
  const LOJA_DONA = '11111111-0000-0000-0000-000000000001';
  const USER_ADMIN_DONO = 'user-admin-dono';
  const USER_ADMIN_ALHEIO = 'user-admin-alheio';
  const USER_SUPERADMIN = 'user-superadmin';

  let status = 'emitida';
  let tokenExpiraEm: string | null = '2099-01-01T00:00:00Z';
  let comSnapshotEmissor = true;
  let cadastroConsultado = false;

  const cadastroAtual = {
    razao_social: 'MISEON CADASTRO ATUAL LTDA',
    cnpj: '99999999000199', inscricao_municipal: '999999',
    logradouro: 'Rua Atual', numero: '1', complemento: null,
    bairro: 'Bairro Atual', cidade: 'São Paulo', uf: 'SP', cep: '01234000',
  };

  const faturaBase = () => ({
    id: '00000000-0000-0000-0000-000000000001',
    loja_id: LOJA_DONA,
    nfse_status: status,
    nfse_numero: '123',
    nfse_codigo_verificacao: 'ABCD1234',
    nfse_emitida_em: '2026-09-01T12:00:00Z',
    ciclo: 'mensal',
    valor_cobrado: 123.45,
    tomador_razao_social: 'Tomador de Teste',
    tomador_cpf_cnpj: '00000000000000',
    tomador_email: 'teste@example.invalid',
    nfse_acesso_token_hash: HASH_TOKEN_VALIDO,
    nfse_acesso_token_expira_em: tokenExpiraEm,
    ...(comSnapshotEmissor ? {
      emissor_snapshot_em: '2026-09-01T12:00:00Z',
      emissor_razao_social: 'EMPRESA NA DATA DA EMISSAO LTDA',
      emissor_cnpj: '00000000000000',
      emissor_inscricao_municipal: '123456',
      emissor_logradouro: 'Avenida de Teste', emissor_numero: '42', emissor_complemento: 'Conjunto 1000',
      emissor_bairro: 'Bairro de Teste', emissor_cidade: 'São Paulo', emissor_uf: 'SP', emissor_cep: '01234000',
    } : {
      emissor_snapshot_em: null,
      emissor_razao_social: null, emissor_cnpj: null, emissor_inscricao_municipal: null,
      emissor_logradouro: null, emissor_numero: null, emissor_complemento: null,
      emissor_bairro: null, emissor_cidade: null, emissor_uf: null, emissor_cep: null,
    }),
  });

  // Um único usuário "logado" por vez nesta suíte — controlado por variável.
  let usuarioLogado: { id: string } | null = null;

  try {
    Deno.env.set('SUPABASE_URL', 'https://example.invalid');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'fixture-sem-credencial');
    Deno.env.set('SUPABASE_ANON_KEY', 'fixture-anon-sem-credencial');
    Object.defineProperty(Deno, 'serve', { configurable: true, value: (fn: typeof handler) => { handler = fn; } });

    globalThis.fetch = (input, init) => {
      const url = String(input);

      if (url.includes('/auth/v1/user')) {
        const headers = init?.headers;
        const auth = headers instanceof Headers ? headers.get('Authorization')
          : (headers as Record<string, string> | undefined)?.Authorization;
        if (!usuarioLogado || !auth) return Promise.resolve(Response.json({ error: 'sem sessão' }, { status: 401 }));
        return Promise.resolve(Response.json({ id: usuarioLogado.id }));
      }
      if (url.includes('/plataforma_admins')) {
        const ehSuperadmin = usuarioLogado?.id === USER_SUPERADMIN;
        return Promise.resolve(Response.json(ehSuperadmin ? { user_id: usuarioLogado!.id } : null));
      }
      if (url.includes('/usuarios_loja')) {
        const ehAdminDono = usuarioLogado?.id === USER_ADMIN_DONO;
        return Promise.resolve(Response.json(ehAdminDono ? { user_id: usuarioLogado!.id } : null));
      }
      if (url.includes('/configuracoes_fiscais_plataforma')) {
        cadastroConsultado = true;
        if (url.includes('certificado') || url.includes('senha')) throw new Error('PDF consultou segredo');
        return Promise.resolve(Response.json(cadastroAtual));
      }
      if (!url.includes('/faturas_assinatura')) throw new Error('Chamada inesperada: ' + url);
      return Promise.resolve(Response.json(faturaBase()));
    };

    await import('./index.ts');

    const req = (query: string, headers?: Record<string, string>) =>
      handler(new Request(`https://example.invalid?id=fixture${query}`, { headers }));

    // 1. Anônimo, sem token: acesso negado (o UUID sozinho nunca basta).
    usuarioLogado = null;
    let resposta = await req('');
    if (resposta.status !== 403) throw new Error(`Esperava 403 sem token/JWT, veio ${resposta.status}`);

    // 2. Token errado: negado com status distinto de "não encontrado".
    resposta = await req(`&token=${'b'.repeat(64)}`);
    if (resposta.status !== 401) throw new Error(`Esperava 401 com token inválido, veio ${resposta.status}`);

    // 3. Token expirado: negado mesmo com hash batendo (simulado via data passada).
    tokenExpiraEm = '2020-01-01T00:00:00Z';
    resposta = await req(`&token=${TOKEN_VALIDO}`);
    if (resposta.status !== 401) throw new Error(`Esperava 401 com token expirado, veio ${resposta.status}`);
    tokenExpiraEm = '2099-01-01T00:00:00Z';

    // 4. Usuário admin de OUTRA loja, sem token: negado.
    usuarioLogado = { id: USER_ADMIN_ALHEIO };
    resposta = await req('', { Authorization: 'Bearer jwt-alheio' });
    if (resposta.status !== 403) throw new Error(`Esperava 403 para admin de outra loja, veio ${resposta.status}`);

    // 5. Token válido e não expirado: acesso concedido.
    usuarioLogado = null;
    resposta = await req(`&token=${TOKEN_VALIDO}`);
    if (resposta.status !== 200 || !cadastroConsultado) throw new Error('Falha ao gerar PDF com token válido');
    let bytes = new Uint8Array(await resposta.arrayBuffer());
    let pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() !== 1 || !pdf.getPage(0).node.Annots()) throw new Error('PDF sem página ou consulta');

    // 6. Admin da loja dona, sem token, autenticado via JWT: acesso concedido.
    usuarioLogado = { id: USER_ADMIN_DONO };
    resposta = await req('', { Authorization: 'Bearer jwt-dono' });
    if (resposta.status !== 200) throw new Error(`Esperava 200 para admin dono, veio ${resposta.status}`);

    // 7. Superadmin, sem token: acesso concedido.
    usuarioLogado = { id: USER_SUPERADMIN };
    resposta = await req('', { Authorization: 'Bearer jwt-superadmin' });
    if (resposta.status !== 200) throw new Error(`Esperava 200 para superadmin, veio ${resposta.status}`);
    usuarioLogado = null;

    const destino = Deno.env.get('NFSE_QA_PDF');
    if (destino) await Deno.writeFile(destino, bytes);

    // 8. Nota sem snapshot do emissor: cai para cadastro atual, PDF ainda gera.
    comSnapshotEmissor = false;
    resposta = await req(`&token=${TOKEN_VALIDO}`);
    if (resposta.status !== 200) throw new Error('PDF deveria gerar mesmo sem snapshot do emissor');
    bytes = new Uint8Array(await resposta.arrayBuffer());
    pdf = await PDFDocument.load(bytes);
    if (pdf.getPageCount() !== 1) throw new Error('PDF sem snapshot deveria ter 1 página');
    comSnapshotEmissor = true;

    // 9. Estados finais/pendentes continuam recusando o PDF mesmo com token válido.
    for (const estado of ['testada_ok', 'cancelada', 'erro', 'processando']) {
      status = estado;
      resposta = await req(`&token=${TOKEN_VALIDO}`);
      if (resposta.status !== 400) throw new Error(`PDF liberado para ${estado}`);
    }
    status = 'emitida';

    if ((await handler(new Request('https://example.invalid', { method: 'POST' }))).status !== 405) {
      throw new Error('Método indevido aceito');
    }
  } finally {
    Object.defineProperty(Deno, 'serve', { configurable: true, value: originalServe });
    globalThis.fetch = originalFetch;
    for (const [chave, valor] of [
      ['SUPABASE_URL', oldUrl], ['SUPABASE_SERVICE_ROLE_KEY', oldKey], ['SUPABASE_ANON_KEY', oldAnon],
    ]) {
      if (valor === undefined) Deno.env.delete(chave!); else Deno.env.set(chave!, valor);
    }
  }
});
