<div align="center">

# 🍽️ MiseOn — Sistema Inteligente de Gestão para Food Service

<img src="public/logo.png" alt="MiseOn Banner" width="520"/>

### *Plataforma SaaS Multi-Tenant Enterprise para Restaurantes, Hamburguerias, Pizzarias, Lanchonetes, Bares, Buffets por Quilo e Dark Kitchens*

[![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](#8-pipeline-de-cicd-e-qualidade)
[![React](https://img.shields.io/badge/React_19.0-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript_5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite_6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_RLS-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![iFood API](https://img.shields.io/badge/iFood_Merchant_API-Oficial_v2.0-EA1D2C?style=for-the-badge)](https://developer.ifood.com.br/)
[![Meta WhatsApp](https://img.shields.io/badge/Meta_WhatsApp_AI-Cloud_API_v21.0-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://developers.facebook.com/)
[![Efí Bank](https://img.shields.io/badge/Efí_Bank-PIX_Automático-F36F21?style=for-the-badge)](https://sejaefi.com.br)
[![FocusNFe](https://img.shields.io/badge/FocusNFe-NFC--e_4.0-0088CC?style=for-the-badge)](#315-emissão-fiscal-nfc-e--nf-e-40-focusnfe)
[![Docker](https://img.shields.io/badge/Docker-Containers-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

---

*Arquitetura Multi-Tenant Nativa no PostgreSQL via Row Level Security (RLS). Uma única instância isola com 100% de integridade cada estabelecimento (`/natureba`, `/sua-loja`), garantindo segregação total de marcas, estoques, caixas, catálogos e permissões.*

</div>

---

## 📋 Sumário Completo

1. [Visão Geral e Proposta de Valor](#1-visão-geral-e-proposta-de-valor)
2. [Arquitetura de Sistemas & Fluxo de Dados](#2-arquitetura-de-sistemas--fluxo-de-dados)
3. [Análise Detalhada dos 24 Módulos Funcionais](#3-análise-detalhada-dos-24-módulos-funcionais)
   - [3.1 Integração iFood Oficial & Importador Reverso de Catálogo](#31-integração-ifood-oficial--importador-reverso-de-catálogo)
   - [3.2 Atendimento Inteligente WhatsApp IA (API Oficial Meta Cloud)](#32-atendimento-inteligente-whatsapp-ia-api-oficial-meta-cloud)
   - [3.3 Gestão de Entregas & Rastreamento GPS ao Vivo (Live Tracking)](#33-gestão-de-entregas--rastreamento-gps-ao-vivo-live-tracking)
   - [3.4 Central de Compras & Inteligência Preditiva de Giro](#34-central-de-compras--inteligência-preditiva-de-giro)
   - [3.5 Onboarding Automatizado & Tour Guiado Bilingue (24 Passos)](#35-onboarding-automatizado--tour-guiado-bilingue-24-passos)
   - [3.6 Salão 3D & Engenharia de Comandas (WebGL Three.js)](#36-salão-3d--engenharia-de-comandas-webgl-threejs)
   - [3.7 Estoque PEPS, Grafo 3D & Entrada via SEFAZ NFC-e](#37-estoque-peps-grafo-3d--entrada-via-sefaz-nfc-e)
   - [3.8 MiseOn Scale Engine (Balança Buffet R$/kg via WebSerial)](#38-miseon-scale-engine-balança-buffet-rkg-via-webserial)
   - [3.9 KDS Kanban Cozinha & Passa-Bastão Operacional](#39-kds-kanban-cozinha--passa-bastão-operacional)
   - [3.10 Frente de Caixa (PDV), Turnos & Pix Efí Bank](#310-frente-de-caixa-pdv-turnos--pix-efí-bank)
   - [3.11 Impressão Térmica ESC/POS & Motor Sonoro WebAudio](#311-impressão-térmica-escpos--motor-sonoro-webaudio)
   - [3.12 Tabela Nutricional Automática (TBCA / USDA / IBGE)](#312-tabela-nutricional-automática-tbca--usda--ibge)
   - [3.13 Menu Board 4K & Chamada de Senhas por Voz (Web Speech API)](#313-menu-board-4k--chamada-de-senhas-por-voz-web-speech-api)
   - [3.14 Financeiro Ledger Dupla Entrada & DRE Gerencial](#314-financeiro-ledger-dupla-entrada--dre-gerencial)
   - [3.15 Emissão Fiscal NFC-e / NF-e 4.0 (FocusNFe)](#315-emissão-fiscal-nfc-e--nf-e-40-focusnfe)
   - [3.16 Gestão de Equipe & Controle de Acesso Baseado em Papéis (RBAC)](#316-gestão-de-equipe--controle-de-acesso-baseado-em-papéis-rbac)
   - [3.17 Operação Dark Kitchen & Multi-Brand (Marcas Virtuais)](#317-operação-dark-kitchen--multi-brand-marcas-virtuais)
   - [3.18 CRM Preditivo & Análise RFM de Clientes](#318-crm-preditivo--análise-rfm-de-clientes)
   - [3.19 Carteira Virtual & Programa de Fidelidade Cashback](#319-carteira-virtual--programa-de-fidelidade-cashback)
   - [3.20 Marketing de Performance, Meta Pixel & Atribuição GA4](#320-marketing-de-performance-meta-pixel--atribuição-ga4)
   - [3.21 Chat IA Gemini na Vitrine Pública (Function Calling)](#321-chat-ia-gemini-na-vitrine-pública-function-calling)
   - [3.22 Engine de SEO & Landing Pages por Nicho (JSON-LD)](#322-engine-de-seo--landing-pages-por-nicho-json-ld)
   - [3.23 Segurança de Conta, Sessão Global & Verificação OTP](#323-segurança-de-conta-sessão-global--verificação-otp)
   - [3.24 Acessibilidade WCAG 2.1 & Motor de Internacionalização (i18n)](#324-acessibilidade-wcag-21--motor-de-internacionalização-i18n)
4. [Análise Arquitetural Arquivo por Arquivo da Estrutura do Repositório](#4-análise-arquitetural-arquivo-por-arquivo-da-estrutura-do-repositório)
5. [Catálogo de Edge Functions (Supabase / Deno)](#5-catálogo-de-edge-functions-supabase--deno)
6. [Matriz de Variáveis de Ambiente](#6-matriz-de-variáveis-de-ambiente)
7. [Guia de Instalação & Execução Local](#7-guia-de-instalação--execução-local)
8. [Pipeline de CI/CD e Qualidade](#8-pipeline-de-cicd-e-qualidade)
9. [Suítes de Testes (Vitest, Cypress e K6)](#9-suítes-de-testes-vitest-cypress-e-k6)
10. [Containers & Orquestração Docker](#10-containers--orquestração-docker)

---

## 1. Visão Geral e Proposta de Valor

O **MiseOn** é um ecossistema SaaS de última geração projetado especificamente para o mercado de gastronomia e *food service*. Ele substitui a dependência de múltiplos sistemas desconectados (PDV, controle de estoque isolado, impressores manuais e gerenciadores de marketplace) por um ambiente unificado e atômico.

### O Problema do Mercado
Restaurantes perdem em média de **8% a 15% de margem líquida** devido a:
1. **Falta de controle de estoque por Ficha Técnica real**: Produtos vendidos no salão ou iFood não abatem insumos no custo PEPS correto.
2. **Retrabalho de Digitação de Pedidos**: Operadores perdem tempo redigitando chamados de WhatsApp e marketplaces.
3. **Impossibilidade de Importação Rápida**: Migrar um restaurante para um novo sistema leva dias redigitando cardápios extensos.

### A Solução MiseOn
- **Migração em <3 Minutos**: Importação reversa do catálogo do iFood com criação automática de categorias, produtos, fotos, adicionais e preços.
- **Automação de Atendimento**: IA integrada ao WhatsApp oficial da Meta que responde dúvidas do cardápio e conduz o cliente para a venda direta.
- **Rastreabilidade PEPS de Ponta a Ponta**: A cada pedido finalizado, o banco de dados executa a baixa contábil exata dos insumos brutos e processados.

---

## 2. Arquitetura de Sistemas & Fluxo de Dados

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT-SIDE (Vercel / PWA)                           │
│  Vitrine Pública (/:slug) · Painel Admin (/admin) · Salão 3D · KDS · PDV Touch   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ HTTPS / WebSockets (Realtime)
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                               SUPABASE CLOUD INFRA                               │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                     POSTGRESQL DATABASE ENGINE (v15+)                      │  │
│  │  • RLS Multi-Tenant (fn_meu_acesso)                                        │  │
│  │  • Ledger Contábil (Triggers de Entrada/Saída)                             │  │
│  │  • Ledger PEPS de Estoque (movimentacoes_estoque)                          │  │
│  └─────────────────────────────────────┬──────────────────────────────────────┘  │
│                                        │                                         │
│  ┌─────────────────────────────────────▼──────────────────────────────────────┐  │
│  │                     EDGE FUNCTIONS RUNTIME (Deno)                          │  │
│  │  • ifood-catalog-import ──► iFood Merchant OAuth v2.0 API                  │  │
│  │  • whatsapp-send/webhook ──► Meta WhatsApp Business Cloud API              │  │
│  │  • pix-criar-cobranca ────► Efí Bank mTLS Certificate Payment API          │  │
│  │  • conta-atualizar ───────► Supabase Admin Auth & Security OTP             │  │
│  │  • equipe-convidar/listar ──► RBAC Team Management                         │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Análise Detalhada dos 24 Módulos Funcionais

### 3.1 Integração iFood Oficial & Importador Reverso de Catálogo
- **Importador Reverso (`ifood-catalog-import`)**: Edge Function assíncrona que lê o catálogo do iFood Merchant API e calcula o diff em 2 fases:
  1. *Fase de Prévia (`confirmar: false`)*: Retorna estatísticas de produtos novos, atualizados e sem alteração.
  2. *Fase de Gravação (`confirmar: true`)*: Persiste categorias, produtos, grupos de opções (ex: adicionais, bordas, pontos de carne) e imagens no banco.
- **Mapeamento De-Para**: Associação de produtos locais com códigos PDV (`externalCode`) do iFood para garantir a baixa unificada de estoque.
- **Proteção de Margem (Markup)**: Cálculo automático do preço ideal a ser cobrado no iFood com base na taxa de comissão contratual da loja.
- **Sincronização Bidirecional de Status**: Aceite, despacho (`/dispatch`), validação de código de coleta do entregador / entrega ao cliente e cancelamento homologado com motivos oficiais.
- **Painel de Negociações**: Módulo para acompanhamento de disputas de cancelamento pós-entrega do iFood com contestação acelerada.

### 3.2 Atendimento Inteligente WhatsApp IA (API Oficial Meta Cloud)
- **Integração Cloud Oficial**: Conectado diretamente à WhatsApp Business API Oficial da Meta (sem risco de banimento de número ou *web-scraping* não oficial).
- **Processamento de Intenção**: Tira dúvidas sobre ingredientes, alérgenos, preços e horários de funcionamento diretamente da base de dados.
- **Link de Rastreio em Tempo Real**: Envia automaticamente o link de acompanhamento ao vivo (`https://miseon.app.br/slug`) assim que o pedido é aceito.
- **Handoff Humano**: Identifica solicitações de suporte humano e transfere o atendimento para a equipe da loja instantaneamente.

### 3.3 Gestão de Entregas & Rastreamento GPS ao Vivo (Live Tracking)
- **Painel de Logística (`Entregas.tsx`)**: Atribuição de entregadores para pedidos de delivery com cálculo de taxa por raio ou km.
- **Rastreio em Tempo Real (`RastreioPedido.tsx`)**: Página pública onde o cliente acompanha o motoboy no mapa via GPS ao vivo.
- **Validação de Código de Coleta/Entrega**: Confirmação obrigatória de código de segurança para liberar a entrega.

### 3.4 Central de Compras & Inteligência Preditiva de Giro
- **Projeção de Consumo de 30 Dias (`Compras.tsx`)**: Analisa o giro de vendas histórico dos últimos 30 dias para calcular a necessidade real de insumos.
- **Geração de Ordem de Compra em 1-Clique**: Cria a lista de reposição exata e formata a Ordem de Compra para envio direto no WhatsApp do fornecedor.
- **Alerta de Ruptura de Estoque**: Identifica insumos abaixo do nível de segurança antes de afetar a produção.

### 3.5 Onboarding Automatizado & Tour Guiado Bilingue (24 Passos)
- **Store Setup Wizard (`StoreSetupWizard.tsx`)**: Card flutuante colapsável que acompanha os 7 marcos de prontidão da loja (cardápio, Pix, iFood, entrega, equipe, estoque, impressora).
- **Tour Guiado 24 Passos (`GuidedTourModal.tsx` & `useGuidedTour.ts`)**:
  - Navega automaticamente pelas rotas (`/admin/pedidos`, `/admin/estoque`, `/admin/mesas`, `/admin/cardapio`, `/admin/kds`, `/admin/pdv`, `/admin/ifood`, `/admin/whatsapp`, `/admin/loja`, `/admin/conta`).
  - Posicionamento inteligente dinâmico que **nunca** cobre o elemento em destaque.
  - Suporte completo a Português e Inglês (i18n).

### 3.6 Salão 3D & Engenharia de Comandas (WebGL Three.js)
- **Planta Baixa Interativa**: Mesas representadas no espaço 3D com estados visuais dinâmicos.
- **Modalidades de Fracionamento**:
  - *Lançamento por Cadeira/Assento*: Cada ocupante possui sua comanda individual.
  - *Rateio Igualitário*: Divisão automática de garrafas ou entradas no fechamento.
  - *Fechamento Parcial*: Emissão de cobrança fracionada no PDV sem encerrar a mesa.
  - *QR Code de Mesa*: Geração e impressão de QR Codes para autoatendimento no salão.

### 3.7 Estoque PEPS, Grafo 3D & Entrada via SEFAZ NFC-e
- **Entrada via SEFAZ (NFC-e)**: Leitura direta do QR Code de notas fiscais de compra no supermercado/fornecedor com consulta à SEFAZ, extração de produtos, conversão de embalagem e entrada no estoque.
- **Calculadora de Rendimento**: Define a conversão (ex: 1 peça de 5kg de queijo ➔ 250 fatias de 20g).
- **Monta & Desmonta**: Rateio de custo atômico para fracionamentos (ex: peça de picanha desossada em bifes e gordura).
- **Setores de Armazenamento**: Separação visual de insumos por ambiente (Geladeira, Freezer, Prateleira Seca).

### 3.8 MiseOn Scale Engine (Balança Buffet R$/kg via WebSerial)
- **Integração Web Serial API (`balanca.ts`)**: Comunicação direta por hardware via porta serial USB/RS-232 com balanças industriais e comerciais (**Toledo Prix 3/4, Filizola, Urano**).
- **Tara e Liquido**: Abatimento automático de tara e envio do peso fracionado líquido direto para a comanda do salão ou caixa PDV.

### 3.9 KDS Kanban Cozinha & Passa-Bastão Operacional
- **Colunas Trello Touchscreen (`KDS.tsx` / `KDSProducao.tsx`)**: Fila, Preparo, Pronto e Entregue com marcação em tempo real.
- **Regra do Bastão Operacional**: A baixa de estoque é disparada no aceite, transferindo a responsabilidade do pedido para o KDS.

### 3.10 Frente de Caixa (PDV), Turnos & Pix Efí Bank
- **Modos Balcão e Garçom/Mesa**: Atendimento de balcão ultra-rápido ou lançamento direto nas comandas do salão.
- **Turnos de Caixa**: Abertura, fechamento, sangrias, reforço de troco e conferência cega de valores.
- **Pix Dinâmico Efí**: Geração de QR Code instantâneo na tela do caixa com baixa automatizada via Webhook ou polling de reconciliação.

### 3.11 Impressão Térmica ESC/POS & Motor Sonoro WebAudio
- **Impressão Térmica 80mm (`print.ts`)**: Emissão formatada de Vias de Cozinha, Romaneios de Entrega e Recibos de Cliente para impressoras térmicas via WebSerial/Browser.
- **Sintetizador WebAudio (`som.ts`)**: Avisos sonoros customizados para novos pedidos e alertas de cozinha sem arquivos externos.

### 3.12 Tabela Nutricional Automática (TBCA / USDA / IBGE)
- **Cálculo por Ficha Técnica (`nutricao.ts`)**: Soma automática de calorias, proteínas, carboidratos, gorduras e sódio com base nas tabelas oficiais TBCA, USDA e POF/IBGE.
- **Rastreabilidade do Dado**: Exibe a origem exata de cada informação nutricional (rótulo, base científica ou IA).

### 3.13 Menu Board 4K & Chamada de Senhas por Voz (Web Speech API)
- **Smart TV 4K**: Exibição rotativa de pratos e produtos em tela cheia sem necessidade de app.
- **Voz Sintetizada**: Anúncio falado automático ("Pedido 42 pronto no balcão").

### 3.14 Financeiro Ledger Dupla Entrada & DRE Gerencial
- **Imutabilidade Contábil**: Triggers no PostgreSQL garantem débito e crédito simétricos.
- **DRE em Tempo Real**: Demonstração do Resultado do Exercício com Margem de Contribuição e Lucro Líquido Real.

### 3.15 Emissão Fiscal NFC-e / NF-e 4.0 (FocusNFe)
- **Emissão Fiscal Nativa**: Suporte a Nota Fiscal de Consumidor Eletrônica (NFC-e) e NF-e 4.0 via FocusNFe.
- **Gestão de Certificado A1**: Upload e validação de Certificado Digital A1 e Token CSC no painel da loja.

### 3.16 Gestão de Equipe & Controle de Acesso Baseado em Papéis (RBAC)
- **Gerenciamento de Equipe (`Equipe.tsx`)**: Convite de novos colaboradores via e-mail e atribuição de papéis (`admin`, `caixa`, `cozinha`, `entregador`).
- **Segurança RLS**: Permissões de acesso granulares aplicadas direto no banco de dados.

### 3.17 Operação Dark Kitchen & Multi-Brand (Marcas Virtuais)
- **Operação de Múltiplas Marcas Virtuais**: Compartilhamento da mesma cozinha física e estoque PEPS entre diferentes marcas virtuais de delivery.
- **Filtros e Visão por Marca**: Separação de faturamento e desempenho por conceito de cardápio.

### 3.18 CRM Preditivo & Análise RFM de Clientes
- **Segmentação RFM (`Dashboard.tsx`)**: Análise automática de Recência, Frequência e Valor Monetário para categorizar clientes em VIPs, em risco ou inativos.
- **Disparo de Campanhas de Retenção**: Ações focadas para reativar clientes que não compram há mais de 30 dias.

### 3.19 Carteira Virtual & Programa de Fidelidade Cashback
- **Cashback Automático (`fn_usar_cashback`)**: Acúmulo de saldo de cashback em compras anteriores e abatimento automático no checkout do PDV ou vitrine.
- **Fidelização sem Fricção**: Cliente visualiza seu saldo em carteira sem necessidade de cartão físico.

### 3.20 Marketing de Performance, Meta Pixel & Atribuição GA4
- **Eventos de Conversão Nativa**: Rastreamento de `PageView`, `AddToCart` e `Purchase` com Meta Pixel e Google Analytics 4 (GA4).
- **Atribuição WhatsApp (`?wa=`)**: Identificação exata de origem de tráfego vindo de campanhas de anúncios.

### 3.21 Chat IA Gemini na Vitrine Pública (Function Calling)
- **Atendente Virtual na Vitrine**: Chatbot via WebSocket que utiliza **Gemini Function Calling** para consultar produtos, sugerir pratos e montar o carrinho do cliente ao vivo.

### 3.22 Engine de SEO & Landing Pages por Nicho (JSON-LD)
- **Dados Estruturados Schema.org**: Geração automática de marcação JSON-LD para motores de busca.
- **Landing Pages Dedicadas**: Páginas otimizadas para SEO focadas nos nichos de Hamburgueria, Pizzaria, Lanchonete, Bar, Dark Kitchen e Restaurante por Quilo (`NicheLandingPage.tsx`).

### 3.23 Segurança de Conta, Sessão Global & Verificação OTP
- **Verificação OTP de E-mail**: Troca de e-mail de acesso via código OTP de 6 dígitos enviado ao novo endereço.
- **Encerramento Global de Sessões**: Botão para revogar sessões ativas em todos os dispositivos em caso de perda ou roubo de aparelho.

### 3.24 Acessibilidade WCAG 2.1 & Motor de Internacionalização (i18n)
- **Acessibilidade Visual**: Ajuste imediato do tamanho das fontes (100%, 110%, 120%) em todo o sistema.
- **i18n Nativo**: Troca de idioma em 1-clique (Português / Inglês) em vitrines e modais.

---

## 4. Análise Arquitetural Arquivo por Arquivo da Estrutura do Repositório

### 4.1 Páginas Administrativas (`src/pages/admin/`)

| Arquivo | Responsabilidade | Recursos Principais |
|---|---|---|
| [`AdminLayout.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/AdminLayout.tsx) | Shell Container do Painel Admin | Navegação responsiva, seletor de loja ativa, barra de topo, montagem do `StoreSetupWizard` e gatilho do Tour Guiado de 24 passos. |
| [`Dashboard.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/Dashboard.tsx) | Painel de Métricas & Inteligência Comercial | Gráficos de faturamento diário/mensal, produtos mais vendidos, margem média e segmentação de clientes RFM (VIP/Risco). |
| [`PainelPedidos.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/PainelPedidos.tsx) | Central Ao Vivo de Pedidos do Balcão | Fila de pedidos unificada com alarmes sonoros (`som.ts`), transições de status via RPC `fn_avancar_status_pedido`, despacho iFood (`/dispatch`), link de rastreio WhatsApp e modais de cancelamento/conferência. |
| [`Estoque.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/Estoque.tsx) | Gestão Completa de Insumos & Receitas | Cadastro de matérias-primas e preparos, scanner de cupom fiscal NFC-e via SEFAZ QR Code, Custo 3D (`EstoqueCusto3D`), Rastreio por Setores (`Rastreio3D`) e calculadora de rendimento. |
| [`PDV.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/PDV.tsx) | Frente de Caixa Touchscreen | Modos Balcão e Mesa/Garçom, gestão de turnos (Abertura, Sangria, Reforço, Fechamento), integração WebSerial com balanças comerciais, cobrança Pix Efí e impressão térmica. |
| [`Cardapio.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/Cardapio.tsx) | Gestor de Vitrine e Categorias | CRUD de produtos, upload de imagens, ordenação por drag-and-drop, gestão de adicionais/opções e alternância de disponibilidade. |
| [`KDS.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/KDS.tsx) | Display de Cozinha Kanban (Geral) | Visão Kanban estilo Trello para equipe da cozinha com colunas configuráveis (Fila, Preparo, Pronto), alertas de tempo corrido e som. |
| [`KDSProducao.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/KDSProducao.tsx) | Display de Cozinha por Estação | Visão filtrada de produção por estaca de preparo (Cozinha, Bar, Confeitaria, Chapa). |
| [`Mesas.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/Mesas.tsx) | Salão 3D & Gerenciador de Comandas | Planta baixa 3D WebGL (Three.js), grade 2D de mesas, comandas fracionadas por assento/cadeira, divisão de conta e gerador de QR Code impresso para mesas. |
| [`Ifood.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/Ifood.tsx) | Integração iFood & Importador Reverso | Conexão OAuth 2.0 iFood, modal de importação reversa de cardápio (`ImportarCardapioModal`), tabela De-Para de códigos PDV (`externalCode`) e calculadora de markup de taxas. |
| [`WhatsApp.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/WhatsApp.tsx) | Configuração de IA WhatsApp Meta API | Credenciais da API Cloud da Meta, personalização de prompt do sistema da IA, histórico de conversas e alternância de Handoff humano. |
| [`Loja.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/Loja.tsx) | Configurações Gerais da Loja | Tokens de marca (cores, logo, fontes), raio de entrega por km/polígono, credenciais Efí Bank, links de TV 4K e certificado fiscal A1 FocusNFe. |
| [`MinhaConta.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/MinhaConta.tsx) | Perfil, Segurança e Acessibilidade | Alteração de dados/senha, desconexão global de sessões em todos os dispositivos, verificação OTP de e-mail e seletor de escala de fonte WCAG 2.1. |
| [`Compras.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/Compras.tsx) | Central de Compras Preditiva | Projeção de giro para 30 dias com base no histórico de vendas, cálculo de ponto de pedido e gerador automático de Ordem de Compra formatada para WhatsApp. |
| [`Financeiro.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/Financeiro.tsx) | DRE Gerencial & Razão de Dupla Entrada | Demonstração do Resultado do Exercício em tempo real, fluxo de caixa, alocação de custos fixos vs variáveis e cálculo do lucro líquido real. |
| [`Entregas.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/Entregas.tsx) | Despacho de Entregas & Motoboys | Atribuição de entregadores para pedidos de delivery, acompanhamento de taxas e liberação via código de segurança. |
| [`Equipe.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/Equipe.tsx) | Gestão de Colaboradores & Permissões | Convites por e-mail via `equipe-convidar` e atribuição de papéis de acesso RBAC (`admin`, `caixa`, `cozinha`, `entregador`). |
| [`Login.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/Login.tsx) | Portal de Autenticação Administrativa | Formato seguro de login por e-mail/senha com suporte a OAuth 2.0 Google. |

---

### 4.2 Páginas Públicas e Comerciais (`src/pages/`)

| Arquivo | Responsabilidade | Recursos Principais |
|---|---|---|
| [`Home.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/Home.tsx) | Landing Page Institucional Comercial | Apresentação comercial completa do SaaS, tabela de preços (mensal/anual), matriz de funcionalidades, depoimentos e FAQ interativo. |
| [`Cardapio.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/Cardapio.tsx) | Vitrine Pública do Cardápio Digital | Navegação por categorias, busca, modal de opções do produto, carrinho lateral, autoatendimento QR Code na mesa, checkout e Pix Efí Bank. |
| [`RastreioPedido.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/RastreioPedido.tsx) | Acompanhamento Público de Entrega Ao Vivo | Rastreamento em tempo real do status do pedido e localização do motoboy no mapa via GPS. |
| [`NicheLandingPage.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/NicheLandingPage.tsx) | Motor de Landing Pages SEO por Nicho | Páginas de alta conversão dinâmicas focadas em Hamburguerias, Pizzarias, Lanchonetes, Bares, Dark Kitchens e Restaurantes por Quilo. |
| [`Depoimentos.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/Depoimentos.tsx) | Depoimentos e Casos de Sucesso | Prova social de proprietários de restaurantes utilizando o MiseOn. |
| [`Videos.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/Videos.tsx) | Central de Tutoriais e Vídeos | Vídeos demonstrativos dos módulos de KDS, PDV, Estoque 3D e iFood. |
| [`Blog.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/Blog.tsx) | Blog de Inteligência em Food Service | Artigos educativos sobre CMV, engenharia de cardápio e gestão de restaurantes. |
| [`BlogPostPage.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/BlogPostPage.tsx) | Leitor Detalhado de Artigos do Blog | Renderizador SEO otimizado para leitura de artigos do blog. |
| [`CadastreSe.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/CadastreSe.tsx) | Formulário de Cadastro de Nova Loja | Onboarding inicial para novos assinantes criarem sua loja e conta admin. |
| [`Acesso.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/Acesso.tsx) | Portal de Acesso Rápido de Lojistas | Redirecionador para login e seleção de estabelecimento. |
| [`TermosDeUso.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/TermosDeUso.tsx) | Termos de Uso do Serviço SaaS | Contrato de prestação de serviço, regras de uso e políticas de cancelamento. |
| [`PoliticaDePrivacidade.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/pages/PoliticaDePrivacidade.tsx) | Política de Privacidade & LGPD | Conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD). |

---

### 4.3 Módulos de Lógica de Negócio, Drivers e Utilitários (`src/lib/`)

| Arquivo | Responsabilidade | Recursos Principais |
|---|---|---|
| [`src/lib/balanca.ts`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/balanca.ts) | Driver de Comunicação WebSerial | Comunicação por hardware via porta COM/USB com balanças comerciais (Toledo Prix 3/4, Filizola CS, Urano). |
| [`src/lib/cdn.ts`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/cdn.ts) | Otimizador de Mídia e Imagens | Geração de URLs de imagens otimizadas com suporte a CDN, redimensionamento dinâmico e formato WebP. |
| [`src/lib/comandas.ts`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/comandas.ts) | Ciclo de Vida de Comandas de Mesa | Abertura, vinculação de assentos, adição de itens e fechamento de comandas de salão. |
| [`src/lib/ifood.ts`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/ifood.ts) | Utilitários de Integração iFood | Funções auxiliares para despacho de entregas (`/dispatch`), de-para de produtos e lista de motivos de cancelamento oficial. |
| [`src/lib/nutricao.ts`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/nutricao.ts) | Motor de Cálculo Nutricional | Apuração de calorias, macronutrientes e sódio baseada nas tabelas TBCA (USP), USDA e POF/IBGE. |
| [`src/lib/pedidos.ts`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/pedidos.ts) | RPC de Transação de Pedidos | Invoca a função `createPedidoPedido` garantindo concorrência, numeração sequencial e snapshot de itens. |
| [`src/lib/print.ts`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/print.ts) | Renderizador Térmico ESC/POS | Formatador de impressão em 80mm para Vias de Produção da Cozinha, Romaneios de Delivery e Recibos. |
| [`src/lib/som.ts`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/som.ts) | Sintetizador de Áudio WebAudio API | Execução de alarmes sonoros customizados para alerta de novos pedidos sem dependência de mídias externas. |
| [`src/lib/supabase.ts`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/supabase.ts) | Cliente HTTP / Realtime Supabase | Inicialização do cliente `@supabase/supabase-js` com persistência de token de sessão RLS. |
| [`src/lib/estoque3d/EstoqueCusto3D.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/estoque3d/EstoqueCusto3D.tsx) | Grafo 3D WebGL de Estoque | Visualização tridimensional em Three.js das esferas de produto e dutos de custo financeiro retido. |
| [`src/lib/estoque3d/Rastreio3D.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/estoque3d/Rastreio3D.tsx) | Rastreamento por Setor de Cozinha | Separação visual 3D de itens armazenados na Geladeira, Freezer e Prateleira Seca. |
| [`src/lib/estoque3d/CalculadoraRendimento.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/lib/estoque3d/CalculadoraRendimento.tsx) | Calculadora de Quebra e Rendimento | Cálculo do percentual de perda e fator de correção durante o fracionamento de matérias-primas. |

---

### 4.4 Componentes Reutilizáveis de Interface (`src/components/`)

| Arquivo | Responsabilidade | Recursos Principais |
|---|---|---|
| [`src/components/tour/GuidedTourModal.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/tour/GuidedTourModal.tsx) | Modal do Tour Guiado de 24 Passos | Interface glassmorphism com animação de holofote (spotlight SVG), barra de progresso por capítulos e algoritmo inteligente de posicionamento não-obstrutivo. |
| [`src/components/admin/StoreSetupWizard.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/admin/StoreSetupWizard.tsx) | Checklist Flutuante de Onboarding | Card retrátil no painel admin que rastreia os 7 marcos essenciais de configuração da loja. |
| [`src/components/pdv/CartSidebar.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pdv/CartSidebar.tsx) | Painel Lateral de Carrinho do PDV | Lista de itens com opções, seletor de cliente, aplicativo de descontos, saldo de cashback e acionamento de pagamento. |
| [`src/components/pdv/HeaderBar.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pdv/HeaderBar.tsx) | Barra de Topo do Caixa PDV | Indicador do status do turno de caixa (Aberto/Fechado), saldo da gaveta em tempo real e alternância dos modos Balcão/Mesa. |
| [`src/components/pdv/PaymentModal.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pdv/PaymentModal.tsx) | Modal de Fechamento de Venda no PDV | Seleção de método (Dinheiro, Cartão, Pix Dinâmico Efí), calculadora de troco e validação de recebimento. |
| [`src/components/pdv/ProductGrid.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pdv/ProductGrid.tsx) | Grade Touch-First de Produtos | Catálogo de produtos com resposta tátil instantânea, filtro por categorias e campo de busca rápida. |
| [`src/components/pdv/CaixaModal.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pdv/CaixaModal.tsx) | Modal de Gestão de Turnos de Caixa | Telas de Abertura de caixa, registro de Sangria, Reforço de troco e Fechamento com conferência cega. |
| [`src/components/pdv/ModalOpcoes.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pdv/ModalOpcoes.tsx) | Modal de Seleção de Opcionais | Escolha de adicionais, observações do item e exibição de alertas de alérgenos nutricionais. |
| [`src/components/pedidos/PedidoHeader.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pedidos/PedidoHeader.tsx) | Cabeçalho do Card de Pedido | Badges de origem (iFood, WhatsApp, QR, Balcão), cronômetro de tempo de espera e dados do cliente. |
| [`src/components/pedidos/PedidoItens.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pedidos/PedidoItens.tsx) | Lista de Itens do Pedido | Detalhamento de produtos, opcionais, observações e funcionalidade de checkoff interativo. |
| [`src/components/pedidos/PedidoFooter.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pedidos/PedidoFooter.tsx) | Rodapé Financeiro do Pedido | Exibição de subtotal, taxa de entrega, descontos aplicados e valor total a receber. |
| [`src/components/pedidos/PedidoActions.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pedidos/PedidoActions.tsx) | Barra de Botões de Fluxo do Pedido | Botões dinâmicos de transição de status (Aceitar, Cozinha, Despachar, Finalizar, Cancelar). |
| [`src/components/pedidos/ModalCancelamento.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pedidos/ModalCancelamento.tsx) | Modal de Cancelamento de Pedido | Seleção de motivos de cancelamento homologados (incluindo motivos oficiais aceitos pelo iFood). |
| [`src/components/pedidos/ModalCodigoEntrega.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pedidos/ModalCodigoEntrega.tsx) | Modal de Validação de Código iFood | Entrada e conferência do código de coleta do entregador ou código de entrega do cliente. |
| [`src/components/pedidos/PainelNegociacoes.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/pedidos/PainelNegociacoes.tsx) | Painel de Disputas de Cancelamento | Acompanhamento e resposta rápida para solicitações de cancelamento pós-entrega do iFood. |
| [`src/components/ui/ErroAmigavel.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/ui/ErroAmigavel.tsx) | Banner de Erro Amigável em Português | Exibição de mensagens de erro traduzidas para linguagem operacional sem jargões técnicos. |
| [`src/components/ui/Toast.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/ui/Toast.tsx) | Sistema Global de Notificações Toast | Mensagens flutuantes temporárias de sucesso, aviso e informação. |
| [`src/components/SEO.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/SEO.tsx) | Componente de Meta Tags & Schema.org | Injeção de tags de título, descrição, OpenGraph e dados estruturados JSON-LD. |
| [`src/components/FooterSEO.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/FooterSEO.tsx) | Rodapé Otimizado para Motores de Busca | Matriz de links internos para otimização de indexação e autoridade SEO. |
| [`src/components/MiseOnLoader.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/MiseOnLoader.tsx) | Animação de Carregamento Esqueleto | Componente de transição visual durante requisições assíncronas. |
| [`src/components/MiseOnLogo.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/MiseOnLogo.tsx) | Logotipo SVG Vetorial Oficial | Logotipo vetorial responsivo da marca MiseOn. |
| [`src/components/Splash.tsx`](file:///c:/Users/rafae/Dev/MiseOn/src/components/Splash.tsx) | Animação de Abertura de Marca | Vídeo/animação de splash exibido uma única vez por sessão ao acessar a vitrine. |

---

## 5. Catálogo de Edge Functions (Supabase / Deno)

| Edge Function | Método | Caminho | Descrição Técnica |
|---|---|---|---|
| `ifood-catalog-import` | `POST` | `supabase/functions/ifood-catalog-import/index.ts` | Conecta à API v2.0 do iFood, realiza a leitura do catálogo de delivery, calcula o diff e importa produtos/opções/fotos. |
| `whatsapp-send` | `POST` | `supabase/functions/whatsapp-send/index.ts` | Dispara mensagens ativas pelo número oficial da Meta via WhatsApp Business Cloud API. |
| `whatsapp-webhook` | `POST/GET` | `supabase/functions/whatsapp-webhook/index.ts` | Webhook de recebimento de mensagens do WhatsApp com integração ao modelo de IA e transição handoff. |
| `pix-criar-cobranca` | `POST` | `supabase/functions/pix-criar-cobranca/index.ts` | Conecta ao Efí Bank via mTLS para gerar Pix dinâmico com QR Code e payload copia-e-cola. |
| `pix-webhook` | `POST` | `supabase/functions/pix-webhook/index.ts` | Processa o retorno instantâneo do banco Efí ao receber pagamentos Pix, atualizando o pedido para `ACEITO`. |
| `conta-atualizar` | `POST` | `supabase/functions/conta-atualizar/index.ts` | Gerencia alterações de senha com validação da senha atual e dispara códigos OTP para troca de e-mail. |
| `equipe-convidar` | `POST` | `supabase/functions/equipe-convidar/index.ts` | Gera e envia e-mails de convite para colaboradores entrarem na equipe da loja com papéis configurados. |
| `equipe-listar` | `POST` | `supabase/functions/equipe-listar/index.ts` | Lista os membros da equipe da loja ativa e permite a alteração de permissões RBAC. |

---

## 6. Matriz de Variáveis de Ambiente

### Frontend (`.env.local`)
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1Ni...
```

### Backend / Supabase Secrets (`supabase secrets set`)
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1...
IFOOD_CLIENT_ID=seu_client_id_ifood
IFOOD_CLIENT_SECRET=seu_client_secret_ifood
META_WA_TOKEN=EAAG...
META_WA_PHONE_NUMBER_ID=1234567890
EFI_CLIENT_ID=Client_Id_...
EFI_CLIENT_SECRET=Client_Secret_...
EFI_PIX_KEY=sua_chave_pix
EFI_CERT_BASE64=certificate_base64_string
```

---

## 7. Guia de Instalação & Execução Local

```bash
# 1. Clonar o repositório
git clone https://github.com/Mald1vas-Tech-Solut1ons/MiseOn.git
cd MiseOn

# 2. Instalar dependências do projeto
npm install

# 3. Configurar ambiente local
cp .env.example .env.local

# 4. Iniciar ambiente de desenvolvimento Vite
npm run dev
```

---

## 8. Pipeline de CI/CD e Qualidade

O projeto utiliza um pipeline automatizado em `.github/workflows/ci.yml`:
1. **Typecheck Estrito**: `npx tsc --noEmit` executado antes de cada merge.
2. **ESLint & Prettier**: Garantia de padrão de código limpo.
3. **Vitest (Integration Tests)**: Testes de regras de negócio em `src/lib/`.
4. **Cypress (End-to-End)**: Automação E2E para validação de fluxos de checkout e PDV.

---

## 9. Suítes de Testes (Vitest, Cypress e K6)

- **Testes de Integração (`__tests__/integration`)**: Executados via Vitest para validar regras contábeis, cálculo PEPS e baixa idempotente de estoque.
- **Testes E2E (`cypress/e2e/`)**: Testes automatizados no navegador cobrindo os fluxos de checkout da vitrine, abertura/fechamento de turno no PDV, cadastro de produtos e sincronização iFood.
- **Testes de Carga (`k6/`)**: Testes de estresse com K6 simulando picos de 200 webhooks/segundo de confirmação Pix Efí e alta concorrência de novos pedidos.

---

## 10. Containers & Orquestração Docker

```bash
# Subir ambiente de produção local via NGINX (Porta 8080)
docker compose up --build

# Subir ambiente de desenvolvimento com Hot-Reload (Porta 5173)
docker compose -f docker-compose.dev.yml up
```

---

## ⚖️ Licença e Propriedade Intelectual

Desenvolvido com excelência por **Mald1vas Tech Solutions** — 2026. Todos os direitos reservados.
