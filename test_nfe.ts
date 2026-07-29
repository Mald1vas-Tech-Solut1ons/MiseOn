declare const Deno: any;
declare const process: any;

const TOKEN_HOMOLOG = (typeof Deno !== 'undefined' ? Deno.env.get('FOCUS_API_TOKEN_HOMOLOG') || Deno.env.get('FOCUS_NFE_HOMOLOG') : undefined)
  || (typeof process !== 'undefined' ? process.env?.FOCUS_API_TOKEN_HOMOLOG || process.env?.FOCUS_NFE_HOMOLOG : undefined);

const CPF_LOJISTA = (typeof Deno !== 'undefined' ? Deno.env.get('FOCUS_CNPJ_TEST') : undefined)
  || (typeof process !== 'undefined' ? process.env?.FOCUS_CNPJ_TEST : undefined);

async function runTest() {
  if (!TOKEN_HOMOLOG) {
    console.error("❌ ERRO: Defina a variável de ambiente FOCUS_API_TOKEN_HOMOLOG (ou FOCUS_NFE_HOMOLOG) para rodar este teste.");
    return;
  }
  if (!CPF_LOJISTA) {
    console.error("❌ ERRO: Defina a variável de ambiente FOCUS_CNPJ_TEST com o CNPJ/CPF do emitente de teste para rodar este teste.");
    return;
  }

  console.log("=> Testando envio de NFC-e (Focus NFe) sem depender do banco de dados...");

  // Pedido Mock para a API Focus NFe
  const pedidoMock = {
    id: "uuid-mock-1234",
    numero: 999,
    taxa_entrega: 5.00,
    desconto: 0,
    lojas: {
      cnpj: CPF_LOJISTA, // Usando CPF do logista (O Focus NFe permite emissão CPF homolog?)
    },
    itens_pedido: [
      {
        id: "item1-uuid-12345",
        nome_produto: "X-Bacon Especial",
        preco_unitario: 25.50,
        quantidade: 2,
        itens_pedido_opcoes: [
          { preco_adicional: 2.00, nome_opcao: "Extra Bacon" }
        ]
      },
      {
        id: "item2-uuid-12345",
        nome_produto: "Coca-Cola 2L",
        preco_unitario: 12.00,
        quantidade: 1,
        itens_pedido_opcoes: []
      }
    ]
  };

  const baseUrl = 'https://homologacao.focusnfe.com.br/v2/nfce';
  const token = TOKEN_HOMOLOG;
  
  const cnpjEmitente = pedidoMock.lojas.cnpj ? pedidoMock.lojas.cnpj.replace(/\D/g, '') : CPF_LOJISTA;
  const ref = `miseon_${pedidoMock.id.substring(0,8)}_${Date.now()}`;
  
  const itemsNF = pedidoMock.itens_pedido.map((item: any, idx: number) => {
    const valAdicionais = (item.itens_pedido_opcoes || []).reduce((acc: number, op: any) => acc + Number(op.preco_adicional || 0), 0);
    const valUnit = Number(item.preco_unitario) + valAdicionais;
    
    return {
      numero_item: idx + 1,
      codigo_produto: item.id.substring(0,10),
      descricao: item.nome_produto.substring(0, 120),
      codigo_ncm: "21069090",
      cfop: "5102",
      valor_unitario_comercial: valUnit.toFixed(2),
      valor_unitario_tributavel: valUnit.toFixed(2),
      unidade_comercial: "UN",
      unidade_tributavel: "UN",
      quantidade_comercial: item.quantidade,
      quantidade_tributavel: item.quantidade,
      valor_bruto: (valUnit * item.quantidade).toFixed(2),
      icms_origem: "0",
      icms_situacao_tributaria: "400",
    };
  });

  const nfePayload = {
    natureza_operacao: "Venda Presencial",
    data_emissao: new Date().toISOString(),
    presenca_comprador: "1",
    cnpj_emitente: cnpjEmitente,
    itens: itemsNF,
    valor_frete: pedidoMock.taxa_entrega > 0 ? Number(pedidoMock.taxa_entrega).toFixed(2) : undefined,
    valor_desconto: pedidoMock.desconto > 0 ? Number(pedidoMock.desconto).toFixed(2) : undefined,
  };

  console.log("=> Payload finalizado:", JSON.stringify(nfePayload, null, 2));
  console.log("=> Enviando para Focus NFe...");

  try {
    const res = await fetch(`${baseUrl}?ref=${ref}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(token + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(nfePayload)
    });

    const data = await res.json();
    console.log(`=> Status HTTP da Sefaz (Focus): ${res.status}`);
    console.dir(data, { depth: null });
  } catch (err) {
    console.error("Falha HTTP:", err);
  }
}

runTest();
