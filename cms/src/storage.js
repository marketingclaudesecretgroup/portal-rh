// Armazenamento de arquivos: Supabase Storage (produção) ou disco local (desenvolvimento).
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const BUCKET = process.env.SUPABASE_BUCKET || 'portal-rh';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const useSupabase = !!(SUPABASE_URL && SERVICE_KEY);
const LOCAL_DIR = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'uploads');

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'application/pdf': '.pdf' };
const MAX_SIZE = 10 * 1024 * 1024;

let client;
function errorMessage(error, fallback = 'Falha no armazenamento.', depth = 0) {
  if (typeof error === 'string' && error.trim() && error !== '[object Object]') return error.trim().slice(0, 400);
  if (error && typeof error === 'object' && depth < 4) {
    for (const key of ['message', 'error', 'msg', 'error_description']) {
      const message = errorMessage(error[key], '', depth + 1);
      if (message) return message;
    }
  }
  return fallback;
}

function storageFailure(error, fallback) {
  const message = errorMessage(error);
  const status = Number(error && (error.status || error.statusCode));
  if ([401, 403].includes(status) || /invalid.*(?:key|jwt)|unauthorized|not authorized|row.level.security/i.test(message)) {
    return new Error('O armazenamento não autorizou o envio. Peça ao administrador para conferir as credenciais do Supabase.');
  }
  return new Error(fallback + ': ' + message);
}

function assertConfigured() {
  if (process.env.VERCEL && !useSupabase) throw new Error('O armazenamento de imagens não foi configurado. Peça ao administrador para configurar o Supabase na Vercel.');
}

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
      const { data, error } = await sb().storage.getBucket(BUCKET);
      if (error && Number(error.status || error.statusCode) !== 404 && !/bucket.*(?:not found|does not exist)/i.test(errorMessage(error))) {
        throw storageFailure(error, 'Não foi possível consultar a pasta de imagens');
      }
      if (data && data.public === false) throw new Error('A pasta de imagens está privada. Peça ao administrador para configurar um bucket público para as imagens do portal.');
      if (!data) {
        const { error } = await sb().storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_SIZE, allowedMimeTypes: Object.keys(ALLOWED) });
        if (error && !/exists/i.test(errorMessage(error))) throw storageFailure(error, 'Não foi possível criar a pasta de imagens');
        if (error) {
          const retry = await sb().storage.getBucket(BUCKET);
          if (retry.error) throw storageFailure(retry.error, 'Não foi possível consultar a pasta de imagens');
          if (retry.data && retry.data.public === false) throw new Error('A pasta de imagens está privada. Peça ao administrador para configurar um bucket público para as imagens do portal.');
        }
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
  if (error) throw storageFailure(error, 'Não foi possível autorizar o envio');
  return { mode: 'supabase', path: p, signedUrl: data.signedUrl };
}

// Confirma que o arquivo chegou ao Storage
async function exists(p) {
  if (!useSupabase) return fs.existsSync(path.join(LOCAL_DIR, p));
  const dir = path.posix.dirname(p), file = path.posix.basename(p);
  const { data, error } = await sb().storage.from(BUCKET).list(dir, { search: file, limit: 100 });
  if (error) throw storageFailure(error, 'Não foi possível confirmar o arquivo enviado');
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
  if (useSupabase) {
    const { error } = await sb().storage.from(BUCKET).remove([p]);
    if (error) throw storageFailure(error, 'Não foi possível excluir o arquivo');
    return;
  }
  fs.rmSync(path.join(LOCAL_DIR, path.normalize(p).replace(/^(\.\.[/\\])+/, '')), { force: true });
}

module.exports = { useSupabase, LOCAL_DIR, ALLOWED, MAX_SIZE, validate, publicUrl, signUpload, exists, saveLocal, remove, errorMessage, assertConfigured };
