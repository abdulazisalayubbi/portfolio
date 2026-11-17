/* A real 3D Dart logo: each facet of the mark is extruded into a chunky,
   bevelled toy block and lit in a small Three.js scene. Drag to spin it.
   If WebGL or Three.js is unavailable, the page falls back to a flat SVG. */
(function () {
  'use strict';

  var root = document.documentElement;
  var canvas = document.getElementById('dart3d');
  if (!canvas) return;
  var stage = canvas.parentElement;

  function fallback() { root.classList.add('no-3d'); }

  var THREE = window.THREE;
  if (!THREE) return fallback();

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) {
    return fallback();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0.2, 11.5);
  camera.lookAt(0, 0, 0);

  // ── Lights: soft sky fill, a warm key, and a pink rim for the cute factor
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fd8ff, 1.5));
  var key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-4, 6, 8);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xffb3cf, 1.4);
  rim.position.set(6, -2, -6);
  scene.add(rim);
  var fill = new THREE.DirectionalLight(0xbfe9ff, 0.7);
  fill.position.set(5, 2, 6);
  scene.add(fill);

  // ── The Dart mark, split into its five facets (coordinates in the
  //    logo's own 502.87-unit square, y pointing down like SVG).
  var SIZE = 502.87;
  var HALF = SIZE / 2;
  var UNIT = 3.1 / SIZE; // the logo is ~3.1 world units wide
  var FACETS = [
    { color: 0x01579B, pts: [[86.01, 86.01], [86.01, 347.36], [90, 372], [102.56, 397], [16.58, 314.33], [4, 290], [0, 274.62], [6.62, 251.47]] },
    { color: 0x40C4FF, pts: [[86.01, 86.01], [244.92, 6.62], [274.66, 0], [293, 4], [311.03, 16.58], [397.01, 102.56], [376, 89], [350.7, 85.98]] },
    { color: 0x40C4FF, pts: [[102.56, 397], [120, 413.55], [413.55, 413.55], [413.55, 502.87], [205.11, 502.87]] },
    { color: 0x29B6F6, pts: [[86.01, 86.01], [413.55, 413.55], [120, 413.55], [102.56, 397], [90, 372], [86.01, 347.36]] },
    { color: 0x01579B, pts: [[86.01, 86.01], [350.7, 85.98], [376, 89], [397.01, 102.56], [502.87, 208.4], [502.87, 413.55], [413.55, 413.55]] }
  ];

  var DEPTH = 0.52;
  var BEVEL = 0.035;
  var extrude = {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelOffset: -BEVEL, // keep each block inside its outline so facets sit flush
    bevelSegments: 4
  };

  var logo = new THREE.Group();
  FACETS.forEach(function (facet) {
    var shape = new THREE.Shape();
    facet.pts.forEach(function (p, i) {
      var x = (p[0] - HALF) * UNIT;
      var y = -(p[1] - HALF) * UNIT;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
    shape.closePath();
    var geometry = new THREE.ExtrudeGeometry(shape, extrude);
    geometry.translate(0, 0, -DEPTH / 2);
    var material = new THREE.MeshPhysicalMaterial({
      color: facet.color,
      roughness: 0.36,
      metalness: 0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.28
    });
    logo.add(new THREE.Mesh(geometry, material));
  });

  var floater = new THREE.Group(); // bobs up and down
  floater.add(logo);
  scene.add(floater);

  // ── A tilted orbit with three candy planets
  var orbit = new THREE.Group();
  orbit.rotation.set(Math.PI / 2 - 0.32, 0.22, 0);
  scene.add(orbit);

  var RADIUS = 2.45;
  orbit.add(new THREE.Mesh(
    new THREE.TorusGeometry(RADIUS, 0.014, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0x54C5F8, transparent: true, opacity: 0.55 })
  ));

  var planets = new THREE.Group();
  orbit.add(planets);
  [
    { color: 0xFFD166, size: 0.17, at: 0 },
    { color: 0xFFB3CF, size: 0.13, at: 2.2 },
    { color: 0x7FE3CF, size: 0.1, at: 4.3 }
  ].forEach(function (p) {
    var ball = new THREE.Mesh(
      new THREE.SphereGeometry(p.size, 32, 24),
      new THREE.MeshPhysicalMaterial({ color: p.color, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 })
    );
    ball.position.set(Math.cos(p.at) * RADIUS, Math.sin(p.at) * RADIUS, 0);
    planets.add(ball);
  });

  // ── Sizing
  function resize() {
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);
  resize();

  // ── Interaction: drag to spin, with a little inertia
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var AUTO_SPIN = reduceMotion ? 0 : 0.55; // radians per second
  var REST_PITCH = 0.14;
  var yaw = -0.6;
  var spin = AUTO_SPIN;
  var pitch = REST_PITCH;
  var pitchTarget = REST_PITCH;
  var dragging = false;
  var lastX = 0, lastY = 0, lastT = 0;

  canvas.addEventListener('pointerdown', function (e) {
    dragging = true;
    lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
    spin = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    stage.classList.add('grabbing');
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var now = performance.now();
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    var dt = Math.max(now - lastT, 8) / 1000;
    yaw += dx * 0.011;
    spin = Math.max(-9, Math.min(9, (dx * 0.011) / dt));
    pitchTarget = Math.max(-0.75, Math.min(0.75, pitchTarget + dy * 0.006));
    lastX = e.clientX; lastY = e.clientY; lastT = now;
  });
  function release() {
    if (!dragging) return;
    dragging = false;
    pitchTarget = REST_PITCH;
    stage.classList.remove('grabbing');
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // keyboard: arrow keys nudge the spin
  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { spin = -3; e.preventDefault(); }
    if (e.key === 'ArrowRight') { spin = 3; e.preventDefault(); }
  });

  // ── Render loop (paused while the hero is off-screen)
  var visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }).observe(stage);
  }

  var clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    if (!visible) return;
    var t = clock.elapsedTime;

    if (!dragging) {
      spin += (AUTO_SPIN - spin) * Math.min(1, dt * 1.6);
      yaw += spin * dt;
    }
    pitch += (pitchTarget - pitch) * Math.min(1, dt * 6);

    logo.rotation.y = yaw;
    logo.rotation.x = pitch;
    if (!reduceMotion) {
      floater.position.y = Math.sin(t * 1.3) * 0.1;
      floater.rotation.z = Math.sin(t * 0.9) * 0.03;
      planets.rotation.z = t * 0.5;
    }
    renderer.render(scene, camera);
  }
  frame();
})();
