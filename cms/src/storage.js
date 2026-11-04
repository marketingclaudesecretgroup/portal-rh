// Armazenamento de arquivos: Supabase Storage (produção) ou disco local (desenvolvimento).
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const BUCKET = process.env.SUPABASE_BUCKET || 'portal-rh';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const useSupabase = !!(SUPABASE_URL && SERVICE_KEY);
const LOCAL_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'uploads');

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'application/pdf': '.pdf' };
const MAX_SIZE = 10 * 1024 * 1024;

let client;
function sb() {
  if (!client) {
    const { createClient } = require('@supabase/supabase-js');
    client = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

let bucketReady;
function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data } = await sb().storage.getBucket(BUCKET);
      if (!data) {
        const { error } = await sb().storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE, allowedMimeTypes: Object.keys(ALLOWED) });
        if (error && !/exists/i.test(error.message)) throw error;
      }
    })().catch((e) => { bucketReady = null; throw e; });
  }
  return bucketReady;
}

function makePath(originalName, mime) {
  const { slugify } = require('./helpers');
  const now = new Date();
  const base = slugify(path.parse(originalName || 'arquivo').name).slice(0, 40) || 'arquivo';
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${base}${ALLOWED[mime]}`;
}

function validate({ name, type, size }) {
  if (!ALLOWED[type]) return 'Formato não permitido. Use JPG, PNG, WEBP, GIF, SVG ou PDF.';
  if (!(size > 0) || size > MAX_SIZE) return 'Arquivo maior que 10 MB.';
  if (!name) return 'Arquivo sem nome.';
  return null;
}

const publicUrl = (p) => useSupabase ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${p.split('/').map(encodeURIComponent).join('/')}` : '/uploads/' + p;

// Supabase: cria um endereço assinado para o navegador enviar o arquivo direto
// (não passa pela Vercel, que limita o tamanho das requisições a 4,5 MB).
async function signUpload(meta) {
  const p = makePath(meta.name, meta.type);
  await ensureBucket();
  const { data, error } = await sb().storage.from(BUCKET).createSignedUploadUrl(p);
  if (error) throw error;
  return { mode: 'supabase', path: p, signedUrl: data.signedUrl };
}

// Confirma que o arquivo chegou ao Storage
async function exists(p) {
  if (!useSupabase) return fs.existsSync(path.join(LOCAL_DIR, p));
  const dir = path.posix.dirname(p), file = path.posix.basename(p);
  const { data } = await sb().storage.from(BUCKET).list(dir, { search: file, limit: 1 });
  return !!(data && data.find((f) => f.name === file));
}

// Local: grava o arquivo recebido pelo servidor
function saveLocal(buffer, meta) {
  const p = makePath(meta.name, meta.type);
  const full = path.join(LOCAL_DIR, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
  return p;
}

async function remove(p) {
  if (useSupabase) { await sb().storage.from(BUCKET).remove([p]); return; }
  fs.rmSync(path.join(LOCAL_DIR, path.normalize(p).replace(/^(\.\.[/\\])+/, '')), { force: true });
}

module.exports = { useSupabase, LOCAL_DIR, ALLOWED, MAX_SIZE, validate, publicUrl, signUpload, exists, saveLocal, remove };
