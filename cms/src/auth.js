const crypto = require('crypto');
const session = require('express-session');
const { db } = require('./db');

// ---- Session store em SQLite (sem dependência extra) ----
class SqliteStore extends session.Store {
  constructor() {
    super();
    this.getStmt = db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?');
    this.setStmt = db.prepare('INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires');
    this.delStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
    setInterval(() => db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now()), 60 * 60 * 1000).unref();
  }
  get(sid, cb) {
    try {
      const row = this.getStmt.get(sid);
      if (!row || row.expires < Date.now()) return cb(null, null);
      cb(null, JSON.parse(row.sess));
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try {
      const exp = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400000;
      this.setStmt.run(sid, JSON.stringify(sess), exp);
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }
  destroy(sid, cb) { try { this.delStmt.run(sid); cb && cb(null); } catch (e) { cb && cb(e); } }
  touch(sid, sess, cb) { this.set(sid, sess, cb); }
}

// Segredo da sessão: variável de ambiente ou gerado e salvo no banco
function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const row = db.prepare("SELECT value FROM settings WHERE key = '_session_secret'").get();
  if (row) return row.value;
  const s = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT INTO settings (key, value) VALUES ('_session_secret', ?)").run(s);
  return s;
}

const sessionMiddleware = session({
  store: new SqliteStore(),
  secret: getSecret(),
  name: 'cs.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 1000 * 60 * 60 * 12
  }
});

// Carrega usuário logado
function loadUser(req, res, next) {
  res.locals.currentUser = null;
  if (req.session && req.session.userId) {
    const u = db.prepare('SELECT id, name, email, role, active FROM users WHERE id = ?').get(req.session.userId);
    if (u && u.active) { req.user = u; res.locals.currentUser = u; }
    else delete req.session.userId;
  }
  next();
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  if (req.xhr || (req.headers.accept || '').includes('application/json')) return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).render('admin/error', { title: 'Acesso restrito', message: 'Somente administradores podem acessar esta área.' });
}

function revokeUserSessions(userId, exceptSid) {
  db.prepare("DELETE FROM sessions WHERE json_extract(sess, '$.userId') = ? AND sid != ?")
    .run(userId, exceptSid || '');
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

// ---- Limite de tentativas de login ----
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
