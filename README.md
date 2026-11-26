# Loja Escolar

Projeto simples da atividade: Express, Sequelize, PostgreSQL do Supabase, UIKit, login e uma listagem extra em React.

## Rodar

1. Crie um banco PostgreSQL no Supabase e copie sua connection string (URI).
2. Copie `.env.example` para `.env` e preencha `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Para a senha, escolha algo próprio e não publique o `.env`.
3. Execute `npm install` e `npm start`; abra `http://localhost:3000`. As tabelas são criadas automaticamente. Crie uma conta comum pela tela ou entre com o administrador definido no `.env`.
4. Para a aplicação React extra, em outro terminal execute `npm install --prefix react-extra` e `npm run react`; abra `http://localhost:5173`. Entre no sistema principal primeiro, no mesmo navegador, para a listagem React poder consultar os produtos.

## Models e autorização

Oito models: User, Profile, Category, Product, Supplier, Customer, Order e OrderItem. Associações: User–Profile (1:1), Category–Product, Supplier–Product e Customer–Order (1:N), Order–Product (N:N) pela tabela OrderItem.

O usuário cadastrado recebe papel `user` e pode consultar produtos. O `admin` pode consultar e realizar CRUD nas telas de todas as tabelas. O primeiro administrador é criado a partir de `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env`.

O servidor usa `sequelize.sync()` para criar as tabelas em um banco vazio. Em publicação, migrations e armazenamento persistente de sessão são melhorias recomendadas.
