# MiseOn — o que saber antes de tocar em qualquer coisa

Sistema de gestão para food service. React 19 + Vite + TS no front, Supabase
(Postgres + RLS + Edge Functions) no back, deploy na Vercel.

Este arquivo existe para a sessão não redescobrir no braço o que já se sabe.
Se você gastou tempo procurando algo que deveria estar aqui, acrescente.

---

## 1. Regras que não se quebram

**`main` é a branch.** Não existe `master`.

**Push publica na hora.** A Vercel publica no instante do push e o CI não
segura nada. Rode `npm run build` e `npx vitest run` ANTES de empurrar, não
depois.

**Nunca grave nem mexa no tenant `natureba`.** Não é cliente pagante — ainda.
É o cadastro preparado para a visita comercial que ainda não aconteceu (zero
pedidos processados, medido em 15/09/2026), e é essa tela que o dono vai ver.
Mexer nela queima a primeira impressão. O tenant de provas é `lanchepaulista`
— é nele que se testa, se grava vídeo e se tira print.

**Não existe cliente pagante.** Nenhum depoimento, print de cliente, logotipo
de loja ou "+X restaurantes" pode aparecer em material de marketing.

**Anúncio (AdSense) só no blog.** O snippet não vai no `index.html`: de lá
ele desce para o `app.html`, que é o shell do /admin, do KDS e do cardápio
da loja. O loader entra por `src/lib/adsense.ts` — prerender no HTML
estático de `/blog*` e `<AdSenseBlog />` na navegação da SPA. O build
falha se ele vazar para outra rota.

As áreas já estão posicionadas (`<AdSlot />` no meio do artigo, no fecho e
no hub). Para ligá-las, cole o `data-ad-slot` em `ADSENSE_SLOTS` — campo
vazio é área desligada, e o Auto Ads segue preenchendo sozinho. Sem
consentimento de marketing o anúncio vai não personalizado, nos dois sinais
que o Google lê (`requestNonPersonalizedAds` e Consent Mode v2). No EEE,
Reino Unido e Suíça quem pergunta é a CMP do Google: nosso banner se cala e
escuta (`src/lib/cmpTcf.ts`).

**Lead só entra por `registrarLead` (`src/lib/leads.ts`).** Até 17/09/2026 a
tabela `leads` tinha zero linhas: o `/contato` gravava colunas que não existem e
o formulário do Kiosk mandava segmento que o CHECK recusa e mostrava sucesso
assim mesmo. Formulário novo chama a função e, se ela devolver `false`, mostra
o WhatsApp com `whatsappDoLead`.

**Ferramentas grátis (`/ferramentas`) não dependem do banco.** Conta em
`src/lib/ferramentas.ts`, texto bilíngue em `src/data/ferramentasData.ts`. Nova
ferramenta = dado + calculadora em `FerramentaPage.tsx` + rota em `App.tsx` +
entrada em `scripts/public-routes.mjs`. Nada de número de mercado sem fonte.

**Leia a função em produção antes de reescrever.** `pg_get_functiondef` é a
verdade; a migration versionada pode estar defasada nos dois sentidos. Isso já
mordeu mais de uma vez.

**Não afirme número que não foi medido.** O produto não tem cliente medido:
qualquer "-30% de desperdício" ou "aumenta X% as vendas" é risco, não
argumento. Se não dá para mostrar a consulta, não vai para a tela nem para o
vídeo.

---

## 2. Onde as coisas estão

| O quê | Onde | Cuidado |
|---|---|---|
| Marca oficial | `public/MiseOn brand identity/entrega/` | **Use esta.** README lista tokens e fontes |
| Assets da marca | `public/brand/` | `icon.png`, `logo-horizontal.png`, peças da animação |
| Logo que o app renderiza | componente `MiseOnLogo` | aponta para `/MiseOn-repagina-removebg-preview.png` |
| Material de marketing | `output/marketing/` | **Olhe antes de produzir** — já tem kit de Instagram, panfletos, planos |
| Prints de tela | `output/marketing/prints/` e `public/images/telas-reais/` | |
| Motor de ativos (vídeo/carrossel) | `scripts/ativos/` + `scripts/gerar-*.mjs` | HTML no Chrome via puppeteer |
| Provas SQL | `supabase/tests/` | rodam em produção sem gravar nada |
| Seeds | `supabase/seeds/` | idempotentes |

**`logo.png` na raiz do repositório é antigo e o app não referencia em lugar
nenhum.** Não use.

### Tokens da marca

| Token | Hex | Uso |
|---|---|---|
| `--miseon-azul` | `#004198` | base |
| `--miseon-azul-claro` | `#0A5CC4` | realce |
| `--miseon-laranja` | `#FC5B24` | ação, destaque |
| `--miseon-tinta` | `#070C18` | fundo escuro |
| `--miseon-nevoa` | `#EAF1FB` | texto claro |

Fontes: **Sora** (títulos), **Manrope** (texto), **JetBrains Mono** (rótulos).

---

## 3. Como aplicar SQL

Não há psql, CLI da Supabase nem Docker nesta máquina. Use a **Management API**
com o PAT que está em `.env.local` (`SUPABASE_ACCESS_TOKEN`):

```
POST https://api.supabase.com/v1/projects/zzuxklwhaoisuuvndtfw/database/query
{"query": "..."}
```

Ou as ferramentas MCP da Supabase (`execute_sql`, `apply_migration`).

**A API devolve só o resultado da ÚLTIMA instrução.** Se precisar de vários
resultados, faça várias chamadas.

**Barra invertida se perde no caminho.** `\d` num regex chega como `d` literal
e nada casa — em silêncio. Use classes POSIX: `[0-9]`, `[[:space:]]`.

`.env.local` aponta para **produção**. Não existe ambiente de staging.

---

## 4. Armadilhas de PL/pgSQL já encontradas

- `record := NULL` deixa a variável **não atribuída**; a leitura seguinte
  levanta `record "x" is not assigned yet`. Use uma flag booleana.
- Expressão `CASE` vira **uma** consulta SQL e resolve os campos de todos os
  ramos — `NEW.pedido_id` num ramo estoura no gatilho de outra tabela. Use
  `IF`/`ELSIF` aninhados.
- `OLD` não existe no INSERT e `NEW` não existe no DELETE: cada referência
  precisa estar dentro do ramo de `TG_OP` que a torna válida.
- `UPDATE OF coluna` dispara pela coluna estar na instrução, mesmo sem mudar de
  valor. Gatilho que grava na própria tabela precisa de guarda de recursão.
- `revoke ... from anon` não basta: se `PUBLIC` tem o grant, `anon` herda.
  Confira `proacl` — um `=X` inicial é o PUBLIC.
- E o contrário também: `revoke ... from public` **não** tira o `anon`. Este
  projeto tem `DEFAULT PRIVILEGES` (`pg_default_acl`) dando ALL/EXECUTE a
  `anon` e `authenticated` **diretamente** em toda tabela, view e função nova
  de `public`. Ou seja: **view criada é view publicada**, e função criada é
  função exposta em `/rest/v1/rpc/`. Para fechar de verdade é preciso revogar
  dos três — `public`, `anon`, `authenticated` — e reconceder a quem precisa.
  Já mordeu duas vezes em 16/09/2026, nas duas direções.
- View de dado sensível pendurada em tabela pública não se protege com
  `security_invoker`. `pub_produtos` libera produto disponível para o mundo
  (é o cardápio, está certo), então qualquer view de custo/margem sobre
  `produtos` herda isso. Carregue o predicado de acesso (`fn_meu_acesso`)
  dentro da própria view.
- Função `SECURITY DEFINER` que recebe `loja_id` por parâmetro precisa
  perguntar `fn_meu_acesso(p_loja_id)` no corpo. DEFINER ignora RLS: sem a
  guarda, troca-se o uuid e lê-se a loja do concorrente.
- `CREATE OR REPLACE VIEW` não muda o tipo de uma coluna existente. Derrube e
  recrie.

---

## 5. Domínio: o que já está decidido

**Custo e margem**
- `qtd_embalagem` é o número que decide o custo de tudo. Cascata de origem:
  `USUARIO > CATALOGO > RENDIMENTO > DESCRICAO > IA`. A correção do lojista
  **nunca** é sobrescrita por leitura automática.
  Ponto único de escrita: `fn_definir_embalagem_insumo`.
- `fn_custo_unitario_insumo` devolve custo **e veredito de confiança**. Quem
  consome deve respeitar `confiavel = false` em vez de publicar o número.
  Margem incerta vem NULA com o motivo — nunca um percentual inventado.
- Custo de preparo sobe da ficha dele, recursivo, teto de 5 níveis.
- Venda por peso conserva o preço praticado do quilo: o item da balança entra
  sem `produto_id` de propósito. Não reprecifique por `produtos.preco`.

**Rendimento**
- `rendimento_pct` aceita **ganho** (arroz cozido = 2,5×), não só perda.
- Ordem de confiança: `MEDIDO_LOJA > REFERENCIA_INGREDIENTE >
  REFERENCIA_CATEGORIA > USUARIO`. O que a loja mediu vence a tabela.
- Gás e mão de obra ficam na OS, nunca no custo do lote.

**Pedido e dinheiro**
- O desconto é decidido no servidor, por gatilho diferido. O que o navegador
  manda não vale.
- `fn_validar_item_pedido_catalogo` força `preco_unitario` pelo catálogo no
  INSERT. O subtotal já é confiável; não precisa reprecificar.
- Pedido de mesa exige o token do QR (equipe da loja entra pelo vínculo).
- Pedido do iFood carrega o preço COM markup do canal — não reprecifique.
- `FINALIZADO` é terminal: não sai nem re-entra.

**Senha ≠ número do pedido.** Colunas separadas. Senha zera às 4h e delivery
não tem. Nunca grave o `displayId` do iFood em `numero`.

---

## 6. Antes de empurrar

```bash
npx tsc -b --noEmit && npx vitest run && npm run build
```

Os guardas de i18n reprovam texto novo sem tradução, e é de propósito:
- `tDynamic('...')` exige entrada em `MAPA_TRADUCAO_TEXTO` (`src/data/i18nData.ts`)
- texto solto no JSX tem teto e não pode crescer — envolva em `tDynamic`
- tradução com apóstrofo precisa de aspas duplas no valor

Husky + lint-staged rodam `eslint --fix` no commit e **abortam** se houver erro.
