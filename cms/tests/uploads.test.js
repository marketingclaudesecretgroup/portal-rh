const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const express = require('express');

const meta = { name: 'Homem Conferindo Roupas no Estoque.png', type: 'image/png', size: 100 };

async function listen(server, t) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

async function fixture(t, options = {}) {
  const calls = [];
  const url = await listen(http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
    calls.push({ method: req.method, url: req.url, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET' && req.url === '/storage/v1/bucket/portal-rh') {
      res.statusCode = options.bucketStatus || 200;
      res.end(JSON.stringify(res.statusCode === 200 ? { id: 'portal-rh', public: options.public !== false } : { message: res.statusCode === 404 ? 'Bucket not found' : 'Invalid JWT', statusCode: res.statusCode }));
    } else if (req.method === 'POST' && req.url === '/storage/v1/bucket') {
      res.end(JSON.stringify({ name: 'portal-rh' }));
    } else if (req.url.startsWith('/storage/v1/object/upload/sign/')) {
      res.end(JSON.stringify({ url: req.url.replace('/storage/v1', '') + '?token=fixture-token' }));
    } else if (req.url === '/storage/v1/object/list/portal-rh') {
      res.statusCode = options.listStatus || 200;
      res.end(JSON.stringify(res.statusCode === 200 ? [{ name: body.search }] : { message: 'Storage unavailable', statusCode: res.statusCode }));
    } else if (req.method === 'DELETE') {
      res.statusCode = 503;
      res.end(JSON.stringify({ message: 'Storage unavailable', statusCode: 503 }));
    } else {
      res.statusCode = 404; res.end(JSON.stringify({ message: 'Not found' }));
    }
  }), t);
  const previous = {};
  for (const key of ['VERCEL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL']) previous[key] = process.env[key];
  Object.assign(process.env, {
    VERCEL: '1', DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
    SUPABASE_URL: options.missing ? '' : url, SUPABASE_SERVICE_ROLE_KEY: options.missing ? '' : 'fixture-service-key'
  });
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  delete require.cache[require.resolve('../src/storage')];
  delete require.cache[require.resolve('../src/routes/admin')];
  const storage = require('../src/storage');
  const { db } = require('../src/db');
  const originalGet = db.get;
  db.get = async () => ({ id: 7 });
  t.after(() => { db.get = originalGet; });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.session = { csrf: 'fixture-csrf' }; req.user = { id: 1, role: 'admin' }; res.locals.settings = {}; next(); });
  app.use('/admin', require('../src/routes/admin'));
  const baseUrl = await listen(http.createServer(app), t);
  async function post(route, data = meta) {
    const response = await fetch(baseUrl + '/admin/midia/' + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'fixture-csrf', Accept: 'application/json' }, body: JSON.stringify(data)
    });
    return { status: response.status, data: await response.json() };
  }
  return { storage, calls, post, url };
}

after(async () => { const cached = require.cache[require.resolve('../src/db')]; if (cached) await cached.exports.pool.end(); });

test('Vercel sem credenciais rejeita envio local antes de gravar no disco ou aguardar timeout', async t => {
  const { storage, post } = await fixture(t, { missing: true });
  let writes = 0;
  storage.saveLocal = () => { writes++; throw new Error('O disco não deve ser usado'); };
  const signature = await post('assinar');
  assert.equal(signature.status, 500);
  assert.match(signature.data.error, /não foi configurado/);
  const direct = await post('enviar');
  assert.equal(direct.status, 503);
  assert.equal(typeof direct.data.error, 'string');
  assert.equal(writes, 0);
});

test('assinatura usa SDK real, cria bucket ausente e produz caminho válido para o nome da imagem', async t => {
  const { post, calls, url } = await fixture(t, { bucketStatus: 404 });
  const result = await post('assinar');
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.mode, 'supabase');
  assert.match(result.data.path, /^\d{4}\/\d{2}\/[\w.-]+\.png$/);
  assert.ok(result.data.signedUrl.startsWith(url));
  assert.ok(calls.some(c => c.method === 'POST' && c.url === '/storage/v1/bucket' && c.body.public === true));
});

test('credencial recusada preserva erro útil e não tenta criar bucket sem autorização', async t => {
  const { post, calls } = await fixture(t, { bucketStatus: 403 });
  const result = await post('assinar');
  assert.equal(result.status, 500);
  assert.match(result.data.error, /credenciais/);
  assert.doesNotMatch(result.data.error, /\[object Object\]/);
  assert.equal(calls.filter(c => c.method === 'POST').length, 0);
});

test('bucket privado não recebe imagem cuja URL pública ficaria quebrada', async t => {
  const { post } = await fixture(t, { public: false });
  const result = await post('assinar');
  assert.equal(result.status, 500);
  assert.match(result.data.error, /privada/);
});

test('falha na confirmação do Storage retorna JSON e não vira arquivo inexistente', async t => {
  const { post } = await fixture(t, { listStatus: 503 });
  const result = await post('confirmar', { ...meta, path: '2026/11/fixture.png' });
  assert.equal(result.status, 500);
  assert.match(result.data.error, /confirmar/);
});

test('confirmação bem-sucedida registra e retorna URL pública utilizável', async t => {
  const { post, url } = await fixture(t);
  const result = await post('confirmar', { ...meta, path: '2026/11/fixture.png' });
  assert.equal(result.status, 200);
  assert.equal(result.data.id, 7);
  assert.equal(result.data.url, url + '/storage/v1/object/public/portal-rh/2026/11/fixture.png');
});

test('falha ao excluir no Storage não é ignorada', async t => {
  const { storage } = await fixture(t);
  await assert.rejects(storage.remove('2026/11/fixture.png'), /excluir/);
});

test('erros aninhados são convertidos em mensagem legível', async t => {
  const { storage } = await fixture(t);
  assert.equal(storage.errorMessage({ error: { message: 'Limite atingido' } }), 'Limite atingido');
  assert.equal(storage.errorMessage({ error: {} }, 'Falha no envio'), 'Falha no envio');
});
