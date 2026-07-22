(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  if (reduce || coarse) return;

  function isBlankHoverTarget(el) {
    if (!el) return true;
    return !el.closest(
      'a, button, input, textarea, select, label, [role="button"], .card-pf, #kc-logo, #kc-logo-wrapper, .alert'
    );
  }

  var canvas = document.createElement('canvas');
  canvas.className = 'scanny-cursor-field';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var mouse = { x: -9999, y: -9999, active: false };
  var raf = 0;
  var w = 0;
  var h = 0;
  var particles = [];

  var colors = [
    '139, 92, 246',
    '236, 72, 153',
    '56, 189, 248',
    '251, 146, 60',
  ];

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var count = Math.min(90, Math.floor((w * h) / 18000));
    particles = [];
    for (var i = 0; i < count; i++) {
      var base = 1.2 + Math.random() * 1.8;
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: base,
        base: base,
      });
    }
  }

  function onMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = isBlankHoverTarget(e.target);
  }

  function onLeave() {
    mouse.active = false;
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    for (var pi = 0; pi < particles.length; pi++) {
      var p = particles[pi];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;

      if (mouse.active) {
        var dx = mouse.x - p.x;
        var dy = mouse.y - p.y;
        var dist = Math.hypot(dx, dy) || 1;
        var radius = 160;
        if (dist < radius) {
          var force = (1 - dist / radius) * 0.085;
          p.vx += dx * force * 0.04 - dy * force * 0.03;
          p.vy += dy * force * 0.04 + dx * force * 0.03;
          p.r = p.base + (1 - dist / radius) * 2.2;
        } else {
          p.r += (p.base - p.r) * 0.08;
        }
      } else {
        p.r += (p.base - p.r) * 0.08;
      }

      p.vx *= 0.96;
      p.vy *= 0.96;
      p.vx += (Math.random() - 0.5) * 0.02;
      p.vy += (Math.random() - 0.5) * 0.02;
    }

    for (var i = 0; i < particles.length; i++) {
      var a = particles[i];
      for (var j = i + 1; j < particles.length; j++) {
        var b = particles[j];
        var ldx = a.x - b.x;
        var ldy = a.y - b.y;
        var ldist = Math.hypot(ldx, ldy);
        if (ldist > 110) continue;
        var nearCursor =
          mouse.active &&
          Math.hypot((a.x + b.x) / 2 - mouse.x, (a.y + b.y) / 2 - mouse.y) < 180;
        if (!nearCursor && ldist > 70) continue;
        var alpha = nearCursor ? 0.22 * (1 - ldist / 110) : 0.08 * (1 - ldist / 70);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = 'rgba(99, 102, 241, ' + alpha + ')';
        ctx.lineWidth = nearCursor ? 1.2 : 0.7;
        ctx.stroke();
      }
    }

    for (var k = 0; k < particles.length; k++) {
      var dot = particles[k];
      var near = mouse.active
        ? Math.max(0, 1 - Math.hypot(dot.x - mouse.x, dot.y - mouse.y) / 160)
        : 0;
      var rgb = colors[k % colors.length];
      var dotAlpha = 0.2 + near * 0.55;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + rgb + ', ' + dotAlpha + ')';
      ctx.fill();
      if (near > 0.35) {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r * 3.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + rgb + ', ' + near * 0.12 + ')';
        ctx.fill();
      }
    }

    if (mouse.active) {
      var g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 90);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(0.35, 'rgba(167,139,250,0.16)');
      g.addColorStop(1, 'rgba(167,139,250,0)');
      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(mouse.x, mouse.y, 90, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', onMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
})();
