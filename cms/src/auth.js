const crypto = require('crypto');
const session = require('express-session');
const { db } = require('./db');

// ---- Sessões guardadas no Postgres ----
class PgStore extends session.Store {
  get(sid, cb) {
    db.get('SELECT sess FROM sessions WHERE sid = ? AND expires > now()', [sid])
      .then((r) => cb(null, r ? r.sess : null), cb);
  }
  set(sid, sess, cb) {
    const exp = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + 86400000);
    db.run('INSERT INTO sessions (sid, sess, user_id, expires) VALUES (?, ?, ?, ?) ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, user_id = EXCLUDED.user_id, expires = EXCLUDED.expires',
      [sid, JSON.stringify(sess), sess.userId || null, exp])
      .then(() => cb && cb(null), (e) => cb && cb(e));
    // Limpeza ocasional de sessões vencidas
    if (Math.random() < 0.02) db.run('DELETE FROM sessions WHERE expires < now()').catch(() => {});
  }
  destroy(sid, cb) { db.run('DELETE FROM sessions WHERE sid = ?', [sid]).then(() => cb && cb(null), (e) => cb && cb(e)); }
  touch(sid, sess, cb) { this.set(sid, sess, cb); }
}

async function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const row = await db.get("SELECT value FROM settings WHERE key = '_session_secret'");
  if (row) return row.value;
  const s = crypto.randomBytes(32).toString('hex');
  await db.run("INSERT INTO settings (key, value) VALUES ('_session_secret', ?) ON CONFLICT (key) DO NOTHING", [s]);
  return (await db.get("SELECT value FROM settings WHERE key = '_session_secret'")).value;
}

// O middleware de sessão é criado depois de ler o segredo
let sessionMw;
async function sessionMiddleware(req, res, next) {
  if (!sessionMw) {
    sessionMw = session({
      store: new PgStore(),
      secret: await getSecret(),
      name: 'cs.sid',
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : !!process.env.VERCEL,
        maxAge: 1000 * 60 * 60 * 12
      }
    });
  }
  sessionMw(req, res, next);
}

async function loadUser(req, res, next) {
  res.locals.currentUser = null;
  if (req.session && req.session.userId) {
    const u = await db.get('SELECT id, name, email, role, active FROM users WHERE id = ?', [req.session.userId]);
    if (u && u.active) { req.user = u; res.locals.currentUser = u; }
    else delete req.session.userId;
  }
  next();
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  if ((req.headers.accept || '').includes('application/json')) return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).render('admin/error', { title: 'Acesso restrito', message: 'Somente administradores podem acessar esta área.' });
}

// Encerra as sessões de um usuário (exceto, opcionalmente, a atual)
function revokeUserSessions(userId, exceptSid) {
  return db.run("DELETE FROM sessions WHERE (user_id = ? OR (sess->>'userId')::int = ?) AND sid != ?", [userId, userId, exceptSid || '']);
}

// ---- CSRF simples por sessão ----
function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = (req.body && req.body._csrf) || req.get('x-csrf-token');
    if (!token || token !== req.session.csrf) {
      return res.status(403).send('Token de segurança inválido. Volte, recarregue a página e tente novamente.');
    }
  }
  next();
}

// ---- Limite de tentativas de login (por instância) ----
const attempts = new Map();
function loginLimiter(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const rec = attempts.get(key) || { count: 0, first: now };
  if (now - rec.first > 15 * 60 * 1000) { rec.count = 0; rec.first = now; }
  if (rec.count >= 10) return res.status(429).render('admin/login', { title: 'Entrar', error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.', email: '', next: '' });
  req.registerFail = () => { rec.count++; attempts.set(key, rec); };
  req.clearFails = () => attempts.delete(key);
  next();
}

module.exports = { sessionMiddleware, loadUser, requireLogin, requireAdmin, csrf, loginLimiter, revokeUserSessions };
