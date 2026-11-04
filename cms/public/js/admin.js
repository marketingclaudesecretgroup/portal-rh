// Utilitários do painel: seletor de mídia, campos de imagem, confirmações, uploads.
(function () {
  var CSRF = document.querySelector('meta[name="csrf-token"]').content;
  window.CSRF = CSRF;

  // Confirmação antes de excluir
  document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // Upload: pede autorização ao servidor; com Supabase, o arquivo vai direto do navegador para o Storage
  function errorMessage(value, fallback, depth) {
    if (typeof value === 'string' && value.trim() && value !== '[object Object]') return value.trim().slice(0, 400);
    if (value && typeof value === 'object' && (depth || 0) < 4) {
      var keys = ['message', 'error', 'msg', 'error_description'];
      for (var i = 0; i < keys.length; i++) {
        var message = errorMessage(value[keys[i]], '', (depth || 0) + 1);
        if (message) return message;
      }
    }
    return fallback;
  }
  function requestJSON(url, options, timeout) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeout || 30000);
    options.signal = controller.signal;
    return fetch(url, options).then(function (r) {
      return r.text().then(function (body) {
        var data;
        try { data = body ? JSON.parse(body) : {}; } catch (_) {
          if (r.ok) throw new Error('A resposta do envio é inválida. Recarregue a página e tente novamente.');
          data = /^\s*</.test(body) ? {} : body;
        }
        if (!r.ok || (data && data.error)) throw new Error(errorMessage(data, 'Não foi possível enviar o arquivo (HTTP ' + r.status + ').'));
        return data;
      });
    }).catch(function (error) {
      if (error.name === 'AbortError') throw new Error('O envio demorou além do esperado. Verifique sua conexão e tente novamente.');
      if (error instanceof TypeError) throw new Error('Não foi possível conectar ao armazenamento. Verifique sua conexão e tente novamente.');
      throw error;
    }).finally(function () { clearTimeout(timer); });
  }
  function postJSON(url, data) {
    return requestJSON(url, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF, Accept: 'application/json' } });
  }
  function uploadFile(file, onProgress) {
    function progress(message) { if (onProgress) onProgress(message); }
    var meta = { name: file.name, type: file.type, size: file.size };
    progress('Preparando envio…');
    return postJSON('/admin/midia/assinar', meta).then(function (sig) {
      progress('Enviando arquivo…');
      if (sig.mode === 'supabase') {
        // Mesmo formato do uploadToSignedUrl do SDK: metadados antes do arquivo.
        // O navegador define o Content-Type com o boundary do multipart.
        var signedBody = new FormData();
        signedBody.append('cacheControl', '31536000');
        signedBody.append('', file, file.name);
        return requestJSON(sig.signedUrl, { method: 'PUT', body: signedBody, headers: { 'x-upsert': 'false' } }, 120000)
          .then(function () { progress('Finalizando imagem…'); meta.path = sig.path; return postJSON('/admin/midia/confirmar', meta); });
      }
      var fd = new FormData();
      fd.append('file', file);
      return requestJSON('/admin/midia/enviar', { method: 'POST', body: fd, headers: { 'X-CSRF-Token': CSRF, Accept: 'application/json' } }, 120000);
    }).then(function (item) {
      if (!item || typeof item.url !== 'string' || !item.url) throw new Error('O arquivo foi enviado, mas não foi possível obter seu endereço. Tente novamente.');
      progress('Envio concluído.');
      return item;
    });
  }
  window.uploadFile = uploadFile;

  // ---------- Modal de mídia ----------
  var modal = document.getElementById('media-modal');
  var pickCallback = null;
  var modalUploading = false;
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uploadIndicator(container, file, position) {
    var previewUrl = file.type.indexOf('image/') === 0 ? URL.createObjectURL(file) : '';
    container.innerHTML = '<div class="upload-progress" role="status" aria-live="polite" aria-atomic="true">' +
      (previewUrl ? '<img class="upload-progress__preview" src="' + esc(previewUrl) + '" alt="">' : '') +
      '<div class="upload-progress__body"><strong class="upload-progress__phase"></strong>' +
      '<span class="upload-progress__name">' + esc((position ? position + ' · ' : '') + file.name) + '</span>' +
      '<div class="upload-progress__bar" role="progressbar" aria-label="Envio em andamento"></div>' +
      '<span class="muted small">Aguarde a conclusão do envio.</span></div>' +
      '<span class="upload-progress__spinner" aria-hidden="true"></span></div>';
    var phase = container.querySelector('.upload-progress__phase');
    return {
      update: function (message) { phase.textContent = message; },
      dispose: function () { if (previewUrl) URL.revokeObjectURL(previewUrl); }
    };
  }
  function uploadBusy(input, busy) {
    input.disabled = busy;
    var label = input.closest('label');
    if (label) { label.classList.toggle('is-uploading', busy); label.setAttribute('aria-disabled', String(busy)); }
  }
  function loadGrid() {
    var grid = modal.querySelector('[data-grid]');
    grid.innerHTML = '<p class="muted">Carregando…</p>';
    return requestJSON('/admin/midia.json', { headers: { Accept: 'application/json' } }).then(function (items) {
      if (modalUploading) return;
      if (!Array.isArray(items)) throw new Error('Não foi possível carregar a biblioteca de imagens.');
      if (!items.length) { grid.innerHTML = '<p class="muted">Nenhum arquivo ainda. Envie o primeiro pelo botão acima.</p>'; return; }
      grid.innerHTML = items.map(function (m) {
        var thumb = m.mime === 'application/pdf' ? '<span class="media-item__pdf">PDF</span>' : '<img src="' + esc(m.url) + '" alt="" loading="lazy">';
        return '<button type="button" class="media-item media-item--pick" data-url="' + esc(m.url) + '">' + thumb + '<span>' + esc(m.original_name) + '</span></button>';
      }).join('');
    }).catch(function (error) { if (!modalUploading) grid.textContent = errorMessage(error, 'Não foi possível carregar as imagens. Tente abrir a biblioteca novamente.'); });
  }
  window.openMediaPicker = function (cb) {
    if (!modal) return;
    if (modalUploading) { modal.hidden = false; return; }
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
      if (!f || modalUploading) return;
      var grid = modal.querySelector('[data-grid]');
      modalUploading = true;
      uploadBusy(e.target, true);
      modal.setAttribute('aria-busy', 'true');
      var indicator = uploadIndicator(grid, f);
      uploadFile(f, indicator.update).then(function (j) { if (pickCallback) pickCallback(j.url); closeModal(modal); })
        .catch(function (err) { grid.textContent = errorMessage(err, 'Não foi possível enviar o arquivo. Tente novamente.'); alert(grid.textContent); })
        .finally(function () { indicator.dispose(); modalUploading = false; modal.setAttribute('aria-busy', 'false'); uploadBusy(e.target, false); e.target.value = ''; });
    });
  }

  // ---------- Campos de imagem fora do editor de blocos ----------
  function initImageField(box) {
    var input = box.querySelector('input');
    var prev = box.querySelector('.image-field__preview');
    function render() { prev.innerHTML = input.value ? '<img src="' + esc(input.value) + '" alt="">' : '<span class="muted small">Nenhuma imagem</span>'; }
    function change(value) {
      input.value = value;
      render();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    box.querySelector('[data-pick]').addEventListener('click', function () { openMediaPicker(function (url) { change(url); }); });
    box.querySelector('[data-clear]').addEventListener('click', function () { change(''); });
    render();
  }
  document.querySelectorAll('[data-image-field]').forEach(initImageField);

  // ---------- Página de mídia ----------
  var up = document.getElementById('media-upload');
  if (up) up.addEventListener('change', function () {
    if (up.disabled || !up.files.length) return;
    var files = Array.from(up.files), status = document.getElementById('upload-status'), done = 0;
    uploadBusy(up, true);
    status.setAttribute('aria-busy', 'true');
    files.reduce(function (p, f, index) {
      return p.then(function () {
        var indicator = uploadIndicator(status, f, (index + 1) + ' de ' + files.length);
        return uploadFile(f, indicator.update).then(function () { done++; })
          .catch(function (e) { alert(f.name + ': ' + e.message); }).finally(indicator.dispose);
      });
    }, Promise.resolve()).then(function () {
      status.textContent = done + ' de ' + files.length + ' arquivo(s) enviado(s).';
      if (done) location.reload();
    }).finally(function () { status.setAttribute('aria-busy', 'false'); uploadBusy(up, false); up.value = ''; });
  });
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var raw = b.getAttribute('data-copy'); var url = /^https?:/.test(raw) ? raw : location.origin + raw;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
        b.classList.add('is-copied'); setTimeout(function () { b.classList.remove('is-copied'); }, 1200);
      }).catch(function () { prompt('Copie o endereço:', url); });
    });
  });

  // Fecha o menu lateral no celular ao navegar
  var flash = document.querySelector('.flash--ok');
  if (flash) setTimeout(function () { flash.classList.add('is-hiding'); }, 4000);
})();
