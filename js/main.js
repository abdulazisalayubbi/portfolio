/* Page behaviour: mascot cloning, mobile menu, scroll reveal,
   active nav link, and the pointer-driven tilt on project phones. */
(function () {
  'use strict';

  // ── Mascot: stamp the bird template into every slot
  var tpl = document.getElementById('bird-tpl');
  if (tpl && 'content' in tpl) {
    document.querySelectorAll('.bird-slot').forEach(function (slot) {
      slot.appendChild(tpl.content.cloneNode(true));
    });
  }

  // ── Mobile menu
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('nav-toggle');
  var links = document.getElementById('nav-links');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  if (nav && toggle && links) {
    toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    document.addEventListener('click', function (e) { if (!nav.contains(e.target)) setMenu(false); });
  }

  // ── Scroll reveal
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        revealer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach(function (el) { revealer.observe(el); });

    // ── Highlight the nav link of the section in view
    var navLinks = {};
    document.querySelectorAll('.nav-links a[href^="#"]').forEach(function (a) {
      navLinks[a.getAttribute('href').slice(1)] = a;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = navLinks[entry.target.id];
        if (link && !link.classList.contains('nav-cta')) link.classList.toggle('active', entry.isIntersecting);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { spy.observe(s); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  // ── Project cards: the phone leans toward the pointer
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (fine && !calm) {
    document.querySelectorAll('.tilt').forEach(function (card) {
      var phone = card.querySelector('.phone');
      if (!phone) return;
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        phone.style.setProperty('--ry', (px * 44).toFixed(1) + 'deg');
        phone.style.setProperty('--rx', (-py * 30).toFixed(1) + 'deg');
      });
      card.addEventListener('pointerleave', function () {
        phone.style.removeProperty('--ry');
        phone.style.removeProperty('--rx');
      });
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
