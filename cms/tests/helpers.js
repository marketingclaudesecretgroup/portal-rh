const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const Database = require('better-sqlite3');

const credentials = { name: 'Administrador de teste', email: 'admin@example.test', password: 'TesteLocal123!' };

async function startPortal() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'portal-rh-test-'));
  const reservation = net.createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'), windowsHide: true,
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, COOKIE_SECURE: 'false', TRUST_PROXY: 'false' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  server.stdout.on('data', data => { logs += data; });
  server.stderr.on('data', data => { logs += data; });
  const baseUrl = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 200; i++) {
    if (server.exitCode !== null) break;
    try { if ((await fetch(baseUrl)).ok) { ready = true; break; } } catch {}
    await delay(50);
  }
  if (!ready) { server.kill(); throw new Error('Servidor de teste não iniciou: ' + logs); }
  const db = new Database(path.join(dataDir, 'portal.db'));

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
    baseUrl, db, dataDir, session, logs: () => logs,
    async close() {
      db.close();
      if (server.exitCode === null) {
        const stopped = once(server, 'exit');
        server.kill();
        await stopped;
      }
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
