// @vitest-environment jsdom
/**
 * O que dá para garantir aqui: a decisão de caminho e a robustez.
 *
 * jsdom não tem canvas 2D nem BarcodeDetector, então a decodificação em si não
 * roda neste ambiente — ela foi verificada no navegador, com fotos sintéticas
 * de cupom (QR grande, pequeno dentro da foto do cupom inteiro, foto escura,
 * JPEG degradado e código inclinado): os seis casos leram.
 *
 * O contrato testado abaixo é o que protege a interface: em ambiente sem
 * suporte, `lerQrDeImagem` devolve null em vez de estourar exceção — porque a
 * tela precisa dizer "não achei o QR" e seguir viva, não quebrar na mão de quem
 * só escolheu uma foto.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { temDetectorNativo, criarDetector, lerQrDeImagem } from './lerQrCode';

describe('lerQrCode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('deve reportar ausência do detector nativo quando o navegador não tem', () => {
    expect(temDetectorNativo()).toBe(false);
    expect(criarDetector()).toBeNull();
  });

  it('deve devolver null sem lançar quando o ambiente não sabe decodificar', async () => {
    // jsdom nunca dispara load/error em <img>; o prazo interno é que resolve —
    // sem ele a tela ficaria presa em "Lendo..." para sempre.
    await expect(lerQrDeImagem(new File([], 'cupom.jpg'))).resolves.toBeNull();
  }, 15_000);

  it('deve devolver null sem lançar quando a imagem é ilegível', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('corrompida')));
    await expect(lerQrDeImagem(new File([], 'quebrada.jpg'))).resolves.toBeNull();
  });

  it('não deve relatar progresso quando nem chega a decodificar', async () => {
    const etapas: string[] = [];
    await lerQrDeImagem(new File([], 'cupom.jpg'), (e) => etapas.push(e));
    expect(etapas).toEqual([]);
  }, 15_000);
});
