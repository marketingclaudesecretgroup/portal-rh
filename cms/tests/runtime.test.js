const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cwd = path.join(__dirname, '..');

function serverless(script) {
  const result = spawnSync(process.execPath, ['--no-experimental-require-module', '-e', script], {
    cwd, encoding: 'utf8', windowsHide: true, timeout: 15000,
    env: {
      ...process.env, NODE_ENV: 'production', VERCEL: '1',
      DATABASE_URL: 'postgresql://runtime:runtime@127.0.0.1:1/runtime',
      SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: ''
    }
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test('handler da Vercel inicia com require(ESM) desabilitado', () => {
  assert.match(serverless(`
    const assert = require('node:assert/strict');
    const app = require('./api');
    assert.equal(typeof app, 'function');
    require('./src/db').pool.end();
    console.log('handler carregado');
  `), /handler carregado/);
});

test('sanitização mantém formatação e elimina conteúdo ativo no runtime serverless', () => {
  serverless(`
    const assert = require('node:assert/strict');
    const { cleanRich, cleanBlocks } = require('./src/blocks');
    const html = cleanRich('<h2>Título</h2><p><strong>Seguro</strong></p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">Link</a>');
    assert.ok(html.includes('<h2>Título</h2>'));
    assert.ok(html.includes('<strong>Seguro</strong>'));
    assert.doesNotMatch(html, /<script|onerror|javascript:/i);
    const blocks = cleanBlocks([{ type: 'rich_text', data: { html: '<p>Bloco seguro</p><img src=x onerror=alert(1)>' } }]);
    assert.match(blocks[0].data.html, /Bloco seguro/);
    assert.doesNotMatch(blocks[0].data.html, /onerror/i);
  `);
});

test('templates EJS continuam renderizando com require(ESM) desabilitado', () => {
  serverless(`
    const assert = require('node:assert/strict');
    const ejs = require('ejs');
    const rendered = ejs.render('<h1><%= title %></h1>', { title: '<seguro>' });
    assert.equal(rendered, '<h1>&lt;seguro&gt;</h1>');
  `);
});

test('CSS e editor são servidos pelo handler serverless antes de acessar o banco', () => {
  serverless(`
    const assert = require('node:assert/strict');
    const { once } = require('node:events');
    (async () => {
      const app = require('./api');
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      try {
        const base = 'http://127.0.0.1:' + server.address().port;
        for (const url of ['/static/css/site.css', '/vendor/quill/quill.js']) {
          const response = await fetch(base + url);
          assert.equal(response.status, 200, url);
          assert.ok((await response.text()).length > 100);
        }
      } finally {
        await new Promise(resolve => server.close(resolve));
        await require('./src/db').pool.end();
      }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
});
