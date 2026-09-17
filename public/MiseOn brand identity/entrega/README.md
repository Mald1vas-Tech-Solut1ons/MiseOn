# MiseOn — Identidade de marca (pacote de entrega)

Tudo que você precisa para usar a marca no seu sistema (React 19 + Vite + TS).
Nada aqui é "só pra ver" — são arquivos prontos pra colar no repositório.

---

## 1. O que tem na pasta

```
entrega/
├── assets/                     ← imagens da marca (PNG transparente, alta resolução)
│   ├── icon.png                  símbolo (chapéu + M/seta), fundo transparente
│   ├── logo-horizontal.png       logo completa (símbolo + "MISE ON" + tagline)
│   ├── part-hat.png              peça: chapéu de chef        ┐
│   ├── part-mbase.png            peça: base azul do M        │ usadas na
│   ├── part-arrowshaft.png       peça: corpo da seta laranja │ animação de abertura
│   ├── part-arrowhead.png        peça: ponta da seta         ┘
│   ├── icon-blue.png             só a parte azul (para artes)
│   └── icon-orange.png           só a seta laranja (para artes)
├── brand.css                   ← animações + variáveis de cor (importado pelos componentes)
├── BrandIntro.tsx              ← abertura de marca (peças se montando) — substitui o Splash
├── MiseOnLoader.tsx            ← loading de dados (anel + % + skeleton)
└── ScreenTransition.tsx        ← transição de telas por rota
```

## 2. Cores e tipografia

| Token              | Hex       | Uso                          |
|--------------------|-----------|------------------------------|
| `--miseon-azul`    | `#004198` | base, autoridade, confiança  |
| `--miseon-azul-claro` | `#0A5CC4` | realces em azul           |
| `--miseon-laranja` | `#FC5B24` | ação, energia, destaques     |
| `--miseon-tinta`   | `#070C18` | fundo escuro                 |
| `--miseon-nevoa`   | `#EAF1FB` | texto/detalhe claro          |

Fontes: **Sora** (títulos), **Manrope** (texto), **JetBrains Mono** (rótulos).
Adicione ao seu `index.css` (você já importa Google Fonts lá):

```css
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
```

## 3. Instalação (3 passos)

1. Copie a pasta `assets/` para `public/brand/` do seu projeto
   → os arquivos ficam acessíveis como `/brand/icon.png`, `/brand/part-hat.png`, etc.
   (os componentes já apontam para esses caminhos).
2. Copie `brand.css`, `BrandIntro.tsx`, `MiseOnLoader.tsx` e `ScreenTransition.tsx`
   para `src/components/` (ou onde preferir).
3. Importe e use (abaixo). Nenhuma dependência nova — só React (e `react-router-dom`,
   que você já tem, para a transição).

## 4. Como usar

### Abertura de marca (`BrandIntro`)
Troca o `Splash.tsx` de vídeo. Aparece 1× por sessão e some sozinho.

```tsx
// src/main.tsx  (ou App.tsx)
import BrandIntro from './components/BrandIntro';

<BrandIntro>
  <App />
</BrandIntro>
```

### Loading de dados (`MiseOnLoader`)
Onde hoje você mostra "carregando":

```tsx
import { MiseOnLoader } from './components/MiseOnLoader';

// com progresso real (ex.: sincronização em etapas)
{carregando && <MiseOnLoader progress={pct} status="Sincronizando pedidos" />}

// indeterminado (enquanto o fetch não resolve)
{carregando && <MiseOnLoader status="Carregando estoque" />}
```

### Transição de telas (`ScreenTransition`)
Envolva suas rotas — cada mudança de URL anima a entrada:

```tsx
import ScreenTransition from './components/ScreenTransition';

<ScreenTransition>
  <Routes>
    <Route path="/:slug" element={<Cardapio />} />
    <Route path="/admin/*" element={<Admin />} />
  </Routes>
</ScreenTransition>
```

## 5. Sobre "vídeo"

A abertura (`BrandIntro`) roda como **HTML/CSS** — mais leve, nítida em qualquer tela
e sem arquivo pesado de vídeo. Se você precisar de um `.mp4` (por ex. para redes sociais),
é só gravar a tela da abertura rodando, ou me pedir para preparar a versão para exportação.

## 6. Acessibilidade

`brand.css` respeita `prefers-reduced-motion`: quem desativa animações no sistema
vê tudo estático, sem quebrar o layout.
