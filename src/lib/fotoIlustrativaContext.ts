import { createContext } from 'react';

/**
 * Loja pode mostrar foto ILUSTRATIVA em produto sem foto própria?
 *
 * Só loja de demonstração (`lojas_publicas.eh_teste`). Em loja real, foto de
 * banco de imagens no lugar do prato é oferta que não corresponde ao produto —
 * em 23/09/2026 a "Baguete de salame" do Natureba aparecia com um hambúrguer.
 * O padrão é `false`: quem esquecer de prover o contexto erra para o lado
 * honesto.
 *
 * Em arquivo próprio (não em `fotoProduto.tsx`) porque um arquivo que
 * exporta componente E contexto quebra o Fast Refresh do Vite.
 */
export const FotoIlustrativaContext = createContext(false);
