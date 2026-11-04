// Uso: npm run reset-password -- email@empresa.com NovaSenha123
const bcrypt = require('bcryptjs');
const { db } = require('../src/db');
const { revokeUserSessions } = require('../src/auth');
const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.log('Uso: npm run reset-password -- email@empresa.com NovaSenhaComOitoCaracteres');
  process.exit(1);
}
const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (!u) { console.log('Usuário não encontrado:', email); process.exit(1); }
db.prepare('UPDATE users SET password_hash = ?, active = 1 WHERE id = ?').run(bcrypt.hashSync(password, 10), u.id);
revokeUserSessions(u.id);
console.log('Senha redefinida para', email);
