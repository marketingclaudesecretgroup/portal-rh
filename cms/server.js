const path = require('path');
const express = require('express');
const { UPLOAD_DIR } = require('./src/db');
const { sessionMiddleware, loadUser } = require('./src/auth');
const { locals } = require('./src/helpers');
require('./src/seed').seedIfEmpty();

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
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
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '30d',
  // SVGs e PDFs podem conter conteúdo ativo quando abertos diretamente.
  // A política mantém as imagens utilizáveis sem executar scripts na origem do portal.
  setHeaders(res) {
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  }
}));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.json({ limit: '5mb' }));
app.use(sessionMiddleware);
app.use(loadUser);
app.use(locals);

app.use('/admin', require('./src/routes/admin'));
app.use('/', require('./src/routes/public'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Ocorreu um erro inesperado. Tente novamente.');
});

app.listen(PORT, () => {
  console.log(`\n  Comunica Secret rodando em http://localhost:${PORT}`);
  console.log(`  Painel: http://localhost:${PORT}/admin\n`);
});
