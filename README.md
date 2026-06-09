<div align="center">
  <img src="assets/cozy_home_illustration.png" alt="Enxoval Checklist Logo" width="200" height="200" />

  # 🏡 Nosso Lar Checklist

  **Um organizador inteligente e elegante para planejar os itens da sua casa nova.**

  [![Deploy Status](https://github.com/vitor0p9f/enxoval-casa-nova/actions/workflows/deploy.yml/badge.svg)](https://github.com/vitor0p9f/enxoval-casa-nova/actions)
  [![Made with Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)](#)
  [![Database Turso](https://img.shields.io/badge/Database-Turso%20%28libSQL%29-4E61A1)](#)
  
  <p align="center">
    <a href="#-sobre-o-projeto">Sobre</a> •
    <a href="#-funcionalidades">Funcionalidades</a> •
    <a href="#-tecnologias">Tecnologias</a>
  </p>
</div>

---

## 📖 Sobre o Projeto
O **Nosso Lar Checklist** é uma aplicação web minimalista e bonita feita especificamente para ajudar casais a organizarem o seu enxoval. Em vez de planilhas complexas, ele oferece uma interface moderna para categorizar móveis e eletrodomésticos, comparar preços e salvar imagens de referências automaticamente a partir da URL das lojas.

A aplicação foi idealizada com foco na facilidade de uso em dispositivos móveis, estética agradável, e arquitetura de dados *Serverless* rodando SQLite no navegador via IndexedDB ou espelhando dados diretamente para a nuvem com o Turso.

## ✨ Funcionalidades
* 📂 **Organização por Seções**: Separe sua casa em cômodos (ex: Cozinha, Quarto Principal, Lavanderia).
* ✅ **Checklist Interativo**: Marque itens como "Adquirido" e veja seu progresso em tempo real no Dashboard.
* 🤖 **Importador de Produtos Inteligente**: Cole o link de um produto da loja (ex: Amazon, MercadoLivre, Magalu) e o sistema automaticamente usa a **API do Microlink** e busca de **Microdados (Schema)** para importar a foto, o título, a loja e o **preço** do produto!
* 📊 **Dashboard Financeiro**: Acompanhe o investimento total da casa e veja quais seções exigem mais orçamento.
* 💾 **Persistência Dupla**: Funciona 100% offline salvando seu banco no próprio navegador (IndexedDB) ou conectando-se a um banco de dados gratuito em nuvem para acessar o mesmo enxoval pelo celular e computador ao mesmo tempo.

## 🛠 Tecnologias

A aplicação foi intencionalmente desenvolvida usando a stack Vanilla, mantendo zero dependências de build complexas como Node.js ou bundlers para o frontend:

- **Frontend**: HTML5, Vanilla CSS (CSS Variables para um Design System fluido), e Vanilla JavaScript (`app.js`, `ui.js`, `scraper.js`, `db.js`).
- **Banco de Dados (Frontend)**: `SQL.js` com WebAssembly carregando uma instância virtual do SQLite diretamente no navegador.
- **Banco de Dados (Nuvem)**: SDK nativo do [Turso](https://turso.tech/) (`@libsql/client/web`) para sincronizar a sessão em diferentes aparelhos.
- **Scraping de Metadados**: API `Microlink.io` (buscando OpenGraph) combinada com *DOM Parsing* local para `itemprop="price"`.
- **Ícones e Tipografia**: *Lucide Icons*, *Playfair Display* e *Montserrat*.



---
*Planejando com carinho cada detalhe do novo lar.* ✨

> **Aviso:** Este projeto foi idealizado e planejado por humanos, e programado com o auxílio de Inteligência Artificial.
