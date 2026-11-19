/* Playable phone demos. The "play" chips under the MedRoyale and Kalorize
   phones, and on the publication card, open a dialog with a big phone running
   a tiny toy version of the app:
     quiz — a 3-question 1v1 match against the bird mascot
     kal  — answer three questions, get a menu for pagi / siang / malam,
            and tap each meal to fill the calorie ring
     rank — a 5,000-player leaderboard in pages of 100: a binary search finds
            the page with your rank, and other pages load only when scrolled to
   Each demo is a mount(screen) function that returns { stop } for cleanup. */
(function () {
  'use strict';

  var dialog = document.getElementById('demo');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var screen = document.getElementById('demo-screen');
  var titleEl = document.getElementById('demo-title');
  var noteEl = document.getElementById('demo-note');
  var closeBtn = document.getElementById('demo-close');
  var birdTpl = document.getElementById('bird-tpl');

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var CANDY = ['#FFD166', '#FFB3CF', '#7FE3CF', '#C7B9FF', '#54C5F8', '#FFB48A'];
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Small DOM helpers
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function icon(id, cls) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    if (cls) svg.setAttribute('class', cls);
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }
  function bird() {
    return birdTpl && 'content' in birdTpl ? birdTpl.content.cloneNode(true) : document.createTextNode('');
  }
  function replay(node, cls) {
    node.classList.remove(cls);
    void node.getBoundingClientRect(); // reflow so the animation restarts
    node.classList.add(cls);
  }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function confetti() {
    if (calm) return;
    for (var i = 0; i < 26; i++) {
      var bit = el('span', 'confetti-bit');
      var angle = Math.random() * Math.PI * 2;
      var dist = 70 + Math.random() * 130;
      bit.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(0) + 'px');
      bit.style.setProperty('--dy', (Math.sin(angle) * dist - 30).toFixed(0) + 'px');
      bit.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      bit.style.setProperty('--c', CANDY[i % CANDY.length]);
      bit.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
      screen.appendChild(bit);
      setTimeout(function (b) { b.remove(); }, 1400, bit);
    }
  }

  /* ───────── MedRoyale: 1v1 quiz against the mascot ───────── */

  var ROUNDS = 3;
  var LIMIT = 12000;     // ms to answer
  var BIRD_SKILL = 0.6;  // chance the bird answers correctly
  var FOE = 'Birdie';
  // The first answer is the correct one; answers are shuffled when shown.
  var QUESTIONS = [
    { q: 'Which chamber of the heart pumps blood out to the body?', a: ['Left ventricle', 'Right ventricle', 'Left atrium', 'Right atrium'] },
    { q: 'A lack of which vitamin causes scurvy?', a: ['Vitamin C', 'Vitamin A', 'Vitamin D', 'Vitamin B12'] },
    { q: 'Which organ produces insulin?', a: ['Pancreas', 'Liver', 'Kidney', 'Spleen'] },
    { q: 'What is the longest bone in the human body?', a: ['Femur', 'Tibia', 'Humerus', 'Fibula'] },
    { q: 'Which blood cells carry oxygen around the body?', a: ['Red blood cells', 'White blood cells', 'Platelets', 'Plasma cells'] },
    { q: 'Which cranial nerve carries vision?', a: ['Optic nerve (II)', 'Olfactory nerve (I)', 'Facial nerve (VII)', 'Vagus nerve (X)'] },
    { q: 'A normal resting heart rate for an adult is about…', a: ['60–100 bpm', '30–50 bpm', '110–140 bpm', '150–180 bpm'] },
    { q: 'Which blood type is the universal red-cell donor?', a: ['O negative', 'AB positive', 'A positive', 'B negative'] }
  ];

  function mountQuiz(root) {
    var alive = true;
    var timers = [];
    var raf = 0;
    var deck = [];
    var round = 0;
    var score = { you: 0, foe: 0 };

    function later(fn, ms) { timers.push(setTimeout(function () { if (alive) fn(); }, ms)); }
    function stop() { alive = false; timers.forEach(clearTimeout); cancelAnimationFrame(raf); }

    // Header that stays put for the whole match
    var roundPill = el('span', 'd-pill', '1v1 quiz');
    var top = el('div', 'd-top');
    top.appendChild(el('b', '', 'MedRoyale'));
    top.appendChild(roundPill);

    function player(side, name) {
      var box = el('div', 'q-player ' + side);
      var ava = el('span', 'q-ava');
      if (side === 'foe') {
        ava.appendChild(bird());
      } else {
        var me = document.createElementNS(SVG_NS, 'svg');
        me.setAttribute('viewBox', '0 0 46 46');
        me.setAttribute('aria-hidden', 'true');
        me.innerHTML = '<circle cx="23" cy="18" r="8" fill="#fff"/><path d="M9.500 38a13.500 13.500 0 0 1 27 0z" fill="#fff"/>';
        ava.appendChild(me);
      }
      var lock = el('span', 'q-lock');
      lock.appendChild(icon('i-tick'));
      ava.appendChild(lock);
      var points = el('strong', 'q-score', '0');
      box.appendChild(ava);
      box.appendChild(el('span', 'q-name', name));
      box.appendChild(points);
      return { box: box, ava: ava, points: points };
    }
    var you = player('you', 'You');
    var foe = player('foe', FOE);
    var vs = el('div', 'q-vs');
    vs.appendChild(you.box);
    vs.appendChild(el('span', 'q-vs-tag', 'VS'));
    vs.appendChild(foe.box);

    var body = el('div', 'q-body');
    root.appendChild(top);
    root.appendChild(vs);
    root.appendChild(body);

    function setScore(who, side, value) {
      score[side] = value;
      who.points.textContent = String(value);
      if (value) replay(who.points, 'bump');
    }
    function unlock() {
      you.box.classList.remove('locked');
      foe.box.classList.remove('locked');
    }

    // ── Lobby
    function lobby() {
      body.textContent = '';
      unlock();
      roundPill.textContent = '1v1 quiz';
      var mid = el('div', 'q-mid');
      mid.appendChild(el('h3', '', 'Ready to duel?'));
      mid.appendChild(el('p', '', 'Three medical questions against ' + FOE + ', my mascot. A quicker correct answer scores more.'));
      var rules = el('ul', 'q-rules');
      [ROUNDS + ' rounds', LIMIT / 1000 + ' s each', 'speed bonus'].forEach(function (r) { rules.appendChild(el('li', '', r)); });
      mid.appendChild(rules);
      var go = el('button', 'd-btn', 'Start match');
      go.type = 'button';
      go.addEventListener('click', startMatch);
      mid.appendChild(go);
      body.appendChild(mid);
      return go;
    }

    function startMatch() {
      deck = shuffle(QUESTIONS).slice(0, ROUNDS);
      round = 0;
      setScore(you, 'you', 0);
      setScore(foe, 'foe', 0);
      ask();
    }

    // ── One round
    function ask() {
      var item = deck[round];
      var correct = item.a[0];
      var options = shuffle(item.a);
      var wrongs = item.a.slice(1);
      var birdPick = Math.random() < BIRD_SKILL ? correct : wrongs[Math.floor(Math.random() * wrongs.length)];
      var birdAt = 2200 + Math.random() * 4800; // ms into the round
      var birdLeft = 0, youLeft = 0;            // share of the timer left when each answered
      var youPick = null, birdDone = false, done = false;
      var began = performance.now();

      body.textContent = '';
      unlock();
      roundPill.textContent = 'Round ' + (round + 1) + '/' + ROUNDS;

      var timer = el('div', 'q-timer');
      var bar = el('i');
      timer.appendChild(bar);
      var cardBox = el('div', 'q-card');
      cardBox.appendChild(el('p', 'q-text', item.q));
      var answers = el('div', 'q-answers');
      var feed = el('p', 'q-feed');
      feed.setAttribute('role', 'status');

      var buttons = options.map(function (text, i) {
        var btn = el('button', 'q-ans');
        btn.type = 'button';
        btn.appendChild(el('em', '', 'ABCD'.charAt(i)));
        btn.appendChild(el('span', '', text));
        btn.addEventListener('click', function () { choose(text, btn); });
        answers.appendChild(btn);
        return { text: text, btn: btn };
      });

      body.appendChild(timer);
      body.appendChild(cardBox);
      body.appendChild(answers);
      body.appendChild(feed);
      buttons[0].btn.focus({ preventScroll: true });

      function elapsed() { return performance.now() - began; }

      function choose(text, btn) {
        if (done || youPick !== null) return;
        youPick = text;
        youLeft = Math.max(0, 1 - elapsed() / LIMIT);
        btn.classList.add('picked');
        you.box.classList.add('locked');
        buttons.forEach(function (b) {
          b.btn.disabled = true;
          if (b.btn !== btn) b.btn.classList.add('dim');
        });
        // Don't keep the player waiting: the bird makes up its mind soon after
        if (!birdDone) {
          birdAt = Math.min(birdAt, elapsed() + 350 + Math.random() * 500);
          feed.textContent = 'Locked in! Waiting for ' + FOE + '…';
        }
      }

      function birdLocks() {
        birdDone = true;
        birdLeft = Math.max(0, 1 - birdAt / LIMIT);
        foe.box.classList.add('locked');
        replay(foe.ava, 'hop');
        if (youPick === null) feed.textContent = FOE + ' has locked in an answer!';
      }

      function tick() {
        if (!alive || done) return;
        var t = elapsed();
        bar.style.transform = 'scaleX(' + Math.max(0, 1 - t / LIMIT).toFixed(4) + ')';
        timer.classList.toggle('low', LIMIT - t < 3500);
        if (!birdDone && t >= birdAt) birdLocks();
        if (t >= LIMIT || (youPick !== null && birdDone)) return reveal();
        raf = requestAnimationFrame(tick);
      }

      function reveal() {
        done = true;
        var youRight = youPick === correct;
        var birdRight = birdDone && birdPick === correct;
        var youGain = youRight ? 100 + Math.round(50 * youLeft) : 0;
        var birdGain = birdRight ? 100 + Math.round(50 * birdLeft) : 0;

        buttons.forEach(function (b) {
          b.btn.disabled = true;
          b.btn.classList.remove('picked');
          b.btn.classList.toggle('dim', b.text !== correct);
          if (b.text === correct) b.btn.classList.add('right');
          else if (b.text === youPick) b.btn.classList.add('wrong');
          if (birdDone && b.text === birdPick) {
            var tag = el('span', 'q-pick');
            tag.title = FOE + ' picked this';
            tag.appendChild(bird());
            b.btn.appendChild(tag);
          }
        });

        if (youGain) setScore(you, 'you', score.you + youGain);
        if (birdGain) setScore(foe, 'foe', score.foe + birdGain);

        var mine = youPick === null ? 'Time’s up! It was ' + correct + '.'
          : youRight ? 'Correct! +' + youGain + '.'
          : 'Not quite — it’s ' + correct + '.';
        var theirs = !birdDone ? FOE + ' ran out of time too.'
          : birdRight ? FOE + ' got it, +' + birdGain + '.'
          : FOE + ' missed it.';
        feed.textContent = mine + ' ' + theirs;

        later(function () {
          round += 1;
          if (round < ROUNDS) ask(); else result();
        }, 2600);
      }

      raf = requestAnimationFrame(tick);
    }

    // ── Final score
    function result() {
      body.textContent = '';
      unlock();
      roundPill.textContent = 'Final score';
      var won = score.you > score.foe;
      var draw = score.you === score.foe;
      var mid = el('div', 'q-mid');
      var big = el('span', 'q-big-bird' + (won ? ' sad' : ' waving'));
      big.setAttribute('aria-hidden', 'true');
      big.appendChild(bird());
      mid.appendChild(big);
      var heading = el('h3', '', won ? 'You win!' : draw ? 'It’s a draw!' : FOE + ' wins!');
      heading.setAttribute('role', 'status');
      mid.appendChild(heading);
      mid.appendChild(el('p', '', won ? 'You beat ' + FOE + ' ' + score.you + ' to ' + score.foe + '. The real app does this live, against real doctors and students.'
        : draw ? 'Level at ' + score.you + ' points each. One more to settle it?'
        : FOE + ' took it ' + score.foe + ' to ' + score.you + '. It’s a bird. You can do this.'));
      var again = el('button', 'd-btn', 'Rematch');
      again.type = 'button';
      again.addEventListener('click', startMatch);
      mid.appendChild(again);
      body.appendChild(mid);
      again.focus({ preventScroll: true });
      if (won) confetti();
    }

    var first = lobby();
    return { stop: stop, focus: first };
  }

  /* ───────── Kalorize: a few questions, then a plan for pagi / siang / malam ───────── */

  // Each answer nudges the daily calorie target (kcal) or picks the menu.
  var STEPS = [
    { key: 'goal', q: 'What’s your goal?', options: [
      { id: 'lose', emo: '🏃', name: 'Lose weight', sub: 'a gentle calorie deficit', kcal: -400 },
      { id: 'keep', emo: '⚖️', name: 'Stay in shape', sub: 'keep things where they are', kcal: 0 },
      { id: 'gain', emo: '💪', name: 'Build muscle', sub: 'a little extra fuel', kcal: 350 }
    ] },
    { key: 'move', q: 'How active is your day?', options: [
      { id: 'low', emo: '💻', name: 'Mostly sitting', sub: 'desk, class, commute', kcal: -200 },
      { id: 'mid', emo: '🚶', name: 'On my feet a lot', sub: 'walking, light exercise', kcal: 0 },
      { id: 'high', emo: '🏋️', name: 'Training most days', sub: 'sport or gym', kcal: 300 }
    ] },
    { key: 'diet', q: 'What do you eat?', options: [
      { id: 'all', emo: '🍗', name: 'Everything', sub: 'meat, fish, vegetables', kcal: 0 },
      { id: 'veg', emo: '🥦', name: 'Vegetarian', sub: 'no meat or fish, eggs are fine', kcal: 0 }
    ] }
  ];
  var BASE_KCAL = 2000;
  var MEALS = [
    { when: 'Pagi', en: 'breakfast', emo: '🌅', share: 0.3 },
    { when: 'Siang', en: 'lunch', emo: '☀️', share: 0.4 },
    { when: 'Malam', en: 'dinner', emo: '🌙', share: 0.3 }
  ];
  // MENU[diet][goal] → the dish for pagi, siang, malam
  var MENU = {
    all: {
      lose: [['Oatmeal pisang', 'oats, banana, a boiled egg'], ['Ayam bakar + nasi merah', 'grilled chicken, brown rice, lalapan'], ['Sup ikan', 'clear fish soup, stir-fried greens']],
      keep: [['Bubur ayam', 'chicken rice porridge'], ['Nasi + ayam bakar', 'grilled chicken, rice, sayur asem'], ['Pepes ikan', 'steamed fish, rice, kangkung']],
      gain: [['Nasi uduk + telur', 'coconut rice, egg, tempeh'], ['Nasi rendang', 'beef rendang, rice, greens'], ['Nasi goreng ayam', 'chicken fried rice, fried egg']]
    },
    veg: {
      lose: [['Oatmeal pisang', 'oats, banana, peanuts'], ['Gado-gado', 'vegetables, tofu, light peanut sauce'], ['Sup tahu', 'tofu soup, stir-fried greens']],
      keep: [['Roti gandum + alpukat', 'wholegrain toast, avocado, egg'], ['Gado-gado + lontong', 'vegetables, tofu, rice cake'], ['Tempe bacem + nasi', 'sweet tempeh, rice, sayur lodeh']],
      gain: [['Nasi uduk + telur', 'coconut rice, egg, tempe orek'], ['Nasi tahu tempe', 'tofu, tempeh, rice, avocado'], ['Nasi goreng telur', 'egg fried rice, tempeh']]
    }
  };
  var RING = 2 * Math.PI * 52; // circumference of the ring, in SVG units

  function mountKal(root) {
    var alive = true;
    var timers = [];
    var raf = 0;
    var answers = {};   // step key → the chosen option
    var firstFocus = null;

    function later(fn, ms) { timers.push(setTimeout(function () { if (alive) fn(); }, ms)); }
    function stop() { alive = false; timers.forEach(clearTimeout); cancelAnimationFrame(raf); }
    function fmt(n) { return n.toLocaleString('en-US'); }

    var pill = el('span', 'd-pill');
    var top = el('div', 'd-top');
    top.appendChild(el('b', '', 'Kalorize'));
    top.appendChild(pill);
    var body = el('div', 'k-body');
    root.appendChild(top);
    root.appendChild(body);

    // ── The questions, one per screen
    function ask(step) {
      var item = STEPS[step];
      body.textContent = '';
      pill.textContent = 'Question ' + (step + 1) + '/' + STEPS.length;

      var dots = el('div', 'k-steps');
      STEPS.forEach(function (_, i) { dots.appendChild(el('i', i <= step ? 'on' : '')); });
      var heading = el('h3', 'k-q', item.q);
      var opts = el('div', 'k-opts');
      var first = null;
      item.options.forEach(function (option) {
        var btn = el('button', 'k-opt');
        btn.type = 'button';
        var emo = el('span', 'emo', option.emo);
        emo.setAttribute('aria-hidden', 'true');
        var text = el('span');
        text.appendChild(el('b', '', option.name));
        text.appendChild(el('small', '', option.sub));
        btn.appendChild(emo);
        btn.appendChild(text);
        btn.addEventListener('click', function () {
          answers[item.key] = option;
          if (step + 1 < STEPS.length) ask(step + 1); else think();
        });
        opts.appendChild(btn);
        if (!first) first = btn;
      });

      body.appendChild(dots);
      body.appendChild(heading);
      body.appendChild(opts);
      if (step > 0) {
        var actions = el('div', 'k-actions');
        var back = el('button', '', 'Back');
        back.type = 'button';
        back.addEventListener('click', function () { ask(step - 1); });
        actions.appendChild(back);
        body.appendChild(actions);
      }
      if (step > 0 || firstFocus) first.focus({ preventScroll: true });
      firstFocus = firstFocus || first;
    }

    // ── A beat of "analysis" before the plan appears
    function think() {
      body.textContent = '';
      pill.textContent = 'One moment';
      var wait = el('div', 'k-load');
      wait.setAttribute('role', 'status');
      var dots = el('span', 'k-dots');
      dots.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 3; i++) dots.appendChild(el('i'));
      wait.appendChild(dots);
      wait.appendChild(el('p', '', 'Building your plan…'));
      body.appendChild(wait);
      later(plan, calm ? 250 : 1100);
    }

    // ── The plan: a daily target and a dish for pagi, siang and malam
    function plan() {
      var target = BASE_KCAL + answers.goal.kcal + answers.move.kcal;
      var dishes = MENU[answers.diet.id][answers.goal.id];
      var portions = MEALS.map(function (m) { return Math.round(target * m.share / 10) * 10; });
      portions[2] = target - portions[0] - portions[1];
      var eaten = [false, false, false];
      var shown = 0;
      var celebrated = false;

      body.textContent = '';
      pill.textContent = 'Your plan';

      var ring = el('div', 'k-ring');
      ring.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="52"/>'
        + '<circle class="fill" cx="60" cy="60" r="52" transform="rotate(-90 60 60)" stroke-dasharray="' + RING.toFixed(1) + '" stroke-dashoffset="' + RING.toFixed(1) + '"/></svg>';
      var fill = ring.querySelector('.fill');
      var num = el('div', 'k-num');
      var kcalEl = el('strong', '', '0');
      num.appendChild(kcalEl);
      num.appendChild(el('span', '', 'of ' + fmt(target) + ' kcal'));
      ring.appendChild(num);

      var list = el('div', 'k-opts');
      var mealEls = MEALS.map(function (meal, i) {
        var btn = el('button', 'k-opt k-meal');
        btn.type = 'button';
        btn.style.animationDelay = (i * 0.09).toFixed(2) + 's';
        var emo = el('span', 'emo', meal.emo);
        emo.setAttribute('aria-hidden', 'true');
        var text = el('span');
        var when = el('span', 'k-when');
        when.appendChild(el('span', '', meal.when + ' · ' + meal.en));
        when.appendChild(el('span', '', ' ≈ ' + fmt(portions[i]) + ' kcal'));
        text.appendChild(when);
        text.appendChild(el('b', '', dishes[i][0]));
        text.appendChild(el('small', '', dishes[i][1]));
        var tick = el('span', 'k-tick');
        tick.appendChild(icon('i-tick'));
        btn.appendChild(emo);
        btn.appendChild(text);
        btn.appendChild(tick);
        btn.addEventListener('click', function () { eaten[i] = !eaten[i]; render(); });
        list.appendChild(btn);
        return btn;
      });

      var tip = el('p', 'k-tip');
      tip.setAttribute('role', 'status');
      tip.appendChild(icon('i-bulb'));
      var tipText = el('span');
      tip.appendChild(tipText);

      var actions = el('div', 'k-actions');
      var again = el('button', '', 'Answer again');
      again.type = 'button';
      again.addEventListener('click', function () { cancelAnimationFrame(raf); answers = {}; ask(0); });
      actions.appendChild(again);

      [ring, list, tip, actions].forEach(function (n) { body.appendChild(n); });

      function countTo(value) {
        cancelAnimationFrame(raf);
        if (calm) { shown = value; kcalEl.textContent = fmt(value); return; }
        var from = shown, began = performance.now();
        (function step(now) {
          var t = Math.min(1, (now - began) / 450);
          shown = Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3)));
          kcalEl.textContent = fmt(shown);
          if (t < 1 && alive) raf = requestAnimationFrame(step);
        })(began);
      }

      function render() {
        var total = 0, count = 0;
        eaten.forEach(function (done, i) {
          mealEls[i].setAttribute('aria-pressed', String(done));
          if (done) { total += portions[i]; count += 1; }
        });
        var complete = count === MEALS.length;
        fill.setAttribute('stroke-dashoffset', (RING * (1 - total / target)).toFixed(1));
        ring.classList.toggle('hit', complete);
        countTo(total);
        tipText.textContent = complete ? 'Day complete, right on your ' + fmt(target) + ' kcal target!'
          : count ? fmt(target - total) + ' kcal to go. Tap the next meal when it’s eaten.'
          : 'Here’s your menu for today. Tap a meal once you’ve eaten it.';
        if (complete && !celebrated) { replay(ring, 'pop'); confetti(); }
        celebrated = complete;
      }

      render();
      mealEls[0].focus({ preventScroll: true });
    }

    ask(0);
    return { stop: stop, focus: firstFocus };
  }

  /* ───────── MedRoyale leaderboard: binary-search to your own page ───────── */

  var PLAYERS = 5000;
  var PER_PAGE = 100; // the leaderboard loads 100 players per page
  var MY_RANK = 3482;
  var NAME_A = ['Swift', 'Calm', 'Brave', 'Sharp', 'Kind', 'Bright', 'Steady', 'Quick', 'Bold', 'Keen'];
  var NAME_B = ['Scalpel', 'Neuron', 'Pulse', 'Femur', 'Synapse', 'Aorta', 'Cortex', 'Retina', 'Tibia'];
  function fmt(n) { return n.toLocaleString('en-US'); }

  function mountRank(root) {
    var alive = true;
    var raf = 0;
    var scrollRaf = 0;
    var pages = Math.ceil(PLAYERS / PER_PAGE);
    var myPage = Math.ceil(MY_RANK / PER_PAGE);
    var first = 0;     // loaded pages run from first to last; the rest are not in the DOM
    var last = 0;
    var meRow = null;  // my row, while its page is loaded
    var atMe = false;  // is my row on screen?
    var busy = false;  // a search is running

    function stop() { alive = false; cancelAnimationFrame(raf); cancelAnimationFrame(scrollRaf); }

    var pill = el('span', 'd-pill', '');
    var top = el('div', 'd-top');
    top.appendChild(el('b', '', 'Leaderboard'));
    top.appendChild(pill);

    // One cell per page: which are loaded, and where the search is looking
    var strip = el('div', 'r-pages');
    strip.setAttribute('aria-hidden', 'true');
    var cells = [];
    for (var c = 0; c < pages; c++) { cells.push(el('i')); strip.appendChild(cells[c]); }

    var list = el('div', 'r-list');
    list.tabIndex = 0;
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', 'Leaderboard, ' + fmt(PLAYERS) + ' players');

    var status = el('p', 'r-status', pages + ' pages of ' + PER_PAGE + ' players. Scroll, or jump to your rank.');
    status.setAttribute('role', 'status');
    var go = el('button', 'd-btn', 'Go to my position');
    go.type = 'button';

    root.appendChild(top);
    root.appendChild(strip);
    root.appendChild(list);
    root.appendChild(status);
    root.appendChild(go);

    function range(p) { return '#' + fmt((p - 1) * PER_PAGE + 1) + '–#' + fmt(Math.min(p * PER_PAGE, PLAYERS)); }

    // Players are made up on the spot from their rank
    function row(i) {
      var mine = i === MY_RANK - 1;
      var node = el('div', 'r-row' + (mine ? ' me' : ''));
      node.setAttribute('role', 'listitem');
      node.appendChild(el('span', 'r-rank', '#' + fmt(i + 1)));
      var ava = el('span', 'r-ava'); // every player is the mascot, on a different colour
      ava.style.setProperty('--c', CANDY[i % CANDY.length]);
      ava.appendChild(bird());
      node.appendChild(ava);
      node.appendChild(el('span', 'r-name', mine ? 'You' : NAME_A[(i * 7 + 3) % NAME_A.length] + NAME_B[(i * 13 + 5) % NAME_B.length] + ((i * 37) % 90 + 10)));
      node.appendChild(el('span', 'r-pts', fmt(15000 - i * 3 + (i * 7) % 3) + ' pts'));
      if (mine) meRow = node;
      return node;
    }
    function page(p) {
      var box = el('div', 'r-page');
      box.appendChild(el('p', 'r-page-tag', 'Page ' + p + ' · ' + range(p)));
      for (var i = (p - 1) * PER_PAGE; i < Math.min(p * PER_PAGE, PLAYERS); i++) box.appendChild(row(i));
      return box;
    }

    // The strip, the counter and the button follow what is loaded and where the list is
    function sync() {
      cells.forEach(function (cell, i) { cell.classList.toggle('loaded', i + 1 >= first && i + 1 <= last); });
      pill.textContent = fmt(Math.min(last * PER_PAGE, PLAYERS) - (first - 1) * PER_PAGE) + ' of ' + fmt(PLAYERS) + ' loaded';
      var mid = meRow && meRow.isConnected ? meRow.offsetTop + meRow.offsetHeight / 2 : -1;
      atMe = mid > list.scrollTop && mid < list.scrollTop + list.clientHeight;
      if (!busy) go.textContent = atMe ? 'Back to the top' : 'Go to my position';
    }
    // Drop every loaded page and load just this one
    function show(p) {
      list.textContent = '';
      meRow = null;
      list.appendChild(page(p));
      first = last = p;
    }
    function centre() {
      if (meRow) list.scrollTop = meRow.offsetTop - (list.clientHeight - meRow.offsetHeight) / 2;
    }

    // Neighbouring pages only load when the list is scrolled to their edge
    list.addEventListener('scroll', function () {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(function () {
        scrollRaf = 0;
        if (!alive || busy) return;
        if (list.scrollTop < 60 && first > 1) {
          var before = list.scrollHeight;
          first -= 1;
          list.insertBefore(page(first), list.firstChild);
          list.scrollTop += list.scrollHeight - before; // stay on the row being read
          status.textContent = 'Scrolled up, so page ' + first + ' (' + range(first) + ') loaded.';
        } else if (list.scrollTop + list.clientHeight > list.scrollHeight - 60 && last < pages) {
          last += 1;
          list.appendChild(page(last));
          status.textContent = 'Scrolled down, so page ' + last + ' (' + range(last) + ') loaded.';
        }
        sync();
      });
    });

    // Scroll the list from one offset to another
    function glide(from, to, ms, ease, done) {
      if (calm) { list.scrollTop = to; done(); return; }
      var t0 = null;
      list.scrollTop = from;
      raf = requestAnimationFrame(function step(now) {
        if (!alive) return;
        if (t0 === null) t0 = now;
        var t = Math.max(0, Math.min(1, (now - t0) / ms));
        list.scrollTop = from + (to - from) * ease(t);
        if (t < 1) raf = requestAnimationFrame(step); else done();
      });
    }
    function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    // Binary search over the pages: halve the range until the page holding my rank turns up.
    // Each page it checks on the way is loaded on its own and scrolled through, towards where the
    // search goes next; the page that holds my rank opens straight at my row.
    function search() {
      var lo = 1;
      var hi = pages;
      var lookups = 0;
      busy = true;
      go.textContent = 'Searching…';
      (function probe() {
        var mid = Math.floor((lo + hi) / 2);
        lookups += 1;
        cells.forEach(function (cell, i) {
          cell.classList.remove('found');
          cell.classList.toggle('probe', i + 1 === mid);
          cell.classList.toggle('out', i + 1 < lo || i + 1 > hi);
        });
        show(mid);
        sync();
        if (mid === myPage) { // the row's place in its page is known, so jump straight to it
          centre();
          land(lookups);
          return;
        }
        var bottom = list.scrollHeight - list.clientHeight;
        var down = myPage > mid;
        status.textContent = 'Lookup ' + lookups + ' · page ' + mid + ' · you’re further ' + (down ? 'down' : 'up');
        if (down) lo = mid + 1; else hi = mid - 1;
        glide(down ? 0 : bottom, down ? bottom : 0, 420, easeInOut, probe);
      })();
    }
    function land(lookups) {
      cells.forEach(function (cell, i) {
        cell.classList.remove('probe', 'out');
        cell.classList.toggle('found', i + 1 === myPage);
      });
      busy = false;
      sync();
      status.textContent = 'You’re #' + fmt(MY_RANK) + '. Found in ' + lookups + ' lookups; 1 of ' + pages + ' pages loaded.';
      if (meRow) replay(meRow, 'found');
    }

    go.addEventListener('click', function () {
      if (busy) return;
      if (atMe) {
        show(1);
        list.scrollTop = 0;
        cells.forEach(function (cell) { cell.classList.remove('found'); });
        status.textContent = 'Back at #1, with only page 1 loaded.';
        sync();
      } else if (meRow && meRow.isConnected) { // my page is already loaded: no search needed
        centre();
        sync();
        status.textContent = 'You’re #' + fmt(MY_RANK) + '. Your page was already loaded.';
        replay(meRow, 'found');
      } else {
        search();
      }
    });

    show(1);
    sync();
    return { stop: stop, focus: go };
  }

  /* ───────── The dialog ───────── */

  var DEMOS = {
    quiz: {
      title: 'MedRoyale',
      note: 'A toy version for this page. In the real app the match is live against another player, over Socket.IO.',
      mount: mountQuiz
    },
    kal: {
      title: 'Kalorize',
      note: 'A toy version for this page: three questions and rough estimates. The real app used machine-learning APIs for its nutrition analysis.',
      mount: mountKal
    },
    rank: {
      title: 'MedRoyale leaderboard',
      note: 'A toy version for this page: 5,000 made-up players, 100 per page. As in the real app, a binary search finds the page with your rank, and the pages above and below only load when you scroll to them.',
      mount: mountRank
    }
  };
  var running = null;

  function open(kind) {
    var demo = DEMOS[kind];
    if (!demo || dialog.open) return;
    titleEl.textContent = demo.title;
    noteEl.textContent = demo.note;
    teardown();
    screen.className = 'demo-screen demo-' + kind;
    screen.scrollTop = 0;
    running = demo.mount(screen);
    dialog.showModal();
    if (running.focus) running.focus.focus({ preventScroll: true });
  }

  function teardown() {
    if (running) running.stop();
    running = null;
    screen.textContent = '';
  }
  // The close event arrives a tick late, so skip it if a demo was reopened meanwhile
  dialog.addEventListener('close', function () { if (!dialog.open) teardown(); });
  // The dialog fills the viewport, so a click on it (not the box) is a click outside
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  closeBtn.addEventListener('click', function () { dialog.close(); });

  document.querySelectorAll('.play-chip[data-demo]').forEach(function (chip) {
    var kind = chip.getAttribute('data-demo');
    chip.addEventListener('click', function () { open(kind); });
    // The little phone (or the line of text the chip sits in) is a bigger,
    // mouse-friendly target for the same button
    var phone = chip.parentElement.querySelector('.phone') || chip.closest('.ribbon');
    if (phone) {
      phone.classList.add('playable');
      phone.addEventListener('click', function () { chip.focus({ preventScroll: true }); open(kind); });
    }
  });

  document.documentElement.classList.add('demos');
})();
