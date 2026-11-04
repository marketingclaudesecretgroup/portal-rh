// Uso: npm run reset-password -- email@empresa.com NovaSenha123
// (precisa da DATABASE_URL no .env ou no ambiente)
try { process.loadEnvFile && process.loadEnvFile('.env'); } catch (e) { /* sem .env */ }
const bcrypt = require('bcryptjs');
const { db, pool } = require('../src/db');
const { revokeUserSessions } = require('../src/auth');
(async () => {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 8) {
    console.log('Uso: npm run reset-password -- email@empresa.com NovaSenhaComOitoCaracteres');
    process.exit(1);
  }
  const u = await db.get('SELECT id FROM users WHERE lower(email) = lower(?)', [email]);
  if (!u) { console.log('Usuário não encontrado:', email); await pool.end(); process.exit(1); }
  await db.run('UPDATE users SET password_hash = ?, active = TRUE WHERE id = ?', [bcrypt.hashSync(password, 10), u.id]);
  await revokeUserSessions(u.id);
  console.log('Senha redefinida para', email);
  await pool.end();
})();
