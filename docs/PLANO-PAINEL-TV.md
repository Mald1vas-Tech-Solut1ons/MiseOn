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
primeiro nome. **Polling, não Realtime** — sem sessão, o Realtime respeita RLS e nada
chegaria. A cadência acompanha o modo: 4s no painel de senhas (é o atraso entre a cozinha
marcar PRONTO e o cliente ser chamado) e 15s no cardápio.

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

> Atualizado em 01/09/2026 depois da segunda rodada. P1, P4 e P5 fechados; P3 mitigado
> em código, falta só o teste no aparelho; P2 é o único ainda inteiro.

### ~~P1 · Token do painel não tem como ser configurado~~ — FECHADO

`painel_tv_token` passou a ter `default gen_random_uuid()` e todas as lojas receberam o
seu. A RPC já recusava sem token quando ele existia, então o painel deixou de ser público
no mesmo movimento — verificado: sem token a chamada levanta exceção, com o token certo
responde. Os dois links na tela da Loja saem com `?token=`, e há botão para gerar
credencial nova com aviso de que isso derruba as TVs já instaladas.

### P2 · Nenhum teste automatizado cobre a senha — ABERTO

Validado manualmente em produção, mas nada trava a regra. A próxima mudança em
`fn_trg_numero_pedido` pode quebrar a atribuição sem ninguém perceber.

*Plano:* teste de integração cobrindo (a) balcão e mesa recebem senha, delivery não;
(b) senha zera na virada do dia de operação; (c) volta ao 1 depois de 999; (d) pedido de
iFood com `displayId` colidente é criado sem erro; (e) `fn_proximo_numero` nunca reemite
número existente.

### P3 · Voz na TV real — MITIGADO, falta o teste no aparelho

Síntese de voz é o recurso menos suportado da pilha e depende de voz instalada. Agora há
três camadas, da mais frágil para a mais robusta: **fala** → **gongo** (dois tons via Web
Audio, não depende de voz nem de arquivo) → **banner visual**, que sempre funciona. Se não
houver voz, a TV avisa na tela em vez de fingir que está chamando.

*Plano:* ainda assim, testar numa Smart TV antes da primeira instalação. O que resta saber
é se o Web Audio responde sem gesto do usuário naquele navegador.

### ~~P4 · Latência de até 10s na chamada~~ — FECHADO

A cadência passou a acompanhar o modo: **4s no painel de senhas**, 15s no cardápio. No
painel o intervalo é o atraso entre a cozinha marcar PRONTO e o cliente ser chamado; no
cardápio ninguém está esperando chamada e não há motivo para dobrar a carga.

### ~~P5 · Colisões históricas de número~~ — FECHADO

As 30 linhas com número repetido foram renumeradas (a mais antiga de cada grupo manteve o
número; as demais foram para cima do maior da loja, preservando a cronologia) e o índice
`uq_pedidos_loja_numero` deixou de ser parcial: agora vale para a tabela inteira. A
migração tem trava — se sobrar qualquer colisão, ela falha em vez de deixar o índice cair
de volta para parcial.

---

## 5. Onde o lojista aprende isso

O tour guiado ganhou o **Módulo 11 — TV do Salão**, com três passos: os dois links e qual
usar em cada TV; quem é chamado e por que delivery fica de fora; e o que é o código no fim
do link. A tela da Loja explica a credencial no próprio lugar onde o link é copiado —
porque o erro previsível é copiar a URL da barra do navegador da TV, sem o token, e o
painel parar de mostrar senhas sem explicação.
