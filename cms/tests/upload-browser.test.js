const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '..', 'public/js/admin.js'), 'utf8');
const styles = fs.readFileSync(path.join(__dirname, '..', 'public/css/admin.css'), 'utf8');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=', 'base64');
const item = { id: 1, url: 'https://storage.example.test/public/fixture.png', mime: 'image/png', original_name: 'Homem Conferindo Roupas no Estoque.png' };
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => { if (browser) await browser.close(); });

async function fixture(t, options = {}) {
  const context = await browser.newContext(options.mobile ? { viewport: { width: 390, height: 844 } } : {});
  if (options.timeout) await context.addInitScript(() => {
    const original = window.setTimeout;
    window.setTimeout = (callback, ms, ...args) => original(callback, ms >= 30000 ? 20 : ms, ...args);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [], requests = [], alerts = [];
  const gates = {}, releases = {};
  for (const stage of options.hold || []) gates[stage] = new Promise(resolve => { releases[stage] = resolve; });
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
  t.after(async () => { Object.values(releases).forEach(release => release()); await context.close(); assert.deepEqual(errors, []); });
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT,POST,OPTIONS' };
    const json = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><head><meta charset="utf-8"><meta name="csrf-token" content="fixture-csrf"><link rel="stylesheet" href="/static/css/admin.css"></head><body class="admin">
      ${options.library ? '<label class="btn btn--primary"><input type="file" multiple hidden id="media-upload">Enviar arquivos</label><div id="upload-status"></div>' : ''}
      <div data-image-field><input name="cover"><div class="image-field__preview"></div><button data-pick>Escolher imagem</button><button data-clear>Remover</button></div>
      <div class="modal" id="media-modal" hidden><div class="modal__box"><div class="modal__head"><h2>Escolher imagem</h2><button data-close>×</button></div><div class="modal__tools"><label class="btn btn--primary"><input type="file" hidden data-upload>Enviar do computador</label></div><div class="media-grid media-grid--pick" data-grid></div></div></div>
      <script src="/static/js/admin.js"></script></body>` });
    if (url.pathname === '/static/js/admin.js') return route.fulfill({ contentType: 'application/javascript', body: source });
    if (url.pathname === '/static/css/admin.css') return route.fulfill({ contentType: 'text/css', body: styles });
    if (url.pathname === '/admin/midia.json') { if (gates.list) await gates.list; return options.listError ? json({ error: { message: 'Sessão expirada' } }, 401) : json([]); }
    requests.push({ path: url.pathname, method: req.method(), data: req.postData(), headers: req.headers() });
    if (url.pathname === '/admin/midia/assinar') {
      if (gates.sign) await gates.sign;
      if (options.timeout) { await new Promise(resolve => setTimeout(resolve, 150)); return json({}).catch(() => {}); }
      if (options.signError) return json({ error: { message: 'Armazenamento não configurado' } }, 503);
      return json(options.local ? { mode: 'local' } : { mode: 'supabase', path: '2026/11/fixture.png', signedUrl: 'https://storage.example.test/storage/upload/sign/fixture.png?token=fixture' });
    }
    if (url.pathname.includes('/storage/upload/sign/')) {
      if (gates.send) await gates.send;
      if (options.putError) return json({ error: { message: 'Arquivo recusado pelo Storage' } }, 403);
      const body = await new Request(req.url(), { method: 'PUT', headers: req.headers(), body: req.postDataBuffer() }).formData();
      assert.equal(body.get('cacheControl'), '31536000');
      assert.equal(body.get('').name, item.original_name);
      assert.deepEqual(Buffer.from(await body.get('').arrayBuffer()), png);
      return json({ Key: 'portal-rh/2026/11/fixture.png' });
    }
    if (url.pathname === '/admin/midia/confirmar') { if (gates.confirm) await gates.confirm; return options.confirmError ? json({ error: { message: 'Não foi possível registrar a imagem' } }, 500) : json(item); }
    if (url.pathname === '/admin/midia/enviar') return json(item);
    if (url.pathname === '/public/fixture.png') return route.fulfill({ headers, contentType: 'image/png', body: png });
    return route.fulfill({ status: 404, body: 'Not found' });
  });
  await page.goto('http://portal-upload.test/');
  if (!options.library) {
    await page.getByRole('button', { name: 'Escolher imagem', exact: true }).click();
    await page.locator('[data-grid]').waitFor({ state: 'visible' });
  }
  async function upload() { await page.locator(options.library ? '#media-upload' : '[data-upload]').setInputFiles({ name: item.original_name, mimeType: 'image/png', buffer: png }); }
  return { page, upload, requests, alerts, release: stage => releases[stage]() };
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
    assert.equal(await page.locator('[data-upload]').isEnabled(), true);
    assert.equal(await page.locator('#media-modal').getAttribute('aria-busy'), 'false');
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

test('loading anima e informa as três etapas, bloqueando envio duplicado até concluir', async t => {
  const { page, upload, release, requests } = await fixture(t, { hold: ['sign', 'send', 'confirm'] });
  await upload();
  assert.equal(await page.locator('.upload-progress__phase').innerText(), 'Preparando envio…');
  assert.ok(await page.locator('.upload-progress__spinner').isVisible());
  assert.equal(await page.locator('.upload-progress__spinner').evaluate(node => getComputedStyle(node).animationName), 'upload-spin');
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), null);
  assert.equal(await page.locator('[data-upload]').isDisabled(), true);
  assert.equal(await page.locator('#media-modal').getAttribute('aria-busy'), 'true');
  await page.locator('.upload-progress__preview').evaluate(image => image.decode());
  await page.locator('[data-upload]').dispatchEvent('change');
  assert.equal(requests.filter(r => r.path === '/admin/midia/assinar').length, 1);
  fs.mkdirSync(path.join(__dirname, '..', 'test-results'), { recursive: true });
  await page.screenshot({ path: path.join(__dirname, '..', 'test-results', 'upload-loading.png') });
  release('sign');
  await page.waitForFunction(() => document.querySelector('.upload-progress__phase').textContent === 'Enviando arquivo…');
  release('send');
  await page.waitForFunction(() => document.querySelector('.upload-progress__phase').textContent === 'Finalizando imagem…');
  release('confirm');
  await page.waitForFunction(url => document.querySelector('[name=cover]').value === url && !document.querySelector('[data-upload]').disabled, item.url);
});

test('loading ocupa a largura disponível e cabe na tela do celular', async t => {
  const { page, upload } = await fixture(t, { mobile: true, hold: ['sign'] });
  await upload();
  assert.ok(await page.locator('.upload-progress').isVisible());
  assert.ok((await page.locator('.upload-progress').boundingBox()).width > 250);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
});

test('resposta atrasada da biblioteca não apaga o loading do envio', async t => {
  const { page, upload, release } = await fixture(t, { hold: ['sign', 'list'] });
  await upload();
  release('list');
  await page.waitForResponse(response => response.url().endsWith('/admin/midia.json'));
  assert.ok(await page.locator('.upload-progress').isVisible());
  assert.equal(await page.locator('.upload-progress__phase').innerText(), 'Preparando envio…');
});

test('página de mídia mostra loading e libera o controle após envio concluído', async t => {
  const { page, upload, release } = await fixture(t, { library: true, hold: ['sign'] });
  await upload();
  assert.ok(await page.locator('#upload-status .upload-progress').isVisible());
  assert.match(await page.locator('.upload-progress__name').innerText(), /1 de 1/);
  assert.equal(await page.locator('#media-upload').isDisabled(), true);
  const reloaded = page.waitForEvent('framenavigated');
  release('sign');
  await reloaded;
  await page.waitForFunction(() => !!window.uploadFile && !document.querySelector('#media-upload').disabled);
});

test('falha na página de mídia encerra loading e permite tentar novamente', async t => {
  const { page, upload } = await fixture(t, { library: true, signError: true });
  await upload();
  await page.waitForFunction(() => document.querySelector('#upload-status').textContent === '0 de 1 arquivo(s) enviado(s).' && !document.querySelector('#media-upload').disabled);
  assert.equal(await page.locator('#upload-status').getAttribute('aria-busy'), 'false');
  assert.equal(await page.locator('.upload-progress').count(), 0);
});
