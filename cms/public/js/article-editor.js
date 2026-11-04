(function () {
  var form = document.getElementById('article-form');
  var input = document.getElementById('content-input');
  var dirty = false;
  var q = new Quill('#content-editor', { theme: 'snow', placeholder: 'Escreva o comunicado…', modules: { toolbar: {
    container: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['blockquote', 'link', 'image'], [{ align: [] }], ['clean']],
    handlers: { image: function () { window.openMediaPicker(function (u) { var r = q.getSelection(true); q.insertEmbed(r.index, 'image', u, 'user'); }); } }
  } } });
  if (window.INITIAL_CONTENT) q.clipboard.dangerouslyPasteHTML(window.INITIAL_CONTENT, 'silent');
  q.on('text-change', function () { dirty = true; });
  form.addEventListener('input', function () { dirty = true; });
  form.addEventListener('submit', function () { input.value = q.getSemanticHTML().replace(/&nbsp;/g, ' '); dirty = false; });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
