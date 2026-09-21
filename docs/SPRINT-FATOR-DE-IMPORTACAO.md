# Sprint — o fator 1 inventado na importação de nota

## O que está quebrado (medido, 21/09/2026)

Duas camadas decidem quanto entra no estoque por unidade comprada, e elas
discordam:

- **Frontend** (`src/lib/fatorImportacaoNota.ts`): ao vincular uma linha da nota
  a um insumo já cadastrado, calcula a conversão (kg→g = 1000, L→ml = 1000,
  "PVC 20UN" = 20). Quando **não há evidência nem histórico**, devolve
  `fator: 0` com `requerConfirmacao: true` — e a tela **bloqueia** a importação
  até o lojista informar o fator. O contrato é explícito: *zero significa "não
  sei, pare"*.

- **Servidor** (`fn_importar_nfce`, produção):
  ```sql
  v_fator := COALESCE(NULLIF((v_item->>'fator')::NUMERIC, 0), 1);
  ```
  Coage **0 → 1** em silêncio. O contrato do frontend é anulado no último passo.

## Por que isso é grave

Com `fator = 1` inventado, para uma linha "CENOURA 1 KG, R$ 5,48" vinculada a um
insumo controlado em **g**:

- `v_qtd_base = 1 * 1 = 1` → entra **1 g** (em vez de 1000 g);
- `preco_embalagem = v_custo / v_qtd_nota = 5,48`, `qtd_embalagem = 1` →
  custo unitário **R$ 5,48 por grama**.

É o lote de "R$ 5,48 por grama" que a varredura de integridade encontrou na loja
de teste (a CTO-A8 subiu 1000× o custo dos dados de demonstração). O número
errado entra como se fosse verdade, sem erro na tela, e contamina lote, CMV e
margem.

## Causa-raiz

O servidor **não vê a unidade crua da nota** (`unidade_nota`), então não consegue
distinguir:

- "fator 1 legítimo" (nota em kg, insumo em kg); de
- "fator 1 inventado" (nota em kg, insumo em g).

Sem essa informação, o `COALESCE(..., 1)` era a saída preguiçosa — e é a
fábrica do erro.

## O que este sprint faz

**Mínimo, seguro e verificável — fechar a porta do servidor:**

`fn_importar_nfce` passa a **respeitar o contrato do frontend**. `fator`
ausente/nulo continua valendo 1 (compatibilidade: a linha de insumo novo na
mesma unidade omite o campo). Mas `fator` **explicitamente ≤ 0** deixa de ser
trapaça para 1: a linha é **recusada** e contada em `itens_recusados`, com o
motivo. O número nunca mais é inventado no servidor; quem não sabe, para.

Isso resolve o caminho que produz o dano (vínculo com fator bloqueado) sem
reescrever o motor de conversão nem tocar em lote antigo.

## O que este sprint NÃO faz (e por quê)

- **Não** reescreve lotes históricos: "fator 1 gravado" é ambíguo depois do
  fato (legítimo ou inventado?) sem a unidade crua da nota. Reescrever às cegas
  seria falsificar estoque — o inverso do objetivo.
- **Não** muda o parser nem o catálogo: a evidência (kg, L, conteúdo "20UN")
  já é lida corretamente pelo frontend.
- **Não** adiciona `unidade_nota` ao payload *neste* sprint. É a evolução certa
  (permite ao servidor converter sozinho e auditar o de-para), mas exige tocar
  o parser, o modal, a RPC e o de-para histórico juntos. Fica registrado como
  próximo passo, com o aceite definido.

## Aceite

- [ ] `fn_importar_nfce` devolve `itens_recusados > 0` e **não** grava
      `preco_embalagem` inventado quando recebe `fator: 0`.
- [ ] `fator` ausente continua valendo 1 (nenhuma nota legítima quebra).
- [ ] Prova: importar uma linha "CENOURA 1 KG, R$ 5,48" com `fator: 0` contra um
      insumo em `g` **não** cria lote a R$ 5,48/g nem move saldo.
- [ ] Suíte TS/Vitest e build passam; varredura de integridade não piora.

## Próximo passo (registrado, não feito aqui)

Adicionar `unidade_nota` (a sigla crua da SEFAZ) ao item do payload e ao
`compras_depara_itens`. Com ela o servidor decide a conversão por conta própria,
audita de-para e permite a **reconciliação assistida** dos lotes antigos — sem
inventar 1 e sem apagar o evento original.
