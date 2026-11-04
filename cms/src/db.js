// Banco de dados Postgres (Supabase). Configure DATABASE_URL.
const { Pool, types } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('\n  Falta a variável DATABASE_URL (string de conexão do Postgres do Supabase). Veja o README.\n');
}

// Contagens (bigint) como número
types.setTypeParser(20, (v) => parseInt(v, 10));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '') ? false : { rejectUnauthorized: false },
  max: process.env.VERCEL ? 2 : 8,
  idleTimeoutMillis: 10000
});

// Aceita "?" como marcador e converte para $1, $2…
const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };

const db = {
  query: (sql, params = []) => pool.query(toPg(sql), params),
  all: async (sql, params = []) => (await pool.query(toPg(sql), params)).rows,
  get: async (sql, params = []) => (await pool.query(toPg(sql), params)).rows[0],
  run: async (sql, params = []) => pool.query(toPg(sql), params),
  // Executa uma função dentro de uma transação
  tx: async (fn) => {
    const client = await pool.connect();
    const c = { all: async (s, p = []) => (await client.query(toPg(s), p)).rows, get: async (s, p = []) => (await client.query(toPg(s), p)).rows[0], run: (s, p = []) => client.query(toPg(s), p) };
    try { await client.query('BEGIN'); const r = await fn(c); await client.query('COMMIT'); return r; }
    catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (lower(email));
CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES pages(id) ON DELETE SET NULL,
  menu_order INTEGER NOT NULL DEFAULT 0,
  show_in_menu BOOLEAN NOT NULL DEFAULT TRUE,
  menu_label TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  meta_description TEXT,
  blocks JSONB NOT NULL DEFAULT '[]',
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  excerpt TEXT,
  cover TEXT,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  path TEXT NOT NULL,
  url TEXT NOT NULL,
  original_name TEXT,
  mime TEXT,
  size INTEGER,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess JSONB NOT NULL,
  user_id INTEGER,
  expires TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires ON sessions (expires);
-- As tabelas só são acessadas pelo servidor; bloqueia acesso pela API pública do Supabase.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
`;

const DEFAULT_SETTINGS = {
  site_name: 'Comunica Secret',
  site_tagline: 'Gente & Gestão',
  logo: '',
  footer_about: 'Este é o canal oficial de comunicação interna da Secret Outlet. Aqui você encontra informações, oportunidades e tudo o que faz parte da nossa jornada.',
  contact_email: 'rh@secretoutlet.com.br',
  contact_phone: '(41) 2101-3200',
  contact_city: 'Curitiba • PR',
  whatsapp_url: 'https://wa.me/5541984165836',
  instagram_url: '',
  facebook_url: '',
  linkedin_url: '',
  footer_link_label: 'Política de Gente & Gestão',
  footer_link_url: '/politicas',
  copyright: 'Secret Group. Todos os direitos reservados.',
  articles_menu_label: 'Comunicados',
  articles_page_title: 'Comunicados',
  home_page_id: ''
};

async function getSettings() {
  const rows = await db.all('SELECT key, value FROM settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (!r.key.startsWith('_')) s[r.key] = r.value;
  return s;
}

async function saveSettings(obj) {
  await db.tx(async (c) => {
    for (const [k, v] of Object.entries(obj)) {
      await c.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v == null ? '' : String(v)]);
    }
  });
}

// Cria as tabelas (uma vez por processo)
let ready;
function init() {
  if (!ready) {
    ready = (async () => {
      await pool.query(SCHEMA);
      await require('./seed').seedIfEmpty();
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

module.exports = { db, pool, init, getSettings, saveSettings, DEFAULT_SETTINGS };
