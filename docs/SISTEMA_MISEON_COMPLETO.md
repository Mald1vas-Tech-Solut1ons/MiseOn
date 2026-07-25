# 🚀 Relatório Técnico & Funcional — Sistema Operacional Gastronômico MiseOn (v1.0.0 Enterprise)

Este documento apresenta a especificação técnica e funcional consolidada da plataforma **MiseOn**, detalhando a cobertura de todos os seus subsistemas operacionais, garantias de integridade e capacidade de entrega no mercado gastronômico.

---

## 🏛️ 1. Arquitetura da Plataforma & Multi-Tenancy

O **MiseOn** é um sistema operacional SaaS para restaurantes, lanchonetes, hamburguerias, pizzarias, bares e buffets por quilo, desenhado com arquitetura de alta performance:

- **Frontend & PWA**: React 19 + TypeScript + Vite + Tailwind CSS + Three.js WebGL (Engine 3D).
- **Backend & Persistence**: Supabase (PostgreSQL 15 com RLS - Row Level Security em todas as tabelas).
- **Isolamento Multi-Tenant**: Cada estabelecimento possui escopo isolado através da função canônica `fn_meu_acesso()`, garantindo que nenhuma loja acesse dados de outra.
- **Resiliência PWA**: Service Worker (`public/sw.js`) com precache de assets, suporte offline e Notificações Push com resposta hálptica.

---

## ⚙️ 2. Sistema 100% Configurável por Segmento & Módulos Híbridos ("TUDO CONFIGURÁVEL")

O **MiseOn** se adapta dinamicamente à realidade de qualquer estabelecimento comercial:

### Presets Recomendados por Segmento (`segmento_negocio`):
1. 🍔 **Hamburgueria & Fast Food**: Combos, adicionais, KDS cozinha, balcão e delivery (oculta balança e salão se desnecessário).
2. 🍕 **Pizzaria**: Montador de pizzas meio-a-meio, tamanhos (P, M, G, GG) e bordas recheadas.
3. 🍽️ **Restaurante À la Carte**: Salão 3D, mesas, comandas, PWA garçom e cozinha.
4. ⚖️ **Restaurante por Quilo / Buffet**: Balança Web Serial, pesagem digital, cartão individual e reposição de cubas.
5. 🛵 **Dark Kitchen / Delivery Apenas**: Operação 100% focada em entrega, iFood, WhatsApp IA e rotas no mapa (oculta mesas e salão).
6. 🍺 **Bar & Pub**: Comandas por cartão, subcomandas por assento e salão.
7. 🌐 **Híbrido / Multissegmento (Geral)**: Todos os módulos ativados.

### Módulos Híbridos Personalizáveis (`modulos_ativos`):
O lojista pode ligar/desligar qualquer módulo individualmente a qualquer momento em `/admin/loja` (ex: operação que funciona como **por quilo no almoço e pizzaria à noite**).
A barra lateral de navegação ([AdminLayout.tsx](file:///c:/Users/rafae/Dev/MiseOn/src/pages/admin/AdminLayout.tsx)) filtra dinamicamente os menus de acordo com os módulos ativos do estabelecimento!

---

## ⚖️ 3. Módulo de Balança de Buffet, Peso Inteligente & Estoque de Cubas

Desenvolvido para atender restaurantes por quilo e buffets self-service com captura automática de pesagem e gestão analógica à realidade da cozinha:

- **Driver Modular (`BalancaEngine`)**:
  - **Web Serial API (Nativo)**: Leitura direta de portas COM / USB (RS-232) em navegadores modernos (Chrome, Edge, Brave).
  - **Rede Local (TCP/IP / Webhook)**: Comunicação via IP fixo da balança.
  - **Emulador Integrado**: Ferramenta de simulação de pesagem para testes operacionais sem hardware presente.
- **Compatibilidade de Hardware**: Toledo Prix 3/4, Filizola CS 15/Platina, Urano e ASCII Serial Genérico.
- **Gestão de Estoque por Reposição de Cubas (`ModalReposicaoBuffet.tsx`)**:
  - A cozinha registra a preparação e reposição de cubas na pista (ex: 5,000 kg de Strogonoff de Filé).
  - O sistema calcula a proporção dos insumos da Ficha Técnica da cuba e realiza a baixa imediata no estoque (`SAIDA_MANUAL` / `SAIDA_BUFFET`), garantindo conciliação entre o peso reposto na pista e o peso vendido na balança dos clientes.

---

## 🔀 4. Divisão Inteligente de Contas (Métodos 1 & 2)

Resolve a fricção de cobrança de consumo coletivo no salão:

- **Método 1: Garçom Fraciona no Lançamento (PWA Mobile)**: O garçom seleciona os assentos participantes na mesa no momento do pedido. O motor fraciona automaticamente a quantidade e atribui frações decimais aos assentos.
- **Método 2: Caixa Divide por Produto no Fechamento (PDV Caixa)**: Apresenta uma matriz interativa no caixa para o operador distribuir produtos consumidos entre os assentos, gerando extratos e NFC-e individuais.

---

## 📳 5. PWA Garçom com Notificação Push & Vibração Hálptica

Atendimento em tempo real no salão:

- **Web Vibration API**: O smartphone do garçom logado no PWA vibra em padrões táteis dinâmicos ao receber chamados da mesa (`[200, 100, 200]` para atendimento e `[300, 100, 300, 100, 500]` para fechamento).
- **Web Push Notifications**: Notificações em segundo plano emitidas pelo Service Worker com tags persistentes.
- **Supabase Realtime**: Atualização instantânea na tela via WebSocket do Postgres sem necessidade de polling.

---

## 📦 6. Módulos Operacionais Integrados

| Módulo | Descrição Técnica & Funcional |
|---|---|
| 🛍 **Vitrine QR Code & Pedidos** | Cardápio digital público (`/:slug`), autoatendimento na mesa via QR Code, adicionais, combos, cupons, taxa de entrega por bairro/distância. |
| 🖥 **PDV Balcão Express** | Caixa de atendimento rápido com abertura de turno, sangria, reforço, fechamento cego e conciliação de gaveta. |
| 🪑 **Salão 3D & Assentos** | Engine **Three.js WebGL** interativa para visualização 3D de salão, assentos numerados por mesa e cronômetro de permanência. |
| 🍳 **Cozinha (KDS Kanban)** | Tela de produção sem papel para a cozinha, com avanço de etapas, tempo de preparo e filtro por estação. |
| 🛵 **Gestão de Entregas & Rotas** | Painel do entregador com rota no Google Maps, cálculo de taxa por km/bairro e rastreamento pelo cliente. |
| 🧊 **Estoque PEPS & Cubas Buffet** | Baixa automática por reposição de cubas ou por venda, estorno no cancelamento, CMV em tempo real e lotes PEPS. |
| 📈 **Double-Entry Ledger Financeiro** | Contabilidade de dupla entrada executada atômica via Triggers do Postgres (`vw_dre_mensal`, `vw_caixa_extrato`). |
| 🤖 **Chat IA (Gemini & Meta)** | Atendimento por IA no WhatsApp via API Oficial Meta Business e Chat na Vitrine com Function Calling para pedidos. |
| 🧾 **Emissor Fiscal NFC-e / NF-e 4.0** | Emissão fiscal nativa integrada ao PDV e à FocusNFe para documentos fiscais eletrônicos. |

---

## 🛡️ 7. Garantias de Entrega & Segurança da Operação

1. **Garantia do Faturamento (Pix Efí Direct)**: O valor das vendas via Pix cai direto na conta bancária do lojista (sem intermediação de saldo no SaaS).
2. **Garantia de Integridade Contábil**: Lançamentos financeiros executados em nível de banco de dados por triggers PostgreSQL.
3. **Garantia Anti-Fraude na Balança**: Leitura serial USB direta impede alteração manual de pesos e valores no buffet.
4. **Garantia de Flexibilidade Híbrida**: Troca dinâmica de segmento e ativação de módulos sob medida para qualquer rotina operacional.

---

*MiseOn — Sistema Operacional Gastronômico Inteligente (2026).*
