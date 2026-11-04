const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { db, UPLOAD_DIR, saveSettings, getSettings } = require('../db');
const { requireLogin, requireAdmin, csrf, loginLimiter, revokeUserSessions } = require('../auth');
const { BLOCKS, cleanBlocks, cleanRich, cleanUrl } = require('../blocks');
const { iconList } = require('../icons');
const { uniqueSlug, slugify, pageUrl, homeId, RESERVED } = require('../helpers');

const router = express.Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.pageUrl = (p) => pageUrl(p, res.locals.settings);
  next();
});
const flash = (req, type, text) => { req.session.flash = { type, text }; };

// Datas: o formulário usa horário de Brasília; o banco guarda UTC
const toUTC = (local) => {
  if (!local) return null;
  if (typeof local !== 'string') return null;
  const parts = local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
  if (!parts) return null;
  const normalized = `${parts[1]}T${parts[2]}:${parts[3] || '00'}`;
  const d = new Date(normalized + '-03:00');
  if (isNaN(d) || new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 19) !== normalized) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};
const toLocalInput = (utc) => {
  if (!utc) return '';
  const d = new Date(utc.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return '';
  return new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 16);
};
const nowUTC = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

// ------------------ Configuração inicial ------------------
const hasUsers = () => db.prepare('SELECT COUNT(*) n FROM users').get().n > 0;

router.get('/setup', csrf, (req, res) => {
  if (hasUsers()) return res.redirect('/admin/login');
  res.render('admin/setup', { title: 'Configuração inicial', error: null, form: {} });
});
router.post('/setup', csrf, (req, res) => {
  if (hasUsers()) return res.redirect('/admin/login');
  const { name, email, password } = req.body;
  const err = validateUser({ name, email, password }, true);
  if (err) return res.render('admin/setup', { title: 'Configuração inicial', error: err, form: req.body });
  const r = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run(name.trim(), email.trim(), bcrypt.hashSync(password, 10));
  req.session.regenerate(() => {
    req.session.userId = r.lastInsertRowid;
    flash(req, 'ok', 'Conta de administrador criada. Bem-vindo ao painel!');
    res.redirect('/admin');
  });
});

// ------------------ Login ------------------
router.get('/login', csrf, (req, res) => {
  if (!hasUsers()) return res.redirect('/admin/setup');
  if (req.user) return res.redirect('/admin');
  res.render('admin/login', { title: 'Entrar', error: null, email: '', next: req.query.next || '' });
});
router.post('/login', csrf, loginLimiter, (req, res) => {
  const { email, password } = req.body;
  const next = /^\/admin/.test(req.body.next || '') ? req.body.next : '/admin';
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim());
  if (!u || !u.active || !bcrypt.compareSync(String(password || ''), u.password_hash)) {
    req.registerFail();
    return res.status(401).render('admin/login', { title: 'Entrar', error: 'E-mail ou senha incorretos.', email, next });
  }
  req.clearFails();
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(u.id);
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
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    return res.status(400).render('admin/error', { title: 'Endereço inválido', message: 'O identificador informado é inválido.' });
  }
  next();
});

function formError(res, message, status = 400) {
  return res.status(status).render('admin/error', { title: 'Não foi possível salvar', message });
}

// ------------------ Painel ------------------
router.get('/', (req, res) => {
  const stats = {
    pages: db.prepare('SELECT COUNT(*) n FROM pages').get().n,
    articles: db.prepare("SELECT COUNT(*) n FROM articles WHERE status='published'").get().n,
    drafts: db.prepare("SELECT (SELECT COUNT(*) FROM pages WHERE status='draft') + (SELECT COUNT(*) FROM articles WHERE status='draft') n").get().n,
    users: db.prepare('SELECT COUNT(*) n FROM users WHERE active = 1').get().n
  };
  const recentPages = db.prepare('SELECT p.id, p.title, p.slug, p.status, p.updated_at, u.name editor FROM pages p LEFT JOIN users u ON u.id = p.updated_by ORDER BY p.updated_at DESC LIMIT 5').all();
  const recentArticles = db.prepare('SELECT a.id, a.title, a.status, a.updated_at, a.published_at FROM articles a ORDER BY a.updated_at DESC LIMIT 5').all();
  res.render('admin/dashboard', { title: 'Painel', stats, recentPages, recentArticles });
});

// ------------------ Páginas ------------------
router.get('/paginas', (req, res) => {
  const pages = db.prepare('SELECT p.*, u.name editor, pp.title parent_title FROM pages p LEFT JOIN users u ON u.id = p.updated_by LEFT JOIN pages pp ON pp.id = p.parent_id ORDER BY COALESCE(pp.menu_order, p.menu_order), COALESCE(p.parent_id, p.id), p.parent_id IS NOT NULL, p.menu_order, p.title').all();
  res.render('admin/pages', { title: 'Páginas', pages, homeId: homeId(res.locals.settings) });
});

const pageEditorData = (page) => ({
  page,
  parents: db.prepare('SELECT id, title FROM pages WHERE parent_id IS NULL AND id != ? AND NOT EXISTS (SELECT 1 FROM pages child WHERE child.parent_id = ?) ORDER BY menu_order, title').all(page.id || 0, page.id || 0),
  schema: BLOCKS,
  icons: iconList(),
  links: linkSuggestions()
});

function linkSuggestions() {
  const s = getSettings();
  const pages = db.prepare('SELECT id, title, slug FROM pages ORDER BY title').all().map(p => ({ label: 'Página: ' + p.title, url: pageUrl(p, s) }));
  const arts = db.prepare('SELECT title, slug FROM articles ORDER BY published_at DESC LIMIT 30').all().map(a => ({ label: 'Comunicado: ' + a.title, url: '/comunicados/' + a.slug }));
  return [{ label: 'Lista de comunicados', url: '/comunicados' }, ...pages, ...arts];
}

router.get('/paginas/nova', (req, res) => {
  const page = { id: 0, title: '', slug: '', parent_id: null, menu_order: 10, show_in_menu: 1, status: 'draft', blocks: '[]', meta_description: '', menu_label: '' };
  res.render('admin/page-edit', { title: 'Nova página', ...pageEditorData(page) });
});

router.get('/paginas/:id', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id);
  if (!page) return res.redirect('/admin/paginas');
  res.render('admin/page-edit', { title: 'Editar página', ...pageEditorData(page) });
});

router.post('/paginas/:id', (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  if (id && !db.prepare('SELECT id FROM pages WHERE id=?').get(id)) return formError(res, 'Página não encontrada.', 404);
  const b = req.body;
  const title = String(b.title || '').trim() || 'Sem título';
  let slug = slugify(b.slug || title);
  if (RESERVED.includes(slug)) slug = slug + '-pagina';
  slug = uniqueSlug('pages', slug, id);
  const parent = b.parent_id ? Number(b.parent_id) : null;
  if (parent !== null) {
    const parentPage = Number.isSafeInteger(parent) && parent > 0 ? db.prepare('SELECT parent_id FROM pages WHERE id=?').get(parent) : null;
    if (!parentPage) return formError(res, 'A página-mãe não existe. Selecione uma página válida.');
    if (parent === id || parentPage.parent_id !== null || (id && db.prepare('SELECT id FROM pages WHERE parent_id=?').get(id))) {
      return formError(res, 'O menu aceita dois níveis. Uma página com subpáginas não pode se tornar uma subpágina.');
    }
  }
  const blocks = JSON.stringify(cleanBlocks(b.blocks));
  const vals = [title, slug, parent, parseInt(b.menu_order, 10) || 0, b.show_in_menu ? 1 : 0, String(b.menu_label || '').trim() || null,
    b.status === 'published' ? 'published' : 'draft', String(b.meta_description || '').slice(0, 300), blocks, req.user.id];
  let savedId = id;
  if (id) {
    db.prepare("UPDATE pages SET title=?, slug=?, parent_id=?, menu_order=?, show_in_menu=?, menu_label=?, status=?, meta_description=?, blocks=?, updated_by=?, updated_at=datetime('now') WHERE id=?").run(...vals, id);
  } else {
    savedId = db.prepare('INSERT INTO pages (title, slug, parent_id, menu_order, show_in_menu, menu_label, status, meta_description, blocks, updated_by) VALUES (?,?,?,?,?,?,?,?,?,?)').run(...vals).lastInsertRowid;
  }
  if (b.set_home && req.user.role === 'admin') saveSettings({ home_page_id: savedId });
  flash(req, 'ok', 'Página salva.');
  res.redirect('/admin/paginas/' + savedId + (b.after === 'view' ? '?ver=1' : ''));
});

router.post('/paginas/:id/duplicar', (req, res) => {
  const p = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id);
  if (!p) return res.redirect('/admin/paginas');
  const r = db.prepare("INSERT INTO pages (title, slug, parent_id, menu_order, show_in_menu, status, meta_description, blocks, updated_by) VALUES (?,?,?,?,0,'draft',?,?,?)")
    .run(p.title + ' (cópia)', uniqueSlug('pages', p.slug + '-copia'), p.parent_id, p.menu_order, p.meta_description, p.blocks, req.user.id);
  flash(req, 'ok', 'Página duplicada como rascunho.');
  res.redirect('/admin/paginas/' + r.lastInsertRowid);
});

router.post('/paginas/:id/excluir', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === homeId(res.locals.settings)) { flash(req, 'erro', 'A página inicial não pode ser excluída. Defina outra página como inicial antes.'); return res.redirect('/admin/paginas'); }
  db.prepare('DELETE FROM pages WHERE id = ?').run(id);
  flash(req, 'ok', 'Página excluída.');
  res.redirect('/admin/paginas');
});

// ------------------ Comunicados (artigos) ------------------
router.get('/comunicados', (req, res) => {
  const q = String(req.query.q || '').trim();
  const rows = q
    ? db.prepare('SELECT a.*, u.name author FROM articles a LEFT JOIN users u ON u.id = a.author_id WHERE a.title LIKE ? OR a.category LIKE ? ORDER BY COALESCE(a.published_at, a.created_at) DESC').all(`%${q}%`, `%${q}%`)
    : db.prepare('SELECT a.*, u.name author FROM articles a LEFT JOIN users u ON u.id = a.author_id ORDER BY COALESCE(a.published_at, a.created_at) DESC').all();
  res.render('admin/articles', { title: 'Comunicados', articles: rows, q, now: nowUTC() });
});

const categories = () => db.prepare("SELECT DISTINCT category FROM articles WHERE category IS NOT NULL AND category != '' ORDER BY category").all().map(r => r.category);

router.get('/comunicados/novo', (req, res) => {
  res.render('admin/article-edit', { title: 'Novo comunicado', article: { id: 0, title: '', slug: '', category: '', excerpt: '', cover: '', content: '', status: 'draft', featured: 0 }, publishedLocal: toLocalInput(nowUTC()), categories: categories() });
});
router.get('/comunicados/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!a) return res.redirect('/admin/comunicados');
  res.render('admin/article-edit', { title: 'Editar comunicado', article: a, publishedLocal: toLocalInput(a.published_at || nowUTC()), categories: categories() });
});
router.post('/comunicados/:id', (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  if (id && !db.prepare('SELECT id FROM articles WHERE id=?').get(id)) return formError(res, 'Comunicado não encontrado.', 404);
  const b = req.body;
  const publishedAt = b.published_at ? toUTC(b.published_at) : nowUTC();
  if (!publishedAt) return formError(res, 'Data de publicação inválida. Informe uma data e horário válidos.');
  const title = String(b.title || '').trim() || 'Sem título';
  const slug = uniqueSlug('articles', b.slug || title, id);
  const vals = [title, slug, String(b.category || '').trim().slice(0, 60), String(b.excerpt || '').trim().slice(0, 400), cleanUrl(b.cover), cleanRich(b.content),
    b.status === 'published' ? 'published' : 'draft', b.featured ? 1 : 0, publishedAt];
  let savedId = id;
  if (id) db.prepare("UPDATE articles SET title=?, slug=?, category=?, excerpt=?, cover=?, content=?, status=?, featured=?, published_at=?, updated_at=datetime('now') WHERE id=?").run(...vals, id);
  else savedId = db.prepare('INSERT INTO articles (title, slug, category, excerpt, cover, content, status, featured, published_at, author_id) VALUES (?,?,?,?,?,?,?,?,?,?)').run(...vals, req.user.id).lastInsertRowid;
  flash(req, 'ok', 'Comunicado salvo.');
  res.redirect('/admin/comunicados/' + savedId);
});
router.post('/comunicados/:id/excluir', (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  flash(req, 'ok', 'Comunicado excluído.');
  res.redirect('/admin/comunicados');
});

// ------------------ Mídia ------------------
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'application/pdf': '.pdf' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${slugify(path.parse(file.originalname).name).slice(0, 40) || 'arquivo'}${ALLOWED[file.mimetype]}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(ALLOWED[file.mimetype] ? null : new Error('Formato não permitido. Use JPG, PNG, WEBP, GIF, SVG ou PDF.'), !!ALLOWED[file.mimetype])
});

const mediaRows = () => db.prepare('SELECT m.*, u.name uploader FROM media m LEFT JOIN users u ON u.id = m.uploaded_by ORDER BY m.created_at DESC, m.id DESC').all().map(m => ({ ...m, url: '/uploads/' + m.filename }));

router.get('/midia', (req, res) => res.render('admin/media', { title: 'Mídia', media: mediaRows() }));
router.get('/midia.json', (req, res) => res.json(mediaRows()));
router.post('/midia/enviar', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo maior que 10 MB.' : err.message });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    const f = req.file;
    const r = db.prepare('INSERT INTO media (filename, original_name, mime, size, uploaded_by) VALUES (?,?,?,?,?)').run(f.filename, f.originalname, f.mimetype, f.size, req.user.id);
    res.json({ id: r.lastInsertRowid, url: '/uploads/' + f.filename, original_name: f.originalname, mime: f.mimetype });
  });
});
router.post('/midia/:id/excluir', (req, res) => {
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(req.params.id);
  if (!m) return res.redirect('/admin/midia');
  fs.rm(path.join(UPLOAD_DIR, path.basename(m.filename)), { force: true }, (err) => {
    if (err) return formError(res, 'Não foi possível excluir o arquivo. Tente novamente.');
    db.prepare('DELETE FROM media WHERE id = ?').run(m.id);
    flash(req, 'ok', 'Arquivo excluído. Verifique se ele não era usado em alguma página.');
    res.redirect('/admin/midia');
  });
});

// ------------------ Meu perfil ------------------
router.get('/perfil', (req, res) => res.render('admin/profile', { title: 'Meu perfil', error: null }));
router.post('/perfil', (req, res) => {
  const { name, current, password } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (password) {
    if (!bcrypt.compareSync(String(current || ''), u.password_hash)) return res.render('admin/profile', { title: 'Meu perfil', error: 'Senha atual incorreta.' });
    if (String(password).length < 8) return res.render('admin/profile', { title: 'Meu perfil', error: 'A nova senha deve ter pelo menos 8 caracteres.' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 10), u.id);
    revokeUserSessions(u.id, req.sessionID);
  }
  if (name && name.trim()) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), u.id);
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
const adminCount = () => db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1").get().n;

router.get('/usuarios', requireAdmin, (req, res) => {
  res.render('admin/users', { title: 'Usuários', users: db.prepare('SELECT * FROM users ORDER BY name').all() });
});
router.get('/usuarios/novo', requireAdmin, (req, res) => res.render('admin/user-edit', { title: 'Novo usuário', u: { id: 0, name: '', email: '', role: 'editor', active: 1 }, error: null }));
router.get('/usuarios/:id', requireAdmin, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.redirect('/admin/usuarios');
  res.render('admin/user-edit', { title: 'Editar usuário', u, error: null });
});
router.post('/usuarios/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  if (id && !db.prepare('SELECT id FROM users WHERE id=?').get(id)) return formError(res, 'Usuário não encontrado.', 404);
  const b = req.body;
  const form = { id, name: b.name, email: b.email, role: b.role === 'admin' ? 'admin' : 'editor', active: b.active ? 1 : 0 };
  const err = validateUser(b, !id);
  const fail = (msg) => res.render('admin/user-edit', { title: id ? 'Editar usuário' : 'Novo usuário', u: form, error: msg });
  if (err) return fail(err);
  const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(b.email.trim(), id);
  if (dup) return fail('Já existe um usuário com este e-mail.');
  if (id) {
    const old = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (old.role === 'admin' && old.active && (form.role !== 'admin' || !form.active) && adminCount() <= 1) return fail('É preciso manter pelo menos um administrador ativo.');
    if (id === req.user.id && !form.active) return fail('Você não pode desativar a própria conta.');
    db.prepare('UPDATE users SET name=?, email=?, role=?, active=? WHERE id=?').run(form.name.trim(), form.email.trim(), form.role, form.active, id);
    if (b.password) db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(b.password, 10), id);
    if (!form.active || b.password) revokeUserSessions(id, id === req.user.id ? req.sessionID : null);
  } else {
    db.prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?,?,?,?,?)').run(form.name.trim(), form.email.trim(), bcrypt.hashSync(b.password, 10), form.role, form.active);
  }
  flash(req, 'ok', 'Usuário salvo.');
  res.redirect('/admin/usuarios');
});
router.post('/usuarios/:id/excluir', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return res.redirect('/admin/usuarios');
  if (id === req.user.id) { flash(req, 'erro', 'Você não pode excluir a própria conta.'); return res.redirect('/admin/usuarios'); }
  if (u.role === 'admin' && adminCount() <= 1) { flash(req, 'erro', 'É preciso manter pelo menos um administrador.'); return res.redirect('/admin/usuarios'); }
  revokeUserSessions(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  flash(req, 'ok', 'Usuário excluído.');
  res.redirect('/admin/usuarios');
});

// ------------------ Configurações (somente admin) ------------------
const SETTING_KEYS = ['site_name', 'site_tagline', 'logo', 'footer_about', 'contact_email', 'contact_phone', 'contact_city', 'whatsapp_url', 'instagram_url', 'facebook_url', 'linkedin_url', 'footer_link_label', 'footer_link_url', 'copyright', 'articles_menu_label', 'articles_page_title', 'home_page_id'];
const URL_KEYS = ['logo', 'whatsapp_url', 'instagram_url', 'facebook_url', 'linkedin_url', 'footer_link_url'];
router.get('/configuracoes', requireAdmin, (req, res) => {
  res.render('admin/settings', { title: 'Configurações', pages: db.prepare('SELECT id, title FROM pages ORDER BY title').all() });
});
router.post('/configuracoes', requireAdmin, (req, res) => {
  const home = req.body.home_page_id;
  if (home && (!/^\d+$/.test(home) || !Number.isSafeInteger(Number(home)) || !db.prepare('SELECT id FROM pages WHERE id=?').get(Number(home)))) {
    return formError(res, 'A página inicial selecionada não existe.');
  }
  const out = {};
  for (const k of SETTING_KEYS) out[k] = URL_KEYS.includes(k) ? cleanUrl(req.body[k]) : String(req.body[k] || '').trim().slice(0, 1000);
  saveSettings(out);
  flash(req, 'ok', 'Configurações salvas.');
  res.redirect('/admin/configuracoes');
});

module.exports = router;
