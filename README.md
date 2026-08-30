# Julius — controle financeiro do casal

App de controle financeiro doméstico feito em React + Supabase, pensado para
você e sua esposa lançarem receitas e despesas no mesmo "lar" (household) e
acompanharem juntos: saldo do mês, categorias, gráfico de gastos e metas de
economia.

## 1. Configurar o Supabase

1. No painel do seu projeto Supabase, abra **SQL Editor** → **New query**.
2. Cole todo o conteúdo do arquivo [`supabase/schema.sql`](./supabase/schema.sql) e clique em **Run**.
   Isso cria as tabelas (`households`, `profiles`, `categories`, `transactions`, `goals`),
   as políticas de RLS (cada casal só enxerga os próprios dados) e as funções
   `create_household` / `join_household` usadas na tela de onboarding.
3. Em **Authentication → Providers**, confirme que **Email** está habilitado.
   Se quiser pular a confirmação por e-mail durante os testes, desative
   "Confirm email" em **Authentication → Settings**.
4. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.
   Elas vão para o `.env` do app (a chave anônima é segura para expor no
   front-end — quem protege os dados é a Row Level Security do banco).

## 2. Rodar localmente

```bash
npm install
cp .env.example .env
# edite .env com sua URL e anon key do Supabase
npm run dev
```

Abra o link que aparecer no terminal (normalmente `http://localhost:5173`).

Crie sua conta, escolha **Criar lar** e dê um nome (ex: "Casa do Victor").
Isso gera um **código de convite** (ex: `7XQK2P`), mostrado na barra lateral.
Sua esposa cria a conta dela e escolhe **Entrar com código**, usando esse
mesmo código — a partir daí, os lançamentos de vocês dois aparecem juntos.

## 3. Subir para o GitHub

```bash
git init
git add .
git commit -m "Primeira versão do app financeiro"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/julius.git
git push -u origin main
```

O `.gitignore` já impede que o `.env` (com suas chaves) vá para o repositório.

## 4. Publicar com GitHub Pages (deploy automático)

O repositório já inclui um workflow em
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) que builda e
publica o app a cada push na branch `main`.

1. No GitHub, vá em **Settings → Pages** do repositório e em **Build and
   deployment** selecione a fonte **GitHub Actions**.
2. Em **Settings → Secrets and variables → Actions**, adicione dois secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   (os mesmos valores do seu `.env`)
3. Dê um push na `main` (ou rode o workflow manualmente em **Actions**).
   Em alguns minutos o app estará em
   `https://SEU-USUARIO.github.io/julius/`.

> O app usa `HashRouter` (URLs com `#`) exatamente para funcionar bem no
> GitHub Pages, que não tem como redirecionar rotas de SPA automaticamente.

## Estrutura do projeto

```
src/
  supabaseClient.js      cliente do Supabase (lê variáveis de ambiente)
  contexts/AuthContext.jsx  sessão, perfil e household do usuário logado
  pages/
    Login.jsx             entrar / criar conta
    Onboarding.jsx        criar lar ou entrar com código de convite
    Dashboard.jsx         saldo do mês, resumo e gráfico por categoria
    Transactions.jsx      lançar, editar e excluir receitas/despesas
    Categories.jsx        categorias de receita e despesa
    Goals.jsx             metas de economia com barra de progresso
  components/            Layout, MonthPicker, CategoryTag
  lib/finance.js          formatação de moeda e datas
supabase/schema.sql       schema completo (tabelas + RLS + funções)
```

## Próximos passos possíveis

- Exportar lançamentos em CSV/PDF.
- Notificação quando uma categoria estourar um limite mensal.
- Editar o nome do lar e remover integrantes.

Qualquer dúvida na hora de configurar, é só perguntar.
