// Definição dos blocos de conteúdo. O editor do admin é gerado a partir daqui,
// e cada bloco tem um template em views/blocks/<tipo>.ejs.
// Gerado no postinstall: funciona também nos runtimes que desabilitam require(ESM).
const sanitizeHtml = require('./sanitize-html.cjs');
const { ICONS } = require('./icons');

const BG = { key: 'background', label: 'Fundo', type: 'select', options: [['branco', 'Branco'], ['suave', 'Bege suave'], ['escuro', 'Escuro']], default: 'branco' };

const BLOCKS = {
  hero: {
    label: 'Banner principal', description: 'Imagem grande com título, texto e botões.',
    fields: [
      { key: 'eyebrow', label: 'Chamada superior', type: 'text', placeholder: 'SAÚDE • SEGURANÇA • BEM-ESTAR' },
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'text', label: 'Descrição', type: 'textarea' },
      { key: 'image', label: 'Imagem de fundo (1920×800)', type: 'image' },
      { key: 'size', label: 'Altura', type: 'select', options: [['grande', 'Grande (página inicial)'], ['media', 'Média (páginas internas)']], default: 'media' },
      { key: 'button1_label', label: 'Botão 1 — texto', type: 'text' },
      { key: 'button1_url', label: 'Botão 1 — link', type: 'url' },
      { key: 'button2_label', label: 'Botão 2 — texto', type: 'text' },
      { key: 'button2_url', label: 'Botão 2 — link', type: 'url' }
    ]
  },
  intro: {
    label: 'Introdução', description: 'Título e parágrafo, com destaque opcional ao lado.',
    fields: [
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'text', label: 'Texto', type: 'textarea' },
      { key: 'highlight_icon', label: 'Ícone do destaque', type: 'icon' },
      { key: 'highlight_text', label: 'Frase de destaque (opcional)', type: 'text' },
      BG
    ]
  },
  quick_links: {
    label: 'Acesso rápido', description: 'Atalhos com ícone para outras páginas.',
    fields: [
      { key: 'title', label: 'Título', type: 'text', default: 'Acesso rápido' },
      { key: 'style', label: 'Estilo', type: 'select', options: [['cards', 'Cards com ícone'], ['pills', 'Botões em linha']], default: 'cards' },
      BG,
      { key: 'items', label: 'Atalhos', type: 'list', itemLabel: 'Atalho', fields: [
        { key: 'icon', label: 'Ícone', type: 'icon' },
        { key: 'label', label: 'Texto', type: 'text' },
        { key: 'url', label: 'Link', type: 'url' }
      ] }
    ]
  },
  cards: {
    label: 'Cards com ícone', description: 'Grade de cards: benefícios, iniciativas, dicas, temas…',
    fields: [
      { key: 'title', label: 'Título da seção', type: 'text' },
      { key: 'subtitle', label: 'Subtítulo', type: 'textarea' },
      BG,
      { key: 'columns', label: 'Colunas', type: 'select', options: [['2', '2'], ['3', '3'], ['4', '4']], default: '3' },
      { key: 'layout', label: 'Disposição', type: 'select', options: [['centro', 'Ícone em cima, centralizado'], ['lateral', 'Ícone ao lado do texto']], default: 'centro' },
      { key: 'items', label: 'Cards', type: 'list', itemLabel: 'Card', fields: [
        { key: 'icon', label: 'Ícone', type: 'icon' },
        { key: 'tag', label: 'Etiqueta (opcional)', type: 'text', placeholder: 'SAÚDE E BEM-ESTAR' },
        { key: 'title', label: 'Título', type: 'text' },
        { key: 'text', label: 'Texto', type: 'textarea' },
        { key: 'lines', label: 'Lista de itens (um por linha)', type: 'lines' },
        { key: 'button_label', label: 'Texto do link/botão', type: 'text' },
        { key: 'url', label: 'Link', type: 'url' },
        { key: 'button_style', label: 'Estilo do link', type: 'select', options: [['link', 'Link com seta'], ['botao', 'Botão']], default: 'link' }
      ] }
    ]
  },
  steps: {
    label: 'Passo a passo', description: 'Etapas numeradas (01, 02, 03…).',
    fields: [
      { key: 'title', label: 'Título da seção', type: 'text' },
      BG,
      { key: 'items', label: 'Etapas', type: 'list', itemLabel: 'Etapa', fields: [
        { key: 'icon', label: 'Ícone', type: 'icon' },
        { key: 'title', label: 'Título', type: 'text' },
        { key: 'text', label: 'Texto', type: 'textarea' }
      ] }
    ]
  },
  featured: {
    label: 'Em destaque', description: 'Card grande de campanha + até 2 cards laterais.',
    fields: [
      { key: 'title', label: 'Título da seção', type: 'text', default: 'Em destaque' },
      BG,
      { key: 'main_tag', label: 'Card principal — etiqueta', type: 'text', placeholder: 'CAMPANHA INTERNA' },
      { key: 'main_title', label: 'Card principal — título', type: 'text', placeholder: 'BLACK' },
      { key: 'main_highlight', label: 'Card principal — palavra em dourado', type: 'text', placeholder: 'FRIDAY' },
      { key: 'main_after', label: 'Card principal — linha final', type: 'text', placeholder: '2026' },
      { key: 'main_subtitle', label: 'Card principal — subtítulo', type: 'text', placeholder: 'DICAS E PREPARATIVOS' },
      { key: 'main_text', label: 'Card principal — texto', type: 'textarea' },
      { key: 'main_button_label', label: 'Card principal — botão', type: 'text', default: 'Saiba mais' },
      { key: 'main_url', label: 'Card principal — link', type: 'url' },
      { key: 'main_image', label: 'Card principal — imagem', type: 'image' },
      { key: 'items', label: 'Cards laterais', type: 'list', itemLabel: 'Card lateral', max: 2, fields: [
        { key: 'tag', label: 'Etiqueta', type: 'text' },
        { key: 'title', label: 'Título', type: 'text' },
        { key: 'text', label: 'Texto', type: 'textarea' },
        { key: 'link_label', label: 'Texto do link', type: 'text', default: 'Saiba mais' },
        { key: 'url', label: 'Link', type: 'url' },
        { key: 'image', label: 'Imagem', type: 'image' }
      ] }
    ]
  },
  banner: {
    label: 'Faixa de destaque', description: 'Chamada com fundo escuro ou claro, imagem e botões.',
    fields: [
      { key: 'theme', label: 'Tema', type: 'select', options: [['escuro', 'Escuro'], ['claro', 'Claro']], default: 'escuro' },
      { key: 'icon', label: 'Ícone (se não houver imagem)', type: 'icon' },
      { key: 'eyebrow', label: 'Etiqueta', type: 'text' },
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'text', label: 'Texto', type: 'textarea' },
      { key: 'image', label: 'Imagem (opcional)', type: 'image' },
      { key: 'button_label', label: 'Botão — texto', type: 'text' },
      { key: 'url', label: 'Botão — link', type: 'url' },
      { key: 'button2_label', label: 'Botão 2 — texto', type: 'text' },
      { key: 'button2_url', label: 'Botão 2 — link', type: 'url' },
      { key: 'note', label: 'Observação pequena', type: 'text' }
    ]
  },
  events: {
    label: 'Agenda / próximos eventos', description: 'Lista de datas com título e descrição.',
    fields: [
      { key: 'title', label: 'Título da seção', type: 'text', default: 'Acontece na Secret' },
      BG,
      { key: 'items', label: 'Eventos', type: 'list', itemLabel: 'Evento', fields: [
        { key: 'icon', label: 'Ícone', type: 'icon', default: 'calendario' },
        { key: 'date', label: 'Data (texto livre)', type: 'text', placeholder: '15 A 30 DE JUNHO' },
        { key: 'title', label: 'Título', type: 'text' },
        { key: 'text', label: 'Descrição', type: 'textarea' },
        { key: 'link_label', label: 'Texto do link', type: 'text' },
        { key: 'url', label: 'Link', type: 'url' }
      ] }
    ]
  },
  latest_articles: {
    label: 'Últimos comunicados', description: 'Mostra automaticamente os artigos publicados mais recentes.',
    fields: [
      { key: 'title', label: 'Título da seção', type: 'text', default: 'Últimos comunicados' },
      BG,
      { key: 'count', label: 'Quantidade', type: 'select', options: [['3', '3'], ['6', '6'], ['9', '9']], default: '3' },
      { key: 'category', label: 'Somente da categoria (opcional)', type: 'text' },
      { key: 'show_all', label: 'Mostrar link "Ver todos"', type: 'checkbox', default: true }
    ]
  },
  faq: {
    label: 'Perguntas frequentes', description: 'Perguntas que abrem e fecham.',
    fields: [
      { key: 'title', label: 'Título da seção', type: 'text', default: 'Dúvidas frequentes' },
      BG,
      { key: 'items', label: 'Perguntas', type: 'list', itemLabel: 'Pergunta', fields: [
        { key: 'question', label: 'Pergunta', type: 'text' },
        { key: 'answer', label: 'Resposta', type: 'textarea' }
      ] }
    ]
  },
  info_table: {
    label: 'Ficha de informações', description: 'Pares rótulo/valor (ex.: versão, responsável).',
    fields: [
      { key: 'title', label: 'Título da seção', type: 'text' },
      BG,
      { key: 'items', label: 'Linhas', type: 'list', itemLabel: 'Informação', fields: [
        { key: 'label', label: 'Rótulo', type: 'text' },
        { key: 'value', label: 'Valor', type: 'text' }
      ] }
    ]
  },
  rich_text: {
    label: 'Texto livre', description: 'Editor de texto para conteúdos longos.',
    fields: [
      { key: 'title', label: 'Título (opcional)', type: 'text' },
      BG,
      { key: 'html', label: 'Conteúdo', type: 'richtext' }
    ]
  },
  embed: {
    label: 'Incorporar (Agenda, Drive, vídeo)', description: 'Exibe um Google Agenda, documento do Drive, formulário ou vídeo.',
    fields: [
      { key: 'title', label: 'Título (opcional)', type: 'text' },
      BG,
      { key: 'url', label: 'Endereço de incorporação (https://…)', type: 'url', help: 'No Google Agenda/Drive/Forms, use a opção "Incorporar" e copie apenas o endereço que está em src="…".' },
      { key: 'height', label: 'Altura (px)', type: 'select', options: [['400', '400'], ['600', '600'], ['800', '800']], default: '600' },
      { key: 'note', label: 'Observação', type: 'text' }
    ]
  },
  help: {
    label: 'Fale com o RH', description: 'Faixa de contato com botão (WhatsApp por padrão).',
    fields: [
      { key: 'title', label: 'Título', type: 'text', default: 'Precisa de ajuda?' },
      { key: 'text', label: 'Texto', type: 'text', default: 'O time de Gente & Gestão está com você em cada etapa.' },
      { key: 'button_label', label: 'Texto do botão', type: 'text', default: 'Falar com o RH' },
      { key: 'url', label: 'Link (vazio = WhatsApp das configurações)', type: 'url' },
      { key: 'note', label: 'Complemento', type: 'text' }
    ]
  },
  notice: {
    label: 'Aviso', description: 'Texto curto de observação ou alerta.',
    fields: [
      { key: 'style', label: 'Tipo', type: 'select', options: [['info', 'Informativo'], ['alerta', 'Alerta']], default: 'info' },
      { key: 'text', label: 'Texto', type: 'textarea' }
    ]
  }
};

const RICH_OPTS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'img', 'hr', 'span', 'pre', 'code'],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'], '*': ['class'] },
  allowedClasses: { '*': ['ql-align-center', 'ql-align-right', 'ql-align-justify', 'ql-size-large', 'ql-size-small'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: { a: (tag, attribs) => ({ tagName: 'a', attribs: /^https?:/i.test(attribs.href || '') ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' } : attribs }) }
};
const cleanRich = (html) => sanitizeHtml(String(html || ''), RICH_OPTS);

function cleanUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(u)) return 'https://' + u; // "site.com" -> https
  return '';
}

function cleanField(f, v) {
  switch (f.type) {
    case 'richtext': return cleanRich(v);
    case 'url': return cleanUrl(v);
    case 'image': { const u = cleanUrl(v); return u; }
    case 'checkbox': return v === true || v === 'true' || v === 'on' || v === 1;
    case 'icon': return ICONS[v] ? v : '';
    case 'select': return f.options.some(o => o[0] === String(v)) ? String(v) : (f.default || f.options[0][0]);
    case 'lines': return (Array.isArray(v) ? v : String(v || '').split('\n')).map(s => String(s).trim()).filter(Boolean).slice(0, 50);
    case 'list': {
      const arr = Array.isArray(v) ? v : [];
      return arr.slice(0, f.max || 60).map(item => {
        const o = {};
        for (const sf of f.fields) o[sf.key] = cleanField(sf, item ? item[sf.key] : undefined);
        return o;
      });
    }
    default: return String(v == null ? '' : v).slice(0, 5000);
  }
}

// Recebe o JSON vindo do editor e devolve somente dados válidos
function cleanBlocks(input) {
  let arr;
  try { arr = typeof input === 'string' ? JSON.parse(input || '[]') : input; } catch { arr = []; }
  if (!Array.isArray(arr)) return [];
  return arr.filter(b => b && BLOCKS[b.type]).slice(0, 80).map(b => {
    const def = BLOCKS[b.type];
    const data = {};
    for (const f of def.fields) data[f.key] = cleanField(f, b.data ? b.data[f.key] : undefined);
    return { type: b.type, hidden: !!b.hidden, data };
  });
}

// Esquema enviado para o editor no navegador
const blockSchema = () => Object.fromEntries(Object.entries(BLOCKS).map(([k, v]) => [k, v]));

module.exports = { BLOCKS, cleanBlocks, cleanRich, cleanUrl, blockSchema };
