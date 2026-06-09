# Guia de Deploy e Configuração do Banco de Dados Turso

Este guia orienta passo a passo como colocar seu enxoval online no **GitHub Pages**, criar um banco de dados serverless gratuito no **Turso** (SQLite na nuvem) e configurar as credenciais de forma segura através do **GitHub Actions**.

---

## 1. Criando e Configurando o Banco de Dados no Turso

O **Turso** é uma plataforma de banco de dados baseada no libSQL (uma bifurcação open-source do SQLite) extremamente rápida, que oferece um plano gratuito muito generoso (até 500 bancos de dados e 9 GB de armazenamento).

### Passo 1: Criar a Conta e o Banco de Dados
1. Acesse [turso.tech](https://turso.tech/) e crie uma conta gratuita.
2. Você pode criar o banco de dados diretamente pelo Painel Web do Turso ou usando a CLI do Turso no terminal:
   - Se optar por usar a CLI, instale-a e execute:
     ```bash
     turso auth signup     # Cadastro / Login
     turso db create enxoval-db
     ```
3. Obtenha a **URL de Conexão** do seu banco. Ela se parece com isto:
   `libsql://enxoval-db-usuario.turso.io`
   *(Observação: A nossa aplicação substitui automaticamente `libsql://` por `https://` para trafegar via HTTP normal no navegador, mas você pode usar o endereço conforme fornecido pelo Turso).*

### Passo 2: Gerar o Token de Acesso (Auth Token)
1. Para permitir que o navegador leia e grave dados no banco, precisamos de um Token.
2. No painel web do Turso, clique no seu banco de dados e vá em **Generate Token** (ou use a CLI):
   ```bash
   turso db tokens create enxoval-db
   ```
3. Guarde com segurança o **Token** gerado.

---

## 2. Deploy no GitHub Pages & CI/CD com Actions

Para evitar expor o Token do banco de dados no seu código público no GitHub, configuraremos a esteira do GitHub Actions para injetar as credenciais dinamicamente durante o processo de deploy.

### Passo 1: Salvar as Credenciais no GitHub Secrets
1. No seu repositório do GitHub, vá em **Settings** -> **Secrets and variables** -> **Actions**.
2. Clique no botão **New repository secret** e adicione o seguinte segredo:
   - **Nome**: `DATABASE_URL`
   - **Valor**: A URL do seu banco do Turso (ex: `libsql://enxoval-db-usuario.turso.io`)
3. Adicione mais um segredo clicando em **New repository secret**:
   - **Nome**: `DATABASE_TOKEN`
   - **Valor**: O Token gerado no Turso.

### Passo 2: Criar o Workflow do GitHub Actions
Na raiz do seu projeto, crie a pasta `.github/workflows` (se ainda não existir) e adicione o arquivo `deploy.yml` com as instruções abaixo:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches:
      - main # Dispara a cada push na branch principal

permissions:
  contents: write

jobs:
  build-and-deploy:
    concurrency: ci-${{ github.ref }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout 🛎️
        uses: actions/checkout@v4

      - name: Configurar Credenciais do Banco de Dados 🔧
        run: |
          # Substitui os valores vazios padrão no arquivo config.js pelas credenciais guardadas no GitHub Secrets
          sed -i "s|DATABASE_URL: 'enxoval.db'|DATABASE_URL: '${{ secrets.DATABASE_URL }}'|g" config.js
          sed -i "s|DATABASE_TOKEN: ''|DATABASE_TOKEN: '${{ secrets.DATABASE_TOKEN }}'|g" config.js
          echo "Credenciais do banco de dados configuradas com sucesso no arquivo de build!"

      - name: Deploy to GitHub Pages 🚀
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: . # Diretório com os arquivos estáticos do site
          branch: gh-pages # Branch destino do deploy
```

### Passo 3: Ativar o GitHub Pages no Repositório
1. Assim que você enviar as alterações (`git push`), a Action rodará e gerará a branch `gh-pages`.
2. No seu repositório no GitHub, vá em **Settings** -> **Pages**.
3. Em **Build and deployment** -> **Source**, selecione **Deploy from a branch**.
4. Em **Branch**, selecione `gh-pages` e a pasta `/ (root)`. Clique em **Save**.

---

## 3. Funcionamento Local vs. Produção (Nuvem)

A aplicação foi desenvolvida com um sistema de **fallback inteligente**:

- **Sem Credenciais (Local/Desenvolvimento)**: Se você abrir a aplicação localmente sem configurar os valores de `DATABASE_URL` e `DATABASE_TOKEN` no `config.js`, ela usará automaticamente o **SQLite local rodando em WebAssembly** (`sql.js`), salvando tudo em cache no **IndexedDB** do seu navegador e carregando o arquivo `enxoval.db` da pasta raiz.
- **Com Credenciais (Nuvem/Produção)**: Se as variáveis estiverem preenchidas (como ocorre após o build do Actions com os Secrets do GitHub), a aplicação conecta-se de forma direta ao banco de dados do **Turso/libSQL**. As tabelas necessárias serão criadas automaticamente no primeiro acesso e o estado inicial padrão (seção "Cozinha") será semeado caso o banco esteja completamente vazio.
