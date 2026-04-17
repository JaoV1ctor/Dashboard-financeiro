# ⚡ Elite Terminal | Conversor Híbrido Premium

<p align="center">
  <img src="https://images.unsplash.com/photo-1611974717483-5828ff79cb0b?auto=format&fit=crop&q=80&w=1200" alt="Elite Terminal Banner" width="100%" style="border-radius: 20px; margin-bottom: 20px;">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Stable%20v1.2.0-F4D548?style=for-the-badge&logo=statuspage&logoColor=black" alt="Status">
  <img src="https://img.shields.io/badge/Architecture-3--Layer%20Native-0B0B0F?style=for-the-badge&logo=architecture&logoColor=white" alt="Architecture">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License">
</p>

## 💎 O Projeto
O **Elite Terminal** é um dashboard financeiro de alta performance, projetado para oferecer conversões instantâneas entre moedas fiduciárias (Fiat) e criptoativos. Construído com uma arquitetura **Client-side Native**, o sistema elimina latências de servidor ao processar toda a lógica diretamente no navegador.

Inspirado na estética *Glassmorphism* de terminais financeiros premium, o projeto foca na clareza de dados e na fluidez da experiência do usuário (UX).

---

## 🚀 Funcionalidades Principais
- **⚡ Conversão Cross-Currency**: Transforme BTC em USD, ETH em BRL ou qualquer par suportado instantaneamente.
- **📊 Dashboards Visuais**: Gráficos dinâmicos de variação de preços integrados com Chart.js.
- **🌑 Glassmorphism UI**: Interface moderna com transparências, desfoques e efeitos de brilho em tons *bgSpace*.
- **📱 Responsivo & Adaptativo**: Experiência fluida em desktops, tablets e dispositivos móveis.
- **🕒 Histórico & Alertas**: Persistência local de transações simuladas e monitoramento de ativos estratégicos.

---

## 🛠️ Stack Tecnológica
- **Linguagem**: [JavaScript (Vanilla ES6+)](https://developer.mozilla.org/pt-BR/docs/Web/JavaScript)
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/)
- **Ícones**: [Lucide Icons](https://lucide.dev/)
- **Gráficos**: [Chart.js](https://www.chartjs.org/)
- **API**: [AwesomeAPI](https://docs.economia.awesomeapi.com.br/)

---

## 📦 Estrutura de Camadas (Architecture)
O projeto segue o padrão de separação de responsabilidades para garantir escalabilidade:
1. **Layer 1 (UI/UX)**: Componentes dinâmicos e manipulação de estado do DOM.
2. **Layer 2 (Connectivity)**: Engine de fetching, normalização de schemas e tratamento de erros de rede.
3. **Layer 3 (Core Logic)**: Funções puras de cálculo matemático e formatação monetária inteligente (FIAT vs Crypto).

---

## 🖱️ Como Rodar Localmente

Devido ao uso de **Módulos ES6**, é necessário servir o projeto através de um servidor local para evitar bloqueios de CORS:

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/conversor-moedas.git

# Entre na pasta
cd conversor-moedas

# Rode com Python (Opção A)
python -m http.server 8080

# OU rode com Node (Opção B)
npx http-server -p 8080
```
Acesse em: `http://localhost:8080`

---

## 📝 Licença
Este projeto está sob a licença MIT. Sinta-se livre para clonar, estudar e contribuir.

<p align="center">
  Desenvolvido por <strong>Joao Victor</strong> ⚡
</p>
