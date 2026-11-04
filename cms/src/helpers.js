const { db, getSettings } = require('./db');
const { icon, social } = require('./icons');

const RESERVED = ['admin', 'comunicados', 'uploads', 'static', 'vendor', 'assets', 'css', 'js', 'api', 'login', 'favicon.ico', 'robots.txt'];

function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, 'e')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function uniqueSlug(table, base, excludeId) {
  let slug = slugify(base) || (table === 'pages' ? 'pagina' : 'comunicado');
  if (table === 'pages' && RESERVED.includes(slug)) slug += '-1';
  let i = 1, candidate = slug;
  while (await db.get(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`, [candidate, excludeId || 0])) candidate = `${slug}-${++i}`;
  return candidate;
}

const homeId = (settings) => parseInt(settings.home_page_id, 10) || 0;

function pageUrl(page, settings) {
  if (!page) return '/';
  if (page.id === homeId(settings)) return '/';
  return '/' + page.slug;
}

async function buildMenu(settings) {
  const pages = await db.all("SELECT id, title, slug, parent_id, menu_label FROM pages WHERE status = 'published' AND show_in_menu ORDER BY menu_order, title");
  const byParent = {};
  for (const p of pages) (byParent[p.parent_id || 0] ||= []).push(p);
  const items = (byParent[0] || []).map(p => ({
    label: p.menu_label || p.title,
    url: pageUrl(p, settings),
    children: (byParent[p.id] || []).map(c => ({ label: c.menu_label || c.title, url: pageUrl(c, settings) }))
  }));
  if (settings.articles_menu_label) items.push({ label: settings.articles_menu_label, url: '/comunicados', children: [] });
  return items;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function fmtDate(v, long) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return '';
  const loc = d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (long) return loc;
  const [dd, mm, yyyy] = loc.split(',')[0].split('/');
  return `${dd} ${MONTHS[parseInt(mm, 10) - 1]} ${yyyy}`;
}

const isExternal = (u) => /^https?:\/\//i.test(u || '');
const linkAttrs = (u) => isExternal(u) ? ' target="_blank" rel="noopener noreferrer"' : '';

// Variáveis disponíveis em todos os templates
async function locals(req, res, next) {
  res.locals.settings = await getSettings();
  res.locals.icon = icon;
  res.locals.social = social;
  res.locals.fmtDate = fmtDate;
  res.locals.linkAttrs = linkAttrs;
  res.locals.currentPath = req.path;
  res.locals.year = new Date().getFullYear();
  next();
}

module.exports = { slugify, uniqueSlug, pageUrl, homeId, buildMenu, fmtDate, locals, RESERVED, linkAttrs };
