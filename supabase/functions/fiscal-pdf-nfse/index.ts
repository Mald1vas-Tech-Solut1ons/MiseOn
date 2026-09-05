import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = new URL(req.url);
    const faturaId = url.searchParams.get('id');

    if (!faturaId) {
      return new Response('Fatura ID não fornecido', { status: 400 });
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
      return new Response('Fatura não encontrada', { status: 404 });
    }

    if (!fatura.nfse_numero) {
      return new Response('NFS-e ainda não foi emitida para esta fatura', { status: 400 });
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width } = page.getSize();

    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);
    const grayBg = rgb(0.92, 0.92, 0.92);

    // Helper functions
    const drawText = (text: string, x: number, y: number, font = helvetica, size = 9, align = 'left', boxWidth = 0) => {
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
    drawText('PREFEITURA DO MUNICÍPIO DE SÃO PAULO', marginX, marginY - 20, helveticaBold, 12, 'center', contentW - 200);
    drawText('NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e', marginX, marginY - 40, helveticaBold, 14, 'center', contentW - 200);
    drawText('RPS nº ' + (fatura.id.split('-')[0]) + ' Série MS', marginX, marginY - 55, helvetica, 9, 'center', contentW - 200); // Fake RPS visual

    // Right header info
    const rightBoxX = marginX + contentW - 190;
    drawField('Número da Nota', fatura.nfse_numero || '', rightBoxX, marginY, 190, 24);
    drawField('Data e Hora de Emissão', fatura.nfse_emitida_em ? new Date(fatura.nfse_emitida_em).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'), rightBoxX, marginY - 24, 190, 23);
    drawField('Código de Verificação', fatura.nfse_codigo_verificacao || '', rightBoxX, marginY - 47, 190, 23);

    // 2. PRESTADOR
    let currentY = marginY - headerH - 5;
    drawBox(marginX, currentY, contentW, 60, 'PRESTADOR DE SERVIÇOS');
    drawText('Nome/Razão Social:', marginX + 5, currentY - 25, helveticaBold, 8);
    drawText('MALDIVAS TECH SOLUCOES EM TECNOLOGIA LTDA', marginX + 90, currentY - 25, helveticaBold, 9);
    
    drawText('CPF/CNPJ:', marginX + 5, currentY - 38, helveticaBold, 8);
    drawText('68.923.239/0001-77', marginX + 50, currentY - 38, helvetica, 9);
    
    drawText('Inscrição Municipal:', marginX + 180, currentY - 38, helveticaBold, 8);
    drawText('4823036', marginX + 270, currentY - 38, helvetica, 9);

    drawText('Endereço:', marginX + 5, currentY - 51, helveticaBold, 8);
    drawText('Rua Fictícia, 123 - Centro - São Paulo/SP - CEP: 01000-000', marginX + 50, currentY - 51, helvetica, 9); // Substitua pelo endereço real

    // 3. TOMADOR
    currentY -= 65;
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
    const descText = `Assinatura MiseOn SaaS\nPlano: ${fatura.ciclo === 'anual' ? 'Anual' : 'Mensal'}\nCompetência: ${new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}\nPagamento via Efí Cartão/Pix.`;
    
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
    drawBox(marginX, currentY, contentW, 40, 'OUTRAS INFORMAÇÕES / VALORES APROXIMADOS DOS TRIBUTOS');
    drawText('Documento emitido por ME ou EPP optante pelo Simples Nacional.', marginX + 5, currentY - 22, helvetica, 8);
    drawText('Não gera direito a crédito fiscal de IPI.', marginX + 5, currentY - 32, helvetica, 8);

    // Footer
    drawText('Esta NFS-e foi gerada eletronicamente.', marginX, 30, helvetica, 8, 'center', contentW);
    drawText('Verifique a autenticidade no site: https://nfe.prefeitura.sp.gov.br/publico/verificacao.aspx', marginX, 20, helvetica, 8, 'center', contentW);

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="MiseOn_NFS-e_${fatura.nfse_numero}.pdf"`,
        ...cors,
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    return new Response('Erro interno ao gerar PDF', { status: 500, headers: cors });
  }
});
