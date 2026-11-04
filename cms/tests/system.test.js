const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { startPortal, setupAdmin, login, credentials } = require('./helpers');

let portal, admin, visitor;
before(async () => {
  portal = await startPortal();
  visitor = portal.session();
  admin = await setupAdmin(portal);
});
after(async () => { if (portal) await portal.close(); });
const postPage = (values) => admin.post('/admin/paginas/0', { title: 'Página QA', status: 'published', blocks: '[]', ...values });
const pageId = response => Number(response.headers.get('location').split('/').pop());
const postArticle = values => admin.post('/admin/comunicados/0', { title: 'Comunicado QA', status: 'published', content: '<p>Conteúdo QA</p>', ...values });

test('todas as páginas e os links internos iniciais respondem', async () => {
  const urls = ['/', '/comunicados', ...(await portal.db.prepare('SELECT slug FROM pages').all()).map(p => '/' + p.slug), ...(await portal.db.prepare('SELECT slug FROM articles').all()).map(a => '/comunicados/' + a.slug)];
  const links = new Set();
  for (const url of urls) {
    const response = await visitor.get(url);
    assert.ok([200, 301].includes(response.status), url);
    for (const [, link] of response.text.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) links.add(link.replace(/&amp;/g, '&'));
  }
  for (const link of links) assert.ok([200, 301, 302].includes((await visitor.get(link)).status), link);
});

test('404 e arquivos CSS, JS e Quill', async () => {
  assert.equal((await visitor.get('/nao-existe')).status, 404);
  for (const url of ['/static/css/site.css', '/static/css/admin.css', '/static/js/site.js', '/static/js/admin.js', '/static/js/blocks-editor.js', '/static/js/article-editor.js', '/vendor/quill/quill.js']) {
    assert.equal((await visitor.get(url)).status, 200, url);
  }
});

test('configuração inicial fecha após criar o administrador', async () => {
  assert.equal((await portal.db.prepare('SELECT COUNT(*) n FROM users').get()).n, 1);
  assert.equal((await visitor.get('/admin/setup')).status, 302);
  assert.equal((await visitor.post('/admin/setup', credentials)).status, 403);
});

test('todos os formulários e listas do painel renderizam', async () => {
  const urls = ['/admin', '/admin/paginas', '/admin/paginas/nova', '/admin/comunicados', '/admin/comunicados/novo', '/admin/midia', '/admin/midia.json', '/admin/usuarios', '/admin/usuarios/novo', '/admin/configuracoes', '/admin/perfil', '/admin/usuarios/1'];
  urls.push(...(await portal.db.prepare('SELECT id FROM pages').all()).map(p => '/admin/paginas/' + p.id));
  urls.push(...(await portal.db.prepare('SELECT id FROM articles').all()).map(a => '/admin/comunicados/' + a.id));
  for (const url of urls) assert.equal((await admin.get(url)).status, 200, url);
});

test('rotas do painel e API exigem autenticação', async () => {
  for (const url of ['/admin', '/admin/paginas', '/admin/comunicados', '/admin/midia', '/admin/usuarios', '/admin/configuracoes']) assert.equal((await visitor.get(url)).status, 302, url);
  assert.equal((await visitor.get('/admin/midia.json', { headers: { Accept: 'application/json' } })).status, 401);
});

test('CSRF impede alteração sem token e com token inválido', async () => {
  const count = (await portal.db.prepare('SELECT COUNT(*) n FROM pages').get()).n;
  for (const _csrf of ['', 'invalido']) assert.equal((await admin.post('/admin/paginas/0', { title: 'Invasão', _csrf })).status, 403);
  assert.equal((await portal.db.prepare('SELECT COUNT(*) n FROM pages').get()).n, count);
});

test('páginas: criar, editar, visualizar rascunho, publicar, duplicar e excluir', async () => {
  const created = await postPage({ title: 'Página de integração', slug: 'pagina-integracao', status: 'draft', blocks: JSON.stringify([{ type: 'intro', data: { title: 'Texto inicial' } }]) });
  assert.equal(created.status, 302);
  const id = pageId(created);
  assert.equal((await visitor.get('/pagina-integracao')).status, 404);
  assert.match((await admin.get('/pagina-integracao')).text, /Texto inicial/);
  assert.equal((await admin.post('/admin/paginas/' + id, { title: 'Página atualizada', slug: 'pagina-integracao', status: 'published', blocks: JSON.stringify([{ type: 'intro', data: { title: 'Texto atualizado' } }]) })).status, 302);
  assert.match((await visitor.get('/pagina-integracao')).text, /Texto atualizado/);
  const copy = await admin.post(`/admin/paginas/${id}/duplicar`);
  assert.equal(copy.status, 302);
  assert.equal((await portal.db.prepare('SELECT status FROM pages WHERE id=?').get(pageId(copy))).status, 'draft');
  await admin.post(`/admin/paginas/${id}/excluir`);
  assert.equal((await visitor.get('/pagina-integracao')).status, 404);
});

test('slugs duplicados e reservados recebem endereço válido', async () => {
  const a = pageId(await postPage({ slug: 'beneficios' }));
  assert.notEqual((await portal.db.prepare('SELECT slug FROM pages WHERE id=?').get(a)).slug, 'beneficios');
  const b = pageId(await postPage({ slug: 'admin' }));
  assert.notEqual((await portal.db.prepare('SELECT slug FROM pages WHERE id=?').get(b)).slug, 'admin');
});

test('página inicial não pode ser excluída', async () => {
  const id = Number((await portal.db.prepare("SELECT value FROM settings WHERE key='home_page_id'").get()).value);
  assert.equal((await admin.post(`/admin/paginas/${id}/excluir`)).status, 302);
  assert.ok((await portal.db.prepare('SELECT id FROM pages WHERE id=?').get(id)));
});

test('página-mãe inexistente é rejeitada sem erro 500', async () => {
  const response = await postPage({ slug: 'mae-invalida', parent_id: '999999' });
  assert.equal(response.status, 400);
  assert.equal((await portal.db.prepare("SELECT COUNT(*) n FROM pages WHERE slug='mae-invalida'").get()).n, 0);
});

test('menu impede ciclo entre página e subpágina', async () => {
  const parent = pageId(await postPage({ slug: 'mae-ciclo', show_in_menu: 'on' }));
  const child = pageId(await postPage({ slug: 'filha-ciclo', parent_id: String(parent), show_in_menu: 'on' }));
  const response = await admin.post('/admin/paginas/' + parent, { title: 'Mãe', slug: 'mae-ciclo', status: 'published', parent_id: String(child), blocks: '[]' });
  assert.equal(response.status, 400);
  assert.equal((await portal.db.prepare('SELECT parent_id FROM pages WHERE id=?').get(parent)).parent_id, null);
});

test('árvore do menu não permite mover página com filhos para terceiro nível', async () => {
  const root = pageId(await postPage({ slug: 'raiz-menu' }));
  const parent = pageId(await postPage({ slug: 'mae-menu' }));
  await postPage({ slug: 'filha-menu', parent_id: String(parent) });
  const response = await admin.post('/admin/paginas/' + parent, { title: 'Mãe', slug: 'mae-menu', status: 'published', parent_id: String(root), blocks: '[]' });
  assert.equal(response.status, 400);
});

test('todos os tipos de bloco renderizam e HTML perigoso é removido', async () => {
  const { BLOCKS } = require('../src/blocks');
  const blocks = Object.keys(BLOCKS).map(type => ({ type, data: type === 'rich_text' ? { html: '<p>Seguro</p><script>alert(1)</script><img src=x onerror=alert(1)>' } : {} }));
  const response = await postPage({ slug: 'todos-blocos', blocks: JSON.stringify(blocks) });
  assert.equal(response.status, 302);
  const rendered = await visitor.get('/todos-blocos');
  assert.equal(rendered.status, 200);
  assert.match(rendered.text, /Seguro/);
  assert.doesNotMatch(rendered.text, /onerror=|<script>alert/);
});

test('ocultar bloco preserva as âncoras dos blocos seguintes', async () => {
  await postPage({ slug: 'ancoras', blocks: JSON.stringify([
    { type: 'hero', data: { button1_label: 'Ir ao terceiro', button1_url: '#secao-3' } },
    { type: 'intro', hidden: true, data: { title: 'Oculto' } },
    { type: 'intro', data: { title: 'Destino da âncora' } }
  ]) });
  const response = await visitor.get('/ancoras');
  assert.doesNotMatch(response.text, />Oculto</);
  assert.match(response.text, /id="secao-3"/);
});

test('comunicados: criar, filtrar, editar, rascunho e excluir', async () => {
  const response = await postArticle({ slug: 'artigo-integracao', category: 'QA', excerpt: 'Resumo QA' });
  assert.equal(response.status, 302);
  const id = pageId(response);
  assert.match((await visitor.get('/comunicados/artigo-integracao')).text, /Conteúdo QA/);
  assert.match((await visitor.get('/comunicados?categoria=QA')).text, /Resumo QA/);
  assert.equal((await admin.post('/admin/comunicados/' + id, { title: 'Rascunho QA', slug: 'artigo-integracao', content: '<p>Rascunho QA</p>', status: 'draft' })).status, 302);
  assert.equal((await visitor.get('/comunicados/artigo-integracao')).status, 404);
  assert.equal((await admin.get('/comunicados/artigo-integracao')).status, 200);
  await admin.post(`/admin/comunicados/${id}/excluir`);
  assert.equal((await portal.db.prepare('SELECT id FROM articles WHERE id=?').get(id)), undefined);
});

test('agendamento esconde comunicado futuro também no endereço direto', async () => {
  const response = await postArticle({ slug: 'futuro-qa', category: 'Categoria secreta futura', published_at: '2099-11-01T12:30' });
  assert.equal(response.status, 302);
  assert.equal((await portal.db.prepare("SELECT published_at FROM articles WHERE slug='futuro-qa'").get()).published_at, '2099-11-01 15:30:00');
  assert.equal((await visitor.get('/comunicados/futuro-qa')).status, 404);
  assert.equal((await admin.get('/comunicados/futuro-qa')).status, 200);
});

test('categorias e listagem não revelam comunicados futuros', async () => {
  await postArticle({ slug: 'categoria-futura', category: 'Tema futuro confidencial', published_at: '2099-12-01T12:30' });
  const response = await visitor.get('/comunicados');
  assert.equal(response.status, 200);
  assert.doesNotMatch(response.text, /Tema futuro confidencial|categoria-futura/);
});

test('data de publicação com segundos preserva o agendamento', async () => {
  const response = await postArticle({ slug: 'data-com-segundos', published_at: '2099-11-01T12:30:45' });
  assert.equal(response.status, 302);
  assert.equal((await portal.db.prepare("SELECT published_at FROM articles WHERE slug='data-com-segundos'").get()).published_at, '2099-11-01 15:30:45');
});

test('data inválida é rejeitada sem publicar imediatamente', async () => {
  assert.equal((await postArticle({ slug: 'data-invalida', published_at: 'nao-e-data' })).status, 400);
  assert.equal((await portal.db.prepare("SELECT COUNT(*) n FROM articles WHERE slug='data-invalida'").get()).n, 0);
});

test('datas impossíveis e horários inválidos são rejeitados', async () => {
  for (const published_at of ['2026-02-30T12:00', '2026-11-01T25:00', '2026-11-01T12:30:61']) {
    assert.equal((await postArticle({ published_at })).status, 400, published_at);
  }
});

test('HTML exportado pelo editor é sanitizado antes de ser publicado', async () => {
  const content = '<p>Conteúdo seguro</p><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">Link</a><script>alert(1)</script>';
  const response = await postArticle({ slug: 'sanitizacao-editor', content });
  assert.equal(response.status, 302);
  const saved = (await portal.db.prepare("SELECT content FROM articles WHERE slug='sanitizacao-editor'").get()).content;
  assert.match(saved, /Conteúdo seguro/);
  assert.doesNotMatch(saved, /onerror|javascript:|<script/);
  const published = await visitor.get('/comunicados/sanitizacao-editor');
  assert.equal(published.status, 200);
  assert.doesNotMatch(published.text, /onerror|javascript:|<script>alert/);
});

test('filtros malformados e página muito grande não causam erro 500', async () => {
  for (const url of ['/comunicados?categoria[]=QA', '/comunicados?categoria[x]=QA', '/comunicados?pagina=9999999999999999999999999999999']) {
    assert.ok([200, 400].includes((await visitor.get(url)).status), url);
  }
});

test('atualizações de registros inexistentes não retornam sucesso nem erro 500', async () => {
  assert.equal((await admin.post('/admin/paginas/999999', { title: 'Inexistente', blocks: '[]' })).status, 404);
  assert.equal((await admin.post('/admin/comunicados/999999', { title: 'Inexistente' })).status, 404);
  assert.equal((await admin.post('/admin/usuarios/999999', { name: 'Inexistente', email: 'missing@example.test', role: 'editor', active: 'on' })).status, 404);
});

test('ID inválido não cria conteúdo novo por acidente', async () => {
  const before = (await portal.db.prepare('SELECT COUNT(*) n FROM pages').get()).n;
  assert.equal((await admin.post('/admin/paginas/invalido', { title: 'Acidental', blocks: '[]' })).status, 400);
  assert.equal((await portal.db.prepare('SELECT COUNT(*) n FROM pages').get()).n, before);
});

test('upload de imagem e PDF, listagem, download e exclusão', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=', 'base64');
  for (const [file, name, mime] of [[png, 'foto.png', 'image/png'], ['%PDF-1.4\n%%EOF', 'documento.pdf', 'application/pdf']]) {
    const response = await admin.upload(file, name, mime);
    assert.equal(response.status, 200, response.text);
    const item = response.json();
    assert.equal((await visitor.get(item.url)).status, 200);
    assert.ok((await admin.get('/admin/midia.json')).json().some(m => m.id === item.id));
    assert.equal((await admin.post(`/admin/midia/${item.id}/excluir`)).status, 302);
    assert.equal((await portal.db.prepare('SELECT id FROM media WHERE id=?').get(item.id)), undefined);
    await assert.rejects(fs.access(path.join(portal.dataDir, item.url.slice(1))));
  }
});

test('upload rejeita arquivo vazio, formato proibido e tamanho acima de 10 MB', async () => {
  assert.equal((await admin.upload(null)).status, 400);
  assert.equal((await admin.upload('<html>Proibido</html>', 'pagina.html', 'text/html')).status, 400);
  assert.equal((await admin.upload(Buffer.alloc(10 * 1024 * 1024 + 1), 'grande.png', 'image/png')).status, 400);
});

test('SVG enviado não pode executar scripts ao abrir diretamente', async () => {
  const response = await admin.upload('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'teste.svg', 'image/svg+xml');
  assert.equal(response.status, 200);
  const file = await visitor.get(response.json().url);
  assert.match(file.headers.get('content-security-policy') || '', /sandbox/);
});

test('usuários: criar editor, impedir duplicidade e validar permissões', async () => {
  const values = { name: 'Editor QA', email: 'editor@example.test', password: 'EditorTeste123!', role: 'editor', active: 'on' };
  assert.equal((await admin.post('/admin/usuarios/0', values)).status, 302);
  const duplicate = await admin.post('/admin/usuarios/0', { ...values, email: 'EDITOR@example.test' });
  assert.match(duplicate.text, /Já existe um usuário/);
  const editor = await login(portal, values.email, values.password);
  for (const url of ['/admin', '/admin/paginas', '/admin/comunicados', '/admin/midia', '/admin/perfil']) assert.equal((await editor.get(url)).status, 200);
  for (const url of ['/admin/usuarios', '/admin/configuracoes']) assert.equal((await editor.get(url)).status, 403);
  assert.equal((await editor.post('/admin/usuarios/0', values)).status, 403);
  const response = await editor.post('/admin/paginas/0', { title: 'Tentativa de início', set_home: 'on', blocks: '[]' });
  assert.notEqual((await portal.db.prepare("SELECT value FROM settings WHERE key='home_page_id'").get()).value, String(pageId(response)));
});

test('último administrador não pode ser desativado ou rebaixado', async () => {
  const id = (await portal.db.prepare('SELECT id FROM users WHERE email=?').get(credentials.email)).id;
  const response = await admin.post('/admin/usuarios/' + id, { ...credentials, password: '', role: 'editor', active: 'on' });
  assert.match(response.text, /pelo menos um administrador ativo/);
  assert.equal((await portal.db.prepare('SELECT role FROM users WHERE id=?').get(id)).role, 'admin');
  await admin.post(`/admin/usuarios/${id}/excluir`);
  assert.ok((await portal.db.prepare('SELECT id FROM users WHERE id=?').get(id)));
});

test('desativar e reativar usuário não restaura sessões antigas', async () => {
  await admin.post('/admin/usuarios/0', { name: 'Temporário', email: 'temporary@example.test', password: 'TesteSessao123!', role: 'editor', active: 'on' });
  const user = await login(portal, 'temporary@example.test', 'TesteSessao123!');
  const id = (await portal.db.prepare("SELECT id FROM users WHERE email='temporary@example.test'").get()).id;
  const values = { name: 'Temporário', email: 'temporary@example.test', role: 'editor' };
  await admin.post('/admin/usuarios/' + id, values);
  await admin.post('/admin/usuarios/' + id, { ...values, active: 'on' });
  assert.equal((await user.get('/admin')).status, 302);
});

test('troca de senha pelo administrador invalida sessões anteriores', async () => {
  await admin.post('/admin/usuarios/0', { name: 'Senha QA', email: 'senha@example.test', password: 'SenhaAntiga123!', role: 'editor', active: 'on' });
  const user = await login(portal, 'senha@example.test', 'SenhaAntiga123!');
  const id = (await portal.db.prepare("SELECT id FROM users WHERE email='senha@example.test'").get()).id;
  await admin.post('/admin/usuarios/' + id, { name: 'Senha QA', email: 'senha@example.test', password: 'SenhaNova123!', role: 'editor', active: 'on' });
  assert.equal((await user.get('/admin')).status, 302);
  assert.equal((await (await login(portal, 'senha@example.test', 'SenhaNova123!')).get('/admin')).status, 200);
});

test('perfil valida senha atual e permite atualizar nome', async () => {
  const failed = await admin.post('/admin/perfil', { name: 'Não salvar', current: 'errada', password: 'OutraSenha123!' });
  assert.match(failed.text, /Senha atual incorreta/);
  assert.equal((await admin.post('/admin/perfil', { name: 'Administrador atualizado' })).status, 302);
  assert.match((await admin.get('/admin/perfil')).text, /Administrador atualizado/);
});

test('troca de senha no perfil preserva sessão atual e revoga as demais', async () => {
  await admin.post('/admin/usuarios/0', { name: 'Perfil QA', email: 'perfil@example.test', password: 'PerfilAntigo123!', role: 'editor', active: 'on' });
  const current = await login(portal, 'perfil@example.test', 'PerfilAntigo123!');
  const previous = await login(portal, 'perfil@example.test', 'PerfilAntigo123!');
  assert.equal((await current.post('/admin/perfil', { name: 'Perfil QA', current: 'PerfilAntigo123!', password: 'PerfilNovo123!' })).status, 302);
  assert.equal((await current.get('/admin')).status, 200);
  assert.equal((await previous.get('/admin')).status, 302);
  assert.equal((await (await login(portal, 'perfil@example.test', 'PerfilNovo123!')).get('/admin')).status, 200);
});

test('redefinição de senha pelo terminal revoga sessões anteriores', async () => {
  await admin.post('/admin/usuarios/0', { name: 'Reset QA', email: 'reset@example.test', password: 'ResetAntigo123!', role: 'editor', active: 'on' });
  const previous = await login(portal, 'reset@example.test', 'ResetAntigo123!');
  execFileSync(process.execPath, ['scripts/reset-password.js', 'reset@example.test', 'ResetNovo123!'], {
    cwd: path.join(__dirname, '..'), env: { ...process.env, DATA_DIR: portal.dataDir }, windowsHide: true
  });
  assert.equal((await previous.get('/admin')).status, 302);
  assert.equal((await (await login(portal, 'reset@example.test', 'ResetNovo123!')).get('/admin')).status, 200);
});

test('configurações salvam identidade e removem links javascript', async () => {
  assert.equal((await admin.post('/admin/configuracoes', { site_name: 'Portal RH QA', home_page_id: '1', whatsapp_url: 'javascript:alert(1)' })).status, 302);
  const response = await visitor.get('/');
  assert.match(response.text, /Portal RH QA/);
  assert.doesNotMatch(response.text, /javascript:alert/);
});

test('página inicial inexistente nas configurações é rejeitada', async () => {
  assert.equal((await admin.post('/admin/configuracoes', { site_name: 'Portal RH QA', home_page_id: '999999' })).status, 400);
  assert.equal((await portal.db.prepare("SELECT value FROM settings WHERE key='home_page_id'").get()).value, '1');
});

test('logout encerra a sessão', async () => {
  const user = await login(portal, credentials.email, credentials.password);
  assert.equal((await user.post('/admin/logout')).status, 302);
  assert.equal((await user.get('/admin')).status, 302);
});

test('limite de login bloqueia a décima primeira tentativa', async () => {
  const user = portal.session();
  await user.get('/admin/login');
  for (let i = 0; i < 10; i++) assert.equal((await user.post('/admin/login', { email: credentials.email, password: 'errada' })).status, 401);
  assert.equal((await user.post('/admin/login', credentials)).status, 429);
});

test('banco permanece íntegro após os fluxos completos', async () => {
  // Nenhuma referência órfã entre páginas, comunicados, mídia e usuários
  const orphans = await portal.db.prepare(`
    SELECT 'pages.parent_id' ref FROM pages p WHERE p.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pages x WHERE x.id = p.parent_id)
    UNION ALL SELECT 'pages.updated_by' FROM pages p WHERE p.updated_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.updated_by)
    UNION ALL SELECT 'articles.author_id' FROM articles a WHERE a.author_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.author_id)
    UNION ALL SELECT 'media.uploaded_by' FROM media m WHERE m.uploaded_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.uploaded_by)`).all();
  assert.deepEqual(orphans, []);
  assert.equal((await portal.db.prepare('SELECT COUNT(*) n FROM pages').get()).n > 0, true);
});
