import { describe, it, expect } from 'vitest';
import { prepararFotosCupom, MAX_FOTOS, LIMITE_TOTAL_BYTES } from './fotoCupom';

/**
 * O redimensionamento em si depende de canvas e é verificado no navegador.
 * Aqui ficam as guardas que decidem antes de gastar rede — as que impedem o
 * lojista de esperar um upload que já se sabe que vai ser recusado.
 */
describe('prepararFotosCupom — recusas antes de gastar rede', () => {
  const arquivoFalso = (nome: string) =>
    new File([new Uint8Array([1, 2, 3])], nome, { type: 'image/jpeg' });

  it('exige ao menos uma foto', async () => {
    await expect(prepararFotosCupom([])).rejects.toThrow(/ao menos uma foto/i);
  });

  it('recusa mais fotos do que o cupom precisa, dizendo o limite', async () => {
    const demais = Array.from({ length: MAX_FOTOS + 1 }, (_, i) => arquivoFalso(`p${i}.jpg`));
    await expect(prepararFotosCupom(demais)).rejects.toThrow(new RegExp(`${MAX_FOTOS} fotos`));
  });

  it('o teto de tamanho é generoso o bastante para um cupom inteiro', () => {
    // 6 fotos de ~1600px em JPEG ficam na casa de centenas de KB cada; o teto
    // existe para barrar o absurdo, não para atrapalhar o uso normal.
    expect(LIMITE_TOTAL_BYTES).toBeGreaterThan(MAX_FOTOS * 1024 * 1024);
  });
});
