const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { db, saveSettings } = require('../db');
const { requireLogin, requireAdmin, csrf, loginLimiter, revokeUserSessions } = require('../auth');
const { BLOCKS, cleanBlocks, cleanRich, cleanUrl } = require('../blocks');
const { iconList } = require('../icons');
const { uniqueSlug, slugify, pageUrl, homeId, RESERVED } = require('../helpers');
const storage = require('../storage');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.locals.flash = req.session.flash || null;
  if (req.session.flash) delete req.session.flash;
  res.locals.pageUrl = (p) => pageUrl(p, res.locals.settings);
  next();
});
const flash = (req, type, text) => { req.session.flash = { type, text }; };

// Datas: o formulário usa horário de Brasília (UTC-3)
const fromLocalInput = (local) => {
  if (!local || typeof local !== 'string') return null;
  const parts = local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!parts) return null;
  const normalized = `${parts[1]}T${parts[2]}:${parts[3] || '00'}`;
  const d = new Date(normalized + '-03:00');
  // rejeita datas impossíveis (ex.: 31/02) que o JavaScript "corrigiria"
  if (isNaN(d) || new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 19) !== normalized) return null;
  return d;
};
const toLocalInput = (date) => {
  const d = date ? new Date(date) : new Date();
  return new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 16);
};

// ------------------ Configuração inicial ------------------
const hasUsers = async () => (await db.get('SELECT COUNT(*) n FROM users')).n > 0;

router.get('/setup', csrf, async (req, res) => {
  if (await hasUsers()) return res.redirect('/admin/login');
  res.render('admin/setup', { title: 'Configuração inicial', error: null, form: {} });
});
router.post('/setup', csrf, async (req, res) => {
  if (await hasUsers()) return res.redirect('/admin/login');
  const { name, email, password } = req.body;
  const err = validateUser({ name, email, password }, true);
  if (err) return res.render('admin/setup', { title: 'Configuração inicial', error: err, form: req.body });
  const r = await db.get("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin') RETURNING id", [name.trim(), email.trim(), bcrypt.hashSync(password, 10)]);
  req.session.regenerate(() => {
    req.session.userId = r.id;
    flash(req, 'ok', 'Conta de administrador criada. Bem-vindo ao painel!');
    res.redirect('/admin');
  });
});

// ------------------ Login ------------------
router.get('/login', csrf, async (req, res) => {
  if (!(await hasUsers())) return res.redirect('/admin/setup');
  if (req.user) return res.redirect('/admin');
  res.render('admin/login', { title: 'Entrar', error: null, email: '', next: req.query.next || '' });
});
router.post('/login', csrf, loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const next = /^\/admin/.test(req.body.next || '') ? req.body.next : '/admin';
  const u = await db.get('SELECT * FROM users WHERE lower(email) = lower(?)', [String(email || '').trim()]);
  if (!u || !u.active || !bcrypt.compareSync(String(password || ''), u.password_hash)) {
    req.registerFail();
    return res.status(401).render('admin/login', { title: 'Entrar', error: 'E-mail ou senha incorretos.', email, next });
  }
  req.clearFails();
  await db.run('UPDATE users SET last_login = now() WHERE id = ?', [u.id]);
  req.session.regenerate(() => {
    req.session.userId = u.id;
    res.redirect(next);
  });
});
router.post('/logout', csrf, (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// Tudo abaixo exige login
router.use(requireLogin, csrf);

// O ID zero é usado apenas para criação; IDs inválidos nunca viram novos registros.
router.param('id', (req, res, next, value) => {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) {
    return res.status(400).render('admin/error', { title: 'Endereço inválido', message: 'O identificador informado é inválido.' });
  }
  next();
});

function formError(res, message, status = 400) {
  return res.status(status).render('admin/error', { title: 'Não foi possível salvar', message });
}

// ------------------ Painel ------------------
router.get('/', async (req, res) => {
  const stats = {
    pages: (await db.get('SELECT COUNT(*) n FROM pages')).n,
    articles: (await db.get("SELECT COUNT(*) n FROM articles WHERE status='published'")).n,
    drafts: (await db.get("SELECT (SELECT COUNT(*) FROM pages WHERE status='draft') + (SELECT COUNT(*) FROM articles WHERE status='draft') n")).n,
    users: (await db.get('SELECT COUNT(*) n FROM users WHERE active')).n
  };
  const recentPages = await db.all('SELECT p.id, p.title, p.slug, p.status, p.updated_at, u.name editor FROM pages p LEFT JOIN users u ON u.id = p.updated_by ORDER BY p.updated_at DESC LIMIT 5');
  const recentArticles = await db.all('SELECT a.id, a.title, a.status, a.updated_at, a.published_at FROM articles a ORDER BY a.updated_at DESC LIMIT 5');
  res.render('admin/dashboard', { title: 'Painel', stats, recentPages, recentArticles });
});

// ------------------ Páginas ------------------
router.get('/paginas', async (req, res) => {
  const pages = await db.all(`SELECT p.*, u.name editor, pp.title parent_title FROM pages p
    LEFT JOIN users u ON u.id = p.updated_by LEFT JOIN pages pp ON pp.id = p.parent_id
    ORDER BY COALESCE(pp.menu_order, p.menu_order), COALESCE(p.parent_id, p.id), p.parent_id IS NOT NULL, p.menu_order, p.title`);
  res.render('admin/pages', { title: 'Páginas', pages, homeId: homeId(res.locals.settings) });
});

async function linkSuggestions(settings) {
  const pages = (await db.all('SELECT id, title, slug FROM pages ORDER BY title')).map(p => ({ label: 'Página: ' + p.title, url: pageUrl(p, settings) }));
  const arts = (await db.all('SELECT title, slug FROM articles ORDER BY published_at DESC NULLS LAST LIMIT 30')).map(a => ({ label: 'Comunicado: ' + a.title, url: '/comunicados/' + a.slug }));
  return [{ label: 'Lista de comunicados', url: '/comunicados' }, ...pages, ...arts];
}
async function pageEditorData(page, settings) {
  return {
    page,
    blocksJson: JSON.stringify(Array.isArray(page.blocks) ? page.blocks : []),
    parents: await db.all('SELECT id, title FROM pages WHERE parent_id IS NULL AND id != ? AND NOT EXISTS (SELECT 1 FROM pages child WHERE child.parent_id = ?) ORDER BY menu_order, title', [page.id || 0, page.id || 0]),
    schema: BLOCKS,
    icons: iconList(),
    links: await linkSuggestions(settings)
  };
}

router.get('/paginas/nova', async (req, res) => {
  const page = { id: 0, title: '', slug: '', parent_id: null, menu_order: 10, show_in_menu: true, status: 'draft', blocks: [], meta_description: '', menu_label: '' };
  res.render('admin/page-edit', { title: 'Nova página', ...(await pageEditorData(page, res.locals.settings)) });
});

router.get('/paginas/:id', async (req, res) => {
  const page = await db.get('SELECT * FROM pages WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  if (!page) return res.redirect('/admin/paginas');
  res.render('admin/page-edit', { title: 'Editar página', ...(await pageEditorData(page, res.locals.settings)) });
});

router.post('/paginas/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  if (id && !(await db.get('SELECT id FROM pages WHERE id = ?', [id]))) return formError(res, 'Página não encontrada.', 404);
  const b = req.body;
  const parent = b.parent_id ? Number(b.parent_id) : null;
  if (parent !== null) {
    const parentPage = Number.isSafeInteger(parent) && parent > 0 && parent <= 2147483647 ? await db.get('SELECT parent_id FROM pages WHERE id = ?', [parent]) : null;
    if (!parentPage) return formError(res, 'A página-mãe não existe. Selecione uma página válida.');
    if (parent === id || parentPage.parent_id !== null || (id && await db.get('SELECT id FROM pages WHERE parent_id = ?', [id]))) {
      return formError(res, 'O menu aceita dois níveis. Uma página com subpáginas não pode se tornar uma subpágina.');
    }
  }
  const title = String(b.title || '').trim() || 'Sem título';
  let slug = slugify(b.slug || title);
  if (RESERVED.includes(slug)) slug = slug + '-pagina';
  slug = await uniqueSlug('pages', slug, id);
  const blocks = JSON.stringify(cleanBlocks(b.blocks));
  const vals = [title, slug, parent, parseInt(b.menu_order, 10) || 0, !!b.show_in_menu, String(b.menu_label || '').trim() || null,
    b.status === 'published' ? 'published' : 'draft', String(b.meta_description || '').slice(0, 300), blocks, req.user.id];
  let savedId = id;
  if (id) {
    await db.run('UPDATE pages SET title=?, slug=?, parent_id=?, menu_order=?, show_in_menu=?, menu_label=?, status=?, meta_description=?, blocks=?, updated_by=?, updated_at=now() WHERE id=?', [...vals, id]);
  } else {
    savedId = (await db.get('INSERT INTO pages (title, slug, parent_id, menu_order, show_in_menu, menu_label, status, meta_description, blocks, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id', vals)).id;
  }
  if (b.set_home && req.user.role === 'admin') await saveSettings({ home_page_id: savedId });
  flash(req, 'ok', 'Página salva.');
  res.redirect('/admin/paginas/' + savedId);
});

router.post('/paginas/:id/duplicar', async (req, res) => {
  const p = await db.get('SELECT * FROM pages WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  if (!p) return res.redirect('/admin/paginas');
  const r = await db.get("INSERT INTO pages (title, slug, parent_id, menu_order, show_in_menu, status, meta_description, blocks, updated_by) VALUES (?,?,?,?,FALSE,'draft',?,?,?) RETURNING id",
    [p.title + ' (cópia)', await uniqueSlug('pages', p.slug + '-copia'), p.parent_id, p.menu_order, p.meta_description, JSON.stringify(p.blocks), req.user.id]);
  flash(req, 'ok', 'Página duplicada como rascunho.');
  res.redirect('/admin/paginas/' + r.id);
});

router.post('/paginas/:id/excluir', async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  if (id === homeId(res.locals.settings)) { flash(req, 'erro', 'A página inicial não pode ser excluída. Defina outra página como inicial antes.'); return res.redirect('/admin/paginas'); }
  await db.run('DELETE FROM pages WHERE id = ?', [id]);
  flash(req, 'ok', 'Página excluída.');
  res.redirect('/admin/paginas');
});

// ------------------ Comunicados (artigos) ------------------
router.get('/comunicados', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const base = 'SELECT a.*, u.name author FROM articles a LEFT JOIN users u ON u.id = a.author_id';
  const order = ' ORDER BY COALESCE(a.published_at, a.created_at) DESC';
  const rows = q
    ? await db.all(base + ' WHERE a.title ILIKE ? OR a.category ILIKE ?' + order, [`%${q}%`, `%${q}%`])
    : await db.all(base + order);
  res.render('admin/articles', { title: 'Comunicados', articles: rows, q, now: new Date() });
});

const categories = async () => (await db.all("SELECT DISTINCT category FROM articles WHERE category IS NOT NULL AND category != '' ORDER BY category")).map(r => r.category);

router.get('/comunicados/novo', async (req, res) => {
  res.render('admin/article-edit', { title: 'Novo comunicado', article: { id: 0, title: '', slug: '', category: '', excerpt: '', cover: '', content: '', status: 'draft', featured: false }, publishedLocal: toLocalInput(), categories: await categories() });
});
router.get('/comunicados/:id', async (req, res) => {
  const a = await db.get('SELECT * FROM articles WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  if (!a) return res.redirect('/admin/comunicados');
  res.render('admin/article-edit', { title: 'Editar comunicado', article: a, publishedLocal: toLocalInput(a.published_at), categories: await categories() });
});
router.post('/comunicados/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  if (id && !(await db.get('SELECT id FROM articles WHERE id = ?', [id]))) return formError(res, 'Comunicado não encontrado.', 404);
  const b = req.body;
  const publishedAt = b.published_at ? fromLocalInput(b.published_at) : new Date();
  if (!publishedAt) return formError(res, 'Data de publicação inválida. Informe uma data e horário válidos.');
  const title = String(b.title || '').trim() || 'Sem título';
  const slug = await uniqueSlug('articles', b.slug || title, id);
  const vals = [title, slug, String(b.category || '').trim().slice(0, 60), String(b.excerpt || '').trim().slice(0, 400), cleanUrl(b.cover), cleanRich(b.content),
    b.status === 'published' ? 'published' : 'draft', !!b.featured, publishedAt];
  let savedId = id;
  if (id) await db.run('UPDATE articles SET title=?, slug=?, category=?, excerpt=?, cover=?, content=?, status=?, featured=?, published_at=?, updated_at=now() WHERE id=?', [...vals, id]);
  else savedId = (await db.get('INSERT INTO articles (title, slug, category, excerpt, cover, content, status, featured, published_at, author_id) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id', [...vals, req.user.id])).id;
  flash(req, 'ok', 'Comunicado salvo.');
  res.redirect('/admin/comunicados/' + savedId);
});
router.post('/comunicados/:id/excluir', async (req, res) => {
  await db.run('DELETE FROM articles WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  flash(req, 'ok', 'Comunicado excluído.');
  res.redirect('/admin/comunicados');
});

// ------------------ Mídia ------------------
const mediaRows = () => db.all('SELECT m.*, u.name uploader FROM media m LEFT JOIN users u ON u.id = m.uploaded_by ORDER BY m.created_at DESC, m.id DESC');

router.get('/midia', async (req, res) => res.render('admin/media', { title: 'Mídia', media: await mediaRows() }));
router.get('/midia.json', async (req, res) => res.json(await mediaRows()));

// 1) O navegador pede autorização para enviar
router.post('/midia/assinar', async (req, res) => {
  const meta = { name: String(req.body.name || ''), type: String(req.body.type || ''), size: parseInt(req.body.size, 10) || 0 };
  const err = storage.validate(meta);
  if (err) return res.status(400).json({ error: err });
  if (!storage.useSupabase) return res.json({ mode: 'local' });
  try { res.json(await storage.signUpload(meta)); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Não foi possível preparar o envio: ' + e.message }); }
});
// 2a) Supabase: depois do envio direto, registra o arquivo
router.post('/midia/confirmar', async (req, res) => {
  const meta = { name: String(req.body.name || ''), type: String(req.body.type || ''), size: parseInt(req.body.size, 10) || 0 };
  const p = String(req.body.path || '');
  if (storage.validate(meta) || !/^\d{4}\/\d{2}\/[\w.-]+$/.test(p) || !(await storage.exists(p))) return res.status(400).json({ error: 'Arquivo não encontrado no armazenamento.' });
  const url = storage.publicUrl(p);
  const r = await db.get('INSERT INTO media (path, url, original_name, mime, size, uploaded_by) VALUES (?,?,?,?,?,?) RETURNING id', [p, url, meta.name.slice(0, 200), meta.type, meta.size, req.user.id]);
  res.json({ id: r.id, url, original_name: meta.name, mime: meta.type });
});
// 2b) Local (desenvolvimento): envio pelo servidor
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: storage.MAX_SIZE } });
router.post('/midia/enviar', (req, res) => {
  if (storage.useSupabase) return res.status(400).json({ error: 'Envio direto desativado.' });
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que 10 MB.' : err.message });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    const meta = { name: req.file.originalname, type: req.file.mimetype, size: req.file.size };
    const verr = storage.validate(meta);
    if (verr) return res.status(400).json({ error: verr });
    const p = storage.saveLocal(req.file.buffer, meta);
    const url = storage.publicUrl(p);
    const r = await db.get('INSERT INTO media (path, url, original_name, mime, size, uploaded_by) VALUES (?,?,?,?,?,?) RETURNING id', [p, url, meta.name.slice(0, 200), meta.type, meta.size, req.user.id]);
    res.json({ id: r.id, url, original_name: meta.name, mime: meta.type });
  });
});
router.post('/midia/:id/excluir', async (req, res) => {
  const m = await db.get('SELECT * FROM media WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  if (!m) return res.redirect('/admin/midia');
  try { await storage.remove(m.path); }
  catch (e) { console.error(e); return formError(res, 'Não foi possível excluir o arquivo. Tente novamente.'); }
  await db.run('DELETE FROM media WHERE id = ?', [m.id]);
  flash(req, 'ok', 'Arquivo excluído. Verifique se ele não era usado em alguma página.');
  res.redirect('/admin/midia');
});

// ------------------ Meu perfil ------------------
router.get('/perfil', (req, res) => res.render('admin/profile', { title: 'Meu perfil', error: null }));
router.post('/perfil', async (req, res) => {
  const { name, current, password } = req.body;
  const u = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (password) {
    if (!bcrypt.compareSync(String(current || ''), u.password_hash)) return res.render('admin/profile', { title: 'Meu perfil', error: 'Senha atual incorreta.' });
    if (String(password).length < 8) return res.render('admin/profile', { title: 'Meu perfil', error: 'A nova senha deve ter pelo menos 8 caracteres.' });
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(password, 10), u.id]);
    await revokeUserSessions(u.id, req.sessionID);
  }
  if (name && name.trim()) await db.run('UPDATE users SET name = ? WHERE id = ?', [name.trim(), u.id]);
  flash(req, 'ok', 'Perfil atualizado.');
  res.redirect('/admin/perfil');
});

// ------------------ Usuários (somente admin) ------------------
function validateUser({ name, email, password }, requirePassword) {
  if (!String(name || '').trim()) return 'Informe o nome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())) return 'Informe um e-mail válido.';
  if ((requirePassword || password) && String(password || '').length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  return null;
}
const adminCount = async () => (await db.get("SELECT COUNT(*) n FROM users WHERE role='admin' AND active")).n;

router.get('/usuarios', requireAdmin, async (req, res) => {
  res.render('admin/users', { title: 'Usuários', users: await db.all('SELECT * FROM users ORDER BY name') });
});
router.get('/usuarios/novo', requireAdmin, (req, res) => res.render('admin/user-edit', { title: 'Novo usuário', u: { id: 0, name: '', email: '', role: 'editor', active: true }, error: null }));
router.get('/usuarios/:id', requireAdmin, async (req, res) => {
  const u = await db.get('SELECT * FROM users WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  if (!u) return res.redirect('/admin/usuarios');
  res.render('admin/user-edit', { title: 'Editar usuário', u, error: null });
});
router.post('/usuarios/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  if (id && !(await db.get('SELECT id FROM users WHERE id = ?', [id]))) return formError(res, 'Usuário não encontrado.', 404);
  const b = req.body;
  const form = { id, name: b.name, email: b.email, role: b.role === 'admin' ? 'admin' : 'editor', active: !!b.active };
  const err = validateUser(b, !id);
  const fail = (msg) => res.render('admin/user-edit', { title: id ? 'Editar usuário' : 'Novo usuário', u: form, error: msg });
  if (err) return fail(err);
  if (await db.get('SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?', [b.email.trim(), id])) return fail('Já existe um usuário com este e-mail.');
  if (id) {
    const old = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!old) return res.redirect('/admin/usuarios');
    if (old.role === 'admin' && old.active && (form.role !== 'admin' || !form.active) && (await adminCount()) <= 1) return fail('É preciso manter pelo menos um administrador ativo.');
    if (id === req.user.id && !form.active) return fail('Você não pode desativar a própria conta.');
    await db.run('UPDATE users SET name=?, email=?, role=?, active=? WHERE id=?', [form.name.trim(), form.email.trim(), form.role, form.active, id]);
    if (b.password) await db.run('UPDATE users SET password_hash=? WHERE id=?', [bcrypt.hashSync(b.password, 10), id]);
    if (!form.active || b.password) await revokeUserSessions(id, id === req.user.id ? req.sessionID : null);
  } else {
    await db.run('INSERT INTO users (name, email, password_hash, role, active) VALUES (?,?,?,?,?)', [form.name.trim(), form.email.trim(), bcrypt.hashSync(b.password, 10), form.role, form.active]);
  }
  flash(req, 'ok', 'Usuário salvo.');
  res.redirect('/admin/usuarios');
});
router.post('/usuarios/:id/excluir', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  const u = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  if (!u) return res.redirect('/admin/usuarios');
  if (id === req.user.id) { flash(req, 'erro', 'Você não pode excluir a própria conta.'); return res.redirect('/admin/usuarios'); }
  if (u.role === 'admin' && (await adminCount()) <= 1) { flash(req, 'erro', 'É preciso manter pelo menos um administrador.'); return res.redirect('/admin/usuarios'); }
  await revokeUserSessions(id);
  await db.run('DELETE FROM users WHERE id = ?', [id]);
  flash(req, 'ok', 'Usuário excluído.');
  res.redirect('/admin/usuarios');
});

// ------------------ Configurações (somente admin) ------------------
const SETTING_KEYS = ['site_name', 'site_tagline', 'logo', 'footer_about', 'contact_email', 'contact_phone', 'contact_city', 'whatsapp_url', 'instagram_url', 'facebook_url', 'linkedin_url', 'footer_link_label', 'footer_link_url', 'copyright', 'articles_menu_label', 'articles_page_title', 'home_page_id'];
const URL_KEYS = ['logo', 'whatsapp_url', 'instagram_url', 'facebook_url', 'linkedin_url', 'footer_link_url'];
router.get('/configuracoes', requireAdmin, async (req, res) => {
  res.render('admin/settings', { title: 'Configurações', pages: await db.all('SELECT id, title FROM pages ORDER BY title') });
});
router.post('/configuracoes', requireAdmin, async (req, res) => {
  const home = req.body.home_page_id;
  if (home && (!/^\d+$/.test(home) || Number(home) > 2147483647 || !(await db.get('SELECT id FROM pages WHERE id = ?', [Number(home)])))) {
    return formError(res, 'A página inicial selecionada não existe.');
  }
  const out = {};
  for (const k of SETTING_KEYS) out[k] = URL_KEYS.includes(k) ? cleanUrl(req.body[k]) : String(req.body[k] || '').trim().slice(0, 1000);
  if (!out.home_page_id) out.home_page_id = res.locals.settings.home_page_id; // mantém a atual
  await saveSettings(out);
  flash(req, 'ok', 'Configurações salvas.');
  res.redirect('/admin/configuracoes');
});

module.exports = router;
