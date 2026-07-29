<div align="center">

<img src="public/logo.png" alt="MiseOn" width="420"/>

### Sistema Inteligente para sua Cozinha

**Cardápio digital · Pedidos em tempo real · Pix na plataforma · Entrega · Estoque com ficha técnica**

[![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](#)
[![Efí Bank](https://img.shields.io/badge/Efí_Bank-PIX-F36F21?style=flat-square)](https://sejaefi.com.br)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)
[![CI/CD](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=github-actions&logoColor=white)](#)

*Multi-tenant desde a primeira linha: uma instância, várias lojas — `/natureba`, `/sua-loja`, cada uma com sua marca, seu cardápio e seu estoque.*

</div>

---

## 📖 Sobre

> 🧠 **Novo no projeto?** Leia a nossa [Documentação de Arquitetura](docs/ARCHITECTURE.md) (Diagrama C4, RLS, Fluxo Pix) para entender o sistema em <30 minutos antes de contribuir.
O **MiseOn** é uma plataforma SaaS para lanchonetes, restaurantes e delivery que substitui sistemas como o Anota AI com um diferencial que eles não entregam bem: **controle de estoque com baixa automática por ficha técnica e visão de custo/lucro por produto**.

O cliente pede pela vitrine (link próprio da loja), o dono recebe em tempo real no painel (PWA instalável no celular, com som e notificação), imprime a comanda térmica, gerencia a entrega — e a cada pedido aceito o estoque de insumos baixa sozinho, alimentando a lista de compras e o custo real de cada item vendido.

> Evolução consolidada de quatro projetos: o motor de custo/ficha técnica do **mise**, o padrão público+admin+Supabase do **lagoon**, o módulo de entrega e o ledger de estoque do **mercadinhosys** e a integração Pix Efí do **MySuperStore**.

## ✨ Funcionalidades

| Módulo | Recursos |
|---|---|
| 🪑 **Salão 3D & Assentos** | Engine **Three.js WebGL** interativa para visualização 3D de salão, assentos numerados por mesa, cronômetro de permanência do cliente e 3 modalidades de comanda fracionada (por cadeira, igualitária ou valor parcial). |
| ⚖️ **Balança Buffet & Quilo** | Driver modular **MiseOn Scale Engine** com suporte a **Web Serial API (cabo USB/RS-232)**, **TCP/IP Rede** e **Emulador**. Vínculo direto do peso líquido com desconto de tara para comanda individual ou de mesa. |
| 🔀 **Divisão Inteligente de Contas** | **Método 1 (Garçom Mobile)**: Fracionamento automático de bebidas/itens compartilhados no momento do lançamento. **Método 2 (Caixa PDV)**: Matriz interativa de divisão por produto no fechamento para cobranças individuais separadas. |
| 📳 **PWA Garçom Push & Vibração** | Notificação instantânea com **Vibração Hálptica (Web Vibration API)** e aviso sonoro no smartphone do garçom para chamados de atendimento e solicitações de fechamento de conta. |
| 🧊 **Estoque & Grafo PEPS 3D** | Ledger auditável PEPS com **Grafo 3D de Transformação de Lotes**, baixa automática no aceite, estorno no cancelamento, **Calculadora Dinâmica de Rendimento** e entrada de insumo em **qualquer unidade** (o sistema converte e aprende a conversão nova). |
| 🔪 **Monta & Desmonta** | Desossa e fracionamento com **conservação de valor**: o frango inteiro vira peito, coxa e carcaça, e o custo sai do lote real (PEPS) rateado por peso — cada parte nasce com o preço que merece, sem centavo perdido. |
| 📋 **Inventário Flexível** | Contagem física na unidade que estiver na mão (cabeça, caixa, quilo). Sobra abre lote novo, falta consome PEPS e vira custo: "sumiu" passa a ter valor em reais. |
| 🚚 **Compras & Fornecedores** | Pedido → recebimento conferido → nota. Registra **marca, lote, validade, preço pago e fornecedor**; aceita entrega parcial, item substituído e outra unidade sem tratar nada disso como erro. Sugestão por **giro real de 30 dias + prazo de entrega** do fornecedor, com alerta de ruptura. Tudo numa transação única (`fn_receber_compra`). |
| 🛍 **Vitrine** | Banners promocionais, busca, filtros por categoria, "os mais pedidos", grupos de adicionais/extras, combos, horário de funcionamento automático, pedido mínimo. |
| 🛒 **Pedidos** | Carrinho, delivery/retirada/salão, cupons (1ª compra, por método de pagamento), taxa de entrega por bairro, troco, observações por item. |
| 💸 **Pagamentos** | Pix **dentro da plataforma** (Efí Bank: QR Code + copia-e-cola + confirmação automática via webhook), **cartão de crédito online** com tokenização no navegador (PCI-safe, parcelado), fallback Pix estático, dinheiro/cartão na entrega. |
| 💳 **Assinatura SaaS** | Checkout transparente integrado à Efí Bank com opções **Mensal (R$ 129,90/mês)** e **Anual (R$ 99,90/mês — R$ 1.198,80/ano com 23% OFF / R$ 360 de economia)**. |
| 🛵 **Entregador** | Login com papel próprio, fila de entregas em tempo real, rota no Google Maps com 1 toque, aviso de cobrança na entrega, baixa de entrega. |
| 📟 **Painel (PWA)** | Pedidos em tempo real (websocket), som de campainha, notificação, fluxo de status (novo → aceito → preparando → pronto → em rota → finalizado), comanda térmica 80mm. |
| 📈 **Financeiro (Ledger)** | Contabilidade de **dupla entrada** atômica via Triggers no Postgres. Lançamentos automáticos de receita e estorno, sem *race conditions*, separando fluxo próprio de integrações (ex: taxa iFood destacada). |
| 📊 **Inteligência** | **DRE Mensal em Tempo Real** (`vw_dre_mensal`), Extrato de Caixa (`vw_caixa_extrato`), Motor de Rateio de Despesas Fixas, Lucro Líquido Real e margem por produto na Ficha Técnica (`vw_custo_produto`). |
| 👁️ **Observabilidade** | Monitoramento em tempo real (Supabase Realtime) no Painel Administrativo. Detecta e notifica sobre estornos suspeitos, falhas de estoque (cancelamentos após aceite) e falhas de assinatura em Webhooks (HMAC). |
| 🤖 **Chat IA (Gemini)** | Atendimento inteligente por IA via WebSocket na vitrine utilizando **Gemini Function Calling** (consulta produtos, recomenda itens e realiza pedidos automaticamente sem depender de API paga do WhatsApp). |
| 🧾 **Emissor NF-e / NFC-e** | Emissão fiscal nativa (NFC-e / NF-e 4.0) integrada ao PDV. Módulo 100% construído e pronto para transmissão (aguardando apenas o upload do Certificado Digital A1 e CNPJ no painel da loja). |

## 🏗️ Arquitetura

```
              ┌─────────────────────────────────────┐
              │        Vercel (SPA + PWA)           │
              │  /:slug vitrine · /admin painel     │
              └───────────────┬─────────────────────┘
                              │ supabase-js (REST + Realtime/WS)
              ┌───────────────▼─────────────────────┐
              │             Supabase                │
              │  Postgres (RLS multi-tenant)        │
              │  Auth · Realtime · Storage          │
              │  ┌───────────────────────────────┐  │
              │  │ Edge Functions (Deno)         │  │
              │  │ pix-criar-cobranca            │◄─┼── Efí Bank (Pix)
              │  │ pix-webhook (confirmação)     │  │
              │  └───────────────────────────────┘  │
              │  Triggers: nº do pedido, baixa de   │
              │  estoque, estorno, upsert cliente   │
              └─────────────────────────────────────┘
```

**Decisões de projeto:** 
- Snapshot de preço/nome em `itens_pedido` (integridade histórica).
- Pagamentos separados do pedido (Pix + dinheiro no mesmo pedido).
- Estoque como **ledger** (`movimentacoes_estoque`) com cache em `insumos.quantidade_atual`.
- **Financeiro como Ledger de Dupla Entrada**: Triggers cuidam do balanço contábil, eliminando a chance de falhas na aplicação gerarem divergências de caixa.
- RLS por tenant em todas as tabelas via `fn_meu_acesso()`.
- **Code-Splitting Agressivo**: O frontend emprega rotas lazy e configuração manual de chunks (separando bibliotecas pesadas) para manter o LCP baixo e otimizar o carregamento.

## 🚀 Começando

> Lista completa de toda credencial/conta que o sistema usa, onde pegar cada uma e onde colar:
> **[CREDENCIAIS.md](CREDENCIAIS.md)**.

### Pré-requisitos
Node 22+, conta no [Supabase](https://supabase.com) (free tier atende) e, para Pix na plataforma, conta [Efí Bank](https://sejaefi.com.br) com certificado Pix.

### 1 · Banco de dados
No SQL Editor do Supabase, execute em ordem:

```
supabase/schema.sql               # schema completo + RLS + triggers
supabase/schema_v2.sql            # rastreio de entrega em tempo real + painel SuperAdmin
supabase/schema_v3.sql            # personalização (fonte/cor do texto) + bucket de upload de imagens
supabase/chat_ia.sql              # módulo de chat (opcional na fase 1)
supabase/seed_natureba.sql        # loja piloto com dados reais (já inclui imagens de placeholder)
supabase/seed_natureba_imagens.sql # só se a loja "natureba" já existia sem imagem_url (idempotente)
```

Crie o usuário do lojista em **Authentication → Users** e vincule-o (instrução no fim do seed).

### 2 · Frontend

```bash
npm install
cp .env.example .env.local    # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

Vitrine: `http://localhost:5173/natureba` · Painel: `http://localhost:5173/admin`

### 3 · Pix na plataforma (Efí Bank)

> Se você é o **lojista** (não o dev) e só precisa saber como criar sua conta Efí, chave Pix e
> credenciais, veja o guia dedicado: **[EFI-SETUP.md](EFI-SETUP.md)**. O passo a passo abaixo é a
> continuação técnica, depois que você já tem essas 4 informações em mãos.

```bash
openssl pkcs12 -in producao.p12 -out efi.pem -nodes
base64 -w0 efi.pem > efi_base64.txt

supabase secrets set EFI_CLIENT_ID=... EFI_CLIENT_SECRET=... \
  EFI_COBRANCAS_CLIENT_ID=... EFI_COBRANCAS_CLIENT_SECRET=... \
  EFI_PIX_KEY=chave-pix EFI_CERT_BASE64="$(cat efi_base64.txt)" EFI_SANDBOX=false

supabase functions deploy pix-criar-cobranca
supabase functions deploy cartao-pagar
supabase functions deploy pix-webhook --no-verify-jwt
```

Registre o webhook (`PUT /v2/webhook/{chave}` → `.../functions/v1/pix-webhook?ignorar=`). Pagamento confirmado marca o pedido como **ACEITO** e dispara a baixa de estoque automaticamente.

### 4 · Login com Google (opcional)

No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um **OAuth Client ID**
(tipo "Web application") com origem autorizada `https://SEU-PROJETO.supabase.co` e redirect URI
`https://SEU-PROJETO.supabase.co/auth/v1/callback`. Cole o Client ID/Secret em Supabase Studio →
**Authentication → Providers → Google**. O botão "Entrar com Google" em `/admin/login` já funciona
assim que o provider estiver habilitado — sem precisar mexer no código.

### 5 · Convite de equipe

`supabase functions deploy equipe-convidar` e `supabase functions deploy equipe-listar` — usadas
pela tela **Equipe** (dentro de "Mais" no painel) pra convidar funcionários por e-mail sem precisar
mexer no banco na mão.

## 🐳 Docker

```bash
docker compose up --build              # produção local (nginx) em :8080
docker compose -f docker-compose.dev.yml up   # dev com hot-reload em :5173
```

## 🔁 CI/CD

Pipeline em `.github/workflows/ci.yml`:

1. **CI** (todo push/PR): typecheck + build + validação da imagem Docker + testes.
2. **CD** (push na `main`): deploy no Vercel + deploy das Edge Functions no Supabase

Também inclui suites de testes robustas:
- **Testes de Integração (`__tests__/integration`)**: Cobrem as lógicas transacionais críticas, como idempotência de triggers e cálculo do ledger. (Executado via `Vitest`).
- **Testes de Carga (`k6/`)**: Validam o SLA em picos (ex: 200 webhooks Pix/segundo e concorrência severa de pedidos novos), atestando a performance da arquitetura.

Secrets necessários no GitHub: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.

## 🤝 Como Contribuir

Antes de colocar a mão na massa, certifique-se de ler nossa [Documentação de Arquitetura](docs/ARCHITECTURE.md).

### 1. Setup Local
- Faça o clone do repositório.
- Rode `npm install --legacy-peer-deps` (necessário para compatibilidade do Vite com Cypress/Code Coverage e UI).
- Copie `.env.example` para `.env.local` e insira as credenciais do seu Supabase.

### 2. Rodando o Projeto
- Execute `npm run dev`.
- Acesse a vitrine em `http://localhost:5173/natureba` e o painel em `http://localhost:5173/admin`.

### 3. Testes e Regras de Commit (Husky)
- Este projeto possui proteção de qualidade via **Husky + Lint-Staged**.
- Ao tentar rodar `git commit`, o sistema executará verificações estritas de TypeScript e ESLint. O commit será cancelado se houver erros de compilação ou violações de regras React Hooks.
- Para rodar os testes End-to-End localmente, suba o frontend (`npm run dev`) e em outro terminal rode `npx cypress open`.

## 📁 Estrutura

```
├── supabase/
│   ├── schema.sql               # schema multi-tenant + RLS + triggers + views
│   ├── chat_ia.sql              # conversas/mensagens (chat websocket + IA)
│   ├── seed_natureba.sql        # loja piloto
│   └── functions/
│       ├── pix-criar-cobranca/  # Efí: cobrança imediata + QR Code
│       └── pix-webhook/         # Efí: confirmação automática
├── src/
│   ├── pages/
│   │   ├── Cardapio.tsx         # vitrine: banners, carrinho, checkout, Pix
│   │   └── admin/               # login, pedidos realtime, estoque
│   ├── components/Splash.tsx    # abertura de marca (5s, 1x por sessão)
│   ├── lib/supabase.ts
│   └── types.ts
├── Dockerfile · nginx.conf · docker-compose*.yml
├── vercel.json · .github/workflows/ci.yml
└── public/                      # logo, ícones PWA, splash.mp4
```

## 🗺️ Roadmap

- [x] **Fase 1 — MVP**: vitrine, carrinho, cupons, pedidos realtime, comanda, Pix Efí, estoque com ficha técnica
- [x] CRUD completo de produtos/ficha técnica no painel · relatório de vendas e lucro líquido (Motor de Custos)
- [x] **Central de Compras**: módulo dedicado para lojista gerenciar recompra massiva.
- [x] Cartão de crédito na plataforma (Efí one-step + tokenização) · tela do entregador com rota no mapa
- [x] **Fase 3 — Ledger Financeiro & Code Splitting**: Contabilidade de dupla entrada rigorosa (Triggers), DRE, Observabilidade Realtime, Lazy Routes, Testes de Carga (K6) e Integração (Vitest).
- [x] **Salão 3D & Grafo PEPS 3D**: Engine Three.js WebGL para salão/assentos e rastreabilidade PEPS de estoque com conservação de valor.
- [x] **Chat IA com Gemini**: Atendimento inteligente via WebSocket na vitrine com function calling (cardápio e suporte).
- [x] **Emissor NF-e / NFC-e 4.0**: Emissão fiscal integrada ao PDV (pronto, pendente apenas upload do Certificado A1 / CNPJ).
- [x] **Balança Buffet & Divisão Inteligente CTO**: Módulo de pesagem Web Serial (Toledo/Filizola/Urano), Divisão Inteligente Métodos 1 e 2, PWA Garçom com Notificação Push & Vibração Hálptica.
- [x] **Suprimentos profissional**: fornecedores, pedido de compra com recebimento parcial/substituição, histórico de preço por marca, monta/desmonta com rateio de custo, inventário multiunidade e sugestão por giro + prazo de entrega.
- [ ] **Fase 4 (Próximos Passos)**: Onboarding self-service automatizado e programa de fidelidade/cashback avançado.

## ❤️ Autor

Desenvolvido por **Mald1vas.T4ch** — 2026. Todos os direitos para transformar a gestão gastronômica.
