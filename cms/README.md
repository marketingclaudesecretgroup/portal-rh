# Comunica Secret — CMS do Portal de Gente & Gestão

CMS simples em **Node.js + SQLite** para o portal do RH da Secret Outlet. O site público já vem com as páginas que vocês criaram (Início, Onboarding, Desenvolvimento, Treinamentos, NR1, Benefícios, Calendário, Gente & Gestão e Políticas), e o RH edita tudo pelo painel em `/admin`.

## O que o painel faz

- **Páginas**: criar, editar, duplicar, excluir, rascunho/publicada, posição no menu e submenu, página inicial.
- **Editor de blocos**: monte a página empilhando blocos com o visual do portal — Banner principal, Introdução, Acesso rápido, Cards com ícone, Passo a passo, Em destaque, Faixa de destaque, Agenda, Últimos comunicados, Perguntas frequentes, Ficha de informações, Texto livre, Incorporar (Google Agenda/Drive/Forms/vídeo), Fale com o RH e Aviso. Cada bloco pode ser reordenado, duplicado ou ocultado.
- **Comunicados (artigos)**: texto com editor, capa, categoria, resumo, fixar no topo e agendamento por data. Aparecem em `/comunicados` e no bloco "Últimos comunicados".
- **Mídia**: envio de imagens e PDFs (até 10 MB).
- **Usuários**: perfis **Administrador** (acesso total) e **Editor** (páginas, comunicados e mídia).
- **Configurações**: logotipo, contatos do RH, WhatsApp, redes sociais e rodapé.

## Rodar no computador (para testar)

1. Instale o **Node.js 22 ou 24** (https://nodejs.org). A execução local foi validada com Node.js 24.
2. Abra o terminal na pasta `cms` e rode (se estiver na raiz do projeto, execute `cd cms` antes):
   ```
   npm ci
   npm start
   ```
3. Acesse http://localhost:3000. Em http://localhost:3000/admin, crie a primeira conta de administrador.

O banco (`data/portal.db`) e os arquivos enviados (`data/uploads/`) ficam na pasta `data`. **Faça backup dessa pasta**: ela guarda todo o conteúdo.

## Testes automatizados

Na pasta `cms`, execute `npm test` para os testes de integração. Eles iniciam um servidor em porta livre e usam um banco temporário, sem alterar `data/portal.db`.

Para testar a interface no Chromium:

```
npx playwright install chromium
npm run test:ui
```

Se o Chrome já estiver instalado, pode usá-lo sem baixar o Chromium. No PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:ui
```

Os testes de interface também usam dados temporários e não acessam contas nem sessões pessoais do navegador. Consulte [TESTES.md](TESTES.md) para os resultados e as correções verificadas.

## Publicar

Qualquer serviço que rode Node.js e tenha **disco persistente** serve.

**Render / Railway**
- Build: `npm install` · Start: `npm start`
- Crie um disco persistente (ex.: montado em `/var/data`) e defina `DATA_DIR=/var/data`.
- Defina `COOKIE_SECURE=true` (o site roda em https).

**VPS / servidor próprio**
```
npm install --omit=dev
DATA_DIR=/srv/comunica-secret PORT=3000 COOKIE_SECURE=true npx pm2 start server.js --name comunica-secret
```
Coloque um Nginx ou Caddy na frente com HTTPS.

### Variáveis de ambiente

| Variável | Para quê | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `DATA_DIR` | Pasta do banco e dos uploads | `./data` |
| `COOKIE_SECURE` | `true` quando o site usa https | `false` |
| `SESSION_SECRET` | Segredo das sessões (opcional; gerado automaticamente) | — |

## Esqueceu a senha?

Outro administrador redefine em **Usuários**. Se não houver nenhum, rode no servidor:
```
npm run reset-password -- rh@secretoutlet.com.br NovaSenha123
```

## Dicas de uso

- Os links dos botões aceitam páginas do portal (`/beneficios`), endereços externos (`https://…`), e-mail (`mailto:`) e âncoras para seções da mesma página (`#secao-3` = 3º bloco).
- Para o Google Agenda: em Configurações da agenda → Integrar agenda → copie o endereço que aparece em `src="…"` e cole no bloco **Incorporar**.
- Os comunicados e alguns links iniciais são **exemplos**: troque pelas informações reais antes de divulgar.
- O portal está público para quem tiver o endereço (e fora do Google). Se ele precisar ser restrito aos colaboradores, publique atrás da rede/VPN da empresa ou peça a evolução "login para colaboradores".

## Estrutura

```
server.js              inicialização
src/db.js              banco SQLite e configurações
src/blocks.js          definição dos blocos (o editor é gerado daqui)
src/icons.js           biblioteca de ícones
src/seed.js            conteúdo inicial
src/routes/public.js   site público
src/routes/admin.js    painel
views/blocks/          visual de cada bloco
public/css, public/js  estilos e scripts
```

Para criar um novo tipo de bloco: adicione a definição em `src/blocks.js` e um template `views/blocks/<tipo>.ejs`.
