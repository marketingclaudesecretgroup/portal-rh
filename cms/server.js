// Execução local / servidor próprio: npm start
try { process.loadEnvFile && process.loadEnvFile('.env'); } catch (e) { /* sem .env */ }
const app = require('./app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Comunica Secret rodando em http://localhost:${PORT}`);
  console.log(`  Painel: http://localhost:${PORT}/admin\n`);
});
