import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { instalarMensagemDeErroNasFunctions, mensagemDoCorpo } from './edgeFunctionErro';

// Cliente REAL do supabase-js com a rede simulada: prova o comportamento no
// mesmo caminho que as 64 chamadas do app percorrem.
function clienteRespondendo(resposta: () => Response | Promise<Response>) {
  const fetch = vi.fn(async () => resposta());
  const cliente = createClient('https://exemplo.supabase.co', 'anon', {
    global: { fetch: fetch as unknown as typeof globalThis.fetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  instalarMensagemDeErroNasFunctions(cliente);
  return cliente;
}

describe('mensagem de erro das Edge Functions', () => {
  it('não-2xx entrega o texto da function em error.message', async () => {
    const cliente = clienteRespondendo(() =>
      new Response(JSON.stringify({ error: 'Esta conta já está vinculada a uma loja.' }), {
        status: 409, headers: { 'Content-Type': 'application/json' },
      }));
    const { data, error } = await cliente.functions.invoke('qualquer');
    expect(data).toBeNull();
    expect(error?.message).toBe('Esta conta já está vinculada a uma loja.');
  });

  it('o corpo continua legível para quem ainda lê error.context', async () => {
    const cliente = clienteRespondendo(() =>
      new Response(JSON.stringify({ error: 'Gemini: model not found' }), {
        status: 502, headers: { 'Content-Type': 'application/json' },
      }));
    const { error } = await cliente.functions.invoke('qualquer');
    const corpo = await (error as unknown as { context: Response }).context.json();
    expect(corpo.error).toBe('Gemini: model not found');
  });

  it('sem corpo útil, troca o inglês do SDK por português', async () => {
    const cliente = clienteRespondendo(() => new Response('boom', { status: 500 }));
    const { error } = await cliente.functions.invoke('qualquer');
    expect(error?.message).toMatch(/servidor não conseguiu/);
    expect(error?.message).not.toMatch(/non-2xx/);
  });

  it('falha de rede vira aviso de conexão', async () => {
    const cliente = clienteRespondendo(() => { throw new TypeError('Failed to fetch'); });
    const { error } = await cliente.functions.invoke('qualquer');
    expect(error?.message).toMatch(/internet/);
  });

  it('2xx passa intacto', async () => {
    const cliente = clienteRespondendo(() =>
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const { data, error } = await cliente.functions.invoke('qualquer');
    expect(error).toBeNull();
    expect(data).toEqual({ ok: true });
  });

  it('instalar duas vezes não empilha', async () => {
    const cliente = clienteRespondendo(() =>
      new Response(JSON.stringify({ erro: 'x' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    const antes = Object.getPrototypeOf(cliente.functions).invoke;
    instalarMensagemDeErroNasFunctions(cliente);
    expect(Object.getPrototypeOf(cliente.functions).invoke).toBe(antes);
  });

  it('reconhece as chaves que as functions usam', () => {
    expect(mensagemDoCorpo({ erro: 'a' })).toBe('a');
    expect(mensagemDoCorpo({ mensagem: 'b' })).toBe('b');
    expect(mensagemDoCorpo({ motivo: 'c' })).toBe('c');
    expect(mensagemDoCorpo({ error: { code: 1 } })).toBeNull();
    expect(mensagemDoCorpo(null)).toBeNull();
  });
});
