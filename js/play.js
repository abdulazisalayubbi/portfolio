/* Playful extras layered on top of main.js:
   - a Flutter-style DEBUG ribbon that toggles "debug paint"
   - the Awards dartboard, which picks one award and tells its story
   - a livelier mascot: eyes that follow the pointer, speech bubbles
   - a dart that rides the Journey timeline as you scroll
   - click-to-copy on the email, with confetti
   The copy lives in index.html (data-say, data-story); this file is behaviour only. */
(function () {
  'use strict';

  var root = document.documentElement;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CANDY = ['#FFD166', '#FFB3CF', '#7FE3CF', '#C7B9FF', '#54C5F8', '#FFB48A'];

  // ── Small helpers
  function restart(el, cls) {
    el.classList.remove(cls);
    void el.getBoundingClientRect(); // reflow so the animation replays
    el.classList.add(cls);
  }

  function addBit(x, y, i) {
    var bit = document.createElement('span');
    var angle = Math.random() * Math.PI * 2;
    var dist = 70 + Math.random() * 150;
    bit.className = 'fx-confetti';
    bit.style.left = x + 'px';
    bit.style.top = y + 'px';
    bit.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(0) + 'px');
    bit.style.setProperty('--dy', (Math.sin(angle) * dist - 50).toFixed(0) + 'px');
    bit.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    bit.style.setProperty('--c', CANDY[i % CANDY.length]);
    bit.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
    document.body.appendChild(bit);
    setTimeout(function () { bit.remove(); }, 1300);
  }
  // A burst of confetti from a point in the viewport
  function confetti(x, y, count) {
    if (calm) return;
    for (var i = 0; i < count; i++) addBit(x, y, i);
  }

  var toastEl = null;
  var toastTimer = 0;
  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
      void toastEl.offsetWidth; // so the first appearance transitions too
    }
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  // ── Mascot: one shared speech bubble, placed in page coordinates so it
  //    is never clipped by a card's overflow
  var bubble = null;
  var bubbleTimer = 0;
  function hideBubble() {
    clearTimeout(bubbleTimer);
    if (bubble) bubble.classList.remove('show');
  }
  function say(slot, text) {
    if (!slot) return;
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'bird-bubble';
      bubble.setAttribute('role', 'status');
      document.body.appendChild(bubble);
    }
    bubble.classList.remove('show', 'below');
    bubble.textContent = text;
    bubble.style.left = '0px';
    bubble.style.top = '0px';

    var r = slot.getBoundingClientRect();
    var bw = bubble.offsetWidth;
    var bh = bubble.offsetHeight;
    var cx = r.left + r.width / 2;
    var left = Math.max(10, Math.min(root.clientWidth - bw - 10, cx - bw / 2));
    var top = r.top + r.height * 0.1 - bh - 12;
    if (top < 84) { // no room above (it would hide under the nav): go below
      top = r.bottom + 12;
      bubble.classList.add('below');
    }
    bubble.style.left = left + 'px';
    bubble.style.top = (top + window.scrollY) + 'px';
    bubble.style.setProperty('--tail', Math.max(20, Math.min(bw - 20, cx - left)) + 'px');
    void bubble.offsetWidth;
    bubble.classList.add('show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(hideBubble, 3800);
  }
  window.addEventListener('resize', hideBubble);

  // Both wings up and a double hop
  function party(slot) {
    if (!slot) return;
    restart(slot, 'party');
    clearTimeout(slot.partyTimer);
    slot.partyTimer = setTimeout(function () { slot.classList.remove('party'); }, 1500);
  }

  var birds = [];
  document.querySelectorAll('.bird-slot').forEach(function (slot) {
    var bird = slot.querySelector('.bird');
    if (!bird) return;
    birds.push(bird);

    var lines = (slot.getAttribute('data-say') || '').split('|').filter(Boolean);
    if (!lines.length) return;
    var next = 0;
    function speak() {
      say(slot, lines[next % lines.length]);
      next += 1;
      restart(slot, 'hop');
    }
    slot.classList.add('talks');
    slot.removeAttribute('aria-hidden');
    slot.setAttribute('role', 'button');
    slot.setAttribute('aria-label', 'The mascot. Activate to hear what it says.');
    slot.tabIndex = 0;
    slot.addEventListener('click', speak);
    slot.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      speak();
    });
  });

  // Eyes follow the pointer (only for birds that are on screen)
  if (!calm && birds.length) {
    var pointerX = 0;
    var pointerY = 0;
    var lookQueued = false;
    var REACH = 5; // how far a pupil can slide, in the bird's own 200-unit space

    if ('IntersectionObserver' in window) {
      var watcher = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { entry.target.onScreen = entry.isIntersecting; });
      });
      birds.forEach(function (bird) { watcher.observe(bird); });
    } else {
      birds.forEach(function (bird) { bird.onScreen = true; });
    }

    var look = function () {
      lookQueued = false;
      birds.forEach(function (bird) {
        if (!bird.onScreen) return;
        var r = bird.getBoundingClientRect();
        if (!r.width) return;
        var dx = pointerX - (r.left + r.width / 2);
        var dy = pointerY - (r.top + r.height / 2);
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var pull = Math.min(1, dist / (r.width * 0.8)) * REACH;
        bird.style.setProperty('--px', (dx / dist * pull).toFixed(2) + 'px');
        bird.style.setProperty('--py', (dy / dist * pull).toFixed(2) + 'px');
      });
    };
    window.addEventListener('pointermove', function (e) {
      pointerX = e.clientX;
      pointerY = e.clientY;
      if (lookQueued) return;
      lookQueued = true;
      requestAnimationFrame(look);
    }, { passive: true });
    root.addEventListener('pointerleave', function () {
      birds.forEach(function (bird) {
        bird.style.removeProperty('--px');
        bird.style.removeProperty('--py');
      });
    });
  }

  // ── Debug paint: outlines, padding tints and size labels, the way
  //    Flutter draws them with debugPaintSizeEnabled
  var ribbon = document.getElementById('debug-ribbon');
  var debugOn = false;
  var measureQueued = false;

  function measure() {
    measureQueued = false;
    document.querySelectorAll('.card, .stat, .contact-card').forEach(function (el) {
      var name = el.classList.contains('card') ? 'Card' : el.classList.contains('stat') ? 'Container' : 'DecoratedBox';
      el.setAttribute('data-dbg', name + ' ' + el.offsetWidth.toFixed(1) + ' × ' + el.offsetHeight.toFixed(1));
    });
  }
  function setDebug(on) {
    debugOn = on;
    if (on) measure();
    root.classList.toggle('debug-paint', on);
    if (ribbon) ribbon.setAttribute('aria-pressed', String(on));
    toast('debugPaintSizeEnabled = ' + on + ';');
  }
  if (ribbon) {
    ribbon.addEventListener('click', function () { setDebug(!debugOn); });
    // "p" is the key that toggles debug paint in a `flutter run` session
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'p' && e.key !== 'P') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (root.classList.contains('intro-on')) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      setDebug(!debugOn);
    });
    window.addEventListener('resize', function () {
      if (!debugOn || measureQueued) return;
      measureQueued = true;
      requestAnimationFrame(measure);
    });
  }

  // ── Awards: the dartboard picks one award and tells its story
  var board = document.getElementById('award-board');
  var grid = document.getElementById('award-grid');
  var spot = document.getElementById('award-spotlight');
  if (board && grid && spot) {
    var awardCards = Array.prototype.slice.call(grid.querySelectorAll('.award'));
    var dartSpot = document.getElementById('award-dart');
    var awardsBird = document.querySelector('.awards-bird');
    var spotMedal = document.getElementById('spot-medal');
    var spotTitle = document.getElementById('spot-title');
    var spotMeta = document.getElementById('spot-meta');
    var spotStory = document.getElementById('spot-story');
    var pin = spot.querySelector('.award-pin').cloneNode(true); // the dart stuck in the chosen card
    var queue = [];
    var current = null;
    var flying = false;

    // Every award comes up once before any repeats
    var nextAward = function () {
      if (!queue.length) {
        queue = awardCards.slice();
        for (var i = queue.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var swap = queue[i]; queue[i] = queue[j]; queue[j] = swap;
        }
        if (queue[0] === current && queue.length > 1) queue.push(queue.shift());
      }
      return queue.shift();
    };

    var reveal = function (card) {
      current = card;
      awardCards.forEach(function (c) { c.classList.toggle('picked', c === card); });
      grid.classList.add('has-pick');
      card.appendChild(pin);

      var medal = card.querySelector('.medal');
      var title = card.querySelector('h3');
      var meta = card.querySelector('h3 ~ p');
      spot.style.setProperty('--tint', card.style.getPropertyValue('--tint') || 'var(--sky)');
      spot.hidden = false;
      spotMedal.innerHTML = medal ? medal.innerHTML : '';
      spotTitle.textContent = title ? title.textContent : '';
      spotMeta.textContent = meta ? meta.textContent : '';
      spotStory.textContent = card.getAttribute('data-story') || '';
      restart(spot, 'pop');
      party(awardsBird);
      if (debugOn) measure();
      if (spot.scrollIntoView) spot.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
    };

    var throwDart = function () {
      if (flying) return;
      flying = true;
      var card = nextAward();
      // land somewhere inside the inner ring, not always dead centre
      var angle = Math.random() * Math.PI * 2;
      var off = Math.random() * 13;
      if (dartSpot) dartSpot.setAttribute('transform', 'translate(' + (Math.cos(angle) * off).toFixed(1) + ' ' + (Math.sin(angle) * off).toFixed(1) + ')');
      restart(board, 'thrown');
      setTimeout(function () {
        flying = false;
        reveal(card);
      }, calm ? 0 : 420);
    };

    var clearPick = function () {
      var hadFocus = spot.contains(document.activeElement);
      current = null;
      awardCards.forEach(function (c) { c.classList.remove('picked'); });
      grid.classList.remove('has-pick');
      pin.remove();
      spot.hidden = true;
      if (hadFocus) board.focus({ preventScroll: true });
    };

    board.disabled = false;
    board.addEventListener('click', throwDart);
    document.getElementById('spot-again').addEventListener('click', throwDart);
    document.getElementById('spot-clear').addEventListener('click', clearPick);
  }

  // ── Journey: a dart rides the timeline as you scroll and lights each
  //    node as it passes. Skipped for reduced-motion visitors, who keep
  //    the plain, fully lit timeline.
  var timeline = document.querySelector('.timeline');
  if (timeline && !calm) {
    var stops = Array.prototype.slice.call(timeline.children).map(function (li) {
      return { li: li, node: li.querySelector('.node'), at: 0 };
    }).filter(function (stop) { return stop.node; });

    var track = document.createElement('li');
    track.className = 'timeline-track';
    track.setAttribute('aria-hidden', 'true');
    track.innerHTML =
      '<i class="timeline-fill"></i>' +
      '<svg class="timeline-dart" viewBox="-14 -98 28 100">' +
        '<path d="M0 0V-28" stroke="#4D6782" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M0-27V-62" stroke="#0175C2" stroke-width="9" stroke-linecap="round"/>' +
        '<path d="M0-61V-80" stroke="#01579B" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M0-74-12-94 0-87z" fill="#FFD166"/>' +
        '<path d="M0-74 12-94 0-87z" fill="#FFB3CF"/>' +
      '</svg>';
    timeline.insertBefore(track, timeline.firstChild);
    timeline.classList.add('tracked');

    var AIM = 0.55; // the dart sits this far down the viewport
    var trackTop = 0;
    var trackHeight = 0;
    var scrollQueued = false;

    var ride = function () {
      scrollQueued = false;
      // how far the aim line has travelled down the timeline
      var reach = window.innerHeight * AIM - timeline.getBoundingClientRect().top;
      var y = Math.max(0, Math.min(trackHeight, reach - trackTop));
      track.style.setProperty('--y', y.toFixed(1) + 'px');
      track.style.setProperty('--p', (trackHeight ? y / trackHeight : 0).toFixed(4));
      stops.forEach(function (stop) { stop.node.classList.toggle('lit', reach >= stop.at); });
    };
    var layout = function () {
      trackTop = track.offsetTop;
      trackHeight = track.offsetHeight;
      stops.forEach(function (stop) { stop.at = stop.li.offsetTop + stop.node.offsetHeight / 2; });
      ride();
    };

    window.addEventListener('scroll', function () {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(ride);
    }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(timeline);
    window.addEventListener('resize', layout);
    layout();
  }

  // ── Contact: clicking the email copies it; the bird celebrates.
  //    Modified clicks (and any copy failure) still open the mail app.
  var mail = document.getElementById('copy-email');
  if (mail) {
    var address = mail.getAttribute('data-copy') || '';
    var hint = mail.querySelector('.copy-hint');
    var contactBird = document.querySelector('.contact-bird');
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var idleHint = coarse ? '· tap to copy' : '· click to copy';
    var copiedTimer = 0;
    if (hint) hint.textContent = idleHint;

    var legacyCopy = function (text) {
      var field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(field);
      field.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* not allowed */ }
      field.remove();
      return ok;
    };

    var celebrate = function () {
      var r = mail.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, 36);
      mail.classList.add('copied');
      if (hint) hint.textContent = '· copied ✓';
      party(contactBird);
      say(contactBird, 'Copied! Paste it into a new email.');
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(function () {
        mail.classList.remove('copied');
        if (hint) hint.textContent = idleHint;
      }, 2600);
    };

    mail.addEventListener('click', function (e) {
      if (!address || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        e.preventDefault();
        navigator.clipboard.writeText(address).then(celebrate, function () {
          if (legacyCopy(address)) celebrate();
          else location.href = mail.href;
        });
      } else if (legacyCopy(address)) {
        e.preventDefault();
        celebrate();
      }
    });
  }
})();
