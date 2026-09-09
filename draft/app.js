(function () {
  'use strict';
  // ---- Wedding config (keep in sync with the date shown in index.html) ----
  var WEDDING_AT = new Date('2027-08-08T17:00:00-04:00'); // Sunday, August 8, 2027, 5:00 PM Toronto time

  var doc = document, root = doc.documentElement, win = window;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var hasGsap = typeof win.gsap !== 'undefined';
  var hasST = hasGsap && typeof win.ScrollTrigger !== 'undefined';
  var reduceMq = win.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = reduceMq.matches;
  var finePointer = win.matchMedia('(pointer: fine)').matches;
  root.classList.add(hasGsap ? 'has-gsap' : 'no-gsap');
  if (hasST) gsap.registerPlugin(ScrollTrigger);

  // ---- Motion state (Pause motion toggle; reduced motion starts paused) ----
  var paused = reduce;
  try { if (!reduce && localStorage.getItem('carpicos-motion') === 'paused') paused = true; } catch (e) {}
  var motionHandlers = [];
  var toggleBtn = $('#motionToggle');
  function setPaused(v, persist) {
    paused = !!v;
    root.classList.toggle('motion-paused', paused);
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      $('span', toggleBtn).textContent = paused ? 'Resume motion' : 'Pause motion';
    }
    motionHandlers.forEach(function (fn) { fn(paused); });
    if (persist) { try { localStorage.setItem('carpicos-motion', paused ? 'paused' : 'on'); } catch (e) {} }
  }
  if (toggleBtn) toggleBtn.addEventListener('click', function () { setPaused(!paused, true); });
  // Track the OS preference live: turning reduced motion on mid-visit pauses everything and drops the curtain.
  // (GSAP's matchMedia context reverts its own tweens; this covers the canvas, flip clock, tilt and the toggle state.)
  var openCurtain = null;
  function onReduceChange(e) {
    reduce = !!e.matches;
    var stored = null; try { stored = localStorage.getItem('carpicos-motion'); } catch (err) {}
    if (reduce && openCurtain) openCurtain();
    setPaused(reduce || stored === 'paused', false);
  }
  if (reduceMq.addEventListener) reduceMq.addEventListener('change', onReduceChange); else if (reduceMq.addListener) reduceMq.addListener(onReduceChange);

  // ---- Nav ----
  var toggle = $('#navToggle'), links = $('#navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    $$('a', links).forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); });
    });
  }
  var sections = $$('main section[id], header[id]');
  var navAnchors = $$('#navLinks a[href^="#"]');
  if ('IntersectionObserver' in window && sections.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navAnchors.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { io.observe(s); });
  }

  // ---- Curtain (CSS does the drawing and the lift; JS only times it and lets people skip) ----
  var curtainOpened = false, curtainCallbacks = [];
  function onCurtainOpen(fn) { if (curtainOpened) fn(); else curtainCallbacks.push(fn); }
  (function () {
    var curtain = $('#curtain');
    function open() {
      if (curtainOpened) return;
      curtainOpened = true;
      root.classList.remove('is-curtained');
      if (curtain) {
        curtain.classList.add('is-open');
        setTimeout(function () { curtain.hidden = true; if (hasST) ScrollTrigger.refresh(); }, 1350);
      }
      curtainCallbacks.forEach(function (fn) { fn(); });
      curtainCallbacks = [];
    }
    openCurtain = open;
    // If this script only ran after the page has been on screen a while (slow CDN ahead of us in the defer chain),
    // the CSS safety animation has already hidden the curtain; do not replay it or lock scrolling.
    var late = false; try { late = performance.now() > 3000; } catch (e) {}
    if (!curtain || reduce || late) { if (curtain) curtain.hidden = true; open(); return; }
    root.classList.add('is-curtained');
    var quick = false;
    try { quick = sessionStorage.getItem('carpicos-seen') === '1'; sessionStorage.setItem('carpicos-seen', '1'); } catch (e) {}
    if (quick) curtain.classList.add('is-quick');
    var timer = setTimeout(open, quick ? 950 : 2250);
    curtain.addEventListener('click', function () { clearTimeout(timer); open(); });
    doc.addEventListener('keydown', function (e) {
      if (curtainOpened) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { clearTimeout(timer); open(); }
    });
  })();

  // ---- Flip countdown ----
  var cd = $('#countdown');
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function buildFlip(b) {
    var v = b.textContent.trim(), parts = {};
    b.textContent = '';
    [['top', 'flip__top'], ['bottom', 'flip__bottom'], ['flapTop', 'flip__flap flip__flap--top'], ['flapBottom', 'flip__flap flip__flap--bottom']].forEach(function (k) {
      var half = doc.createElement('span'); half.className = k[1];
      var txt = doc.createElement('span'); txt.textContent = v; half.appendChild(txt); b.appendChild(half); parts[k[0]] = txt;
    });
    var flipping = false, queued = null, guard = 0;
    function finish() {
      if (!flipping) return;
      clearTimeout(guard);
      parts.bottom.textContent = parts.flapBottom.textContent;
      parts.flapTop.textContent = parts.top.textContent;
      b.classList.remove('is-flipping');
      flipping = false;
      if (queued !== null) { var q = queued; queued = null; set(q); }
    }
    b.addEventListener('animationend', function (e) { if (e.animationName === 'flipBottom') finish(); });
    function set(val, instant) {
      var cur = parts.top.textContent;
      if (val === cur) return;
      if (flipping) { queued = val; return; }
      if (instant || reduce || paused || doc.hidden) {
        parts.top.textContent = parts.bottom.textContent = parts.flapTop.textContent = parts.flapBottom.textContent = val;
        return;
      }
      flipping = true;
      parts.flapTop.textContent = cur;
      parts.flapBottom.textContent = val;
      parts.top.textContent = val;
      b.classList.add('is-flipping');
      guard = setTimeout(finish, 900);
    }
    return { set: set };
  }
  var flips = {};
  if (cd) $$('[data-cd]', cd).forEach(function (b) { flips[b.getAttribute('data-cd')] = buildFlip(b); });
  var first = true;
  function tick() {
    if (!cd) return;
    var diff = WEDDING_AT - new Date();
    if (diff <= 0) { cd.classList.add('is-past'); cd.textContent = 'We are married!'; clearInterval(cdTimer); return; }
    var d = Math.floor(diff / 864e5), h = Math.floor(diff % 864e5 / 36e5), m = Math.floor(diff % 36e5 / 6e4), s = Math.floor(diff % 6e4 / 1e3);
    flips.days.set(pad(d, 2), first); flips.hours.set(pad(h, 2), first); flips.minutes.set(pad(m, 2), first); flips.seconds.set(pad(s, 2), first);
    first = false;
  }
  tick(); var cdTimer = setInterval(tick, 1000);

  // ---- Effects canvas: petals (looping), cursor sparkles and RSVP hearts (transient) ----
  var fx = (function () {
    var canvas = $('#fx');
    if (!canvas || reduce || !canvas.getContext) return { hearts: function () {} };
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1, mobile = false, TAU = Math.PI * 2;
    var petals = [], sparks = [], hearts = [], sprites = [];
    var running = false, rafId = 0, last = 0, t = 0, lastSpark = 0;
    function rand(a, b) { return a + Math.random() * (b - a); }
    var COLORS = [
      ['#F6DEE3', '#E7CBD2', 'rgba(89,54,62,.22)'],
      ['#E7CBD2', '#C9A0AA', 'rgba(89,54,62,.2)'],
      ['#FCF9F7', '#F0DFE4', 'rgba(89,54,62,.3)'],
      ['#DDB9C1', '#AE8390', 'rgba(47,20,22,.2)']
    ];
    function makeSprite(c, blur) {
      var S = 64, cv = doc.createElement('canvas'), k = Math.min(dpr, 2);
      cv.width = cv.height = S * k;
      var g = cv.getContext('2d'); g.scale(k, k); g.translate(S / 2, S / 2);
      if (blur && 'filter' in g) g.filter = 'blur(' + blur + 'px)';
      var grad = g.createLinearGradient(-10, -24, 10, 24); grad.addColorStop(0, c[0]); grad.addColorStop(1, c[1]);
      g.beginPath(); g.moveTo(0, -24); g.bezierCurveTo(19, -20, 20, 12, 0, 25); g.bezierCurveTo(-20, 12, -19, -20, 0, -24); g.closePath();
      g.fillStyle = grad; g.fill(); g.strokeStyle = c[2]; g.lineWidth = 1; g.stroke();
      g.beginPath(); g.moveTo(0, -15); g.quadraticCurveTo(3, 2, 0, 19); g.lineWidth = .7; g.stroke();
      return cv;
    }
    function newPetal(anywhere) {
      var r = Math.random(), depth = r < .38 ? 0 : r < .76 ? 1 : 2;
      return {
        x: rand(-40, W + 40), y: anywhere ? rand(-H, H) : rand(-140, -30),
        s: [rand(9, 14), rand(14, 22), rand(22, 32)][depth], depth: depth,
        vy: [rand(16, 28), rand(28, 46), rand(46, 68)][depth],
        amp: rand(14, 40), freq: rand(.25, .6), ph: rand(0, TAU),
        rot: rand(0, TAU), vr: rand(-.9, .9), ff: rand(.5, 1.4), fp: rand(0, TAU),
        sp: (Math.random() * COLORS.length | 0) * 2 + (depth === 0 ? 1 : 0),
        a: [.38, .62, .85][depth]
      };
    }
    function resize() {
      W = win.innerWidth; H = win.innerHeight; mobile = W < 720;
      dpr = Math.min(win.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!sprites.length) COLORS.forEach(function (c) { sprites.push(makeSprite(c, 0), makeSprite(c, 1.6)); });
      var want = mobile ? 16 : (W > 1400 ? 54 : 42);
      while (petals.length < want) petals.push(newPetal(true));
      if (petals.length > want) petals.length = want;
    }
    function drawPetals(dt) {
      var wind = Math.sin(t * .18) * 22 + Math.sin(t * .47) * 8;
      for (var i = 0; i < petals.length; i++) {
        var p = petals[i];
        p.y += p.vy * dt;
        p.x += (Math.sin(t * p.freq + p.ph) * p.amp * .6 + wind * (.4 + p.depth * .3)) * dt;
        p.rot += p.vr * dt;
        if (p.y > H + 40) { petals[i] = newPetal(false); continue; }
        if (p.x < -70) p.x = W + 60; else if (p.x > W + 70) p.x = -60;
        var sx = Math.max(.18, Math.abs(Math.cos(t * p.ff + p.fp)));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(sx, 1); ctx.globalAlpha = p.a;
        ctx.drawImage(sprites[p.sp], -p.s / 2, -p.s / 2, p.s, p.s); ctx.restore();
      }
    }
    function spawnSpark(x, y) {
      if (sparks.length > 90) return;
      sparks.push({ x: x + rand(-7, 7), y: y + rand(-7, 7), vx: rand(-20, 20), vy: rand(-46, -10), s: rand(3, 7.5), life: 0, ttl: rand(.5, .95), rot: rand(0, TAU), vr: rand(-2, 2), gold: Math.random() < .7 });
    }
    function drawSparks(dt) {
      for (var i = sparks.length - 1; i >= 0; i--) {
        var k = sparks[i]; k.life += dt;
        if (k.life >= k.ttl) { sparks.splice(i, 1); continue; }
        var f = 1 - k.life / k.ttl, s = k.s * (.35 + f * .65);
        k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.vr * dt;
        ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.rot); ctx.globalAlpha = f;
        ctx.fillStyle = k.gold ? '#C9A961' : '#C9A0AA';
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s);
        ctx.fill(); ctx.restore();
      }
    }
    function burstHearts(x, y) {
      var palette = ['#E7CBD2', '#C9A0AA', '#C9A961', '#9B6F7C', '#F6DEE3'];
      for (var i = 0; i < 28 && hearts.length < 160; i++) {
        hearts.push({ x: x + rand(-40, 40), y: y + rand(-12, 12), vx: rand(-90, 90), vy: rand(-330, -150), s: rand(8, 21), rot: rand(-.5, .5), vr: rand(-1.6, 1.6), life: 0, ttl: rand(1.9, 3.1), c: palette[i % palette.length], ph: rand(0, TAU) });
      }
      start();
    }
    function drawHearts(dt) {
      for (var i = hearts.length - 1; i >= 0; i--) {
        var h = hearts[i]; h.life += dt;
        if (h.life >= h.ttl) { hearts.splice(i, 1); continue; }
        var f = h.life / h.ttl; h.vy += 95 * dt;
        h.x += (h.vx + Math.sin(t * 2 + h.ph) * 32) * dt; h.y += h.vy * dt; h.rot += h.vr * dt;
        var s = h.s;
        ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.rot); ctx.globalAlpha = f < .75 ? 1 : (1 - f) / .25;
        ctx.fillStyle = h.c; ctx.beginPath();
        ctx.moveTo(0, s * .35); ctx.bezierCurveTo(-s * .95, -s * .3, -s * .5, -s * .95, 0, -s * .45); ctx.bezierCurveTo(s * .5, -s * .95, s * .95, -s * .3, 0, s * .35);
        ctx.fill(); ctx.restore();
      }
    }
    function frame(ts) {
      if (!running) return;
      var dt = Math.min(.05, (ts - last) / 1000) || 0; last = ts; t += dt;
      ctx.clearRect(0, 0, W, H);
      if (!paused) drawPetals(dt);
      drawSparks(dt); drawHearts(dt);
      if (paused && !sparks.length && !hearts.length) { running = false; ctx.clearRect(0, 0, W, H); return; }
      rafId = requestAnimationFrame(frame);
    }
    function start() { if (running || doc.hidden) return; running = true; last = performance.now(); rafId = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(rafId); }
    resize();
    var rt;
    win.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); }, { passive: true });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); else { start(); } });
    if (finePointer) {
      win.addEventListener('pointermove', function (e) {
        if (paused || mobile || e.pointerType === 'touch') return;
        var now = performance.now(); if (now - lastSpark < 26) return; lastSpark = now;
        spawnSpark(e.clientX, e.clientY); if (Math.random() < .35) spawnSpark(e.clientX, e.clientY);
        start();
      }, { passive: true });
    }
    motionHandlers.push(function (p) { if (!p) start(); });
    start();
    return { hearts: burstHearts };
  })();

  // ---- 3D tilt on the framed photo (desktop pointers only) ----
  (function () {
    var frame = $('#frame'), tilt = $('#frameTilt'), glare = $('.frame__glare');
    if (!frame || !tilt || !finePointer) return;
    var rect = null, raf = 0, px = 0, py = 0, on = false, apply;
    if (hasGsap) {
      // quickTo needs GSAP's canonical property names (rotationX/rotationY); the rotateX alias only works in ordinary tweens
      var ry = gsap.quickTo(tilt, 'rotationY', { duration: .7, ease: 'power3' }), rx = gsap.quickTo(tilt, 'rotationX', { duration: .7, ease: 'power3' });
      var gx = glare ? gsap.quickTo(glare, 'xPercent', { duration: .7, ease: 'power3' }) : null, gy = glare ? gsap.quickTo(glare, 'yPercent', { duration: .7, ease: 'power3' }) : null;
      gsap.set(tilt, { transformPerspective: 1200 });
      apply = function () { ry(px * 9); rx(-py * 9); if (gx) { gx(px * 28); gy(py * 28); } };
    } else {
      apply = function () { tilt.style.transform = 'perspective(1200px) rotateY(' + (px * 9).toFixed(2) + 'deg) rotateX(' + (-py * 9).toFixed(2) + 'deg)'; };
    }
    frame.addEventListener('pointerenter', function () { rect = frame.getBoundingClientRect(); on = true; }, { passive: true });
    frame.addEventListener('pointermove', function (e) {
      if (!on || paused || !rect) return;
      px = ((e.clientX - rect.left) / rect.width - .5) * 2; py = ((e.clientY - rect.top) / rect.height - .5) * 2;
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; apply(); });
    }, { passive: true });
    frame.addEventListener('pointerleave', function () { on = false; px = 0; py = 0; apply(); }, { passive: true });
  })();

  // ---- GSAP motion: hero reveal, scroll reveals, parallax (all inside a reduced-motion aware context) ----
  var parallax = [];
  if (hasGsap) {
    gsap.matchMedia().add({ reduce: '(prefers-reduced-motion: reduce)', ok: '(prefers-reduced-motion: no-preference)' }, function (ctx) {
      if (ctx.conditions.reduce) return;

      // Hero: split the names, then unfold letter by letter once the curtain lifts
      $$('.hero__names .word').forEach(function (w) {
        var text = w.textContent; w.textContent = '';
        for (var i = 0; i < text.length; i++) { var s = doc.createElement('span'); s.className = 'ch'; s.textContent = text.charAt(i); w.appendChild(s); }
      });
      var h1 = $('#heroNames'); if (h1) h1.setAttribute('aria-label', 'Nick & Laura');
      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      tl.from('.hero__names .ch', { yPercent: 110, rotateX: -80, opacity: 0, transformPerspective: 600, duration: 1.15, stagger: { each: .055 }, ease: 'expo.out' }, .15)
        .from('.hero__names .amp', { scale: 0, rotate: -40, opacity: 0, duration: 1, ease: 'back.out(2.2)' }, .6)
        .from('[data-hero]', { y: 24, opacity: 0, duration: .95, stagger: .1 }, .65)
        .from('.hero__rule span', { scaleX: 0, duration: 1, ease: 'power2.inOut' }, .95)
        .from('.cd-unit', { y: 20, rotateX: -35, opacity: 0, transformPerspective: 600, duration: .85, stagger: .08 }, 1.2)
        .from('.hero__scroll', { opacity: 0, y: -10, duration: .8 }, 1.9);
      onCurtainOpen(function () {
        setTimeout(function () { tl.play(); }, 300);
        // Safety net: if the animation ticker was starved (throttled frames, headless renderers) snap the hero to visible.
        // Skipped while the tab is hidden so background-tab visitors still get the full reveal when they come back.
        var ensure = function () {
          if (doc.hidden) {
            doc.addEventListener('visibilitychange', function once() { doc.removeEventListener('visibilitychange', once); setTimeout(ensure, 3500); });
            return;
          }
          if (tl.progress() < 1) tl.progress(1);
        };
        setTimeout(ensure, 3500);
      });

      // Mouse parallax on the toile layers (x only; scroll owns y)
      var cleanups = [];
      var hero = $('.hero');
      if (finePointer && hero) {
        var layers = [$('.hero__toile--a'), $('.hero__toile--b'), $('.hero__toile--c')].filter(Boolean);
        var movers = layers.map(function (l, i) { return gsap.quickTo(l, 'x', { duration: 1.2, ease: 'power2' }); });
        var depths = [18, 34, 10], mraf = 0, mx = 0;
        var onHeroMove = function (e) {
          if (paused) return;
          mx = (e.clientX / win.innerWidth - .5) * 2;
          if (!mraf) mraf = requestAnimationFrame(function () { mraf = 0; movers.forEach(function (fn, i) { fn(mx * depths[i]); }); });
        };
        hero.addEventListener('pointermove', onHeroMove, { passive: true });
        cleanups.push(function () { hero.removeEventListener('pointermove', onHeroMove); cancelAnimationFrame(mraf); mraf = 0; });
      }
      // Returned to gsap.matchMedia: runs when the context reverts (preference flips to reduce) so a flip back does not
      // stack duplicate listeners/observers or re-enable ScrollTriggers that were killed with the context.
      var cleanup = function () { cleanups.forEach(function (fn) { fn(); }); cleanups = []; parallax.length = 0; };

      if (!hasST) return cleanup;

      // Scroll reveals for every section (groups stagger their children)
      $$('[data-reveal]').forEach(function (el) {
        var kids = el.hasAttribute('data-reveal-group') ? Array.prototype.slice.call(el.children) : [el];
        gsap.from(kids, { y: 36, opacity: 0, duration: 1, ease: 'power3.out', stagger: .11, scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
      });
      $$('.ornament').forEach(function (o) {
        var st = { trigger: o, start: 'top 90%', once: true };
        gsap.from($$('span', o), { scaleX: 0, duration: 1.2, ease: 'power3.inOut', scrollTrigger: st });
        gsap.from($('i', o), { scale: 0, rotate: 90, opacity: 0, duration: .9, ease: 'back.out(2)', scrollTrigger: st });
      });

      // Photo band: frame swings in, monogram line-draws, image and toile parallax
      var band = $('.photo-band'), frameEl = $('.frame');
      if (band && frameEl) {
        gsap.from(frameEl, { scale: .88, y: 70, rotateX: 12, opacity: 0, transformPerspective: 1200, duration: 1.5, ease: 'power3.out', scrollTrigger: { trigger: frameEl, start: 'top 88%', once: true } });
        var mono = $$('.frame .mono [pathLength]');
        if (mono.length) gsap.fromTo(mono, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, stagger: .07, ease: 'power2.inOut', scrollTrigger: { trigger: frameEl, start: 'top 80%', once: true } });
        var thru = { trigger: band, start: 'top bottom', end: 'bottom top', scrub: true };
        parallax.push(gsap.fromTo($$('.frame__img, .frame__placeholder'), { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: thru }).scrollTrigger);
        parallax.push(gsap.fromTo('.photo-band__toile', { y: -70 }, { y: 70, ease: 'none', scrollTrigger: thru }).scrollTrigger);
      }

      // Hero parallax: three toile layers drift at different rates, content eases up and fades
      var heroSt = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
      [['.hero__toile--a', -90], ['.hero__toile--b', -170], ['.hero__toile--c', -40]].forEach(function (p) {
        if ($(p[0])) parallax.push(gsap.to(p[0], { y: p[1], ease: 'none', scrollTrigger: heroSt }).scrollTrigger);
      });
      parallax.push(gsap.to('#heroInner', { y: 90, opacity: .15, ease: 'none', scrollTrigger: heroSt }).scrollTrigger);

      // Layout changes after load (RSVP form -> thank-you card, guest boxes, Q&A toggles, menu) shift every trigger below them
      var refreshTimer = 0;
      var refreshSoon = function () { clearTimeout(refreshTimer); refreshTimer = setTimeout(function () { ScrollTrigger.refresh(); }, 120); };
      if ('ResizeObserver' in win) { var ro = new ResizeObserver(refreshSoon); ro.observe(doc.body); cleanups.push(function () { ro.disconnect(); clearTimeout(refreshTimer); }); }
      else { doc.addEventListener('toggle', refreshSoon, true); cleanups.push(function () { doc.removeEventListener('toggle', refreshSoon, true); clearTimeout(refreshTimer); }); }
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { ScrollTrigger.refresh(); });
      win.addEventListener('load', function () { ScrollTrigger.refresh(); }, { once: true });
      return cleanup;
    });
  }
  // Pause motion rests the scrub parallax (revert to start); resume re-enables it. Registered once, outside the media context.
  motionHandlers.push(function (p) { parallax.forEach(function (st) { if (p) st.disable(true); else st.enable(); }); });

  setPaused(paused, false);

  // ---- RSVP (posts straight to a Google Form owned by Nick and Laura; responses land in their Google Sheet) ----
  var FORM = {
    action: 'https://docs.google.com/forms/d/e/1FAIpQLSdivNTNjqTSrxRYFbhhbxlwK-mMoANwgZj4SiTOOfdq0FJp4Q/formResponse',
    fallback: 'https://docs.google.com/forms/d/e/1FAIpQLSdivNTNjqTSrxRYFbhhbxlwK-mMoANwgZj4SiTOOfdq0FJp4Q/viewform',
    fields: { name: 'entry.521357415', email: 'entry.1157304710', attending: 'entry.686622912', extra: 'entry.941261820',
              guest1: 'entry.1562040421', guest2: 'entry.1004882003', guest3: 'entry.2082170761', guest4: 'entry.272580214',
              dietary: 'entry.694190378', song: 'entry.1258660614', message: 'entry.215218613' },
    maxGuests: 4,
    attendingLabels: { yes: 'Joyfully accepts', no: 'Regretfully declines' }
  };
  var form = $('#rsvpForm');
  if (!form) return;
  var attendingOnly = $('#attendingOnly'), msg = $('#formMsg'), submit = $('#rsvpSubmit');
  var done = $('#rsvpDone'), doneTitle = $('#doneTitle'), doneText = $('#doneText');
  var fallbackLink = $('#rsvpFallback');
  if (fallbackLink && FORM.fallback.indexOf('__') !== 0) fallbackLink.href = FORM.fallback;

  var extraSel = $('#extra'), guestBox = $('#guestNames');
  function renderGuestFields() {
    var n = parseInt(extraSel.value, 10) || 0;
    var current = {};
    $$('input', guestBox).forEach(function (i) { current[i.name] = i.value; });
    guestBox.innerHTML = '';
    for (var k = 1; k <= n; k++) {
      var wrap = document.createElement('div'); wrap.className = 'field';
      var lab = document.createElement('label'); lab.setAttribute('for', 'guest' + k); lab.textContent = 'Guest ' + k + ' full name';
      var req = document.createElement('span'); req.className = 'req'; req.textContent = ' *'; lab.appendChild(req);
      var inp = document.createElement('input'); inp.type = 'text'; inp.id = 'guest' + k; inp.name = 'guest' + k; inp.maxLength = 120; inp.setAttribute('aria-required', 'true');
      inp.autocomplete = 'off'; inp.placeholder = 'First and last name'; inp.value = current['guest' + k] || '';
      var err = document.createElement('small'); err.className = 'err'; err.id = 'err-guest' + k; err.setAttribute('data-err', 'guest' + k);
      wrap.appendChild(lab); wrap.appendChild(inp); wrap.appendChild(err); guestBox.appendChild(wrap);
    }
    guestBox.hidden = n === 0;
  }
  extraSel.addEventListener('change', renderGuestFields);
  renderGuestFields();

  function syncAttending() {
    var v = (form.querySelector('input[name="attending"]:checked') || {}).value;
    attendingOnly.hidden = v === 'no';
  }
  $$('input[name="attending"]', form).forEach(function (r) { r.addEventListener('change', syncAttending); });
  syncAttending();

  function setError(name, text) {
    var el = form.querySelector('[data-err="' + name + '"]');
    if (el) { el.textContent = text || ''; if (!el.id) el.id = 'err-' + name; }
    var field = el && el.closest('.field');
    if (field) field.classList.toggle('has-error', !!text);
    var input = form.querySelector('[name="' + name + '"]');
    if (input && input.type !== 'radio') {
      if (text) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', el ? el.id : ''); }
      else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
    }
  }
  function clearErrors() { $$('[data-err]', form).forEach(function (el) { setError(el.getAttribute('data-err'), ''); }); msg.textContent = ''; msg.classList.remove('is-error'); }

  function showDone(data) {
    var first = (data.name || '').trim().split(/\s+/)[0] || 'friend';
    form.hidden = true; done.hidden = false;
    if (data.attending === 'yes') {
      doneTitle.textContent = 'See you there, ' + first + '!';
      doneText.textContent = 'Your RSVP is in. We cannot wait to celebrate with you on August 8, 2027. Keep an eye on this site for the full timeline as the day gets closer.';
    } else {
      doneTitle.textContent = 'Thank you, ' + first;
      doneText.textContent = 'We are sorry you cannot make it, but we are so grateful you let us know. You will be in our thoughts on the day.';
    }
    done.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    // Draft-only flourish: the thank-you card pops in and hearts float up from it
    if (hasGsap && !reduce) gsap.from(done, { scale: .92, y: 24, opacity: 0, duration: .9, ease: 'back.out(1.6)' });
    if (!paused) setTimeout(function () {
      var r = done.getBoundingClientRect();
      fx.hearts(Math.max(40, Math.min(win.innerWidth - 40, r.left + r.width / 2)), Math.max(40, Math.min(win.innerHeight - 40, r.top + r.height / 2)));
    }, 600);
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    clearErrors();
    var data = {};
    $$('input, select, textarea', form).forEach(function (el) {
      if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; return; }
      data[el.name] = el.value;
    });
    if (data.website) { showDone(data); return; } // honeypot: bots see success, nothing is sent
    var errors = {};
    if (!data.name || data.name.trim().length < 2) errors.name = 'Please enter your full name.';
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) errors.email = 'Please enter a valid email address.';
    if (!data.attending) errors.attending = 'Please let us know if you can make it.';
    var extra = data.attending === 'yes' ? (parseInt(data.extra, 10) || 0) : 0;
    for (var g = 1; g <= extra; g++) {
      if (!data['guest' + g] || data['guest' + g].trim().length < 2) errors['guest' + g] = 'Please enter this guest\'s full name.';
    }
    if (Object.keys(errors).length) {
      Object.keys(errors).forEach(function (k) { setError(k, errors[k]); });
      var first = form.querySelector('.has-error input, .has-error textarea, .has-error select, fieldset.has-error input');
      if (first) first.focus();
      return;
    }
    if (FORM.action.indexOf('__') === 0) { msg.textContent = 'The RSVP form is not connected yet. Please try again later.'; msg.classList.add('is-error'); return; }
    submit.disabled = true; msg.textContent = 'Sending…';
    var body = new URLSearchParams();
    body.append(FORM.fields.name, data.name.trim());
    body.append(FORM.fields.email, data.email.trim());
    body.append(FORM.fields.attending, FORM.attendingLabels[data.attending]);
    body.append(FORM.fields.extra, String(extra));
    for (var q = 1; q <= FORM.maxGuests; q++) {
      var key = FORM.fields['guest' + q];
      if (key && key.indexOf('__') !== 0) body.append(key, q <= extra ? (data['guest' + q] || '').trim() : '');
    }
    body.append(FORM.fields.dietary, data.attending === 'yes' ? (data.dietary || '') : '');
    body.append(FORM.fields.song, data.attending === 'yes' ? (data.song || '') : '');
    body.append(FORM.fields.message, data.message || '');
    fetch(FORM.action, { method: 'POST', mode: 'no-cors', body: body })
      .then(function () { showDone(data); })
      .catch(function () { msg.textContent = 'We could not send your RSVP. Please check your connection and try again, or use the backup form link below.'; msg.classList.add('is-error'); })
      .then(function () { submit.disabled = false; if (msg.textContent === 'Sending…') msg.textContent = ''; });
  });
})();
