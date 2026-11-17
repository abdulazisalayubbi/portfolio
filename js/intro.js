/* Intro splash: a one-button darts game. A crosshair sweeps over the board;
   every dart that lands adds to a "build" bar (the nearer the bullseye, the
   more it adds) and at 100% the page irises open from the board.
   The inline script in <head> decides whether the intro shows on load:
   once per session, never for reduced-motion visitors or deep links. */
(function () {
  'use strict';

  var root = document.documentElement;
  var intro = document.getElementById('intro');
  if (!intro) return;

  var stage = document.getElementById('intro-stage');
  var board = document.getElementById('intro-board');
  var aim = document.getElementById('intro-aim');
  var dartsLayer = document.getElementById('intro-darts');
  var bird = document.getElementById('intro-bird');
  var fill = document.getElementById('intro-fill');
  var statusEl = document.getElementById('intro-status');
  var countEl = document.getElementById('intro-count');
  var skip = document.getElementById('intro-skip');
  var replay = document.getElementById('intro-replay');
  var pageParts = document.querySelectorAll('body > header, body > main, body > footer');

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SEEN_KEY = 'azis-intro-seen';
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Board geometry, in the SVG's 240-unit viewBox
  var CX = 120, CY = 120;
  var REACH = 96;      // how far from the centre the crosshair swings
  var SWEEP = 1.7;     // in/out speed, rad/s — it crosses the bullseye every ~1.8s
  var TURN = 0.6;      // how fast the sweep line itself rotates, rad/s
  var COOLDOWN = 380;  // ms between throws

  // Rings from the centre outwards: radius, build progress gained, label
  var ZONES = [
    { r: 14, gain: 100, label: 'Bullseye! Hot reload ⚡', bull: true },
    { r: 32, gain: 50, label: 'So close! +50%' },
    { r: 68, gain: 34, label: 'Nice! +34%' },
    { r: Infinity, gain: 20, label: 'On the board! +20%' }
  ];
  var FLIGHTS = [['#FFD166', '#FFB3CF'], ['#7FE3CF', '#FFD166'], ['#C7B9FF', '#7FE3CF'], ['#FFB3CF', '#C7B9FF'], ['#FFB48A', '#FFD166']];
  var CANDY = ['#FFD166', '#FFB3CF', '#7FE3CF', '#C7B9FF', '#54C5F8', '#FFB48A'];

  var state = 'idle'; // idle → play → done → out → idle
  var progress = 0;
  var darts = 0;
  var t = 0, turn0 = 0, last = 0, readyAt = 0;
  var ax = CX, ay = CY;
  var raf = 0;
  var timers = [];
  var returnFocus = null; // the footer button, when the intro was replayed from it

  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function svg(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function restartAnimation(el, cls) {
    el.classList.remove(cls);
    void el.getBoundingClientRect(); // reflow so the animation replays
    el.classList.add(cls);
  }

  function setPageInert(on) {
    pageParts.forEach(function (part) { part.inert = on; });
  }

  // ── Crosshair: a slowly rotating line it slides along, through the centre
  function moveAim(dt) {
    t += dt;
    var r = REACH * Math.sin(SWEEP * t);
    var a = turn0 + TURN * t;
    ax = CX + r * Math.cos(a);
    ay = CY + r * Math.sin(a);
    aim.setAttribute('transform', 'translate(' + ax.toFixed(1) + ' ' + ay.toFixed(1) + ')');
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state === 'play') moveAim(dt);
  }

  // ── HUD
  function plural(n) { return n + (n === 1 ? ' dart' : ' darts'); }
  function updateHud() {
    fill.style.width = progress + '%';
    countEl.textContent = plural(darts);
    statusEl.textContent = darts ? 'Compiling… ' + progress + '%' : 'Waiting for your first dart…';
  }

  // ── A dart stuck in the board at (x, y): tip at the hit point, tail
  //    leaning away from the nearest top/bottom edge so it stays in view
  function addDart(x, y) {
    var flip = y < CY ? ' scale(1 -1)' : '';
    var lean = (Math.random() * 28 - 14).toFixed(1);
    var colors = FLIGHTS[(darts - 1) % FLIGHTS.length];
    var holder = svg('g', { transform: 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')' + flip + ' rotate(' + lean + ') scale(.66)' });
    var dart = svg('g', { 'class': 'intro-dart' });
    dart.appendChild(svg('path', { d: 'M0 0 22-22', stroke: '#4D6782', 'stroke-width': 3, 'stroke-linecap': 'round' }));
    dart.appendChild(svg('path', { d: 'M20-20 46-46', stroke: '#0175C2', 'stroke-width': 9, 'stroke-linecap': 'round' }));
    dart.appendChild(svg('path', { d: 'M44-44 60-60', stroke: '#01579B', 'stroke-width': 4, 'stroke-linecap': 'round' }));
    dart.appendChild(svg('path', { d: 'M56-56 62-76l12 6z', fill: colors[0] }));
    dart.appendChild(svg('path', { d: 'M56-56 80-58l-6-12z', fill: colors[1] }));
    holder.appendChild(svg('circle', { 'class': 'intro-ping', r: 12 }));
    holder.appendChild(svg('circle', { r: 3, fill: '#0B2A4A', opacity: 0.3 }));
    holder.appendChild(dart);
    dartsLayer.appendChild(holder);
  }

  function pop(zone, x, y) {
    var label = document.createElement('span');
    label.className = 'intro-pop' + (zone.bull ? ' bull' : '');
    label.textContent = zone.label;
    label.style.left = Math.max(24, Math.min(76, x / 2.4)) + '%';
    label.style.top = (y / 2.4) + '%';
    stage.appendChild(label);
    setTimeout(function () { label.remove(); }, 950);
  }

  function confetti() {
    if (calm) return;
    for (var i = 0; i < 30; i++) {
      var bit = document.createElement('span');
      var angle = Math.random() * Math.PI * 2;
      var dist = 90 + Math.random() * 170;
      bit.className = 'intro-confetti';
      bit.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(0) + 'px');
      bit.style.setProperty('--dy', (Math.sin(angle) * dist - 40).toFixed(0) + 'px');
      bit.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      bit.style.setProperty('--c', CANDY[i % CANDY.length]);
      bit.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
      stage.appendChild(bit);
    }
  }

  // ── Throwing
  function throwDart() {
    if (state !== 'play') return;
    var now = performance.now();
    if (now < readyAt) return;
    readyAt = now + COOLDOWN;

    var x = ax, y = ay;
    var dx = x - CX, dy = y - CY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var zone = ZONES[ZONES.length - 1];
    for (var i = 0; i < ZONES.length; i++) {
      if (dist <= ZONES[i].r) { zone = ZONES[i]; break; }
    }

    darts += 1;
    progress = Math.min(100, progress + zone.gain);
    addDart(x, y);
    pop(zone, x, y);
    updateHud();
    restartAnimation(board, 'hit');
    restartAnimation(bird, 'cheer');

    if (progress >= 100) win();
  }

  function win() {
    state = 'done';
    intro.classList.add('won');
    statusEl.textContent = '✓ Built in ' + plural(darts);
    countEl.textContent = 'Launching…';
    confetti();
    later(function () { exit(false); }, 1250);
  }

  // ── Leaving: an iris opens from the bullseye and the page shows through
  function setMask(value) {
    intro.style.webkitMaskImage = value;
    intro.style.maskImage = value;
  }

  function finishExit() {
    cancelAnimationFrame(raf);
    root.classList.remove('intro-out');
    setMask('');
    state = 'idle';
  }

  function exit(fast) {
    if (state !== 'play' && state !== 'done') return;
    state = 'out';
    clearTimers();
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* storage blocked */ }

    // intro-out keeps the overlay up while the page underneath wakes up
    root.classList.remove('intro-on');
    root.classList.add('intro-out');
    setPageInert(false);
    if (returnFocus) returnFocus.focus({ preventScroll: true });

    if (calm) return finishExit();

    var box = intro.getBoundingClientRect();
    var b = board.getBoundingClientRect();
    var ox = b.left + b.width / 2 - box.left;
    var oy = b.top + b.height / 2 - box.top;
    var reach = Math.sqrt(Math.pow(Math.max(ox, box.width - ox), 2) + Math.pow(Math.max(oy, box.height - oy), 2)) + 4;
    var duration = fast ? 450 : 750;
    var began = performance.now();

    function iris(now) {
      var p = Math.min(1, (now - began) / duration);
      var eased = p * p * (3 - 2 * p) * (0.35 + 0.65 * p); // slow start, quick finish
      var r = eased * reach;
      setMask('radial-gradient(circle at ' + ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px, transparent ' + r.toFixed(1) + 'px, #000 ' + (r + 2).toFixed(1) + 'px)');
      if (p < 1) requestAnimationFrame(iris); else finishExit();
    }
    requestAnimationFrame(iris);
  }

  // ── Starting (on load, or again from the footer button)
  function start() {
    clearTimers();
    cancelAnimationFrame(raf);
    dartsLayer.textContent = '';
    stage.querySelectorAll('.intro-pop, .intro-confetti').forEach(function (n) { n.remove(); });
    intro.classList.remove('won');
    board.classList.remove('hit');
    bird.classList.remove('cheer');
    setMask('');
    intro.scrollTop = 0;

    progress = 0;
    darts = 0;
    t = Math.PI / (2 * SWEEP); // begin at the rim, not on the bullseye
    turn0 = Math.random() * Math.PI * 2;
    readyAt = performance.now() + 250;
    updateHud();
    moveAim(0);

    root.classList.remove('intro-out');
    root.classList.add('intro-on');
    setPageInert(true);
    state = 'play';
    last = performance.now();
    raf = requestAnimationFrame(tick);
    stage.focus({ preventScroll: true });
  }

  // ── Input: any tap or click on the splash throws; Space/Enter too
  intro.addEventListener('pointerdown', function (e) {
    if (e.button || e.target.closest('.intro-skip')) return;
    throwDart();
  });
  stage.addEventListener('click', function (e) {
    if (e.detail === 0) throwDart(); // activation from assistive tech, not a pointer
  });
  document.addEventListener('keydown', function (e) {
    if (state !== 'play' && state !== 'done') return;
    if (e.key === 'Escape') { exit(true); return; }
    if (e.key !== ' ' && e.key !== 'Spacebar' && e.key !== 'Enter') return;
    if (e.target === skip) return; // the Skip button handles its own keys
    e.preventDefault();
    if (!e.repeat) throwDart();
  });
  skip.addEventListener('click', function () { exit(true); });
  if (replay) replay.addEventListener('click', function () { returnFocus = replay; start(); });

  if (root.classList.contains('intro-on')) start();
})();
