# Domínio canônico: `https://miseon.app.br`

`vercel.json` é JSON estrito e o schema da Vercel recusa chave desconhecida
dentro de um `redirect` — por isso a explicação mora aqui e não lá.

## A regra

```jsonc
{
  "source": "/((?!api/).*)",
  "has": [{ "type": "host", "value": "www.miseon.app.br" }],
  "destination": "https://miseon.app.br/$1",
  "permanent": true
}
```

Tudo que chegar em `www` sai com **308** para o apex. O apex já era o canônico
declarado no `<link rel="canonical">` do `index.html` e no
`scripts/prerender.mjs` (`const BASE`) — o redirect só faz o servidor concordar
com o que o HTML sempre disse.

## Por que

Até 11/09/2026 o site respondia **idêntico nos dois hosts, sem redirect**. Isso
não é detalhe de SEO:

- conteúdo duplicado para busca, com os dois hosts competindo entre si;
- sessão e cookie separados por host — logar num não loga no outro;
- quebra silenciosa em toda integração que valida domínio.

O custo apareceu no mesmo dia: conectar o WhatsApp com o painel aberto em
`www.miseon.app.br/admin/whatsapp` mandava para a Meta um `redirect_uri` que não
está em "URIs de redirecionamento OAuth válidos" do app. A resposta foi **"URL
bloqueado"**, sem dizer qual URL nem por quê. Pareceu integração quebrada; era o
endereço na barra. (O `redirectUri()` em `src/pages/admin/WhatsApp.tsx` também
passou a usar o host canônico, para não depender só do redirect.)

## Por que `/api/` fica de fora

Lá existe rota **POST** (`api/fiscal-proxy-nfse.ts`). O 308 preserva método e
corpo, mas nem todo cliente máquina-a-máquina segue redirect em POST. Deixando
`/api/` sem redirect, uma integração apontada para o `www` continua sendo
atendida direto, em vez de falhar de um jeito difícil de diagnosticar.

## Ao cadastrar URL em serviço externo

Use sempre o apex, sem `www`: Meta/WhatsApp, Efí, iFood, Search Console,
webhooks. Se um serviço já estiver cadastrado no `www`, migre — o 308 cobre
navegador, não cobre todo cliente de API.
