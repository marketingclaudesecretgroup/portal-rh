# Portal RH — Comunica Secret

Portal de Gente & Gestão da Secret Outlet, com site público e painel administrativo para gerenciar páginas em blocos, comunicados, imagens, PDFs e usuários.

## Executar localmente

Requer Node.js 22 ou 24.

```sh
cd cms
npm ci
npm start
```

- Portal: http://localhost:3000
- Painel: http://localhost:3000/admin
- No primeiro acesso ao painel, crie a conta de administrador.

O banco SQLite e os uploads são criados automaticamente em `cms/data`. Essa pasta contém os dados de uso e não é versionada. Para migrar uma instalação existente, transfira seu backup por um canal privado e configure `DATA_DIR` conforme a documentação.

## Estrutura

- `cms/`: aplicação Node.js, Express, EJS e SQLite, incluindo testes automatizados.
- `mockups/` e `Claude outputs/`: referências visuais do portal e do painel.
- Arquivos HTML e Markdown na raiz: conteúdos e materiais de planejamento do portal.

## Verificação

```sh
cd cms
npm test
npx playwright install chromium
npm run test:ui
```

Os testes usam banco, uploads e servidor temporários. A verificação de 04/11/2026 aprovou 39 testes de integração e 8 de interface. Para usar o Chrome já instalado, consulte as instruções no README do CMS.

- [Instalação, configuração e publicação](cms/README.md)
- [Resultados dos testes e correções](cms/TESTES.md)
- [Planejamento e conteúdo original](PORTAL_RH_GOOGLE_SITES.md)

## Dependências

O projeto mantém um alerta baixo do Quill 2.0.3, sem correção oficial indicada pelo mantenedor. O HTML exportado pelo editor é sanitizado no servidor antes de ser armazenado e publicado; essa proteção possui teste de regressão. Detalhes e referência no relatório de testes.
