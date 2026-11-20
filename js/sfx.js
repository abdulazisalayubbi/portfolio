/* Sound effects, synthesised with Web Audio so there are no files to load.
   A dart's whoosh through the air, then the thunk as it sticks in the
   board, and a sparkle on top for a bullseye or the winning dart. Used by the
   intro splash (js/intro.js) and the Awards dartboard (js/play.js)
   through window.sfx.dart(). */
(function () {
  'use strict';

  var Ctx = window.AudioContext || window.webkitAudioContext;
  var ctx = null;
  var out = null;    // master volume
  var noise = null;  // half a second of white noise, shared by every sound
  var queued = null; // a throw waiting for the browser to allow audio
  var STALE = 400;   // ms after which a queued throw is dropped, not played late
  var SPARKLE = [1046.5, 1318.5, 1568, 2093, 2637, 3136]; // C6 E6 G6 C7 E7 G7

  function context() {
    if (ctx || !Ctx) return ctx;
    try { ctx = new Ctx(); } catch (e) { return null; }
    out = ctx.createGain();
    out.gain.value = 0.7;
    out.connect(ctx.destination);
    var length = Math.floor(ctx.sampleRate * 0.5);
    noise = ctx.createBuffer(1, length, ctx.sampleRate);
    var data = noise.getChannelData(0);
    for (var i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // A burst of filtered noise that swells to `peak` and dies away
  function hiss(at, length, attack, peak, filter) {
    var src = ctx.createBufferSource();
    var gain = ctx.createGain();
    src.buffer = noise;
    src.loop = true;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(at, Math.random() * 0.2);
    src.stop(at + length + 0.02);
  }

  // A pure tone that rings out, like a tiny bell
  function ping(at, freq, peak, length) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  // Sparkle: bell notes running up two octaves, each with a fainter,
  // slightly sharp overtone that makes it glitter
  function sparkle(at) {
    SPARKLE.forEach(function (freq, i) {
      var start = at + i * 0.055;
      ping(start, freq, 0.15, 0.5);
      ping(start, freq * 2.01, 0.045, 0.28);
    });
  }

  function schedule(flight, bull) {
    var now = ctx.currentTime + 0.01;
    var hit = now + flight;
    var pitch = 0.92 + Math.random() * 0.16; // no two throws sound quite alike

    // Whoosh: rising, airy noise for as long as the dart is in the air
    if (flight > 0.06) {
      var air = ctx.createBiquadFilter();
      air.type = 'bandpass';
      air.Q.value = 1.1;
      air.frequency.setValueAtTime(650 * pitch, now);
      air.frequency.exponentialRampToValueAtTime(2600 * pitch, hit);
      hiss(now, flight + 0.03, flight * 0.75, 0.11, air);
    }

    // Thunk: a low thump that drops in pitch (the board)…
    var osc = ctx.createOscillator();
    var body = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(175 * pitch, hit);
    osc.frequency.exponentialRampToValueAtTime(58, hit + 0.11);
    body.gain.setValueAtTime(0.0001, hit);
    body.gain.exponentialRampToValueAtTime(0.55, hit + 0.004);
    body.gain.exponentialRampToValueAtTime(0.0001, hit + 0.2);
    osc.connect(body);
    body.connect(out);
    osc.start(hit);
    osc.stop(hit + 0.22);

    // …under a short dry tick (the tip biting in)
    var tip = ctx.createBiquadFilter();
    tip.type = 'bandpass';
    tip.Q.value = 0.8;
    tip.frequency.value = 1900 * pitch;
    hiss(hit, 0.05, 0.002, 0.28, tip);

    if (bull) sparkle(hit + 0.04);
  }

  // Play a queued throw once audio is running, unless it has gone stale
  function flush() {
    if (!queued || !ctx || ctx.state !== 'running') return;
    var waited = performance.now() - queued.asked;
    var throwing = queued;
    queued = null;
    if (waited < STALE) schedule(Math.max(0, throwing.flight - waited / 1000), throwing.bull);
  }

  function wake() {
    if (!ctx || ctx.state === 'running') return;
    var resumed = ctx.resume();
    if (resumed && resumed.then) resumed.then(flush, function () { /* still blocked */ });
  }

  // Browsers only start audio from a user gesture, and a touch only counts
  // once the finger lifts, so a throw made on pointerdown is finished here.
  ['pointerup', 'touchend', 'click', 'keydown'].forEach(function (type) {
    document.addEventListener(type, function () { if (queued) wake(); }, true);
  });

  window.sfx = {
    // flightMs: how long the dart's flight animation runs before it lands
    // bull: true for a bullseye or the dart that finishes the build, which adds the sparkle
    dart: function (flightMs, bull) {
      if (!context()) return;
      var flight = Math.max(0, flightMs || 0) / 1000;
      if (ctx.state === 'running') { schedule(flight, bull); return; }
      queued = { asked: performance.now(), flight: flight, bull: bull };
      wake();
    }
  };
})();
