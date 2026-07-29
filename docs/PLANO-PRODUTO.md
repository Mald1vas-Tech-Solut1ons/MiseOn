# MiseOn — Plano de Produto e Implementação
**Referência competitiva:** Anota AI Premium (R$ 99,99/mês) · **MiseOn:** R$ 129,90/mês (mensal) ou R$ 99,90/mês (anual)
**Última revisão:** julho/2026 · Baseado em auditoria do código real (src/ + supabase/)

---

## 1. Onde estamos — paridade com o Anota AI Premium

| Recurso do concorrente | Status MiseOn | Detalhe real do código |
|---|---|---|
| Cardápio Digital | ✅ **Melhor** | White-label por loja (tema, fontes, cores, banners, link próprio) — Anota AI não personaliza assim |
| QR Code para mesas | ✅ Tem | `Mesas.tsx` + QR por mesa, mapa de salão, salão 3D com assentos |
| Pedidos em Balcão (PDV) | ✅ Tem | `PDV.tsx` touch-first, pedido nasce `origem='balcao'` e cai no fluxo normal |
| Frente de Caixa | ✅ Tem | `caixa_turnos` + `caixa_movimentacoes`: abertura, sangria, reforço, conferência |
| App Garçom / Comanda Digital | ✅ **Melhor** | `PainelGarcomMobile.tsx` com push + vibração háptica; divisão de conta por cadeira/igualitária/parcial |
| Pagamento Online | ✅ **Melhor** | Pix + crédito com split direto na conta do lojista (Efí). ⚠️ cartão pendente de validação com venda real |
| Cupons | ✅ Tem | Percentual/fixo, primeira compra, método exigido, validade, limite |
| Cashback | ✅ Tem | `cashback_saldos` + `cashback_movimentos`, crédito no pedido finalizado, uso no checkout |
| Recuperador de Vendas | ✅ Tem | `carrinhos_abandonados` + varredura automática e disparo de e-mail |
| Agendamento de Pedidos | ✅ Tem | `agendado_para` exposto no `CheckoutDrawer` |
| Cadastro de Entregadores | ✅ **Melhor** | App próprio do entregador com rota e live tracking no mapa |
| KDS (Display de cozinha) | ✅ Tem | `KDS.tsx` (cozinha pura) + `KDSProducao.tsx` (produção de preparos) |
| Gestor de Estoque | ✅ **Muito melhor** | Ficha técnica com baixa automática, PEPS auditável por lote, grafo 3D, preparos com validade, **monta/desmonta com rateio de custo** e **inventário multiunidade** |
| Registro de Compras | ✅ **Muito melhor** | Fornecedores, pedido → recebimento conferido → nota, com marca/lote/validade/preço, entrega parcial e histórico de preço por fornecedor |
| Gestão Financeira | ✅ **Melhor** | Ledger de dupla entrada por trigger, DRE mensal, extrato de caixa, margem real por produto |
| NF Automatizada | ✅ Tem | `Fiscal.tsx` — NFC-e/NF-e 4.0 pronta, pendente upload do certificado A1 do lojista |
| Integração com anúncios | ❌ **Falta** | Sem Pixel Meta / GA4 / catálogo — único gap de paridade que resta |
| Suporte todos os dias | 🟡 Operacional | Central de Ajuda criada; suporte é processo, não código |

**Leitura honesta:** a paridade está fechada, exceto Pixel/anúncios. O diferencial de venda migrou de "temos estoque" para **"somos o único que sabe quanto custa cada grama do seu prato, de quem você comprou e por quanto"**.

---

## 2. Personas e suas dores

- **Dono** — "quanto vendi, quanto sobrou, o que falta comprar". Atendido: Dashboard do dia, DRE, Central de Compras com sugestão por giro.
- **Balcão/Caixa** — lançar pedido em ≤ 30s. Atendido pelo PDV + frente de caixa.
- **Cozinha** — "o que fazer agora", agregado, com atraso em cor. Atendido pelo KDS.
- **Garçom** — abrir mesa, lançar item, fechar conta. Atendido pelo painel mobile com push.
- **Comprador/estoquista** — *(persona nova)* precisa saber o que pedir, de quem, por quanto, e conferir o que chegou sem fingir que veio tudo certo. Atendido pelo módulo de Suprimentos.
- **Entregador** e **Cliente final** — bem servidos desde o MVP.

---

## 3. O que foi entregue

| Fase | Escopo | Status |
|---|---|---|
| **0** | Dashboard do dia, onboarding do lojista | ✅ concluída |
| **1** | PDV, frente de caixa, KDS puro | ✅ concluída |
| **2** | Mesas, QR por mesa, comanda, modo garçom, salão 3D, divisão de contas | ✅ concluída |
| **3** | Agendamento, recuperador de vendas, cashback | ✅ concluída (falta Pixel/anúncios) |
| **4** | NFC-e / NF-e 4.0 | ✅ construída, pendente certificado A1 do lojista |
| **5** | **Suprimentos: compras, fornecedores, monta/desmonta, inventário** | ✅ concluída |

### Fase 5 — Suprimentos (julho/2026)

O princípio: **pedido é intenção, recebimento é fato, e a diferença entre os dois é informação** — não erro a esconder.

| Entrega | O que resolve |
|---|---|
| `fornecedores` | De quem se compra, com prazo de entrega, dias de entrega e pedido mínimo |
| `compras` + `compras_itens` | Intenção e fato na mesma linha; fator de conversão gravado como snapshot |
| `fn_receber_compra` | Conferência, razão, saldo, custo e financeiro numa **transação única** |
| `fn_transformar_estoque` | Monta/desmonta com conservação de valor (PEPS real rateado por peso) |
| `fn_ajustar_inventario` | Contagem física em qualquer unidade; sobra abre lote, falta vira custo |
| `vw_insumo_giro` | Consumo diário, dias de cobertura, prazo do fornecedor, capital parado |
| `vw_lotes_validade` | O dinheiro prestes a vencer, antes de virar lixo |
| `vw_historico_precos_compra` | Custo normalizado por unidade-base — "onde você compra melhor" |

**Dívidas antigas corrigidas no caminho:**
1. `unidades_medida` não tinha `dente`, `cabeça`, `maço`, `folha`, `rodela` — a UI oferecia e a FK recusava. Cadastrar alho em "dente" estourava violação de chave estrangeira.
2. `fn_lancar_custo_estoque` creditava `1.1.01` (**Caixa**) ao baixar CMV, porque não existia conta de estoque. Vender um lanche reduzia o caixa contábil sem um centavo sair. Criada `1.1.03 Estoque de Insumos`. ⚠️ **Lançamentos anteriores à correção seguem apontando para Caixa.**
3. O abastecimento fazia `insert` + `update` em chamadas soltas do navegador: falha no meio deixava o razão com a entrada e o saldo sem ela.

---

## 4. O que falta para o lançamento

### 4.1 Bloqueadores comerciais (não são código)
| Item | Por quê | Dono |
|---|---|---|
| Validar cartão com venda real de R$ 1 | Única ponta de pagamento sem prova ao vivo | Rafael |
| 2ª conta Efí + 3 envs para antecipação | Promessa já exposta na UI | Rafael |
| Certificado A1 no tenant piloto | Fiscal está pronto, mas não emitiu nota real | Lojista piloto |

### 4.2 Último gap de paridade
| Item | Descrição | Esforço |
|---|---|---|
| **Pixel & anúncios** | Campos Meta Pixel ID / GA4 na Loja; eventos ViewContent/AddToCart/Purchase no cardápio; guia na Central de Ajuda | S |

### 4.3 Evolução natural do módulo de Suprimentos
| Item | Descrição | Esforço |
|---|---|---|
| Enviar pedido pelo WhatsApp | O pedido já é um documento; falta o botão que manda a lista formatada para o fornecedor | S |
| Importar XML da NF-e de compra | Ler a nota do fornecedor e pré-preencher a conferência (o `Fiscal.tsx` já cita entrada por XML) | M |
| Curva ABC de insumos | `vw_insumo_giro` já tem giro e capital parado — falta a leitura que diz onde o dinheiro está preso | S |
| Contas a pagar por fornecedor | O lançamento credita Fornecedores (2.1.01); falta a tela de vencimentos e baixa | M |
| Receita técnica de desmonte | Salvar um desmonte como modelo ("desossa padrão de frango") para repetir em 1 clique | M |

### 4.4 Contínuo — Qualidade & UX
- **Consistência visual**: 3 linguagens convivendo (admin claro, PainelPedidos dark, KDS custom). Definir tokens e um kit pequeno (`Botao`, `Card`, `Campo`, `Badge`).
- **Mobile do admin**: auditar cada tela em 375px — o dono opera do celular.
- **Estados vazios que ensinam**: padrão da Equipe replicado em todas as telas novas.
- **Impressão térmica**: revisar templates 58/80mm com lojista real.

---

## 5. Posicionamento (para o comercial)

Contra o Anota AI Premium, a paridade já não é argumento deles — é nosso. O que o MiseOn vende e eles não têm:

1. **Dinheiro direto na conta do lojista** (split Efí; não seguramos o dinheiro de ninguém).
2. **Custo real por ficha técnica**, com PEPS auditável lote a lote — margem por produto que não é chute.
3. **Desmonte com rateio de custo**: quem compra boi, frango ou peixe inteiro sabe quanto custa cada corte.
4. **Compras profissionais**: histórico de preço por fornecedor e por marca, com alerta de quando o item acaba antes da entrega chegar.
5. **App de entregador com tracking**, marca própria por loja e multi-loja.

A frase de venda: *"Todo sistema te diz quanto você vendeu. O MiseOn te diz quanto sobrou — e por quê."*

---

## 6. Ambientes de teste
- **Lanche do Paulista** — tenant de provas. Toda mudança nova nasce aqui.
- **"N" de NATUREBA!** — tenant de apresentação. **Não alterar sem autorização explícita.**
