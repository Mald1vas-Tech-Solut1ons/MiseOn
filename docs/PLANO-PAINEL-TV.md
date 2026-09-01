# Painel de TV — como funciona, o que foi corrigido, o que falta

Levantamento de 01/09/2026. Tudo aqui foi **medido em produção**, não deduzido.

---

## 1. Como funciona

Uma rota só: `/tv/:slug` → `src/pages/PainelTV.tsx`. A TV do balcão **não faz login** —
o navegador da Smart TV abre a URL pública da loja.

Dois modos, num toggle no cabeçalho:

| Modo | O que mostra |
|---|---|
| **Cardápio 4K** | Carrossel de categorias, 12s cada, com QR do cardápio digital |
| **Painel de Senhas** | Senhas em preparo e prontas, com chamada por voz |

**Dados.** `fn_painel_tv_senhas(slug, token)` — RPC `SECURITY DEFINER`. A tabela `pedidos`
não tem policy de SELECT público (nem deve ter): a RPC devolve só número, status e
primeiro nome. Polling a cada 10s, não Realtime — sem sessão, o Realtime respeita RLS e
nada chegaria.

**Chamada por voz.** O painel guarda um retrato dos pedidos `PRONTO`. Quando um número
aparece que não estava no retrato anterior, ele é anunciado. A primeira carga só registra
o retrato — senão a TV sairia gritando senha antiga ao ser ligada.

---

## 2. A lógica das senhas

**A regra central: número de pedido e senha são coisas diferentes.** Em food service isso
não é preferência, é o padrão — e o MiseOn usava um número só para as duas, o que produzia
"Senha 9279" no painel do balcão.

| | Número do pedido | Senha |
|---|---|---|
| Para que serve | Identidade: fiscal, financeiro, suporte | Chamar no balcão |
| Vive | Para sempre | Um dia de operação |
| Faixa | Cresce sem limite | 1 a 999, volta ao 1 |
| Quem tem | Todo pedido | Só os tipos que a loja escolheu |

**Número** — `fn_proximo_numero(loja_id)` incrementa `loja_sequencias`. Atômico (o UPSERT
toma lock da linha). Nunca zera. Desde 01/09 ele **se autocorrige**: nunca fica atrás do
maior número já emitido pela loja.

**Senha** — `fn_proxima_senha(loja_id, virada)` incrementa `loja_senhas` na chave
`(loja_id, dia_servico)`. Atribuída no `BEFORE INSERT`, só quando `tipo_pedido` está em
`lojas.painel_tv_tipos`. Delivery fica `NULL`: não há ninguém no balcão para ouvir.

**Dia de operação vira às 4h locais**, não à meia-noite (`lojas.senha_virada_hora`,
configurável 0–12). Bar e hamburgueria faturam depois da meia-noite e aquele pedido
pertence ao serviço da véspera — é como a casa conta o próprio dia.

**iFood.** O `displayId` (o número que o cliente vê no app deles) mora em
`pedidos.ifood_display_id` e aparece na comanda. O `numero` vem sempre da nossa sequência.

---

## 3. O que estava errado (corrigido em 01/09/2026)

| # | Defeito | Consequência real |
|---|---|---|
| 1 | RPC não filtrava por tipo de pedido | Os 27 pedidos de iFood do Natureba, todos DELIVERY, entrariam no painel e seriam **anunciados em voz alta** — "retire no balcão" — para quem está em casa esperando entregador |
| 2 | Janela era `date_trunc('day', now())` com banco em UTC | Às **21h de Brasília**, no meio do jantar, o painel apagava a noite inteira. Pedido feito 20:45 e pronto 21:10 deixava de ser retornado pela consulta e **nunca era anunciado** |
| 3 | `displayId` do iFood gravado em `pedidos.numero` | Índice único `(loja_id, numero)` rejeita o INSERT quando o displayId bate com um número já emitido. A função levanta exceção, o webhook não confirma, o iFood reentrega e **falha de novo, para sempre**. Pedido que nunca chega na cozinha. Reproduzido com displayId 26 |
| 4 | Contador da loja podia ficar atrás da realidade | Natureba: contador em 6, pedidos até 9279. A próxima venda de balcão tentaria emitir 7 — que já existia — e **travaria o caixa** |
| 5 | Senha era o número do pedido | Lanche do Paulista mostraria "Senha 241" com 26 pedidos reais (o contador avança até em insert que falha) |
| 6 | Modo do painel era `useState` puro | Queda de energia, atualização ou screensaver devolvia a TV ao cardápio. Quem escolheu senhas descobria pelo cliente reclamando |
| 7 | Falha de voz era silenciosa | Sem síntese de voz no aparelho, o banner aparecia e o ícone ficava verde como se falasse. Ninguém era chamado |
| 8 | `BANNERS` no tipo `ModoExibicao` | Nunca implementado — nem botão, nem render. Tipo mentindo sobre o que a tela faz |

**Verificação end-to-end em produção:** pedido de balcão → senha 1; mesa → senha 2;
delivery → nenhuma. A RPC devolveu só 1 e 2. A TV em `/tv/lanchepaulista` exibiu `#1`.
Pedido de iFood com `displayId` 26 contra um pedido 26 existente: criado com número 243,
sem colisão. Dados de teste removidos.

---

## 4. O que falta — plano

### P1 · Token do painel não tem como ser configurado

`fn_painel_tv_senhas` aceita `?token=` e `lojas.painel_tv_token` existe, mas **não há UI
para gerar ou ver esse token**, e o link que o lojista copia não o inclui. Na prática o
recurso é inalcançável e **nenhuma loja tem token** — o painel é público por slug, expondo
números de pedido e primeiro nome de clientes a quem souber o slug.

*Plano:* botão "Gerar token do painel" na tela da Loja, que grava o UUID e passa a montar
os dois links já com `?token=`. Migração precisa lidar com a TV já instalada sem token —
por isso a RPC hoje só exige token quando ele existe. Ao gerar, avisar que os links
antigos param de mostrar senhas.

### P2 · Nenhum teste automatizado cobre a senha

Validei manualmente em produção. Não há teste que trave a regra — a próxima mudança em
`fn_trg_numero_pedido` pode quebrar a atribuição sem ninguém perceber.

*Plano:* teste de integração cobrindo (a) balcão e mesa recebem senha, delivery não;
(b) senha zera na virada do dia de operação; (c) volta ao 1 depois de 999; (d) pedido de
iFood com `displayId` colidente é criado sem erro.

### P3 · Voz na TV real não foi verificada

Medido: funciona em Chromium desktop sem gesto do usuário, 2 vozes. **Isso não prova nada
sobre Tizen, webOS ou Android TV.** O código agora detecta ausência de voz e avisa na tela
("Chamada apenas visual neste aparelho"), então o pior caso é honesto — mas continua sendo
suposição até rodar num aparelho de verdade.

*Plano:* testar numa Smart TV antes da primeira instalação. Se não houver voz pt-BR,
considerar tocar um gongo curto em `<audio>` antes do banner — áudio simples tem suporte
muito mais amplo que síntese de fala.

### P4 · Latência de até 10s na chamada

Polling de 10s. Entre a cozinha marcar PRONTO e a TV anunciar podem passar 10 segundos.
Aceitável, mas é bom o lojista saber que não é instantâneo.

*Plano:* só mexer se incomodar na operação. Realtime exigiria sessão na TV (hoje ela não
loga), o que é mais superfície de risco do que ganho.

### P5 · Colisões históricas de número

18 pedidos no Lanche do Paulista e 4 no Natureba compartilham número com outro pedido da
mesma loja. **Todas anteriores a 22/07/2026**, antes do índice único existir — por isso o
índice é parcial (`WHERE criado_em >= '2026-07-22'`). Não afeta operação nova.

*Plano:* como é tudo dado de teste pré-lançamento, limpar antes do primeiro cliente real e
então remover a cláusula parcial do índice, deixando a regra valer para toda a tabela.
