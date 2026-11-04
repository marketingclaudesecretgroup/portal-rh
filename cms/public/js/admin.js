// Utilitários do painel: seletor de mídia, campos de imagem, confirmações, uploads.
(function () {
  var CSRF = document.querySelector('meta[name="csrf-token"]').content;
  window.CSRF = CSRF;

  // Confirmação antes de excluir
  document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // Upload genérico
  function uploadFile(file) {
    var fd = new FormData();
    fd.append('file', file);
    return fetch('/admin/midia/enviar', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': CSRF, Accept: 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Falha no envio'); return j; }); });
  }
  window.uploadFile = uploadFile;

  // ---------- Modal de mídia ----------
  var modal = document.getElementById('media-modal');
  var pickCallback = null;
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function loadGrid() {
    var grid = modal.querySelector('[data-grid]');
    grid.innerHTML = '<p class="muted">Carregando…</p>';
    fetch('/admin/midia.json', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (items) {
      if (!items.length) { grid.innerHTML = '<p class="muted">Nenhum arquivo ainda. Envie o primeiro pelo botão acima.</p>'; return; }
      grid.innerHTML = items.map(function (m) {
        var thumb = m.mime === 'application/pdf' ? '<span class="media-item__pdf">PDF</span>' : '<img src="' + esc(m.url) + '" alt="" loading="lazy">';
        return '<button type="button" class="media-item media-item--pick" data-url="' + esc(m.url) + '">' + thumb + '<span>' + esc(m.original_name) + '</span></button>';
      }).join('');
    });
  }
  window.openMediaPicker = function (cb) {
    if (!modal) return;
    pickCallback = cb;
    modal.hidden = false;
    loadGrid();
  };
  function closeModal(m) { m.hidden = true; }
  document.addEventListener('click', function (e) {
    var close = e.target.closest('[data-close]');
    if (close) closeModal(close.closest('.modal'));
    if (e.target.classList && e.target.classList.contains('modal')) closeModal(e.target);
    var item = e.target.closest('.media-item--pick');
    if (item && pickCallback) { pickCallback(item.getAttribute('data-url')); closeModal(modal); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') document.querySelectorAll('.modal:not([hidden])').forEach(closeModal);
  });
  if (modal) {
    modal.querySelector('[data-upload]').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var grid = modal.querySelector('[data-grid]');
      grid.innerHTML = '<p class="muted">Enviando “' + esc(f.name) + '”…</p>';
      uploadFile(f).then(function (j) { if (pickCallback) pickCallback(j.url); closeModal(modal); })
        .catch(function (err) { alert(err.message); loadGrid(); })
        .finally(function () { e.target.value = ''; });
    });
  }

  // ---------- Campos de imagem fora do editor de blocos ----------
  function initImageField(box) {
    var input = box.querySelector('input');
    var prev = box.querySelector('.image-field__preview');
    function change(value) {
      input.value = value;
      render();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function render() { prev.innerHTML = input.value ? '<img src="' + esc(input.value) + '" alt="">' : '<span class="muted small">Nenhuma imagem</span>'; }
    box.querySelector('[data-pick]').addEventListener('click', function () { openMediaPicker(function (url) { change(url); }); });
    box.querySelector('[data-clear]').addEventListener('click', function () { change(''); });
    render();
  }
  document.querySelectorAll('[data-image-field]').forEach(initImageField);

  // ---------- Página de mídia ----------
  var up = document.getElementById('media-upload');
  if (up) up.addEventListener('change', function () {
    var files = Array.from(up.files), status = document.getElementById('upload-status'), done = 0;
    status.textContent = 'Enviando ' + files.length + ' arquivo(s)…';
    files.reduce(function (p, f) {
      return p.then(function () { return uploadFile(f).then(function () { done++; }).catch(function (e) { alert(f.name + ': ' + e.message); }); });
    }, Promise.resolve()).then(function () { status.textContent = done + ' arquivo(s) enviado(s).'; location.reload(); });
  });
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = location.origin + b.getAttribute('data-copy');
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
        b.classList.add('is-copied'); setTimeout(function () { b.classList.remove('is-copied'); }, 1200);
      }).catch(function () { prompt('Copie o endereço:', url); });
    });
  });

  // Fecha o menu lateral no celular ao navegar
  var flash = document.querySelector('.flash--ok');
  if (flash) setTimeout(function () { flash.classList.add('is-hiding'); }, 4000);
})();
