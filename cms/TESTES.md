# Verificação do Portal RH

## Inicialização serverless (04/11/2026)

O erro `ERR_REQUIRE_ESM` em `htmlparser2` foi reproduzido com `node --no-experimental-require-module`, a restrição do ambiente que derrubava a função antes de servir qualquer página. A instalação/build agora empacota o `sanitize-html` 2.18.1 e suas dependências em CommonJS, mantendo a versão atual do sanitizador.

`npm run test:runtime` aprovou quatro verificações com essa restrição: carregamento do handler da Vercel, remoção de HTML ativo e preservação da formatação, renderização EJS e respostas HTTP 200 para CSS e Quill. Esses testes não dependem de credenciais ou conexão Postgres. O arquivo CommonJS é gerado automaticamente no `postinstall` e incluído na função pelo `vercel.json`.

## Versão Vercel + Supabase (04/11/2026)

O CMS passou a usar Postgres (Supabase) no lugar do SQLite e o Supabase Storage para arquivos. Todas as correções listadas abaixo foram mantidas na nova versão, e a mesma suíte foi adaptada para o Postgres (cada execução usa um *schema* temporário).

- `npm test`: **39 testes passaram** (Linux, Node.js 22, PostgreSQL 17).
- `npm run test:ui`: **8 testes passaram** (Chromium headless).
- O teste de integridade do SQLite (`PRAGMA integrity_check`) foi substituído por uma verificação de referências órfãs no Postgres.
- Os testes usam armazenamento local de arquivos; o envio direto ao Supabase Storage (URL assinada) deve ser conferido no primeiro deploy.

## Versão SQLite (histórico)

Execução em 04/11/2026, Windows, Node.js 24.14.1 e Chrome em modo headless pelo Playwright.

## Resultado

- `npm test`: **39 testes passaram**, sem falhas.
- `PLAYWRIGHT_CHANNEL=chrome npm run test:ui`: **8 testes passaram**, sem falhas. No PowerShell, defina a variável conforme o README.
- Testes isolados com servidor em porta livre, banco SQLite e uploads temporários; conteúdo de `cms/data` preservado.
- `npm audit`: nenhum alerta moderado, alto ou crítico; permanece um alerta baixo no Quill.

## Cobertura

- Nove páginas públicas, comunicados, links internos, arquivos estáticos e resposta 404.
- Criação da primeira conta, login, logout, CSRF, limite de tentativas e acesso de administrador/editor.
- Páginas: criação, edição, publicação, rascunhos, prévia, duplicação, exclusão, slugs e hierarquia do menu.
- Todos os tipos de bloco, HTML sanitizado e estabilidade das âncoras ao ocultar blocos.
- Comunicados: edição, filtros, categorias, agendamento, datas inválidas e prévia autenticada.
- Usuários: criação, duplicidade, proteção do último administrador, desativação, alteração de perfil e senhas.
- Revogação de sessões após desativação e redefinição de senha pelo painel, perfil e terminal.
- Upload, listagem, download e exclusão de imagens/PDFs; formato proibido e limite de 10 MB.
- SVG com script: imagem continua renderizando e o script não executa ao abrir o arquivo.
- Configurações e validação da página inicial.
- Interface: menu móvel, editor de blocos, editor de comunicados, seletor de mídia e aviso de alterações na capa.
- Páginas públicas e painel em larguras de 1440 e 390 pixels, sem erros JavaScript ou rolagem horizontal nos cenários verificados.

## Problemas reproduzidos e corrigidos

| Área | Problema observado | Correção |
| --- | --- | --- |
| Agendamento | Artigo futuro era acessível pela URL direta e sua categoria aparecia publicamente. | Data de publicação verificada também no detalhe e nas categorias; prévia preservada para usuários autenticados. |
| Datas | Horário com segundos ou data inválida podia resultar em publicação imediata. | Aceita minutos ou segundos, valida datas reais e rejeita entrada inválida antes de salvar. |
| Menu | Página-mãe inexistente causava erro 500; mudanças de hierarquia eram aceitas silenciosamente ou ocultavam descendentes. | Validação explícita da existência e do limite de dois níveis, incluindo no seletor do editor. |
| Âncoras | Ocultar um bloco renumerava as seções seguintes e quebrava botões. | Mantém a posição original de cada seção. |
| Formulários | IDs inválidos criavam novos conteúdos; edição de registro inexistente retornava sucesso ou erro 500; filtros malformados causavam erro 500. | IDs, registros, filtros e página inicial validados com resposta 400/404. |
| Login | Bloqueio por excesso de tentativas retornava erro 500 ao renderizar formulário sem token CSRF. | Token preparado antes da aplicação do limite; resposta 429 verificada. |
| Sessões | Desativação e troca de senha não encerravam corretamente sessões anteriores. | Revogação pelo ID do usuário no JSON da sessão, aplicada no painel, perfil e script de redefinição. |
| Uploads | SVG podia executar script na origem do portal; exclusão retornava sucesso antes de concluir e ignorava erros do disco. | CSP com sandbox nos arquivos enviados; exclusão aguarda o disco e trata falhas. |
| Capa | Escolher/remover uma imagem não disparava o aviso de alteração pendente. | Campos de imagem disparam eventos de alteração, verificados pelo navegador. |
| Dependências | EJS carregava dependências com alertas moderados e Multer usava uma versão descontinuada. | EJS 7.0.2 e Multer 2.5.0, verificados novamente nos fluxos completos. |

## Alerta remanescente

O Quill 2.0.3 mantém o alerta baixo [GHSA-v3m3-f69x-jf25](https://github.com/advisories/GHSA-v3m3-f69x-jf25), sem versão corrigida indicada pelo mantenedor. O relatório do npm sugere downgrade para 2.0.2, mas isso não representa uma correção oficial. A aplicação sanitiza o HTML exportado com `sanitize-html` antes de armazenar e publicar; o teste com scripts, atributos de evento e links `javascript:` passou. O alerta da dependência continua aberto e deve ser acompanhado.
