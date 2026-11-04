const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { Client, types } = require('pg');
types.setTypeParser(20, (v) => parseInt(v, 10));

try { process.loadEnvFile && process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* sem .env */ }

const credentials = { name: 'Administrador de teste', email: 'admin@example.test', password: 'TesteLocal123!' };

// Os testes rodam num schema temporário do Postgres, apagado ao final.
// Use TEST_DATABASE_URL (recomendado: um Postgres local ou a conexão "Direct"/"Session" do Supabase).
function baseDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Defina TEST_DATABASE_URL (ou DATABASE_URL) para rodar os testes. Veja o README.');
  return url;
}
const withSchema = (url, schema) => {
  const u = new URL(url);
  u.searchParams.set('options', `-c search_path=${schema}`);
  return u.toString();
};
const sslFor = (url) => /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false };

// Converte valores do Postgres para o formato usado nas asserções
function normalize(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) out[k] = v.toISOString().slice(0, 19).replace('T', ' ');
    else if (v && typeof v === 'object') out[k] = JSON.stringify(v);
    else out[k] = v;
  }
  return out;
}

async function startPortal() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'portal-rh-test-'));
  const schema = 'teste_' + crypto.randomBytes(5).toString('hex');
  const base = baseDatabaseUrl();
  const client = new Client({ connectionString: base, ssl: sslFor(base) });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  const databaseUrl = withSchema(base, schema);
  process.env.DATABASE_URL = databaseUrl; // scripts filhos (ex.: reset-password) usam o mesmo schema

  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const env = { ...process.env, PORT: String(port), DATA_DIR: dataDir, DATABASE_URL: databaseUrl, COOKIE_SECURE: 'false', TRUST_PROXY: 'false', SESSION_SECRET: 'segredo-de-teste' };
  delete env.SUPABASE_URL; delete env.SUPABASE_SERVICE_ROLE_KEY; delete env.VERCEL; // uploads locais nos testes
  const server = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), windowsHide: true, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  server.stdout.on('data', data => { logs += data; });
  server.stderr.on('data', data => { logs += data; });
  const baseUrl = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 300; i++) {
    if (server.exitCode !== null) break;
    try { if ((await fetch(baseUrl)).ok) { ready = true; break; } } catch {}
    await delay(50);
  }
  if (!ready) { server.kill(); await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await client.end(); throw new Error('Servidor de teste não iniciou: ' + logs); }

  // Interface parecida com a anterior: db.prepare(sql).get(...) / .all(...), mas assíncrona
  const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };
  const db = {
    prepare: (sql) => ({
      get: async (...params) => normalize((await client.query(toPg(sql), params)).rows[0]),
      all: async (...params) => (await client.query(toPg(sql), params)).rows.map(normalize)
    })
  };

  function session() {
    let cookie = '';
    let csrf = '';
    async function request(url, options = {}) {
      const headers = { ...options.headers };
      if (cookie) headers.Cookie = cookie;
      let body = options.body;
      if (body && !(body instanceof FormData) && typeof body !== 'string') {
        body = new URLSearchParams({ _csrf: csrf, ...body });
      }
      const response = await fetch(baseUrl + url, { ...options, body, headers, redirect: 'manual' });
      const cookies = response.headers.getSetCookie();
      if (cookies.length) cookie = cookies.map(c => c.split(';')[0]).join('; ');
      const text = await response.text();
      const token = text.match(/name="csrf-token" content="([^"]+)"/);
      if (token) csrf = token[1];
      return { status: response.status, headers: response.headers, text, json: () => JSON.parse(text) };
    }
    return {
      get: (url, options) => request(url, options),
      post: (url, body = {}, options = {}) => request(url, { ...options, method: 'POST', body }),
      upload: (file, name, type) => {
        const body = new FormData();
        if (file !== null) body.set('file', new Blob([file], { type }), name);
        return request('/admin/midia/enviar', { method: 'POST', body, headers: { 'X-CSRF-Token': csrf, Accept: 'application/json' } });
      }
    };
  }
  return {
    baseUrl, db, dataDir, schema, session, logs: () => logs,
    async close() {
      if (server.exitCode === null) {
        const stopped = once(server, 'exit');
        server.kill();
        await stopped;
      }
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await client.end();
      assert.equal(path.dirname(path.resolve(dataDir)), path.resolve(os.tmpdir()));
      assert.ok(path.basename(dataDir).startsWith('portal-rh-test-'));
      await fs.rm(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  };
}

async function setupAdmin(portal) {
  const admin = portal.session();
  assert.equal((await admin.get('/admin/setup')).status, 200);
  assert.equal((await admin.post('/admin/setup', credentials)).status, 302);
  assert.equal((await admin.get('/admin')).status, 200);
  return admin;
}

async function login(portal, email, password) {
  const user = portal.session();
  await user.get('/admin/login');
  assert.equal((await user.post('/admin/login', { email, password })).status, 302);
  await user.get('/admin');
  return user;
}

module.exports = { startPortal, setupAdmin, login, credentials };
