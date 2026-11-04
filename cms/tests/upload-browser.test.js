const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '..', 'public/js/admin.js'), 'utf8');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=', 'base64');
const item = { id: 1, url: 'https://storage.example.test/public/fixture.png', mime: 'image/png', original_name: 'Homem Conferindo Roupas no Estoque.png' };
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => { if (browser) await browser.close(); });

async function fixture(t, options = {}) {
  const context = await browser.newContext();
  if (options.timeout) await context.addInitScript(() => {
    const original = window.setTimeout;
    window.setTimeout = (callback, ms, ...args) => original(callback, ms >= 30000 ? 20 : ms, ...args);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [], requests = [], alerts = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
  t.after(async () => { await context.close(); assert.deepEqual(errors, []); });
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT,POST,OPTIONS' };
    const json = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><head><meta name="csrf-token" content="fixture-csrf"></head><body>
      <div data-image-field><input name="cover"><div class="image-field__preview"></div><button data-pick>Escolher imagem</button><button data-clear>Remover</button></div>
      <div class="modal" id="media-modal" hidden><input type="file" data-upload><div data-grid></div></div>
      <script src="/static/js/admin.js"></script></body>` });
    if (url.pathname === '/static/js/admin.js') return route.fulfill({ contentType: 'application/javascript', body: source });
    if (url.pathname === '/admin/midia.json') return options.listError ? json({ error: { message: 'Sessão expirada' } }, 401) : json([]);
    requests.push({ path: url.pathname, method: req.method(), data: req.postData(), headers: req.headers() });
    if (url.pathname === '/admin/midia/assinar') {
      if (options.timeout) { await new Promise(resolve => setTimeout(resolve, 150)); return json({}).catch(() => {}); }
      if (options.signError) return json({ error: { message: 'Armazenamento não configurado' } }, 503);
      return json(options.local ? { mode: 'local' } : { mode: 'supabase', path: '2026/11/fixture.png', signedUrl: 'https://storage.example.test/storage/upload/sign/fixture.png?token=fixture' });
    }
    if (url.pathname.includes('/storage/upload/sign/')) {
      if (options.putError) return json({ error: { message: 'Arquivo recusado pelo Storage' } }, 403);
      const body = await new Request(req.url(), { method: 'PUT', headers: req.headers(), body: req.postDataBuffer() }).formData();
      assert.equal(body.get('cacheControl'), '31536000');
      assert.equal(body.get('').name, item.original_name);
      assert.deepEqual(Buffer.from(await body.get('').arrayBuffer()), png);
      return json({ Key: 'portal-rh/2026/11/fixture.png' });
    }
    if (url.pathname === '/admin/midia/confirmar') return options.confirmError ? json({ error: { message: 'Não foi possível registrar a imagem' } }, 500) : json(item);
    if (url.pathname === '/admin/midia/enviar') return json(item);
    if (url.pathname === '/public/fixture.png') return route.fulfill({ headers, contentType: 'image/png', body: png });
    return route.fulfill({ status: 404, body: 'Not found' });
  });
  await page.goto('http://portal-upload.test/');
  await page.getByRole('button', { name: 'Escolher imagem', exact: true }).click();
  await page.locator('[data-grid]').waitFor({ state: 'visible' });
  async function upload() { await page.locator('[data-upload]').setInputFiles({ name: item.original_name, mimeType: 'image/png', buffer: png }); }
  return { page, upload, requests, alerts };
}

test('upload assinado envia multipart, confirma o arquivo e exibe a imagem no editor', async t => {
  const { page, upload, requests } = await fixture(t);
  await upload();
  await page.waitForFunction(url => document.querySelector('[name=cover]').value === url, item.url);
  await page.locator('.image-field__preview img').evaluate(image => image.decode());
  assert.equal(await page.locator('.image-field__preview img').evaluate(image => image.naturalWidth), 1);
  assert.equal(await page.locator('#media-modal').getAttribute('hidden'), '');
  assert.ok(requests.some(r => r.path === '/admin/midia/confirmar'));
  assert.ok(!requests.some(r => r.path === '/admin/midia/enviar'));
});

for (const [option, expected] of [['signError', 'Armazenamento não configurado'], ['putError', 'Arquivo recusado pelo Storage'], ['confirmError', 'Não foi possível registrar a imagem']]) {
  test(`erro na etapa ${option} é legível e permite tentar outro arquivo`, async t => {
    const { page, upload, alerts } = await fixture(t, { [option]: true });
    await upload();
    await page.waitForFunction(message => document.querySelector('[data-grid]').textContent.includes(message), expected);
    await page.waitForFunction(() => document.querySelector('[data-upload]').value === '');
    assert.equal(alerts[0], expected);
    assert.ok(!alerts[0].includes('[object Object]'));
    assert.equal(await page.locator('[name=cover]').inputValue(), '');
  });
}

test('limite de espera encerra envio parado com mensagem e campo liberado', async t => {
  const { page, upload } = await fixture(t, { timeout: true });
  await upload();
  await page.waitForFunction(() => document.querySelector('[data-grid]').textContent.includes('demorou'));
  await page.waitForFunction(() => document.querySelector('[data-upload]').value === '');
});

test('erro ao listar a biblioteca é exibido sem quebrar o painel', async t => {
  const { page } = await fixture(t, { listError: true });
  await page.waitForFunction(() => document.querySelector('[data-grid]').textContent === 'Sessão expirada');
});

test('envio local de desenvolvimento continua funcionando', async t => {
  const { page, upload, requests } = await fixture(t, { local: true });
  await upload();
  await page.waitForFunction(url => document.querySelector('[name=cover]').value === url, item.url);
  assert.ok(requests.some(r => r.path === '/admin/midia/enviar'));
});
