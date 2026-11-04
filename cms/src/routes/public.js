const express = require('express');
const { db } = require('../db');
const { buildMenu, homeId } = require('../helpers');

const router = express.Router();

router.use(async (req, res, next) => {
  res.locals.menu = await buildMenu(res.locals.settings);
  next();
});

async function fetchArticles({ limit = 12, offset = 0, category } = {}) {
  const where = ["status = 'published'", 'published_at <= now()'];
  const params = [];
  if (category) { where.push('lower(category) = lower(?)'); params.push(category); }
  const rows = await db.all(`SELECT id, title, slug, category, excerpt, cover, published_at FROM articles WHERE ${where.join(' AND ')} ORDER BY featured DESC, published_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  const total = (await db.get(`SELECT COUNT(*) n FROM articles WHERE ${where.join(' AND ')}`, params)).n;
  return { rows, total };
}

async function renderPage(req, res, page) {
  if (!page || (page.status !== 'published' && !req.user)) return notFound(req, res);
  let blocks = Array.isArray(page.blocks) ? page.blocks : [];
  blocks = blocks.map((b, index) => ({ ...b, index })).filter(b => !b.hidden); // mantém as âncoras #secao-N
  for (const b of blocks) {
    if (b.type === 'latest_articles') {
      b.articles = (await fetchArticles({ limit: parseInt(b.data.count, 10) || 3, category: b.data.category || null })).rows;
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

router.get('/', async (req, res) => {
  const page = await db.get('SELECT * FROM pages WHERE id = ?', [homeId(res.locals.settings)]);
  if (!page) return res.render('public/empty', { title: res.locals.settings.site_name });
  await renderPage(req, res, page);
});

router.get('/comunicados', async (req, res) => {
  const per = 12;
  const pageN = req.query.pagina === undefined ? 1 : Number(req.query.pagina);
  if ((req.query.pagina !== undefined && typeof req.query.pagina !== 'string') ||
      !Number.isSafeInteger(pageN) || pageN < 1 || pageN > 100000 ||
      (req.query.categoria !== undefined && typeof req.query.categoria !== 'string')) {
    return res.status(400).send('Filtros inválidos. Confira a categoria e o número da página.');
  }
  const category = (req.query.categoria || '').trim() || null;
  const { rows, total } = await fetchArticles({ limit: per, offset: (pageN - 1) * per, category });
  const categories = (await db.all("SELECT DISTINCT category FROM articles WHERE status='published' AND published_at <= now() AND category IS NOT NULL AND category != '' ORDER BY category")).map(r => r.category);
  res.render('public/articles', { title: res.locals.settings.articles_page_title || 'Comunicados', articles: rows, categories, category, pageN, pages: Math.ceil(total / per) });
});

router.get('/comunicados/:slug', async (req, res) => {
  const a = await db.get('SELECT a.*, u.name author FROM articles a LEFT JOIN users u ON u.id = a.author_id WHERE a.slug = ?', [req.params.slug]);
  const isPublic = a && a.status === 'published' && a.published_at && new Date(a.published_at) <= new Date();
  if (!a || (!isPublic && !req.user)) return notFound(req, res);
  const related = await db.all("SELECT title, slug, category, cover, published_at, excerpt FROM articles WHERE status='published' AND id != ? AND published_at <= now() ORDER BY published_at DESC LIMIT 3", [a.id]);
  res.render('public/article', { title: a.title, description: a.excerpt, article: a, related, isDraft: !isPublic });
});

router.get('/:slug', async (req, res) => {
  const page = await db.get('SELECT * FROM pages WHERE slug = ?', [req.params.slug]);
  if (page && page.id === homeId(res.locals.settings)) return res.redirect(301, '/');
  await renderPage(req, res, page);
});

router.use(notFound);

module.exports = router;
