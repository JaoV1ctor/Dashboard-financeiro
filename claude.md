# 🛠️ Stack & Architecture (Project Metadata)

## Protocol: The Hypper-Minimalist Stack
- **DOM & Core Structure**: HTML5 Semântico (`index.html`). 
- **Styling UI/UX**: Tailwind CSS (via script CDN)
  - Abordagem visual: Glassmorphism e Dark Mode dinâmico.
  - Ausência de CSS customizado extenso, salvo reset ou keyframes específicos.
- **Interactivity & Core Logic**: Vanilla JavaScript (ES6+), módulos separados logicamente via funções.
- **Typography & Assets**: Fontes sem serifas modernas `Inter` ou `Geist`. Minimalist SVGs / Lucide.

## Principle
Arquitetura leve capaz de rodar sem build steps complexos na fase atual, permitindo deploy instantâneo, com a regra basilar de ter *Zero side-effects* nas funções de conversão matematicamente sensíveis.
