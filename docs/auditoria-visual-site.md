# Auditoria visual e comportamental do site

**Base verificada:** http://127.0.0.1:4174
**Cenários:** 10 combinações de rota e viewport.

## Resultado: APROVADO

| Rota | Viewport | H1 | Imagens | Overflow | Resultado |
|---|---|---|---:|---|---|
| / | desktop | Você sabe quanto seu restaurante faturou ontem. Consegue explicar o custo e a operação por trás desse valor? | 0 quebradas | não | OK |
| / | mobile | Você sabe quanto seu restaurante faturou ontem. Consegue explicar o custo e a operação por trás desse valor? | 0 quebradas | não | OK |
| /sistema-para-restaurantes | mobile | O sistema para restaurante que integra salão, garçons, cozinha e gestão financeira | 0 quebradas | não | OK |
| /sistema-para-hamburgueria | mobile | O sistema para hamburgueria que organiza a chapa e centraliza toda a sua operação | 0 quebradas | não | OK |
| /sistema-para-lanchonete | mobile | O sistema para lanchonete com PDV de balcão rápido e controle total da loja | 0 quebradas | não | OK |
| /sistema-para-pizzaria | mobile | O sistema para pizzaria que organiza o forno e agiliza as entregas do seu delivery | 0 quebradas | não | OK |
| /sistema-para-dark-kitchen | mobile | Cozinha sem salão precisa de margem, não de mesa | 0 quebradas | não | OK |
| /api-whatsapp-restaurantes | mobile | Atendimento inteligente via WhatsApp com IA Oficial Meta para o seu restaurante | 0 quebradas | não | OK |
| /cadastre-se | mobile | Cadastre sua loja no MiseOn | 0 quebradas | não | OK |
| /contato | mobile | Fale com a nossa equipe | 0 quebradas | não | OK |

## Evidências

- `output/marketing/qa-posicionamento/home-desktop.png`
- `output/marketing/qa-posicionamento/home-mobile.png`
- `output/marketing/qa-posicionamento/restaurante-salao-mobile.png`
- `output/marketing/qa-posicionamento/hamburgueria-mobile.png`
- `output/marketing/qa-posicionamento/lanchonete-mobile.png`
- `output/marketing/qa-posicionamento/pizzaria-mobile.png`
- `output/marketing/qa-posicionamento/dark-kitchen-mobile.png`
- `output/marketing/qa-posicionamento/whatsapp-ia-mobile.png`
- `output/marketing/qa-posicionamento/cadastro-mobile.png`
- `output/marketing/qa-posicionamento/contato-mobile.png`

## Escopo

- carregamento sem tela vazia ou erro de runtime;
- H1 e conteúdo significativo;
- ausência de overflow horizontal nas larguras verificadas;
- imagens carregadas;
- três CTAs na home;
- ausência de prova social proibida.
