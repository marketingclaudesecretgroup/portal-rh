// Editor de blocos — gera formulários a partir de window.BLOCK_SCHEMA
(function () {
  var SCHEMA = window.BLOCK_SCHEMA;
  var ICONS = window.ICONS;
  var ICON_MAP = {};
  ICONS.forEach(function (i) { ICON_MAP[i.key] = i; });
  var state = Array.isArray(window.INITIAL_BLOCKS) ? window.INITIAL_BLOCKS : [];
  var root = document.getElementById('blocks');
  var form = document.getElementById('page-form');
  var dirty = false;

  function markDirty() { dirty = true; var m = document.getElementById('dirty-msg'); if (m) m.hidden = false; }
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  form.addEventListener('submit', function () {
    document.getElementById('blocks-input').value = JSON.stringify(state);
    dirty = false;
  });
  form.addEventListener('input', function (e) { if (!e.target.closest('#blocks')) markDirty(); });

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function svg(key) { var i = ICON_MAP[key]; return i ? '<svg class="ic" viewBox="0 0 48 48">' + i.svg + '</svg>' : '<span class="muted small">—</span>'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function defaultValue(f) {
    if (f.default !== undefined) return clone(f.default);
    if (f.type === 'list' || f.type === 'lines') return [];
    if (f.type === 'checkbox') return false;
    if (f.type === 'select') return f.options[0][0];
    return '';
  }
  function newData(fields) {
    var d = {};
    fields.forEach(function (f) {
      d[f.key] = defaultValue(f);
      if (f.type === 'list') d[f.key] = [newData(f.fields)];
    });
    return d;
  }

  // ---------- Campos ----------
  function makeField(f, obj) {
    if (obj[f.key] === undefined) obj[f.key] = defaultValue(f);
    var wrap = el('div', { class: 'field field--' + f.type });
    var label = el('span', { text: f.label });
    var input;
    var onChange = function (v) { obj[f.key] = v; markDirty(); };

    switch (f.type) {
      case 'textarea':
        input = el('textarea', { rows: 3, placeholder: f.placeholder || '' });
        input.value = obj[f.key] || '';
        input.addEventListener('input', function () { onChange(input.value); });
        break;
      case 'lines':
        input = el('textarea', { rows: 4, placeholder: 'Um item por linha' });
        input.value = (obj[f.key] || []).join('\n');
        input.addEventListener('input', function () { onChange(input.value.split('\n')); });
        break;
      case 'select':
        input = el('select');
        f.options.forEach(function (o) { var op = el('option', { value: o[0], text: o[1] }); if (String(obj[f.key]) === o[0]) op.selected = true; input.appendChild(op); });
        input.addEventListener('change', function () { onChange(input.value); });
        break;
      case 'checkbox':
        wrap = el('label', { class: 'check' });
        input = el('input', { type: 'checkbox' });
        input.checked = !!obj[f.key];
        input.addEventListener('change', function () { onChange(input.checked); });
        wrap.appendChild(input); wrap.appendChild(document.createTextNode(' ' + f.label));
        return wrap;
      case 'url':
        input = el('input', { type: 'text', list: 'link-suggestions', placeholder: f.placeholder || '/pagina, https://… ou mailto:…' });
        input.value = obj[f.key] || '';
        input.addEventListener('input', function () { onChange(input.value.trim()); });
        break;
      case 'image':
        input = imageInput(obj, f.key, onChange);
        break;
      case 'icon':
        input = iconInput(obj, f.key, onChange);
        break;
      case 'richtext':
        input = richInput(obj, f.key, onChange);
        break;
      case 'list':
        return listInput(f, obj);
      default:
        input = el('input', { type: 'text', placeholder: f.placeholder || '' });
        input.value = obj[f.key] || '';
        input.addEventListener('input', function () { onChange(input.value); });
    }
    wrap.appendChild(label);
    wrap.appendChild(input);
    if (f.help) wrap.appendChild(el('small', { class: 'muted', text: f.help }));
    return wrap;
  }

  function imageInput(obj, key, onChange) {
    var box = el('div', { class: 'image-field' });
    var prev = el('div', { class: 'image-field__preview' });
    var render = function () { prev.innerHTML = obj[key] ? '<img src="' + String(obj[key]).replace(/"/g, '&quot;') + '" alt="">' : '<span class="muted small">Nenhuma imagem</span>'; };
    var btns = el('div', { class: 'image-field__btns' }, [
      el('button', { type: 'button', class: 'btn btn--sm', text: 'Escolher imagem', onclick: function () { window.openMediaPicker(function (u) { onChange(u); render(); }); } }),
      el('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: 'Remover', onclick: function () { onChange(''); render(); } })
    ]);
    box.appendChild(prev); box.appendChild(btns);
    render();
    return box;
  }

  function iconInput(obj, key, onChange) {
    var det = el('details', { class: 'iconpick' });
    var sum = el('summary');
    var render = function () { var i = ICON_MAP[obj[key]]; sum.innerHTML = '<span class="iconpick__cur">' + svg(obj[key]) + '</span><span>' + (i ? i.label : 'Sem ícone') + '</span>'; };
    det.appendChild(sum);
    det.addEventListener('toggle', function () {
      if (!det.open || det.querySelector('.iconpick__grid')) return;
      var grid = el('div', { class: 'iconpick__grid' });
      grid.appendChild(el('button', { type: 'button', class: 'iconpick__opt', title: 'Sem ícone', html: '<span class="muted">∅</span>', onclick: function () { onChange(''); render(); det.open = false; } }));
      ICONS.forEach(function (i) {
        grid.appendChild(el('button', { type: 'button', class: 'iconpick__opt', title: i.label, html: svg(i.key), onclick: function () { onChange(i.key); render(); det.open = false; } }));
      });
      det.appendChild(grid);
    });
    render();
    return det;
  }

  function richInput(obj, key, onChange) {
    var holder = el('div', { class: 'rte' });
    setTimeout(function () {
      var q = new Quill(holder, { theme: 'snow', modules: { toolbar: {
        container: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['blockquote', 'link', 'image'], [{ align: [] }], ['clean']],
        handlers: { image: function () { window.openMediaPicker(function (u) { var r = q.getSelection(true); q.insertEmbed(r.index, 'image', u, 'user'); }); } }
      } } });
      if (obj[key]) q.clipboard.dangerouslyPasteHTML(obj[key], 'silent');
      q.on('text-change', function () { onChange(q.getSemanticHTML().replace(/&nbsp;/g, ' ')); });
    }, 0);
    return holder;
  }

  function listInput(f, obj) {
    if (!Array.isArray(obj[f.key])) obj[f.key] = [];
    var arr = obj[f.key];
    var wrap = el('div', { class: 'listfield' });
    wrap.appendChild(el('span', { class: 'listfield__label', text: f.label }));
    var items = el('div', { class: 'listfield__items' });
    wrap.appendChild(items);
    var addBtn = el('button', { type: 'button', class: 'btn btn--sm', text: '+ Adicionar ' + (f.itemLabel || 'item').toLowerCase() });
    wrap.appendChild(addBtn);

    function render() {
      items.innerHTML = '';
      arr.forEach(function (item, idx) {
        var titleText = item.title || item.label || item.question || item.date || '';
        var head = el('div', { class: 'listitem__head' }, [
          el('strong', { text: (f.itemLabel || 'Item') + ' ' + (idx + 1) + (titleText ? ' — ' + titleText : '') }),
          el('span', { class: 'tools' }, [
            el('button', { type: 'button', class: 'icon-btn', title: 'Subir', text: '↑', onclick: function () { move(idx, -1); } }),
            el('button', { type: 'button', class: 'icon-btn', title: 'Descer', text: '↓', onclick: function () { move(idx, 1); } }),
            el('button', { type: 'button', class: 'icon-btn', title: 'Duplicar', text: '⧉', onclick: function () { if (f.max && arr.length >= f.max) return; arr.splice(idx + 1, 0, clone(item)); markDirty(); render(); } }),
            el('button', { type: 'button', class: 'icon-btn icon-btn--danger', title: 'Remover', text: '×', onclick: function () { if (confirm('Remover este item?')) { arr.splice(idx, 1); markDirty(); render(); } } })
          ])
        ]);
        var body = el('div', { class: 'listitem__body' });
        f.fields.forEach(function (sf) { body.appendChild(makeField(sf, item)); });
        var box = el('div', { class: 'listitem' }, [head, body]);
        head.addEventListener('click', function (e) { if (!e.target.closest('button')) box.classList.toggle('is-collapsed'); });
        items.appendChild(box);
      });
      addBtn.hidden = !!(f.max && arr.length >= f.max);
    }
    function move(i, dir) { var j = i + dir; if (j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; markDirty(); render(); }
    addBtn.addEventListener('click', function () { arr.push(newData(f.fields)); markDirty(); render(); });
    render();
    return wrap;
  }

  // ---------- Blocos ----------
  function blockSummary(b) {
    var d = b.data || {};
    return d.title || d.main_title || d.eyebrow || d.text || '';
  }

  function renderBlock(b, idx) {
    var def = SCHEMA[b.type];
    var card = el('section', { class: 'block' + (b.hidden ? ' is-hidden' : '') + (b._open ? '' : ' is-collapsed') });
    var summary = el('span', { class: 'block__summary', text: String(blockSummary(b)).slice(0, 70) });
    var head = el('header', { class: 'block__head' }, [
      el('span', { class: 'block__num', text: String(idx + 1) }),
      el('div', { class: 'block__name' }, [el('strong', { text: def.label }), summary]),
      el('span', { class: 'tools' }, [
        el('button', { type: 'button', class: 'icon-btn', title: 'Subir', text: '↑', onclick: function () { moveBlock(idx, -1); } }),
        el('button', { type: 'button', class: 'icon-btn', title: 'Descer', text: '↓', onclick: function () { moveBlock(idx, 1); } }),
        el('button', { type: 'button', class: 'icon-btn', title: b.hidden ? 'Mostrar no site' : 'Ocultar do site', text: b.hidden ? '◌' : '●', onclick: function () { b.hidden = !b.hidden; markDirty(); renderAll(); } }),
        el('button', { type: 'button', class: 'icon-btn', title: 'Duplicar', text: '⧉', onclick: function () { var c = clone(b); c._open = true; state.splice(idx + 1, 0, c); markDirty(); renderAll(); } }),
        el('button', { type: 'button', class: 'icon-btn icon-btn--danger', title: 'Excluir bloco', text: '×', onclick: function () { if (confirm('Excluir o bloco "' + def.label + '"?')) { state.splice(idx, 1); markDirty(); renderAll(); } } })
      ])
    ]);
    head.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      b._open = !b._open;
      card.classList.toggle('is-collapsed', !b._open);
    });
    var body = el('div', { class: 'block__body' });
    if (def.description) body.appendChild(el('p', { class: 'muted small block__desc', text: def.description + (b.hidden ? ' · Este bloco está oculto no site.' : '') }));
    b.data = b.data || {};
    def.fields.forEach(function (f) { body.appendChild(makeField(f, b.data)); });
    body.addEventListener('input', function () { summary.textContent = String(blockSummary(b)).slice(0, 70); });
    card.appendChild(head);
    card.appendChild(body);
    // Adicionar bloco entre blocos
    var insert = el('button', { type: 'button', class: 'insert-here', title: 'Inserir bloco aqui', text: '+', onclick: function () { openLibrary(idx + 1); } });
    card.appendChild(insert);
    return card;
  }

  function renderAll() {
    root.innerHTML = '';
    if (!state.length) root.appendChild(el('div', { class: 'blocks-empty', html: '<strong>Esta página ainda não tem blocos.</strong><br><span class="muted">Clique em “+ Adicionar bloco” para começar. Sugestão: Banner principal → Introdução → Cards → Fale com o RH.</span>' }));
    state.forEach(function (b, i) { if (SCHEMA[b.type]) root.appendChild(renderBlock(b, i)); });
  }
  function moveBlock(i, dir) { var j = i + dir; if (j < 0 || j >= state.length) return; var t = state[i]; state[i] = state[j]; state[j] = t; markDirty(); renderAll(); }

  // ---------- Biblioteca ----------
  var lib = document.getElementById('library-modal');
  var insertAt = null;
  function openLibrary(at) { insertAt = at; lib.hidden = false; }
  var libGrid = document.getElementById('library');
  Object.keys(SCHEMA).forEach(function (type) {
    var def = SCHEMA[type];
    libGrid.appendChild(el('button', { type: 'button', class: 'lib-item', onclick: function () {
      var b = { type: type, hidden: false, data: newData(def.fields), _open: true };
      var at = insertAt == null ? state.length : insertAt;
      state.splice(at, 0, b);
      lib.hidden = true; markDirty(); renderAll();
      var node = root.children[at]; if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } }, [el('strong', { text: def.label }), el('span', { text: def.description || '' })]));
  });
  document.querySelector('[data-open-library]').addEventListener('click', function () { openLibrary(null); });
  document.querySelector('[data-collapse-all]').addEventListener('click', function () { state.forEach(function (b) { b._open = false; }); renderAll(); });

  renderAll();
})();
