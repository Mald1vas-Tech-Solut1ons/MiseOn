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

## ⚖️ 2. Módulo de Balança de Buffet & Peso Inteligente

Desenvolvido para atender restaurantes por quilo e buffets self-service com captura automática de pesagem:

- **Driver Modular (`BalancaEngine`)**:
  - **Web Serial API (Nativo)**: Leitura direta de portas COM / USB (RS-232) em navegadores modernos (Chrome, Edge, Brave).
  - **Rede Local (TCP/IP / Webhook)**: Comunicação via IP fixo da balança.
  - **Emulador Integrado**: Ferramenta de simulação de pesagem para testes operacionais sem hardware presente.
- **Compatibilidade de Hardware**: Drivers parseadores de frame para **Toledo Prix 3 / Prix 4**, **Filizola CS 15 / Platina**, **Urano** e ASCII Serial Genérico.
- **Automação de Tara**: Desconto automático da tara do prato em gramas com conversão direta de R$/kg.
- **Gravação em Comanda**: Vínculo instantâneo do item pesado à comanda individual do cartão ou subcomanda de mesa.

---

## 🔀 3. Divisão Inteligente de Contas (Métodos 1 & 2)

Resolve a fricção de cobrança de consumo coletivo no salão:

### Método 1: Garçom Fraciona no Lançamento (PWA Mobile)
- Ao adicionar um item compartilhável (cerveja 1L, vinho, jarra, porção), o garçom seleciona os assentos/participantes na mesa.
- O motor fraciona automaticamente a quantidade (`1 / N` participantes) e atribui as frações decimais aos assentos selecionados.

### Método 2: Caixa Divide por Produto no Fechamento (PDV Caixa)
- Itens lançados na comanda mãe/geral da mesa são apresentados em uma matriz interativa no caixa.
- O operador atribui graficamente quais clientes racham determinado produto.
- O sistema calcula o subtotal exato por cliente (prato por quilo + frações de bebidas + taxa de serviço) e emite cobranças e notas NFC-e individuais.

---

## 📳 4. PWA Garçom com Notificação Push & Vibração Hálptica

Atendimento em tempo real no salão:

- **Web Vibration API**: O smartphone do garçom logado no PWA vibra em padrões táteis dinâmicos ao receber chamados da mesa:
  - *Chamado de Atendimento*: Vibração dupla (`[200, 100, 200]`).
  - *Solicitação de Fechamento*: Vibração tripla (`[300, 100, 300, 100, 500]`).
- **Web Push Notifications**: Notificações em segundo plano emitidas pelo Service Worker com tags persistentes.
- **Supabase Realtime**: Atualização instantânea na tela via WebSocket do Postgres sem necessidade de polling.

---

## 📦 5. Módulos Operacionais Integrados

| Módulo | Descrição Técnica & Funcional |
|---|---|
| 🛍 **Vitrine QR Code & Pedidos** | Cardápio digital público (`/:slug`), autoatendimento na mesa via QR Code, adicionais, combos, cupons, taxa de entrega por bairro/distância. |
| 🖥 **PDV Balcão Express** | Caixa de atendimento rápido com abertura de turno, sangria, reforço, fechamento cego e conciliação de gaveta. |
| 🪑 **Salão 3D & Assentos** | Engine **Three.js WebGL** interativa para visualização 3D de salão, assentos numerados por mesa e cronômetro de permanência. |
| 🍳 **Cozinha (KDS Kanban)** | Tela de produção sem papel para a cozinha, com avanço de etapas, tempo de preparo e filtro por estação. |
| 🛵 **Gestão de Entregas & Rotas** | Painel do entregador com rota no Google Maps, cálculo de taxa por km/bairro e rastreamento pelo cliente. |
| 🧊 **Estoque PEPS & Ficha Técnica** | Baixa automática no aceite do pedido, estorno no cancelamento, CMV em tempo real, lotes PEPS e Central de Compras Massiva. |
| 📈 **Double-Entry Ledger Financeiro** | Contabilidade de dupla entrada executada atômica via Triggers do Postgres (`vw_dre_mensal`, `vw_caixa_extrato`). |
| 🤖 **Chat IA (Gemini & Meta)** | Atendimento por IA no WhatsApp via API Oficial Meta Business e Chat na Vitrine com Function Calling para pedidos. |
| 🧾 **Emissor Fiscal NFC-e / NF-e 4.0** | Emissão fiscal nativa integrada ao PDV e à FocusNFe para documentos fiscais eletrônicos. |

---

## 🛡️ 6. Garantias de Entrega & Segurança da Operação

1. **Garantia do Faturamento (Pix Efí Direct)**: O valor das vendas via Pix cai direto na conta bancária do lojista (sem intermediação de saldo no SaaS).
2. **Garantia de Integridade Contábil**: Lançamentos financeiros executados em nível de banco de dados por triggers PostgreSQL, imunes a falhas de conexão no cliente.
3. **Garantia Anti-Fraude na Balança**: Leitura serial USB direta impede alteração manual de pesos e valores no buffet.
4. **Garantia de Continuidade**: Operação em modo PWA com resiliência contra oscilações de rede.

---

*MiseOn — Sistema Operacional Gastronômico Inteligente (2026).*
