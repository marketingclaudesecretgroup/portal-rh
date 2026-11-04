const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startPortal, setupAdmin, credentials } = require('./helpers');

let portal, browser, admin;
before(async () => {
  portal = await startPortal();
  admin = await setupAdmin(portal);
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
});
after(async () => {
  if (browser) await browser.close();
  if (portal) await portal.close();
});

async function openPage(t, { authenticated = true, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  // Os testes usam apenas o portal local; a fonte externa não é necessária.
  await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await context.close(); assert.deepEqual(errors, [], 'Erros JavaScript no navegador'); });
  if (authenticated) {
    await page.goto(portal.baseUrl + '/admin/login');
    await page.locator('[name=email]').fill(credentials.email);
    await page.locator('[name=password]').fill(credentials.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL(portal.baseUrl + '/admin');
  }
  return page;
}

test('portal público sem erros JavaScript e sem rolagem horizontal no desktop e celular', async t => {
  for (const mobile of [false, true]) {
    const page = await openPage(t, { authenticated: false, mobile });
    for (const url of ['/', '/onboarding', '/desenvolvimento', '/treinamentos', '/nr1', '/beneficios', '/calendario', '/gente-e-gestao', '/politicas', '/comunicados']) {
      const response = await page.goto(portal.baseUrl + url);
      assert.equal(response.status(), 200, url);
      assert.ok(await page.locator('main').isVisible());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${url}, mobile=${mobile}: rolagem horizontal`);
    }
  }
});

test('menu móvel abre, expande submenu e navega', async t => {
  const page = await openPage(t, { authenticated: false, mobile: true });
  await page.goto(portal.baseUrl);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  assert.equal(await page.locator('.nav-toggle').getAttribute('aria-expanded'), 'true');
  await page.getByRole('button', { name: 'Abrir submenu de Desenvolvimento' }).click();
  await page.locator('#site-nav').getByRole('link', { name: 'Treinamentos', exact: true }).click();
  await page.waitForURL(portal.baseUrl + '/treinamentos');
});

test('login, formulários administrativos e logout no navegador', async t => {
  const page = await openPage(t);
  for (const url of ['/admin/paginas', '/admin/comunicados', '/admin/midia', '/admin/usuarios', '/admin/configuracoes', '/admin/perfil']) {
    assert.equal((await page.goto(portal.baseUrl + url)).status(), 200);
    assert.ok(await page.locator('h1').isVisible());
  }
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await page.waitForURL(portal.baseUrl + '/admin/login');
});

test('editor de blocos cria texto, duplica, reordena, oculta e salva', async t => {
  const page = await openPage(t);
  await page.goto(portal.baseUrl + '/admin/paginas/nova');
  await page.locator('[name=title]').fill('Página criada no navegador');
  await page.locator('[name=slug]').fill('pagina-navegador');
  await page.getByRole('button', { name: '+ Adicionar bloco', exact: true }).click();
  assert.equal(await page.locator('.lib-item').count(), Object.keys(require('../src/blocks').BLOCKS).length);
  await page.locator('.lib-item').filter({ has: page.locator('strong', { hasText: /^Introdução$/ }) }).click();
  await page.locator('.block .field--text input').first().fill('Introdução <texto>');
  await page.locator('.block__head [title="Duplicar"]').click();
  assert.equal(await page.locator('.block').count(), 2);
  await page.locator('.block').nth(1).locator('.field--text input').first().fill('Segundo bloco');
  await page.locator('.block').nth(1).locator('.block__head [title="Subir"]').click();
  await page.locator('.block').nth(1).locator('.block__head [title="Ocultar do site"]').click();
  await page.getByRole('button', { name: '+ Adicionar bloco', exact: true }).click();
  await page.locator('.lib-item').filter({ has: page.locator('strong', { hasText: /^Texto livre$/ }) }).click();
  await page.locator('.block .ql-editor').fill('Texto rico preservado');
  await page.locator('[name=status]').selectOption('published');
  await page.getByRole('button', { name: 'Salvar página', exact: true }).click();
  await page.waitForURL(/\/admin\/paginas\/\d+$/);
  assert.equal(await page.locator('.block').count(), 3);
  const saved = portal.db.prepare("SELECT blocks FROM pages WHERE slug='pagina-navegador'").get();
  const blocks = JSON.parse(saved.blocks);
  assert.equal(blocks[0].data.title, 'Segundo bloco');
  assert.equal(blocks[1].hidden, true);
  assert.match(blocks[2].data.html, /Texto rico preservado/);
  await page.goto(portal.baseUrl + '/pagina-navegador');
  assert.ok(await page.getByRole('heading', { name: 'Segundo bloco', exact: true }).isVisible());
  assert.equal(await page.getByText('Introdução <texto>', { exact: true }).count(), 0);
});

test('comunicado com editor rico salva formatação e mantém texto ao reabrir', async t => {
  const page = await openPage(t);
  await page.goto(portal.baseUrl + '/admin/comunicados/novo');
  await page.locator('[name=title]').fill('Comunicado do navegador');
  await page.locator('[name=slug]').fill('comunicado-navegador');
  await page.locator('[name=excerpt]').fill('Resumo de teste no navegador');
  await page.locator('.ql-editor').fill('Comunicado com conteúdo rico');
  await page.locator('[name=status]').selectOption('published');
  await page.getByRole('button', { name: 'Salvar comunicado', exact: true }).click();
  await page.waitForURL(/\/admin\/comunicados\/\d+$/);
  assert.equal(await page.locator('.ql-editor').innerText(), 'Comunicado com conteúdo rico');
  await page.goto(portal.baseUrl + '/comunicados/comunicado-navegador');
  assert.ok(await page.getByText('Comunicado com conteúdo rico', { exact: true }).isVisible());
});

test('imagem de capa: upload, escolha e remoção marcam alterações pendentes', async t => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=', 'base64');
  assert.equal((await admin.upload(png, 'capa.png', 'image/png')).status, 200);
  const page = await openPage(t);
  await page.goto(portal.baseUrl + '/admin/comunicados/novo');
  await page.locator('[name=title]').fill('Capa QA');
  await page.getByRole('button', { name: 'Escolher imagem', exact: true }).click();
  await page.locator('.media-item--pick').first().click();
  assert.ok((await page.locator('[name=cover]').inputValue()).startsWith('/uploads/'));
  await page.getByRole('button', { name: 'Salvar comunicado', exact: true }).click();
  await page.waitForURL(/\/admin\/comunicados\/\d+$/);
  await page.getByRole('button', { name: 'Remover', exact: true }).click();
  assert.equal(await page.locator('[name=cover]').inputValue(), '');
  let dialogType = '';
  page.once('dialog', async dialog => { dialogType = dialog.type(); await dialog.dismiss(); });
  await page.goto(portal.baseUrl + '/admin').catch(() => {});
  assert.equal(dialogType, 'beforeunload', 'Remover a capa deve avisar que há alterações não salvas');
});

test('todas as páginas administrativas cabem na tela do celular', async t => {
  const page = await openPage(t, { mobile: true });
  for (const url of ['/admin', '/admin/paginas', '/admin/paginas/1', '/admin/comunicados', '/admin/comunicados/1', '/admin/midia', '/admin/usuarios', '/admin/configuracoes', '/admin/perfil']) {
    await page.goto(portal.baseUrl + url);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${url}: rolagem horizontal`);
  }
});

test('SVG permanece utilizável como imagem e não executa scripts ao abrir', async t => {
  const file = await admin.upload('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="gold"/><script>document.documentElement.setAttribute("data-executed", "yes")</script></svg>', 'ativo.svg', 'image/svg+xml');
  assert.equal(file.status, 200);
  const page = await openPage(t, { authenticated: false });
  await page.goto(portal.baseUrl);
  const url = portal.baseUrl + file.json().url;
  assert.equal(await page.evaluate(async src => {
    const image = new Image();
    image.src = src;
    await image.decode();
    return image.naturalWidth;
  }, url), 40);
  await page.goto(url);
  assert.equal(await page.locator('svg').getAttribute('data-executed'), null);
});
