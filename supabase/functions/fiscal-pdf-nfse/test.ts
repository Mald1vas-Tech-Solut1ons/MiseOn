import PdfPrinter from "npm:pdfmake";

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

const printer = new PdfPrinter(fonts);
const docDefinition = {
  content: [
    { text: 'NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e', style: 'header' },
    { text: 'Número: 202609001', margin: [0, 20, 0, 8] },
    { text: 'Valor: R$ 1,00' },
  ],
  styles: {
    header: {
      fontSize: 18,
      bold: true,
      alignment: 'center'
    }
  },
  defaultStyle: {
    font: 'Helvetica'
  }
};

const pdfDoc = printer.createPdfKitDocument(docDefinition);
const chunks = [];
pdfDoc.on('data', chunk => chunks.push(chunk));
pdfDoc.on('end', () => {
  const result = Buffer.concat(chunks);
  console.log("PDF gerado com sucesso, tamanho:", result.length);
});
pdfDoc.end();
