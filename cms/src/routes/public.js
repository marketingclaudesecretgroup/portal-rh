const express = require('express');
const { db } = require('../db');
const { buildMenu, homeId, pageUrl } = require('../helpers');

const router = express.Router();

router.use((req, res, next) => {
  res.locals.menu = buildMenu(res.locals.settings);
  next();
});

function fetchArticles({ limit = 12, offset = 0, category } = {}) {
  const where = ["status = 'published'", "published_at <= datetime('now')"];
  const params = [];
  if (category) { where.push('category = ? COLLATE NOCASE'); params.push(category); }
  const rows = db.prepare(`SELECT id, title, slug, category, excerpt, cover, published_at FROM articles WHERE ${where.join(' AND ')} ORDER BY featured DESC, published_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  const total = db.prepare(`SELECT COUNT(*) n FROM articles WHERE ${where.join(' AND ')}`).get(...params).n;
  return { rows, total };
}

function renderPage(req, res, page) {
  const canPreview = !!req.user;
  if (!page || (page.status !== 'published' && !canPreview)) return notFound(req, res);
  let blocks = [];
  try { blocks = JSON.parse(page.blocks || '[]'); } catch { blocks = []; }
  blocks = blocks.map((b, index) => ({ ...b, index })).filter(b => !b.hidden);
  // Dados dinâmicos para blocos de artigos
  for (const b of blocks) {
    if (b.type === 'latest_articles') {
      b.articles = fetchArticles({ limit: parseInt(b.data.count, 10) || 3, category: b.data.category || null }).rows;
    }
  }
  res.render('public/page', {
    title: page.id === homeId(res.locals.settings) ? res.locals.settings.site_name : page.title,
    description: page.meta_description,
    page, blocks, isDraft: page.status !== 'published'
  });
}

function notFound(req, res) {
  res.status(404).render('public/404', { title: 'Página não encontrada' });
}

router.get('/', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(homeId(res.locals.settings));
  if (!page) return res.render('public/empty', { title: res.locals.settings.site_name });
  renderPage(req, res, page);
});

router.get('/comunicados', (req, res) => {
  const per = 12;
  const pageN = req.query.pagina === undefined ? 1 : Number(req.query.pagina);
  if ((req.query.pagina !== undefined && typeof req.query.pagina !== 'string') ||
      !Number.isSafeInteger(pageN) || pageN < 1 || pageN > Math.floor(Number.MAX_SAFE_INTEGER / per) ||
      (req.query.categoria !== undefined && typeof req.query.categoria !== 'string')) {
    return res.status(400).send('Filtros inválidos. Confira a categoria e o número da página.');
  }
  const category = (req.query.categoria || '').trim() || null;
  const { rows, total } = fetchArticles({ limit: per, offset: (pageN - 1) * per, category });
  const categories = db.prepare("SELECT DISTINCT category FROM articles WHERE status='published' AND published_at <= datetime('now') AND category IS NOT NULL AND category != '' ORDER BY category").all().map(r => r.category);
  res.render('public/articles', { title: res.locals.settings.articles_page_title || 'Comunicados', articles: rows, categories, category, pageN, pages: Math.ceil(total / per) });
});

router.get('/comunicados/:slug', (req, res) => {
  const a = db.prepare('SELECT a.*, u.name author FROM articles a LEFT JOIN users u ON u.id = a.author_id WHERE a.slug = ?').get(req.params.slug);
  const isPublic = a && a.status === 'published' && a.published_at && a.published_at <= new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (!a || (!isPublic && !req.user)) return notFound(req, res);
  const related = db.prepare("SELECT title, slug, category, cover, published_at, excerpt FROM articles WHERE status='published' AND id != ? AND published_at <= datetime('now') ORDER BY published_at DESC LIMIT 3").all(a.id);
  res.render('public/article', { title: a.title, description: a.excerpt, article: a, related, isDraft: !isPublic });
});

router.get('/:slug', (req, res) => {
  const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get(req.params.slug);
  if (page && page.id === homeId(res.locals.settings)) return res.redirect(301, '/');
  renderPage(req, res, page);
});

router.use(notFound);

module.exports = router;
module.exports.pageUrl = pageUrl;
