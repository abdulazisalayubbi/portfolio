/* CV popup: the "View my CV" buttons open the PDF in a dialog, next to the
   mascot in its suit and tie. Without JS (or <dialog>) they stay plain links
   to the file. The copy and the PDF address live in index.html. */
(function () {
  'use strict';

  var dialog = document.getElementById('cv-pop');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var frame = document.getElementById('cv-frame');
  var closeBtn = document.getElementById('cv-close');

  function open(e) {
    // Modified clicks keep their usual meaning: open the file in a new tab
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (dialog.open) return;
    // The PDF only loads the first time someone asks for it
    if (!frame.getAttribute('src')) frame.src = frame.getAttribute('data-src');
    dialog.showModal();
  }

  document.querySelectorAll('a[data-cv]').forEach(function (link) {
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', open);
  });

  // The dialog fills the viewport, so a click on it (not the box) is a click outside
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  closeBtn.addEventListener('click', function () { dialog.close(); });
})();
