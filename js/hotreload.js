/* Live main.dart: the underlined values in the hero's code card are buttons.
   Tapping one cycles it, then the page "hot reloads" — a ⚡ flash, a console
   toast, and the edit really applies (role line, colour palette, dark mode).
   Edits last for the session; the inline script in <head> re-applies the
   palette and dark mode before first paint so a refresh doesn't flicker. */
(function () {
  'use strict';

  var root = document.documentElement;
  var card = document.getElementById('live-code');
  if (!card) return;

  var roleEl = document.getElementById('live-role');
  var chipEl = document.getElementById('live-chip');
  var statusEl = document.querySelector('#live-status span');
  var reloadChip = document.getElementById('live-chip-reload');
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  var KEY = 'azis-live-main';
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var LIBRARIES = 648; // how many libraries the pretend app has
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ROLES = [
    { title: 'Senior Mobile Developer', chip: 'Flutter @ MedRoyale' },
    { title: 'Flutter Developer', chip: 'iOS & Android, one codebase' },
    { title: 'Widget Wrangler', chip: 'everything is a widget' },
    { title: 'Hot Reload Enthusiast', chip: 'save, ⚡, repeat' }
  ];
  var THEMES = ['sky', 'mint', 'sunset', 'grape'];

  // Each editable field: how many values it cycles through, and how value i
  // reads in the code and to a screen reader.
  var FIELDS = {
    role: { count: ROLES.length, code: function (i) { return "'" + ROLES[i].title + "'"; } },
    theme: { count: THEMES.length, code: function (i) { return 'Palette.' + THEMES[i]; } },
    dark: { count: 2, code: function (i) { return i ? 'true' : 'false'; } }
  };
  var NAMES = { role: 'role', theme: 'theme', dark: 'darkMode' };

  var state = { role: 0, theme: 0, dark: 0 };
  var buttons = {};
  var flash, bolt, toast, toastText;
  var toastTimer = 0, applyTimer = 0;

  // ── Session storage
  function load() {
    try {
      var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (!saved) return;
      var role = ROLES.findIndex(function (r) { return r.title === saved.role; });
      var theme = THEMES.indexOf(saved.theme);
      if (role > 0) state.role = role;
      if (theme > 0) state.theme = theme;
      if (saved.dark === true) state.dark = 1;
    } catch (e) { /* storage blocked or stale */ }
  }
  function save() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ role: ROLES[state.role].title, theme: THEMES[state.theme], dark: !!state.dark }));
    } catch (e) { /* storage blocked */ }
  }

  // ── Applying the state to the page
  function toHex(color) {
    var m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
    var scale = 1;
    if (!m) { m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color); scale = 255; }
    if (!m) return '';
    return '#' + [m[1], m[2], m[3]].map(function (n) {
      var v = Math.max(0, Math.min(255, Math.round(parseFloat(n) * scale)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }

  function syncThemeColor() {
    if (!themeMeta) return;
    var probe = document.createElement('i');
    probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--hero-1)';
    document.body.appendChild(probe);
    var hex = toHex(getComputedStyle(probe).color);
    probe.remove();
    if (hex) themeMeta.setAttribute('content', hex);
  }

  function apply() {
    var theme = THEMES[state.theme];
    if (theme === THEMES[0]) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    root.toggleAttribute('data-dark', !!state.dark);
    if (roleEl) roleEl.textContent = ROLES[state.role].title;
    if (chipEl) chipEl.textContent = ROLES[state.role].chip;
    syncThemeColor();
  }

  function label(field) {
    buttons[field].textContent = FIELDS[field].code(state[field]);
    buttons[field].setAttribute('aria-label', NAMES[field] + ': ' + FIELDS[field].code(state[field]) + '. Tap to change.');
  }

  // ── The hot-reload show
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.getBoundingClientRect(); // reflow so the animation restarts
    el.classList.add(cls);
  }

  function buildFx() {
    flash = document.createElement('div');
    flash.className = 'reload-flash';
    flash.setAttribute('aria-hidden', 'true');

    bolt = document.createElementNS(SVG_NS, 'svg');
    bolt.setAttribute('class', 'reload-bolt');
    bolt.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#i-zap');
    bolt.appendChild(use);

    toast = document.createElement('div');
    toast.className = 'reload-toast';
    toast.setAttribute('role', 'status');
    var icon = document.createElementNS(SVG_NS, 'svg');
    icon.setAttribute('class', 'ic');
    icon.setAttribute('aria-hidden', 'true');
    icon.appendChild(use.cloneNode());
    toastText = document.createElement('span');
    toast.appendChild(icon);
    toast.appendChild(toastText);

    document.body.appendChild(flash);
    document.body.appendChild(bolt);
    document.body.appendChild(toast);
  }

  function say(ms) {
    toastText.textContent = '';
    var strong = document.createElement('b');
    strong.textContent = 'Hot reload';
    toastText.appendChild(strong);
    toastText.appendChild(document.createTextNode(' · Reloaded 1 of ' + LIBRARIES + ' libraries in ' + ms + ' ms.'));
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2800);
  }

  function hotReload(field) {
    var btn = buttons[field];
    var began = performance.now();
    if (!flash) buildFx();

    // The flash and bolt burst out of the value that was just edited
    var r = btn.getBoundingClientRect();
    var fx = (r.left + r.width / 2).toFixed(0) + 'px';
    var fy = (r.top + r.height / 2).toFixed(0) + 'px';
    [flash, bolt].forEach(function (el) {
      el.style.setProperty('--fx', fx);
      el.style.setProperty('--fy', fy);
    });

    replay(btn, 'edited');
    if (statusEl) statusEl.textContent = 'reloading…';

    // Rapid taps collapse into one reload that applies the latest state
    clearTimeout(applyTimer);
    applyTimer = setTimeout(function () {
      apply();
      replay(flash, 'go');
      replay(bolt, 'go');
      if (field === 'role' && roleEl) replay(roleEl.parentElement, 'swap');
      if (reloadChip) replay(reloadChip, 'zapped');
      var ms = Math.round(performance.now() - began) + 90 + Math.floor(Math.random() * 60);
      if (statusEl) statusEl.textContent = 'reloaded in ' + ms + ' ms';
      say(ms);
    }, calm ? 0 : 170);
  }

  // ── Turn the marked values into buttons
  card.querySelectorAll('[data-live]').forEach(function (span) {
    var field = span.getAttribute('data-live');
    if (!FIELDS[field]) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tok ' + span.className;
    btn.addEventListener('click', function () {
      state[field] = (state[field] + 1) % FIELDS[field].count;
      label(field);
      save();
      hotReload(field);
    });
    span.replaceWith(btn);
    buttons[field] = btn;
  });

  load();
  Object.keys(buttons).forEach(label);
  apply(); // quiet: restores a saved state without the show
})();
