const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'portal.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor',
  active INTEGER NOT NULL DEFAULT 1,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES pages(id) ON DELETE SET NULL,
  menu_order INTEGER NOT NULL DEFAULT 0,
  show_in_menu INTEGER NOT NULL DEFAULT 1,
  menu_label TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  meta_description TEXT,
  blocks TEXT NOT NULL DEFAULT '[]',
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  excerpt TEXT,
  cover TEXT,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  featured INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_name TEXT,
  mime TEXT,
  size INTEGER,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expires INTEGER NOT NULL
);
`);

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

const getSettings = () => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return s;
};

const saveSettings = (obj) => {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const tx = db.transaction((o) => { for (const [k, v] of Object.entries(o)) stmt.run(k, v == null ? '' : String(v)); });
  tx(obj);
};

module.exports = { db, DATA_DIR, UPLOAD_DIR, getSettings, saveSettings, DEFAULT_SETTINGS };
