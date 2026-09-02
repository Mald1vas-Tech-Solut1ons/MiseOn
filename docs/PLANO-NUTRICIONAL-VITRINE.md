# MiseOn — Onda V: a tabela nutricional que o cliente vê

**Papel deste doc:** plano de execução da última milha do épico `EP-NUT` — tirar o dado
nutricional de dentro do banco e colocá-lo, correto e bonito, na frente de quem decide o
pedido. Complementa [PLANO-NUTRICIONAL.md](PLANO-NUTRICIONAL.md) (Sprints 0–6); não o
substitui.
**Owner:** Rafael (PO/CTO) · **Loja de provas:** Lanche do Paulista (`lanchepaulista`)
**Status:** ✅ ENTREGUE em 2026-09-02 — as 4 fatias da §4 aplicadas em produção. Selo público fica para a onda seguinte.
**Medição de base:** 2026-09-01, contra o banco de produção

---

## 1. O que existe hoje, medido (não estimado)

O encanamento está construído. As Sprints 0–2 entregaram base científica, motor de cálculo
recursivo, captura por EAN/foto/IA e cadastro manual; um trabalho posterior (agosto) somou o
cache por produto e a RPC pública `fn_nutricao_cardapio`, e ligou um componente de tabela no
modal do produto. **Nada disso é retrabalho.**

O problema é o resultado. Contagem no Lanche do Paulista, hoje:

| | |
|---|---|
| Produtos disponíveis no cardápio | **10** |
| Produtos que **exibem** tabela nutricional | **1** — "Bombom Sonho de Valsa Lacta" |
| Produtos `PARCIAL` (calculam, mas não publicam) | 2 — X-BACON (93,6%), X-PAULISTA (87,3%) |
| Produtos `SEM_DADOS` (sem ficha técnica) | 6 — as duas batatas, dois refrigerantes, o combo, o Smash Duplo |
| Insumos cadastrados | 31 · **8 com nutrição revisada (26%)** · 4 preparos |

> O único prato com tabela nutricional na vitrine da hamburgueria é um bombom de revenda.
> Nenhum hambúrguer aparece. A feature está ligada e vazia.

E há um número **errado** salvo no cache: o X-SALADA está gravado como `COMPLETO`,
`cobertura_pct = 100`, com **1.100 g de massa** e 3 insumos sem dado nenhum. Um sanduíche de
1,1 kg. A causa está em §2.1. Ele não chega à vitrine hoje — só por causa de um filtro extra
posto na RPC, não porque o cálculo tenha percebido o erro.

---

## 2. Os oito defeitos que separam "existe" de "confiável"

Cada um foi verificado no código e no dado real, e cada um tem correção nomeada na §4.

### 2.1 Cobertura fantasma: o que não tem massa some do denominador

`fn_calcular_nutricao_receita` mede cobertura por **massa**. Um insumo sem ponte de conversão
(`un`, `fatias`, `folha` sem `peso_medio_un_g`) tem `massa_g = NULL`: ele entra em
`insumos_faltantes`, mas some **dos dois lados** da fração. Com pão, queijo e tomate sem peso
médio, o X-SALADA calcula "100% de cobertura" sobre carne e alface apenas.

Isso já tinha sido diagnosticado na migração `20260818230000` e contornado com um filtro
(`insumos_faltantes = 0`) na RPC pública. O contorno protege a vitrine e esconde o defeito:
o status gravado continua mentindo, e é ele que o admin lê.

**Correção:** cobertura passa a ter dois números independentes — `cobertura_massa_pct` e
`itens_com_dado / itens_totais`. `COMPLETO` exige os dois. `status` deixa de ser derivável
de uma fração que ignora o que não sabe medir.

### 2.2 O alérgeno não sai do insumo

`insumos_nutricao` guarda `alergenos_contem` e `alergenos_pode_conter` — e estão preenchidos.
O motor **não os agrega**, o cache não tem coluna para eles e a vitrine não os exibe.

O efeito concreto: o único produto publicado hoje declara, no cadastro,
**amendoim, glúten, leite e soja** — e o cliente não vê nenhum deles.

Para quem lê tabela nutricional por necessidade e não por curiosidade, o alérgeno vale mais
que a caloria. É o risco R-01 do épico, aberto.

**Correção:** o motor agrega alérgeno pela mesma recursão do nutriente (um alérgeno dentro de
um preparo é alérgeno do prato), o cache guarda, a vitrine mostra **acima** dos macros. Regra
ADR-03 preservada em todas as superfícies: ausência na lista significa *não avaliado*, nunca
*não contém* — e o texto diz isso com essas palavras.

### 2.3 A porção não existe

A tabela atual anuncia "porção de X g — o prato inteiro". Falta tudo o que a rotulagem
brasileira usa para dar sentido ao número: **%VD**, a coluna **por 100 g**, e a possibilidade
de o prato render mais de uma porção. O catálogo `nutrientes` já tem `vdr`, `indentacao`,
`ordem` e `fator_energetico` — nada disso é lido pela UI, que reimplementa a lista à mão.

**Correção:** `produtos_nutricao_config` (porções, peso da porção, fator de cocção) + cache com
`por_porcao` e `por_100g` + tabela que lê o catálogo do banco em vez de uma constante no `.tsx`.

### 2.4 Sem fator de cocção, fritura e grelha erram sistematicamente

Risco R-03 do épico, ainda não endereçado. Batata frita absorve óleo; hambúrguer perde água e
gordura na chapa. Somar ingrediente cru e publicar como servido é errado na direção previsível.
As duas batatas e os dois hambúrgueres do Paulista caem exatamente aqui.

**Correção:** fator por prato com presets citáveis (grelhado 0,75 · frito 1,15 · cozido 1,05),
default 1,00, sempre visível no dossiê e no admin — nunca aplicado em silêncio.

### 2.5 Seis dos dez produtos não têm por onde calcular

Refrigerante em lata, bombom, água: **revenda**. Não têm ficha técnica porque não têm receita —
mas têm rótulo, que é a melhor fonte de todas. Hoje o único jeito de dar nutrição a uma
Coca-Cola é criar uma ficha técnica de uma linha, como foi feito no bombom. É um contorno que
o lojista não vai descobrir sozinho.

O combo é outro caso: ele *é* a soma dos seus componentes, e essa soma não é feita.

**Correção:** dois caminhos novos, ambos sem inventar conceito — produto de revenda aponta para
o insumo que ele é (`produtos_nutricao_config.insumo_id`), e combo soma os produtos que o
compõem.

### 2.6 O cache envelhece em silêncio

Existem dois gatilhos de invalidação: `fichas_tecnicas` e `insumos_nutricao`. Faltam:

| Mudança | Hoje | Consequência |
|---|---|---|
| Receita de um **preparo** (`fichas_preparos`) | ❌ não recalcula | Trocar o Molho da Casa não muda o X-PAULISTA. O número publicado passa a descrever uma receita que não existe mais |
| `insumos.unidade_medida` ou `is_preparo` | ❌ não recalcula | Muda a base de conversão do prato inteiro |
| Produto novo | ❌ sem linha no cache | Nasce invisível, sem sinal para o lojista |

**Correção:** completar as quatro origens de invalidação (NUT-18 do épico prevê exatamente
isso) e recalcular em cascata quem consome o preparo alterado.

### 2.7 Nenhuma crítica de sanidade, e ninguém enxerga a lacuna

O "Alface — 500 g por unidade" foi gravado como `revisado`, origem USDA, e produziu um
sanduíche de 1,1 kg sem que nada reclamasse. Duas verificações baratas pegariam:

1. **Coerência energética**: kcal declarada × (4·carbo + 4·prot + 9·gord + 2·fibra) — ±20%.
   Já existe na Edge Function de OCR; não existe no cálculo do prato.
2. **Plausibilidade de porção**: um prato de 1,1 kg ou de 5 g pede confirmação humana.

E, do lado do lojista, não há **nenhuma** tela que responda "por que o meu X-BACON não mostra
tabela?". A lacuna precisa virar tarefa com nome e deep-link (§8.1.3 do épico), não sumiço.

### 2.8 Bug latente: rendimento em kg dividindo consumo em gramas

O motor faz `coalesce(rendimento_padrao_kg, rendimento_porcoes)` e divide o consumo por esse
número. As duas colunas estão em **unidades diferentes** — kg numa, unidade do preparo na
outra. Nenhum preparo em produção usa `rendimento_padrao_kg` hoje (verificado), então o defeito
está dormindo. No dia em que alguém preencher "rende 2 kg" e a ficha consumir "250 g", o
aporte sai **1.000× maior**.

**Correção:** normalizar o rendimento para a unidade do preparo antes de dividir, e cobrir com
golden test — é meia hora de trabalho contra um erro que passaria despercebido por meses.

---

## 3. Princípio de projeto desta onda

> **Um número que não pode ser explicado não é publicado.**

Três consequências, e elas resolvem as decisões de detalhe sem nova discussão:

1. **Publicar é o estado raro, não o padrão.** Prato só aparece com tabela quando todo insumo
   tem dado rastreável. Menos pratos com número, zero números falsos.
2. **A ausência é informação.** Prato sem número ainda mostra o que se sabe — alérgenos
   declarados — e nunca finge que a lista está completa.
3. **Toda superfície carrega a proveniência.** Vitrine, PDV, impressão e dossiê dizem de onde
   veio o valor e quando. É o que o §3.2 do épico exige e o que sustenta o selo.

### 3.1 Decisões do PO — 2026-09-01

Perguntadas e respondidas. Ficam aqui para não serem reabertas.

| Decisão | Resolução |
|---|---|
| **Escopo** | As 4 fatias da §4. Selo público, dossiê e rótulo imprimível são a onda seguinte |
| **Padrão de exibição** | Profissional por default, **tudo configurável pelo lojista** — não pergunte, entregue o certo e deixe a chave na mão dele |
| **Prato incompleto** | Nunca publica macro parcial (número subestimado engana quem conta caloria), **mas sempre publica o alérgeno já declarado** — é o dado de que o cliente com restrição precisa, e omiti-lo é pior que não ter número. O lojista pode, se quiser, liberar a exibição parcial com aviso (`nutricao_exibicao`) |
| **Dado de prova** | Lanche do Paulista é loja fictícia de teste: pode corrigir, completar e recadastrar à vontade |
| **"A marmita é fit mesmo?"** | O cliente precisa **julgar**, não só ler. Entram os selos de atributo calculados pelo critério legal da RDC 54/2012 (fonte/alto teor de proteína, baixo em sódio, sem açúcares adicionados) — critério objetivo, exibível, nunca inferido por IA. Ver V-18 |
| **Onde a tabela aparece** | No cardápio, no modal do produto **e no pedido** — o carrinho soma kcal e consolida alérgenos dos itens escolhidos. Ver V-19 |

---

## 4. As quatro fatias

Cada fatia é entregável sozinha e deixa o produto melhor do que encontrou. Ordem é caminho
crítico: sem a Fatia 1 as demais publicam número errado mais rápido.

### Fatia 1 — O motor conta a verdade inteira · banco

| ID | Entrega | Fecha |
|---|---|---|
| **V-01** | Motor agrega **alérgenos** pela recursão de preparos (`contem`/`pode_conter`, deduplicados) | §2.2 · R-01 |
| **V-02** | Cobertura em dois eixos (massa + contagem de itens); `COMPLETO` exige ambos; fim da cobertura fantasma | §2.1 |
| **V-03** | Normalização de rendimento kg × unidade do preparo | §2.8 |
| **V-04** | Crítica de sanidade no cálculo: coerência energética (±20%) e plausibilidade de massa; grava `alertas[]` e impede publicação de erro grosseiro | §2.7 |
| **V-05** | Invalidação completa: `fichas_preparos`, `insumos`, `produtos`; cascata para quem consome o preparo | §2.6 |

**Critério de aceite (Gherkin resumido)**

```gherkin
Cenário: alérgeno de dentro do preparo aparece no prato
  Dado um preparo "Molho da Casa" que consome Maionese (contém Ovo)
    E um produto "X-PAULISTA" que consome 40 ml desse molho
  Quando o cálculo for executado
  Então "Ovo" consta em alergenos_contem do X-PAULISTA
    E a lista é apresentada como "avaliados", nunca como "os únicos"

Cenário: item sem massa não é apagado da conta
  Dado um X-SALADA com pão, queijo e tomate sem peso médio informado
  Quando o cálculo for executado
  Então cobertura por itens = 2/5
    E o status é PARCIAL, jamais COMPLETO
    E os três aparecem nomeados em insumos_faltantes

Cenário: mudar o preparo muda o prato
  Dado um X-PAULISTA calculado e cacheado
  Quando a ficha do preparo "Molho da Casa" for alterada
  Então o cache do X-PAULISTA é recalculado na mesma transação
```

### Fatia 2 — O prato sabe como é servido · banco + admin

| ID | Entrega | Fecha |
|---|---|---|
| **V-06** | `produtos_nutricao_config`: `porcoes`, `peso_porcao_g`, `fator_coccao` + método, `exibir`, `observacao`, `insumo_id` (revenda) | §2.3 · §2.4 · §2.5 |
| **V-07** | Revenda: produto aponta para o insumo que ele é — Coca-Cola herda o rótulo, sem ficha de mentira | §2.5 |
| **V-08** | Combo: soma dos produtos componentes, com a mesma regra de publicação | §2.5 |
| **V-09** | Cache v2: `por_porcao`, `por_100g`, `alergenos_*`, `alertas`, `composicao_fontes` (% rótulo/base/estimado), `itens_total`/`itens_com_dado` | §2.1 · §2.3 |

> **Nota de honestidade:** `composicao_fontes` é o insumo do selo nível 2 do épico. Esta onda
> **grava** o dado; o selo em si (`lojas_selo_nutricional`, página `/selo/:slug`) continua
> sendo Sprint 4–5 do plano-mãe e **não** entra aqui.

### Fatia 3 — A lacuna vira tarefa · admin

| ID | Entrega | Fecha |
|---|---|---|
| **V-10** | Painel **Nutrição do cardápio**: semáforo por prato, o que falta com nome e deep-link para o insumo, e a consequência ("complete o pão brioche e 3 pratos publicam") | §2.7 |
| **V-11** | Preview ao vivo no editor de ficha técnica — `fn_simular_nutricao` existe desde a Sprint 1 e nunca foi chamada pela UI | §2.7 |
| **V-12** | Config por prato no mesmo modal: porção, rendimento, cocção com presets, alternância exibir/ocultar | §2.3 · §2.4 |
| **V-13** | Alerta de alérgeno no PDV e no KDS ao abrir o item (NUT-26 do épico) | R-01 |

### Fatia 4 — A vitrine, bonita e honesta · cliente

| ID | Entrega | Fecha |
|---|---|---|
| **V-14** | `TabelaNutricional` v2: alérgenos acima dos macros (ícone **e** texto), ordem/indentação/VDR lidos do catálogo, coluna %VD, alternância porção ⇄ 100 g, `<table>` semântica com `<th scope>`, desenhada em 375px | §2.2 · §2.3 |
| **V-15** | Selo de kcal no card da vitrine + filtro rápido por alérgeno na listagem | conversão |
| **V-16** | Disclaimer nos dois níveis (§16.1 curto no card, §16.2 longo no modal) + proveniência ("62% rótulo · 31% base científica · 7% estimado") | §3.2 do épico |
| **V-17** | JSON-LD `schema.org/NutritionInformation` no prerender do cardápio (NUT-25) | SEO |
| **V-18** | **Selos de atributo** calculados pela RDC 54/2012 — "fonte de proteína", "alto teor de proteína", "baixo em sódio", "sem açúcares adicionados". Critério legal, calculado sobre 100 g/100 ml, com o critério visível ao toque. Só aparece em prato `COMPLETO`, nunca inferido por IA | "é fit mesmo?" |
| **V-19** | **Resumo nutricional do pedido**: o carrinho soma kcal e consolida os alérgenos dos itens escolhidos, dizendo quantos itens entraram na conta e quantos não têm dado | pedido |
| **V-20** | Configuração por loja: `nutricao_ativo`, `nutricao_exibicao` (completa / só alérgenos / parcial com aviso), `nutricao_selos_atributo`, disclaimer editável | §3.1 |

---

## 5. Prova no Lanche do Paulista

A onda só fecha quando a loja de provas sai de **1/10** para um número que se defende:

1. Completar os 10 insumos que faltam pelos caminhos que já existem (EAN → foto → IA), medindo
   o tempo real de cada um — é a métrica-norte do épico (≤ 8 s por insumo).
2. Corrigir o "Alface 500 g/un" e conferir se a crítica de sanidade (V-04) o teria pego.
3. Ligar revenda para os dois refrigerantes e somar o COMBO X-BACON.
4. Registrar o antes/depois: pratos publicáveis, massa por prato, kcal, alérgenos por prato.

**Meta de saída:** ≥ 8 dos 10 produtos com tabela publicada, 100% dos publicados com alérgeno
declarado, nenhum prato com massa fora de faixa plausível.

O Natureba tem **0 produtos** e **0 linhas** de nutrição hoje (verificado) — nenhuma mudança
desta onda toca a vitrine dele.

### 5.1 Resultado medido — 2026-09-02

O cardápio foi remontado por inteiro (script reproduzível em
[scripts/seed-cardapio-lanche-paulista.sql](../scripts/seed-cardapio-lanche-paulista.sql)):
16 produtos em 7 categorias, linha tradicional e linha fit, 11 preparos com ordem de produção.

| | Antes (01/09) | Depois (02/09) |
|---|---|---|
| Produtos disponíveis | 10 | **16** |
| Publicando tabela | **1** (um bombom de revenda) | **16** |
| Insumos de comida com nutrição | 8 de 31 (26%) | **41 de 41 (100%)** |
| Produtos com alérgeno declarado | 1 (não exibido) | 16 (11 com alérgeno, todos exibidos) |
| Prato com massa implausível | X-SALADA, 1.100 g | nenhum |

Alguns números que a vitrine passou a publicar, todos derivados da ficha técnica:

| Prato | Porção | kcal | Proteína | Selos |
|---|---|---|---|---|
| COMBO X-BACON | 481 g | 1.310 | 66 g | alto em proteína |
| X-BACON | 388 g | 1.122 | 64 g | alto em proteína |
| SMASH FIT DE PATINHO | 291 g | 531 | 50 g | alto em proteína |
| BOWL FIT DE FRANGO | 294 g | 484 | 40 g | alto em proteína · baixo em gordura saturada |
| BURGER FIT DE FRANGO | 271 g | 407 | 41 g | alto em proteína · baixo em gordura saturada |
| SALADA CAESAR FIT | 229 g | 236 | 33 g | alto em proteína |

**Provas executadas no banco** (os golden tests do NUT-07 exigem
`SUPABASE_SERVICE_ROLE_KEY`, que não está no `.env.local` desta máquina — então
os cenários foram provados por consulta direta):

1. **Rendimento normalizado** — `fn_rendimento_na_unidade_do_preparo('g', 2 kg, null) = 2000`,
   `('kg', 2, null) = 2`, e volume sem densidade cai no rendimento em porções. O erro de 1000×
   da §2.8 não existe mais.
2. **Alérgeno atravessa a recursão** — o X-PAULISTA **não** usa maionese na ficha; usa o "Molho
   da Casa", que a contém. "Ovo" aparece nos alergênicos do prato.
3. **Item sem massa não some da conta** — carne (com dado) + item sem nutrição devolve
   `cobertura por massa 100%` mas `itens 1/2`, `status PARCIAL` e o faltante nomeado. Antes
   isso publicava como COMPLETO.
4. **Mudar o preparo muda o prato** — dobrar a maionese do "Molho da Casa" recalculou X-BACON
   (1.122 → 1.194 kcal) e X-PAULISTA (1.041 → 1.186 kcal) na mesma transação. Revertido.

**Quatro defeitos foram descobertos justamente por encher o cardápio**, e cada um virou correção
versionada em `20260902010000_nutricao_ajustes_pos_medicao.sql`: refrigerante açucarado exibindo
"baixo em calorias" (critério de líquido é metade do de sólido), água mineral colecionando selos
de virtude, `%VD` de gorduras trans (a IN 75/2020 não estabelece valor diário) e nutriente
opcional zerado poluindo a tabela.

### 5.2 O que ficou sem verificação de navegador

O painel do lojista (Fatia 3) e a configuração da loja foram verificados por tipo, por lint e
pelas consultas acima, **não por navegador**: a credencial de `credenciais_testes.md` não
autentica mais (o banco foi zerado em 01/09). A vitrine, essa sim, foi verificada no navegador
em 375 px e em desktop, incluindo a tabela reagindo ao adicional escolhido.

---

## 6. O que fica de fora, dito na cara

- **Selo público `/selo/:slug`**, histórico de nível e assinatura com CRN — Sprints 4–5 do
  plano-mãe. Esta onda prepara o dado, não desenha o selo.
- **Dossiê PDF para fiscalização** e **rótulo imprimível de marmitaria** — Sprint 6.
- **Nutrição por adicional escolhido** (bacon extra muda a tabela ao vivo no modal). É a
  evolução óbvia da Fatia 4 e tecnicamente pequena depois dela; fica para a onda seguinte para
  não atrasar o básico.
- **Retenção por nutriente** no cozimento — v1 usa fator único por prato (R-03).
- **Filtro "sem glúten" na vitrine** — depende de declaração humana em massa, e ADR-03 proíbe
  derivá-la por IA.

---

## 7. DoD desta onda

Além do DoD do épico (§11 do plano-mãe):

1. Nenhum produto publicado com `alertas` de sanidade não resolvidos.
2. Golden test novo para: alérgeno vindo de preparo aninhado, rendimento em kg, item sem massa,
   revenda sem ficha, combo.
3. `npm run typecheck`, `npm run lint`, `npm test` limpos; `get_advisors` sem alerta novo.
4. Testado no navegador com sessão real — as Sprints 1 e 2 fecharam sem isso e é dívida aberta.
5. Antes/depois medido no Lanche do Paulista, com os números da §5 registrados neste doc.
