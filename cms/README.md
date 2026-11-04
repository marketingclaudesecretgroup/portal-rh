# Comunica Secret — CMS do Portal de Gente & Gestão

### Compatibilidade com o runtime da Vercel

Use Node.js 22.12 ou mais recente. `npm ci` executa o `postinstall`, que gera `src/sanitize-html.cjs` com o sanitizador e suas dependências em CommonJS. Esse arquivo também é gerado por `npm run build` e pelo build da Vercel. Isso permite manter `sanitize-html` 2.18.1 nos ambientes serverless que desabilitam `require(ESM)`.

O arquivo gerado não é versionado e não deve ser editado manualmente. A Vercel o inclui no pacote da função. Após atualizar as dependências, execute `npm run build` antes de iniciar a aplicação. Para conferir a inicialização, os templates, a sanitização e os arquivos estáticos no modo restrito, execute `npm run test:runtime`; esse teste não precisa de banco de dados.

CMS em **Node.js (Express)** para o portal do RH da Secret Outlet, pronto para rodar na **Vercel** com **Supabase**:

- **Supabase Postgres** guarda páginas, comunicados, usuários, configurações e sessões de login.
- **Supabase Storage** guarda imagens e PDFs (o navegador envia direto ao Storage, sem passar pelo limite de 4,5 MB da Vercel).
- **Vercel** roda o site e o painel.

Na primeira execução, o sistema cria as tabelas e o conteúdo inicial sozinho (Início, Onboarding, Desenvolvimento, Treinamentos, NR1, Benefícios, Calendário, Gente & Gestão, Políticas e 4 comunicados de exemplo).

## O que o painel faz

- **Páginas**: criar, editar, duplicar, excluir, rascunho/publicada, menu e submenu, página inicial.
- **Editor de blocos**: Banner principal, Introdução, Acesso rápido, Cards com ícone, Passo a passo, Em destaque, Faixa de destaque, Agenda, Últimos comunicados, Perguntas frequentes, Ficha de informações, Texto livre, Incorporar (Google Agenda/Drive/Forms/vídeo), Fale com o RH e Aviso.
- **Comunicados**: editor de texto, capa, categoria, resumo, fixar no topo e agendamento.
- **Mídia**: imagens e PDFs até 10 MB.
- **Usuários**: **Administrador** (tudo) e **Editor** (páginas, comunicados e mídia).
- **Configurações**: logotipo, contatos do RH, WhatsApp, redes sociais e rodapé.

---

## Passo a passo: Supabase + Vercel

### 1. Criar o projeto no Supabase

1. Em https://supabase.com, crie um projeto (região sugerida: **South America (São Paulo)**). Anote a senha do banco.
2. Pegue a **string de conexão**: botão **Connect** no topo do projeto → **Transaction pooler** (porta **6543**). Troque `[YOUR-PASSWORD]` pela senha do banco. Essa é a `DATABASE_URL`.
3. Pegue as chaves em **Project Settings → API Keys**:
   - **Project URL** → `SUPABASE_URL`
   - chave **service_role** (secreta) → `SUPABASE_SERVICE_ROLE_KEY`

   A service_role dá acesso total: cadastre só na Vercel, nunca coloque em código ou mande por e-mail/WhatsApp.

Não precisa criar tabelas nem bucket: o sistema cria tudo no primeiro acesso (o bucket público se chama `portal-rh`).

### 2. Subir o código para o GitHub

O repositório é `marketingclaudesecretgroup/portal-rh` (o CMS fica na pasta `cms`). O `.gitignore` já impede o envio de `node_modules`, `data` e `.env`.

### 3. Importar na Vercel

1. **Add New → Project** → escolha o repositório.
2. **Root Directory**: `cms` (clique em *Edit* e selecione a pasta). **Application Preset**: **Other**. (O arquivo `vercel.json` já configura tudo; não precisa preencher build nem output.)
3. Em **Environment Variables**, cadastre:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | string do Transaction pooler (porta 6543) |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role |
| `SESSION_SECRET` | um texto longo e aleatório (40+ caracteres) |

4. **Deploy**. Ao terminar, abra `https://seu-projeto.vercel.app/admin` e crie a conta de administrador.

Para usar um endereço próprio (ex.: `rh.secretoutlet.com.br`), vá em **Settings → Domains** na Vercel.

---

## Rodar no computador (opcional)

1. Instale o **Node.js 20+**.
2. Copie `.env.example` para `.env` e preencha (pode usar o mesmo Supabase).
3. No terminal, dentro desta pasta:
   ```
   npm install
   npm start
   ```
4. Acesse http://localhost:3000 e http://localhost:3000/admin.

Sem `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, os arquivos enviados ficam na pasta local `data/uploads` (útil só para testes).

## Testes

Os testes criam um *schema* temporário no Postgres e apagam ao final; os dados reais não são tocados.
Defina `TEST_DATABASE_URL` (um Postgres local ou a conexão **Direct**/**Session pooler** do Supabase — não use a de produção se puder evitar) e rode:

```
npm test                      # 39 testes de integração
npx playwright install chromium
npm run test:ui               # 8 testes no navegador
```

No Windows (PowerShell), para usar o Chrome instalado: `$env:PLAYWRIGHT_CHANNEL="chrome"; npm run test:ui`.
Resultados e correções em [TESTES.md](TESTES.md).

## Esqueceu a senha?

Outro administrador redefine em **Usuários**. Se não houver nenhum, com o `.env` preenchido rode:
```
npm run reset-password -- rh@secretoutlet.com.br NovaSenha123
```

## Backup

Tudo fica no Supabase. Os planos pagos fazem backup diário automático; no gratuito, exporte de vez em quando em **Database → Backups** ou com `pg_dump`. Projetos gratuitos do Supabase são pausados após alguns dias sem acesso — reative pelo painel se isso acontecer.

## Dicas de uso

- Links dos botões aceitam páginas do portal (`/beneficios`), endereços externos (`https://…`), e-mail (`mailto:`) e âncoras da mesma página (`#secao-3` = 3º bloco).
- Google Agenda: Configurações da agenda → Integrar agenda → copie o endereço de `src="…"` e cole no bloco **Incorporar**.
- Os comunicados e alguns links iniciais são **exemplos**: troque antes de divulgar.
- O portal é público para quem tiver o endereço. Para restringir aos colaboradores, é possível adicionar um login para colaboradores.

## Estrutura

```
app.js                 aplicação Express
server.js              execução local (npm start)
api/index.js           entrada na Vercel
vercel.json            configuração da Vercel
src/db.js              conexão Postgres, tabelas e configurações
src/storage.js         Supabase Storage (ou disco local)
src/blocks.js          definição dos blocos (o editor é gerado daqui)
src/icons.js           biblioteca de ícones
src/seed.js            conteúdo inicial
src/routes/            site público e painel
views/                 templates (site, painel e blocos)
public/                CSS e JavaScript
```

Para criar um novo tipo de bloco: adicione a definição em `src/blocks.js` e um template `views/blocks/<tipo>.ejs`.
