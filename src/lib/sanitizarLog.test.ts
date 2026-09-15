import { expect, it } from 'vitest';
import { sanitizarLog } from './sanitizarLog';
it('remove credenciais de callback, parâmetros e JWT de stack/mensagem', () => {
  const log = sanitizarLog('Falha https://miseon.app.br/admin?code=segredo#access_token=token access_token=outro refresh_token=mais eyJabc.def.ghi');
  expect(log).toContain('https://miseon.app.br/admin');
  for (const segredo of ['segredo', '=token', '=outro', '=mais', 'eyJabc.def.ghi']) expect(log).not.toContain(segredo);
});
