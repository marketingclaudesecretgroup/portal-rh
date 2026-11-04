// O runtime serverless pode desabilitar require(ESM), mesmo no Node.js 22/24.
// Empacota o sanitizador e seu parser em CommonJS durante a instalação/build.
// Assim mantemos a versão atual e suas correções de segurança.
const path = require('node:path');
const { buildSync } = require('esbuild');

buildSync({
  entryPoints: [require.resolve('sanitize-html')],
  outfile: path.join(__dirname, '..', 'src', 'sanitize-html.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  legalComments: 'inline',
  logLevel: 'info'
});
