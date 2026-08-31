import { describe, it, expect } from 'vitest';
import { interpretarEntradaNota, extrairChaveDeTexto, ufDaChave } from './entradaNota';

const CHAVE = '35260801157555004878651070001051029721313325';
const HASH = 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0';
const URL_QR = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${CHAVE}|2|1|1|${HASH}`;

describe('a chave como o lojista realmente digita', () => {
  it('aceita a chave em blocos de quatro, como vem impressa no cupom', () => {
    const impressa = CHAVE.replace(/(\d{4})/g, '$1 ').trim();
    const r = interpretarEntradaNota(impressa);
    expect(r.chave).toBe(CHAVE);
    expect(r.tipo).toBe('chave');
  });

  it('aceita a chave com ponto, traço e barra no meio', () => {
    expect(extrairChaveDeTexto(CHAVE.replace(/(\d{8})/g, '$1.'))).toBe(CHAVE);
    expect(extrairChaveDeTexto(CHAVE.replace(/(\d{11})/g, '$1-'))).toBe(CHAVE);
  });

  it('acha a chave dentro de uma frase copiada do cupom', () => {
    const r = interpretarEntradaNota(`Chave de acesso: ${CHAVE} Protocolo de autorização 135260012345678`);
    expect(r.chave).toBe(CHAVE);
  });

  it('reconhece a UF pela chave', () => {
    expect(ufDaChave(CHAVE)).toBe('SP');
    expect(ufDaChave('33' + CHAVE.slice(2))).toBe('RJ');
    expect(ufDaChave('31' + CHAVE.slice(2))).toBe('MG');
    expect(interpretarEntradaNota('43' + CHAVE.slice(2)).descricao).toMatch(/RS/);
  });

  it('diz quantos dígitos faltam em vez de só recusar', () => {
    const r = interpretarEntradaNota('3526 0801 1575 5500');
    expect(r.podeConsultar).toBe(false);
    expect(r.descricao).toMatch(/16 de 44/);
  });
});

describe('a URL do QR em todas as formas que chegam', () => {
  it('aceita a URL completa', () => {
    const r = interpretarEntradaNota(URL_QR);
    expect(r.tipo).toBe('url_qr');
    expect(r.podeConsultar).toBe(true);
    expect(r.chave).toBe(CHAVE);
    expect(r.uf).toBe('SP');
  });

  it('aceita colagem com quebra de linha e espaços do WhatsApp', () => {
    const r = interpretarEntradaNota(`\n  ${URL_QR}\n\n`);
    expect(r.tipo).toBe('url_qr');
    expect(r.url).not.toMatch(/\s/);
  });

  it('aceita caractere invisível grudado na colagem', () => {
    const r = interpretarEntradaNota(`\u200B${URL_QR}\u200E`);
    expect(r.tipo).toBe('url_qr');
    expect(r.podeConsultar).toBe(true);
  });

  it('aceita URL sem o https://', () => {
    const r = interpretarEntradaNota(URL_QR.replace('https://', ''));
    expect(r.tipo).toBe('url_qr');
    expect(r.url?.startsWith('https://')).toBe(true);
  });

  it('aceita os separadores codificados como %7C', () => {
    const r = interpretarEntradaNota(URL_QR.replace(/\|/g, '%7C'));
    expect(r.tipo).toBe('url_qr');
    expect(r.chave).toBe(CHAVE);
  });

  it('aceita só o trecho p=... colado sozinho', () => {
    const r = interpretarEntradaNota(`p=${CHAVE}|2|1|1|${HASH}`);
    expect(r.tipo).toBe('url_qr');
    expect(r.url).toContain('nfce.fazenda.sp.gov.br');
  });

  it('aceita aspas e sinais de menor/maior coladas junto', () => {
    expect(interpretarEntradaNota(`"${URL_QR}"`).tipo).toBe('url_qr');
    expect(interpretarEntradaNota(`<${URL_QR}>`).tipo).toBe('url_qr');
  });

  it('aceita a URL de outro estado sem travar', () => {
    const chaveRj = '33' + CHAVE.slice(2);
    const r = interpretarEntradaNota(`https://www.fazenda.rj.gov.br/nfce/qrcode?p=${chaveRj}|2|1|1|${HASH}`);
    expect(r.tipo).toBe('url_qr');
    expect(r.uf).toBe('RJ');
    expect(r.podeConsultar).toBe(true);
  });
});

describe('o que não dá para consultar — e por quê', () => {
  it('separa a URL da consulta por digitação, que tem captcha', () => {
    const r = interpretarEntradaNota('https://www.nfce.fazenda.sp.gov.br/consulta');
    expect(r.tipo).toBe('url_sem_hash');
    expect(r.podeConsultar).toBe(false);
    expect(r.descricao).toMatch(/captcha|QR Code/i);
  });

  it('reconhece a chave dentro da URL de consulta, mas não promete consultar', () => {
    const r = interpretarEntradaNota(`https://www.nfce.fazenda.sp.gov.br/consulta?chNFe=${CHAVE}`);
    expect(r.chave).toBe(CHAVE);
    expect(r.podeConsultar).toBe(false);
  });

  it('recusa a URL do QR sem o código de segurança no fim', () => {
    const r = interpretarEntradaNota(`https://www.nfce.fazenda.sp.gov.br/qrcode?p=${CHAVE}|2|1|1|`);
    expect(r.podeConsultar).toBe(false);
    expect(r.chave).toBe(CHAVE);
  });

  it('explica o vazio sem parecer erro', () => {
    expect(interpretarEntradaNota('').podeConsultar).toBe(false);
    expect(interpretarEntradaNota('   ').tipo).toBe('desconhecido');
  });

  it('não confunde texto qualquer com nota fiscal', () => {
    const r = interpretarEntradaNota('comprei tomate hoje');
    expect(r.tipo).toBe('desconhecido');
    expect(r.chave).toBeUndefined();
  });
});

describe('toda entrada reconhecida sai íntegra', () => {
  const entradas = [
    URL_QR,
    URL_QR.replace('https://', ''),
    URL_QR.replace(/\|/g, '%7C'),
    ` ${URL_QR} `,
    CHAVE,
    CHAVE.replace(/(\d{4})/g, '$1 ').trim(),
  ];

  it('a chave extraída sempre tem 44 dígitos e UF conhecida', () => {
    for (const entrada of entradas) {
      const r = interpretarEntradaNota(entrada);
      expect(r.chave, entrada.slice(0, 40)).toHaveLength(44);
      expect(r.uf).toBe('SP');
    }
  });

  it('a URL final nunca leva caractere invisível para a requisição', () => {
    // Colagem de WhatsApp e PDF gruda zero-width e marca de direção. Dentro da
    // URL isso vira hash inválido e a SEFAZ recusa uma nota que estava certa.
    const sujos = ['\u200B', '\u200E', '\u200F', '\u2060', '\uFEFF', '\u00AD'];
    for (const c of sujos) {
      const r = interpretarEntradaNota(`${c}${URL_QR}${c}`);
      expect(r.tipo, `invisível ${escape(c)}`).toBe('url_qr');
      expect(/[\u200B-\u200F\u2060\uFEFF\u00AD]/.test(r.url ?? ''), `sobrou ${escape(c)}`).toBe(false);
    }
  });

  it('quando pode consultar, a URL está pronta para requisição', () => {
    for (const entrada of entradas) {
      const r = interpretarEntradaNota(entrada);
      if (!r.podeConsultar) continue;
      expect(() => new URL(r.url!)).not.toThrow();
      expect(r.url).toMatch(/^https:\/\//);
    }
  });
});
