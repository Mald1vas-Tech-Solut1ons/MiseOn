import { createClient } from 'jsr:@supabase/supabase-js@2';
import { enderecoPrestador, nfseDisponivel, prestadorParaExibir } from './dados.ts';
import { hashToken, tokenAutoriza } from '../_shared/nfse-acesso.ts';
import { PDFDocument, PDFString, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET') return new Response('Método não permitido', { status: 405, headers: cors });

  try {
    const url = new URL(req.url);
    const faturaId = url.searchParams.get('id');
    const tokenBruto = url.searchParams.get('token');

    if (!faturaId) {
      return new Response('Fatura ID não fornecido', { status: 400, headers: cors });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: fatura, error } = await supabase
      .from('faturas_assinatura')
      .select('*, lojas(nome)')
      .eq('id', faturaId)
      .single();

    if (error || !fatura) {
      return new Response('Fatura não encontrada', { status: 404, headers: cors });
    }

    // Contrato de acesso: o link entregue por e-mail carrega um token
    // individual (o UUID da fatura sozinho nunca basta). Quem está logado
    // como admin da própria loja ou como superadmin também acessa, sem
    // depender do token — cobre o painel e o caso de token perdido/expirado.
    let autorizado = false;
    if (tokenBruto && fatura.nfse_acesso_token_hash) {
      autorizado = tokenAutoriza(fatura, await hashToken(tokenBruto));
    }
    if (!autorizado) {
      const authHeader = req.headers.get('Authorization') ?? '';
      if (authHeader) {
        const supabaseUser = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user } } = await supabaseUser.auth.getUser();
        if (user) {
          const { data: souSuperadmin } = await supabase
            .from('plataforma_admins').select('user_id').eq('user_id', user.id).maybeSingle();
          if (souSuperadmin) {
            autorizado = true;
          } else {
            const { data: souAdminLoja } = await supabase
              .from('usuarios_loja').select('user_id')
              .eq('user_id', user.id).eq('loja_id', fatura.loja_id).eq('papel', 'admin').maybeSingle();
            autorizado = !!souAdminLoja;
          }
        }
      }
    }
    if (!autorizado) {
      const motivo = tokenBruto ? 'Token de acesso inválido ou expirado' : 'Acesso não autorizado a este documento';
      return new Response(motivo, { status: tokenBruto ? 401 : 403, headers: cors });
    }

    if (!nfseDisponivel(fatura)) {
      return new Response('NFS-e ainda não foi emitida para esta fatura', { status: 400, headers: cors });
    }

    const { data: cadastroAtual, error: erroPrestador } = await supabase
      .from('configuracoes_fiscais_plataforma')
      .select('razao_social,cnpj,inscricao_municipal,logradouro,numero,complemento,bairro,cidade,uf,cep')
      .eq('id', true).single();
    if (erroPrestador || !cadastroAtual) throw new Error('Cadastro fiscal indisponível');
    const { prestador, snapshotHistorico } = prestadorParaExibir(fatura, cadastroAtual);
    const enderecoEmissor = enderecoPrestador(prestador);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width } = page.getSize();

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);
    const grayBg = rgb(0.92, 0.92, 0.92);

    // Helper functions
    const drawText = (text: string, x: number, y: number, font = helvetica, size = 9, align = 'left', boxWidth = 0) => {
      // Razões sociais e complementos longos não podem invadir o próximo campo.
      const available = boxWidth || width - x - 25;
      const naturalWidth = font.widthOfTextAtSize(text, size);
      if (naturalWidth > available) size *= available / naturalWidth;
      const textWidth = font.widthOfTextAtSize(text, size);
      let posX = x;
      if (align === 'center') posX = x + (boxWidth - textWidth) / 2;
      if (align === 'right') posX = x + boxWidth - textWidth - 5;
      page.drawText(text, { x: posX, y, size, font, color: black });
    };

    const drawBox = (x: number, y: number, w: number, h: number, title?: string) => {
      // Border
      page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: black, borderWidth: 1 });
      if (title) {
        // Title background
        page.drawRectangle({ x, y: y - 14, width: w, height: 14, color: grayBg, borderColor: black, borderWidth: 1 });
        drawText(title, x, y - 10, helveticaBold, 9, 'center', w);
      }
    };

    const drawField = (label: string, value: string, x: number, y: number, w: number, h: number) => {
      page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: black, borderWidth: 1 });
      drawText(label, x + 3, y - 10, helveticaBold, 7);
      drawText(value, x + 3, y - 22, helvetica, 9);
    };

    // --- MAIN LAYOUT ---
    const marginX = 20;
    const marginY = 820;
    const contentW = width - (marginX * 2);

    // 1. HEADER
    const headerH = 70;
    page.drawRectangle({ x: marginX, y: marginY - headerH, width: contentW, height: headerH, borderColor: black, borderWidth: 1 });
    
    // Logo / Title area
    drawText('MISEON - ASSINATURA', marginX, marginY - 20, helveticaBold, 12, 'center', contentW - 200);
    drawText('RESUMO DA NFS-e', marginX, marginY - 40, helveticaBold, 14, 'center', contentW - 200);

    // Right header info
    const rightBoxX = marginX + contentW - 190;
    drawField('Número da Nota', fatura.nfse_numero || '', rightBoxX, marginY, 190, 24);
    drawField('Data e Hora de Emissão', new Date(fatura.nfse_emitida_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), rightBoxX, marginY - 24, 190, 23);
    drawField('Código de Verificação', fatura.nfse_codigo_verificacao || '', rightBoxX, marginY - 47, 190, 23);

    // 2. PRESTADOR
    let currentY = marginY - headerH - 5;
    const prestadorBoxH = snapshotHistorico ? 60 : 72;
    drawBox(marginX, currentY, contentW, prestadorBoxH,
      snapshotHistorico ? 'PRESTADOR DE SERVIÇOS - DADOS NA DATA DE EMISSÃO' : 'PRESTADOR DE SERVIÇOS - CADASTRO ATUAL');
    drawText('Nome/Razão Social:', marginX + 5, currentY - 25, helveticaBold, 8);
    drawText(prestador.razao_social, marginX + 90, currentY - 25, helveticaBold, 9);

    drawText('CPF/CNPJ:', marginX + 5, currentY - 38, helveticaBold, 8);
    drawText(prestador.cnpj, marginX + 50, currentY - 38, helvetica, 9);

    drawText('Inscrição Municipal:', marginX + 180, currentY - 38, helveticaBold, 8);
    drawText(prestador.inscricao_municipal, marginX + 270, currentY - 38, helvetica, 9);

    drawText('Endereço:', marginX + 5, currentY - 51, helveticaBold, 8);
    drawText(enderecoEmissor, marginX + 50, currentY - 51, helvetica, 9);

    if (!snapshotHistorico) {
      drawText('Nota emitida antes do registro de snapshot: dados acima são do cadastro atual, não necessariamente os da data de emissão.',
        marginX + 5, currentY - 64, helvetica, 6.5);
    }

    // 3. TOMADOR
    currentY -= (prestadorBoxH + 5);
    drawBox(marginX, currentY, contentW, 60, 'TOMADOR DE SERVIÇOS');
    drawText('Nome/Razão Social:', marginX + 5, currentY - 25, helveticaBold, 8);
    drawText(fatura.tomador_razao_social || fatura.lojas?.nome || '', marginX + 90, currentY - 25, helvetica, 9);
    
    drawText('CPF/CNPJ:', marginX + 5, currentY - 38, helveticaBold, 8);
    drawText(fatura.tomador_cpf_cnpj || '', marginX + 50, currentY - 38, helvetica, 9);
    
    drawText('E-mail:', marginX + 180, currentY - 38, helveticaBold, 8);
    drawText(fatura.tomador_email || '', marginX + 215, currentY - 38, helvetica, 9);

    drawText('Endereço:', marginX + 5, currentY - 51, helveticaBold, 8);
    const endStr = `${fatura.tomador_logradouro || ''}, ${fatura.tomador_numero || ''} ${fatura.tomador_complemento || ''} - ${fatura.tomador_bairro || ''} - ${fatura.tomador_cidade || ''}/${fatura.tomador_uf || ''} - CEP: ${fatura.tomador_cep || ''}`;
    drawText(endStr, marginX + 50, currentY - 51, helvetica, 8);

    // 4. INTERMEDIARIO (Empty for now but standard in SP)
    currentY -= 65;
    drawBox(marginX, currentY, contentW, 30, 'INTERMEDIÁRIO DE SERVIÇOS');
    drawText('CPF/CNPJ: ---', marginX + 5, currentY - 24, helvetica, 8);
    drawText('Nome/Razão Social: ---', marginX + 100, currentY - 24, helvetica, 8);

    // 5. DISCRIMINAÇÃO
    currentY -= 35;
    const discrimH = 250;
    drawBox(marginX, currentY, contentW, discrimH, 'DISCRIMINAÇÃO DOS SERVIÇOS');
    const descText = `Assinatura MiseOn SaaS\nPlano: ${fatura.ciclo === 'anual' ? 'Anual' : 'Mensal'}\nEmissão registrada: ${new Date(fatura.nfse_emitida_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\nDocumento fiscal e competência: consulte a nota oficial.`;
    
    // Draw multiline
    const lines = descText.split('\n');
    lines.forEach((line, i) => {
      drawText(line, marginX + 10, currentY - 25 - (i * 12), helvetica, 10);
    });

    // 6. VALOR TOTAL E IMPOSTOS
    currentY -= (discrimH + 5);
    drawBox(marginX, currentY, contentW, 40);
    drawText('VALOR TOTAL DA NOTA = R$ ' + Number(fatura.valor_cobrado).toFixed(2).replace('.', ','), marginX, currentY - 25, helveticaBold, 14, 'center', contentW);

    currentY -= 45;
    drawBox(marginX, currentY, contentW, 40, 'CONSULTA AO DOCUMENTO FISCAL');
    drawText('Resumo auxiliar. O documento fiscal oficial é disponibilizado pela Prefeitura.', marginX + 5, currentY - 22, helvetica, 8);
    drawText('Na consulta, informe CNPJ do prestador, número da nota e código de verificação.', marginX + 5, currentY - 32, helvetica, 8);

    // Footer
    drawText('Este resumo não substitui a NFS-e oficial.', marginX, 30, helvetica, 8, 'center', contentW);
    drawText('Verifique a autenticidade no site: https://nfe.prefeitura.sp.gov.br/publico/verificacao.aspx', marginX, 20, helvetica, 8, 'center', contentW);
    const consulta = pdfDoc.context.obj({
      Type: 'Annot', Subtype: 'Link', Rect: [marginX, 16, width - marginX, 30], Border: [0, 0, 0],
      A: { S: 'URI', URI: PDFString.of('https://nfe.prefeitura.sp.gov.br/publico/verificacao.aspx?tipo=0') },
    });
    page.node.addAnnot(pdfDoc.context.register(consulta));

    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes).buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename="MiseOn_NFS-e_${fatura.nfse_numero}.pdf"`,
        ...cors,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return new Response('Erro interno ao gerar PDF', { status: 500, headers: cors });
  }
});
