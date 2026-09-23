/**
 * Quem está pedindo, lembrado NESTE aparelho, por loja.
 *
 * Uma fonte só para o cardápio online e o pedido de mesa. Antes: a mesa
 * guardava o nome numa chave própria e o checkout não guardava nada — quem
 * fechava o carrinho e voltava tinha de digitar nome e telefone de novo, e
 * é esse atrito que derruba a venda.
 *
 * Regras:
 *   - O que a pessoa digitou por último vence o perfil carregado do banco.
 *   - É conveniência do aparelho, não dado da loja: o banco continua sendo a
 *     fonte do cliente (`clientes`). Falha de armazenamento nunca quebra o
 *     pedido (aba anônima, cota cheia, bloqueio).
 *   - NUNCA no totem: aparelho compartilhado não lembra o cliente anterior.
 */
import type { EnderecoFormData } from '../components/EnderecoMixin';

export interface IdentidadeCliente {
  nome: string;
  telefone: string;
  /** Preferências do último checkout nesta loja. */
  tipo?: 'DELIVERY' | 'RETIRADA_BALCAO';
  metodo?: string;
  endereco?: EnderecoFormData | null;
  bairro?: string;
}

const VAZIA: IdentidadeCliente = { nome: '', telefone: '' };
const chave = (lojaSlug: string) => `miseon_cliente_${lojaSlug}`;
/** Chave que a mesa usava antes deste módulo: lida uma vez, para ninguém perder o nome. */
const chaveAntigaMesa = (lojaSlug: string) => `miseon_nome_mesa_${lojaSlug}`;

export function lerIdentidade(lojaSlug: string): IdentidadeCliente {
  try {
    const bruto = localStorage.getItem(chave(lojaSlug));
    if (bruto) {
      const salvo = JSON.parse(bruto) as Partial<IdentidadeCliente>;
      return { ...VAZIA, ...salvo, nome: salvo.nome ?? '', telefone: salvo.telefone ?? '' };
    }
    const nomeAntigo = localStorage.getItem(chaveAntigaMesa(lojaSlug));
    return nomeAntigo ? { ...VAZIA, nome: nomeAntigo } : { ...VAZIA };
  } catch {
    return { ...VAZIA };
  }
}

export function salvarIdentidade(lojaSlug: string, parcial: Partial<IdentidadeCliente>): void {
  try {
    const atual = lerIdentidade(lojaSlug);
    const proximo: IdentidadeCliente = { ...atual, ...parcial };
    proximo.nome = (proximo.nome ?? '').trim() ? proximo.nome : atual.nome;
    localStorage.setItem(chave(lojaSlug), JSON.stringify(proximo));
    localStorage.removeItem(chaveAntigaMesa(lojaSlug));
  } catch {
    // Conveniência: sem armazenamento, o pedido segue normalmente.
  }
}

export function esquecerIdentidade(lojaSlug: string): void {
  try {
    localStorage.removeItem(chave(lojaSlug));
    localStorage.removeItem(chaveAntigaMesa(lojaSlug));
  } catch { /* nada a fazer */ }
}
