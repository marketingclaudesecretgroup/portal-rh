// Biblioteca de ícones (traço fino, 48x48) — extraídos e inspirados nos HTMLs do Comunica Secret.
const ICONS = {
  'pessoa': ['Pessoa', '<circle cx="24" cy="15" r="8"/><path d="M9 42v-4c0-8 6-13 15-13s15 5 15 13v4"/>'],
  'formatura': ['Treinamento', '<path d="m4 18 20-10 20 10-20 10L4 18Z"/><path d="M12 22v10c7 6 17 6 24 0V22M42 20v12"/>'],
  'coracao': ['Coração', '<path d="M24 41S7 31 7 18c0-6 4-10 10-10 4 0 6 2 7 5 1-3 3-5 7-5 6 0 10 4 10 10 0 13-17 23-17 23Z"/>'],
  'saude': ['Saúde e bem-estar', '<path d="M24 42S6 31 6 17c0-6 4-10 10-10 4 0 7 2 8 6 1-4 4-6 8-6 6 0 10 4 10 10 0 14-18 25-18 25Z"/><path d="M7 25h10l3-7 6 14 4-7h11"/>'],
  'calendario': ['Calendário', '<rect x="6" y="9" width="36" height="33" rx="4"/><path d="M15 5v8M33 5v8M6 18h36M14 25h4M23 25h4M32 25h4M14 33h4M23 33h4M32 33h4"/>'],
  'calendario-check': ['Calendário (check)', '<rect x="6" y="9" width="36" height="33" rx="4"/><path d="M15 5v8M33 5v8M6 18h36m-25 9 5 5 10-11"/>'],
  'escudo': ['Escudo (segurança)', '<path d="M24 5 40 11v11c0 10-6 17-16 21C14 39 8 32 8 22V11l16-6Z"/><path d="m16 24 5 5 11-12"/>'],
  'escudo-coracao': ['Escudo com coração', '<path d="M24 4 40 10v12c0 10-6 17-16 22C14 39 8 32 8 22V10l16-6Z"/><path d="M24 33s-9-5-9-12c0-3 2-5 5-5 2 0 3 1 4 3 1-2 2-3 4-3 3 0 5 2 5 5 0 7-9 12-9 12Z"/>'],
  'escudo-cruz': ['Plano de saúde', '<path d="M24 5 40 11v11c0 10-6 17-16 21C14 39 8 32 8 22V11l16-6Z"/><path d="M20 16h8v6h6v8h-6v6h-8v-6h-6v-8h6v-6Z"/>'],
  'documento': ['Documento', '<path d="M11 5h19l8 8v30H11V5Z"/><path d="M30 5v9h8M17 23h15M17 30h15M17 37h10"/>'],
  'lupa': ['Lupa', '<circle cx="20" cy="20" r="12"/><path d="m29 29 12 12M16 16c2-2 6-3 9-1"/>'],
  'grupo': ['Grupo', '<circle cx="24" cy="15" r="6"/><circle cx="10" cy="19" r="4"/><circle cx="38" cy="19" r="4"/><path d="M13 39v-5c0-6 5-10 11-10s11 4 11 10v5M3 39v-4c0-5 3-8 8-8 2 0 4 1 5 2M45 39v-4c0-5-3-8-8-8-2 0-4 1-5 2"/>'],
  'dupla': ['Duas pessoas', '<circle cx="18" cy="16" r="6"/><circle cx="34" cy="18" r="5"/><path d="M5 40v-5c0-7 5-11 13-11s13 4 13 11v5M29 27c2-2 4-3 7-3 6 0 9 4 9 10v6H31"/>'],
  'casa-coracao': ['Ambiente seguro', '<path d="M7 22 24 7l17 15v20H7V22Z"/><path d="M24 34s-7-4-7-10c0-3 2-4 4-4 2 0 3 1 3 3 1-2 2-3 4-3 2 0 4 1 4 4 0 6-8 10-8 10Z"/>'],
  'balao': ['Conversa', '<path d="M8 10h32v23H23L13 41v-8H8V10Z"/>'],
  'baloes': ['Dúvidas', '<path d="M5 8h27v21H18L10 36v-7H5V8Z"/><path d="M35 17h8v20h-5v6l-7-6h-7v-5"/>'],
  'grafico': ['Indicadores', '<path d="M8 42V29h8v13M20 42V21h8v21M32 42V10h8v32M5 42h38"/>'],
  'tendencia': ['Crescimento', '<path d="M6 38 18 26l8 7L42 12"/><path d="M31 12h11v11"/>'],
  'engrenagem': ['Processos', '<circle cx="24" cy="24" r="8"/><path d="M24 5v5M24 38v5M5 24h5M38 24h5M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/>'],
  'megafone': ['Comunicado', '<path d="M7 26h8l19 9V10L15 19H7v7ZM15 26l3 14h7l-4-12M39 17l5-3M39 28l5 3"/>'],
  'fone': ['Atendimento', '<path d="M8 28v-7a16 16 0 0 1 32 0v7M8 27H4v10h8V27H8ZM40 27h4v10h-8V27h4ZM36 39c-2 3-5 4-9 4"/>'],
  'sino': ['Aviso', '<path d="M14 32h20l-3-5V17a7 7 0 0 0-14 0v10l-3 5Z"/><path d="M21 37c1 4 5 4 6 0M24 7V4"/>'],
  'relogio': ['Relógio', '<circle cx="24" cy="24" r="18"/><path d="M24 13v12l8 5"/>'],
  'check': ['Check', '<rect x="8" y="9" width="31" height="31" rx="3"/><path d="m15 23 7 7L43 9"/>'],
  'predio': ['Empresa', '<path d="M8 42h32M12 42V15l10-7 10 7v27M32 23h7v19M18 18h2M24 18h2M18 25h2M24 25h2M18 32h2M24 32h2M20 42v-5h4v5"/>'],
  'cadeado': ['Acessos', '<rect x="9" y="19" width="30" height="23" rx="3"/><path d="M15 19v-5a9 9 0 0 1 18 0v5M24 28v6M21 31h6"/>'],
  'carteira': ['Financeiro', '<path d="M7 13h32a4 4 0 0 1 4 4v23H7a4 4 0 0 1-4-4V11a5 5 0 0 1 4-5h28"/><path d="M34 23h10v10H34a5 5 0 0 1 0-10Z"/><circle cx="36" cy="28" r="1"/>'],
  'tenis': ['Atividade física', '<path d="M5 31c10 1 15-5 18-16 6 8 12 12 20 14v9H5v-7Z"/><path d="m10 28 4 4m2-9 5 4m5-8 5 4"/>'],
  'estrela': ['Destaque', '<path d="m24 5 5.6 12 13 1.4-9.7 8.8 2.7 12.8L24 33.4 12.4 40l2.7-12.8L5.4 18.4l13-1.4L24 5Z"/>'],
  'presente': ['Presente', '<rect x="6" y="18" width="36" height="9" rx="2"/><path d="M9 27v15h30V27M24 18v24M24 18s-3-11-10-10c-4 1-3 9 10 10ZM24 18s3-11 10-10c4 1 3 9-10 10Z"/>'],
  'bolo': ['Aniversário', '<path d="M8 42h32M10 42V28h28v14M10 34c3 2 5 2 7 0s5-2 7 0 5 2 7 0 5-2 7 0M24 28v-6M24 16c-2-2-2-4 0-7 2 3 2 5 0 7Z"/>'],
  'livro': ['Leitura', '<path d="M6 10c7-2 13-1 18 3v29c-5-4-11-5-18-3V10ZM42 10c-7-2-13-1-18 3v29c5-4 11-5 18-3V10Z"/>'],
  'notebook': ['Ferramentas', '<rect x="9" y="10" width="30" height="21" rx="2"/><path d="M4 37h40l-3 4H7l-3-4Z"/>'],
  'lampada': ['Ideia', '<path d="M18 34c0-4-6-7-6-15a12 12 0 0 1 24 0c0 8-6 11-6 15H18ZM19 39h10M21 43h6"/>'],
  'alvo': ['Objetivo', '<circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="4"/>'],
  'maleta': ['Trabalho', '<rect x="5" y="14" width="38" height="27" rx="3"/><path d="M17 14V9h14v5M5 25h38M21 25v4h6v-4"/>'],
  'aviao': ['Férias', '<path d="M43 7 5 22l14 5 5 14 19-34ZM19 27 43 7"/>'],
  'email': ['E-mail', '<rect x="5" y="10" width="38" height="28" rx="3"/><path d="m6 12 18 14 18-14"/>'],
  'whatsapp': ['WhatsApp', '<path d="M24 5a19 19 0 0 0-16.4 28.6L5 43l9.7-2.5A19 19 0 1 0 24 5Z"/><path d="M17 15c-1 0-3 2-2 6 2 6 7 11 13 13 4 1 6-1 6-2l-1-3-5-2-2 2c-3-1-6-4-7-7l2-2-2-5h-2Z"/>'],
  'link': ['Link', '<path d="M20 28 28 20M17 23l-5 5a6 6 0 0 0 8 8l5-5M31 25l5-5a6 6 0 0 0-8-8l-5 5"/>'],
  'info': ['Informação', '<circle cx="24" cy="24" r="18"/><path d="M24 21v12M24 15h.01"/>'],
  'etiqueta': ['Campanha', '<path d="M6 6h17l19 19-17 17L6 23V6Z"/><circle cx="15" cy="15" r="3"/>'],
  'mapa': ['Localização', '<path d="M24 43s14-12 14-24a14 14 0 0 0-28 0c0 12 14 24 14 24Z"/><circle cx="24" cy="19" r="5"/>']
};

const SOCIAL = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v8h4v-8h3l1-4h-4V8Z"/>',
  linkedin: '<path d="M6 10v10M6 6v.01M10 20v-6a3 3 0 0 1 6 0v6M10 10v10"/>',
  email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  phone: '<path d="M6 3h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2Z"/>',
  pin: '<path d="M12 22s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/>'
};

function icon(name, cls = 'ic') {
  const i = ICONS[name];
  if (!i) return '';
  return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${i[1]}</svg>`;
}
function social(name) {
  return `<svg class="ic-s" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${SOCIAL[name] || ''}</svg>`;
}
const iconList = () => Object.entries(ICONS).map(([k, v]) => ({ key: k, label: v[0], svg: v[1] }));

module.exports = { ICONS, icon, social, iconList };
