# Portal RH — Comunica Secret

Portal de Gente & Gestão da Secret Outlet, com site público e painel administrativo para gerenciar páginas em blocos, comunicados, imagens, PDFs e usuários.

Hospedagem: **Vercel** (aplicação) + **Supabase** (banco Postgres e armazenamento de arquivos).

## Publicar

O passo a passo completo está em [cms/README.md](cms/README.md). Resumo:

1. Crie um projeto no Supabase e copie a string do **Transaction pooler**, a **Project URL** e a chave **service_role**.
2. Na Vercel, importe este repositório com **Root Directory = `cms`** e **Application Preset = Other**.
3. Cadastre as variáveis `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SESSION_SECRET`.
4. Faça o deploy e acesse `/admin` para criar a conta de administrador.

## Executar localmente

Requer Node.js 22 ou mais recente.

```sh
cd cms
cp .env.example .env   # preencha com os dados do Supabase
npm ci
npm start
```

- Portal: http://localhost:3000
- Painel: http://localhost:3000/admin

## Verificação

```sh
cd cms
npm test
npx playwright install chromium
npm run test:ui
```

Os testes usam um schema temporário no Postgres (`TEST_DATABASE_URL`). A verificação de 04/11/2026 aprovou 39 testes de integração e 8 de interface na versão Supabase.

- [Instalação, configuração e publicação](cms/README.md)
- [Resultados dos testes e correções](cms/TESTES.md)
- [Planejamento e conteúdo original](PORTAL_RH_GOOGLE_SITES.md)

## Estrutura

- `cms/`: aplicação Node.js (Express, EJS, Postgres/Supabase), incluindo testes automatizados.
- `mockups/` e `Claude outputs/`: referências visuais do portal e do painel.
- Arquivos HTML e Markdown na raiz: conteúdos e materiais de planejamento do portal.

## Dependências

O Quill 2.0.3 mantém um alerta baixo sem correção oficial; o HTML do editor é sanitizado no servidor antes de ser salvo e publicado (há teste de regressão). Detalhes em `cms/TESTES.md`.
