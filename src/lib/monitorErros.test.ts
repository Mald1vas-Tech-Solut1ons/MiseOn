import { describe, expect, it } from 'vitest';
import { ehMaquinaLocal } from './monitorErros';

describe('monitor de erros não grava a máquina de desenvolvimento', () => {
  it.each(['localhost', '127.0.0.1', '[::1]', 'app.localhost', '192.168.0.10', '10.0.0.2', '172.20.1.1'])(
    '%s é local', (h) => expect(ehMaquinaLocal(h)).toBe(true));
  it.each(['miseon.app.br', 'www.miseon.app.br', 'miseon.vercel.app', '172.32.0.1'])(
    '%s é produção', (h) => expect(ehMaquinaLocal(h)).toBe(false));
});
