const path = require('path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const { init } = require('./src/db');
const { sessionMiddleware, loadUser } = require('./src/auth');
const { locals } = require('./src/helpers');
const storage = require('./src/storage');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Atualizações do painel usam uma URL nova, mesmo com o cache dos arquivos estáticos.
app.locals.adminAssetVersion = crypto.createHash('sha256')
  .update(fs.readFileSync(path.join(__dirname, 'public', 'js', 'admin.js'))).digest('hex').slice(0, 12);
if (process.env.TRUST_PROXY !== 'false') app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/vendor/quill', express.static(path.join(__dirname, 'node_modules', 'quill', 'dist'), { maxAge: '30d' }));
if (!storage.useSupabase) app.use('/uploads', express.static(storage.LOCAL_DIR, {
  maxAge: '30d',
  // SVGs e PDFs podem conter conteúdo ativo; a política impede scripts na origem do portal.
  setHeaders(res) { res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"); }
}));

// Garante que as tabelas existem antes de atender
app.use(async (req, res, next) => { await init(); next(); });
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(sessionMiddleware);
app.use(loadUser);
app.use(locals);

app.use('/admin', require('./src/routes/admin'));
app.use('/', require('./src/routes/public'));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const dbDown = /ECONNREFUSED|ENOTFOUND|password authentication|DATABASE_URL|connect/i.test(String(err && err.message));
  res.status(500).send(dbDown
    ? 'Não foi possível conectar ao banco de dados. Verifique a variável DATABASE_URL.'
    : 'Ocorreu um erro inesperado. Tente novamente.');
});

module.exports = app;
