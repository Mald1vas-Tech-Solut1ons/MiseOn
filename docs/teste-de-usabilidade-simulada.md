# Teste de usabilidade simulada — MiseOn

**Data:** 18/09/2026 · **Alvo:** `https://miseon.app.br` em produção · **Commit:** `f8e8af0`

## Como este teste foi feito

Cinco perfis percorreram o produto sem conhecimento prévio. O que dá para
percorrer sem senha foi **percorrido de verdade no navegador**; o que está atrás
do login foi **lido no código**, porque não há credencial de lojista disponível
nesta máquina.

Cada achado abaixo traz a origem:

- **[medido]** — observado ao vivo, com número.
- **[código]** — lido no repositório, com arquivo e linha.

Nada aqui é suposição de comportamento. Onde eu não pude verificar, está
escrito que não pude.

**Limite declarado:** ninguém completou cadastro real, configuração, cadastro de
produto ou primeiro pedido — isso exigiria criar conta em produção. Os passos 3
a 6 do roteiro foram avaliados pelo código do fluxo, não pela execução.

---

## O que funciona bem (para não consertar o que não está quebrado)

Antes das falhas, o que os cinco perfis encontrariam de bom:

- **Suporte real e visível** [medido]: WhatsApp, `suporte@miseon.app.br`,
  `contato@miseon.app.br` e 7 perguntas frequentes, incluindo "Posso cancelar
  quando quiser?". Rodapé com CNPJ e cidade. Isso é mais do que muita
  concorrente entrega.
- **Assistente de configuração existe** [código]
  (`StoreSetupWizard.tsx:23`): 5 passos obrigatórios — identidade, primeiro
  produto, pagamento, horários, divulgar — e 2 opcionais (iFood, WhatsApp).
  É onboarding de verdade, orientado a ativação.
- **Honestidade em dois pontos difíceis** [medido]: a calculadora diz "Não é
  promessa de economia, é o tamanho do problema que você mesmo estimou", e a
  foto do totem diz "Cena ilustrativa". Não há depoimento inventado.
- **Trial sem cartão** [código]: `lojas.trial_termina_em` existe e
  `src/lib/assinatura.ts` avalia. A promessa tem lastro.

---

## Perfil 1 — Hamburgueria com delivery e dois funcionários

**Entende o produto?** Em parte. O selo acima do título diz "SISTEMA DE GESTÃO E
OPERAÇÃO PARA RESTAURANTES", mas o H1 é uma pergunta sobre lucro, não uma frase
sobre o que o produto é. Ele entende o *problema* em 5 segundos; o *produto*,
não.

**Cria conta?** Clica em "Cadastrar minha loja", cai em `/cadastre-se`, que tem
**zero campos** e um botão. O botão leva a `/admin/login`, que diz **"Bem-vindo
de volta — Entre para gerenciar sua operação"**. [medido]

> Aqui ele hesita. Ele nunca esteve aqui. Não existe "criar conta".

**Configura a operação?** O cadastro pergunta se ele faz entregas e qual o
modelo (fixo/freelancer). Ele responde. Nenhum passo do assistente trata de
entrega ou taxa. [código]

**Preço?** Só a 84% da página — depois de ~50 telas. [medido]

**Desistiria:** na tela de login que diz "bem-vindo de volta".
**Confiaria:** vendo o próprio cardápio no ar com um produto seu.
**Iria ao concorrente:** qualquer um com "Criar conta grátis" visível.

---

## Perfil 2 — Lanchonete de balcão e WhatsApp

**O que ele procura:** WhatsApp. A home promete "IA no WhatsApp (API Meta)" logo
no primeiro bloco e o FAQ responde "A IA fecha pedidos sozinha no WhatsApp?".
[medido]

**Fricção:** o WhatsApp é passo **opcional** do assistente, o último da lista
[código] (`StoreSetupWizard.tsx`, `id: 'whatsapp'`, `obrigatorio: false`) — para
ele é o motivo da compra, não um extra. E o cadastro nunca pergunta se ele vende
por WhatsApp, embora pergunte sobre salão e entrega.

**Preço:** ele é o menor ticket dos cinco. O plano único de R$ 169,90/mês
(R$ 149,90 no anual) [medido] não tem degrau para quem só quer balcão e
WhatsApp.

**Desistiria:** ao descobrir que paga pelo pacote inteiro.
**Confiaria:** vendo a IA responder no número dele antes de assinar.
**Iria ao concorrente:** Anota AI, que nasce dessa dor específica.

---

## Perfil 3 — Restaurante com salão e quatro garçons

**Fricção central:** no cadastro ele marca "Atendo no salão com garçom" e
informa 4 funcionários. Depois disso, **nenhuma das duas respostas é usada para
configurar nada**. [código] — as colunas `atende_salao_garcom`, `faz_entregas` e
`qtd_funcionarios` aparecem em exatamente **um** lugar fora do formulário:
`src/pages/superadmin/Tenants.tsx:458-466`, a tela do **superadmin**. Ou seja:
são coletadas para o vendedor ver, não para montar a operação do cliente.

O assistente é uma lista estática [código] (`StoreSetupWizard.tsx:178` filtra só
por `obrigatorio`, nunca por segmento ou perfil): ele recebe os mesmos 7 passos
que um dark kitchen sem salão. Nenhum passo cria mesas ou convida garçom, apesar
de existirem as telas `Mesas.tsx` e `PainelGarcomMobile.tsx`.

Isso contradiz o princípio escrito no próprio documento de engenharia do
produto: "a máquina infere, o usuário confirma".

**Desistiria:** ao terminar o assistente e ainda não ter mesa nem garçom.
**Confiaria:** se ao marcar "salão com garçom" o sistema já perguntasse quantas
mesas e oferecesse o convite para os quatro.
**Iria ao concorrente:** Saipos ou GrandChef, que vendem salão como carro-chefe.

---

## Perfil 4 — Pizzaria de alto volume

**O que ele encontra:** `/sistema-para-pizzaria` fala de KDS de forno, taxa por
raio/bairro, iFood e custeio de massa e molho da casa. É uma página honesta: não
promete o que o produto não faz. [código] (`landingPagesData.ts`)

**Onde trava:** a primeira pergunta de qualquer pizzaria é **meio a meio** — e o
site não responde. O termo aparece no blog do MiseOn, em artigo chamado
"Engenharia para Pizzarias: Como Gerenciar Pedidos Meio a Meio" [código]
(`blogData.ts:779`), mas **não existe no fluxo de pedido nem no schema**: zero
ocorrências em `PDV.tsx`, `Cardapio.tsx` (público e admin), `components/pdv/` e
nas migrations. [código]

Não é propaganda enganosa — é conteúdo educativo. Mas o leitor sai do artigo
achando que o sistema resolve, e não há nada no site que diga sim ou não.

**Segundo ponto:** as landings de nicho exibem métricas como
`value: '100%'` — seis ocorrências no arquivo [código]
(`landingPagesData.ts`). Número redondo sem origem, num público que desconfia de
promessa.

**Desistiria:** na dúvida não respondida sobre meio a meio.
**Confiaria:** vendo uma pizza meio a meio sendo montada, precificada e baixada
do estoque.
**Iria ao concorrente:** qualquer sistema que mostre meio a meio em 30 segundos.

---

## Perfil 5 — Administrador de duas unidades

**Este é o pior caso dos cinco.**

**Não há como operar duas lojas.** [código] `AdminLayout.tsx:185-211` busca
todos os vínculos do usuário e faz `const ativo = rels[0]` — pega o primeiro.
Não há `.order()` na consulta e não há seletor de loja em lugar nenhum do
painel. Consequência: ele entra, vê **uma** unidade, não tem como trocar, e qual
delas aparece depende da ordem que o Postgres devolver — pode mudar entre um
login e outro.

**O site não avisa.** O plano único não menciona unidade adicional; não há preço
por loja nem indicação de limite. Ele descobre depois de pagar.

**Desistiria:** no primeiro login, ao não achar a segunda unidade.
**Confiaria:** com um seletor de unidade no topo e um painel consolidado.
**Iria ao concorrente:** Consumer ou Saipos, que tratam rede como caso normal.

---

## Problemas, classificação, correção e medição

### CRÍTICO

| # | Problema | Evidência |
|---|---|---|
| C1 | "Cadastrar minha loja" leva a uma tela de **login** que diz "Bem-vindo de volta". Não existe opção de criar conta: `signUp` só é usado para o **cliente final** (`ModalAuthCliente.tsx:36` — única ocorrência no projeto). Para o lojista há Google OAuth, senha e link mágico. O cadastro **está habilitado** no projeto (`disable_signup = false`, medido na Management API) e `signInWithOtp` cria o usuário por padrão — ou seja, **a capacidade existe e quem esconde é a interface**. Quem chega por e-mail e não quer usar Google não descobre isso em lugar nenhum. | [medido] + [código] |
| C2 | Quem tem duas unidades fica preso na primeira: `AdminLayout.tsx:211` usa `rels[0]`, sem ordenação e sem seletor de loja. | [código] |

**C1 — correção:** separar cadastro de login. Em `/cadastre-se`, formulário
próprio (nome, e-mail, senha) chamando `supabase.auth.signUp`, ou, mantendo o
link mágico, trocar o texto para "Criar conta / Entrar" e rotular o botão como
"Receber link para criar minha conta". A tela nunca deve dizer "bem-vindo de
volta" para quem chega de `/cadastre-se`.
**Como medir:** taxa `clicou em Cadastrar → chegou no assistente` (hoje não
medida, depende do evento `start_signup`); e contagem de `auth.users` criados
por dia. Alvo: sair de zero conta nova por semana.

**C2 — correção:** ordenar a consulta (`.order('criado_em')`) e adicionar
seletor de unidade no cabeçalho quando `rels.length > 1`, guardando a escolha.
Enquanto não houver seletor, mostrar aviso explícito ao usuário com mais de um
vínculo, em vez de escolher em silêncio.
**Como medir:** consulta em `usuarios_loja` por `user_id` com mais de uma loja
(hoje: verificar quantos existem); e teste de regressão que falha se
`AdminLayout` voltar a usar índice fixo.

### ALTO

| # | Problema | Evidência |
|---|---|---|
| A1 | CPF/CNPJ e razão social obrigatórios **antes** de ver o produto (`TornarSeLojista.tsx:53-58`), enquanto a home promete "Crie sua conta em 3 minutos" e "Zero Cartão no Cadastro". | [código] + [medido] |
| A2 | O perfil operacional coletado no cadastro (`atende_salao_garcom`, `faz_entregas`, `qtd_funcionarios`) é lido **apenas** em `superadmin/Tenants.tsx:458-466`. Não configura nada para o cliente. | [código] |
| A3 | O preço aparece a **84% da página**; a home tem **58,7 telas** de rolagem no desktop e **53,4** no celular. | [medido] |

**A1 — correção:** mover CPF/CNPJ e razão social para o momento em que são
necessários (emissão fiscal ou primeira cobrança). Para começar o trial bastam
nome da loja e segmento.
**Como medir:** conclusão do formulário por etapa (abandono na etapa 1 vs 2 vs
3). Alvo: reduzir abandono da etapa 1.

**A2 — correção:** derivar os passos do assistente do perfil informado — salão
com garçom acrescenta "Criar mesas" e "Convidar garçom"; entregas acrescenta
"Definir taxa de entrega". `PASSOS_WIZARD` passa a ser filtrado por perfil, como
já é por `obrigatorio`.
**Como medir:** % de lojas com salão que criam ao menos uma mesa nos 7 primeiros
dias; % de lojas com entrega que configuram taxa.

**A3 — correção:** bloco de preço logo após o herói (resumo com valor e "30 dias
grátis"), mantendo o detalhamento embaixo; e cortar a home — hoje ela repete a
mesma dor em quatro blocos (alerta de margem, calculadora, comparativo, tabela
de realidade).
**Como medir:** profundidade de rolagem até o bloco de preço e cliques no CTA de
preço (depende de analytics, hoje inexistente).

### MÉDIO

| # | Problema | Correção | Medição |
|---|---|---|---|
| M1 | Plano único (R$ 169,90/mês; R$ 149,90 anual) sem degrau para lanchonete de balcão nem preço para unidade adicional [medido] | Definir preço por unidade adicional e decidir se haverá plano de entrada. Se não houver, dizer na página de planos. | Perguntas sobre preço no WhatsApp; % de leads que citam "caro" |
| M2 | **37 alvos de toque menores que 32px** na home em 375px [medido] | Piso de 44px em links e botões do site público | Repetir a medição; alvo: zero |
| M3 | Números não medidos no material: "Aumente o Ticket Médio em 28%", "Reduza até 35% do tempo de preparo", seis métricas `'100%'` nas landings [código] | Trocar por número medido com fonte, ou por afirmação qualitativa. É a regra que o próprio `CLAUDE.md` estabelece | Auditoria: zero número sem fonte no site |
| M4 | Assistente não cobre mesas/garçom nem entregas, embora as telas existam [código] | Ver A2 | Ver A2 |
| M5 | Loja nasce vazia: `saas-tornar-se-lojista` não chama `fn_semear_loja`, que existe no banco [código] | Decidir se o segmento semeia categorias/produtos de exemplo — e, se semear, deixar apagar em um clique | Tempo até o primeiro produto cadastrado |

### BAIXO

| # | Problema | Correção | Medição |
|---|---|---|---|
| B1 | "Meio a meio" aparece no blog mas não existe no produto nem no schema [código] | Responder no FAQ o que o sistema faz hoje para pizzaria meio a meio — inclusive se a resposta for "ainda não" | Dúvidas sobre meio a meio no suporte |
| B2 | Bloco do totem Bravus (B2B enterprise, "sob proposta") aparece muito cedo, antes das funcionalidades [medido] | Mover para depois do fluxo do pedido | Rolagem até o bloco de funcionalidades |
| B3 | `/cadastre-se` é uma página inteira só para um botão [medido] | Ou recebe o formulário de cadastro (ver C1), ou o CTA da home aponta direto ao destino | Passos até criar conta: hoje 3 cliques, alvo 1 |

---

## Resumo por perfil

| Perfil | Onde desistiria | Gravidade |
|---|---|---|
| 1. Hamburgueria | Tela de login dizendo "bem-vindo de volta" | Crítico (C1) |
| 2. Lanchonete | Preço único para quem só quer WhatsApp | Médio (M1) |
| 3. Restaurante com garçons | Assistente acaba sem mesa nem garçom | Alto (A2) |
| 4. Pizzaria | Dúvida de meio a meio sem resposta | Baixo (B1) |
| 5. Duas unidades | Primeiro login — a segunda unidade não existe | Crítico (C2) |

**O padrão que atravessa os cinco:** o MiseOn pergunta bem e usa mal a resposta.
Ele coleta segmento, número de funcionários, salão e entrega — e depois entrega
a todos a mesma tela. O produto tem as peças (mesas, garçom, entregas, KDS por
estação); falta ligar a resposta do cadastro à configuração.

**A trava anterior a tudo:** nada disso é mensurável hoje. Não existe analytics
no site (o único GA4 do código é o do lojista, injetado por
`SEO.tsx:135` com o ID dele). Todas as medições propostas acima dependem de
instrumentar o funil primeiro — ver §12 de [auditoria-inicial.md](auditoria-inicial.md).
