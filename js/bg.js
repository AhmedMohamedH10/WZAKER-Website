/* خلفية الحلقات: حلقات هادية بتطفو ببطء وبتبعد برفق عن مؤشر الماوس وترجع لمكانها بنعومة */
(() => {
  const cv = document.getElementById("bg");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  /* الهواتف (اللمس) أو تقليل الحركة: رسم ثابت من غير حركة، علشان البطارية والأداء */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(pointer: coarse)").matches;
  const RGB = "61,255,163";
  const rnd = (a, b) => a + Math.random() * (b - a);
  let W = 0, H = 0, dpr = 1, rings = [], raf = 0, last = 0;
  const m = { x: 0, y: 0, tx: 0, ty: 0, on: false, px: 0, py: 0, tpx: 0, tpy: 0 };

  function size() {
    const w = innerWidth, h = innerHeight, rebuild = true;
    W = w; H = h; dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (rebuild) build();
    if (reduce) draw(0, 0);
  }

  /* نفس الحلقات التلاتة الأصلية (مكانها ومقاسها)، بس بتتحرك مع الماوس برفق */
  function build() {
    const v = Math.min(W, H) / 100;
    const defs = [
      { x: 13 * v, y: 11 * v, r: 23 * v, d: .6, glow: false },
      { x: W - 7 * v, y: H - 23 * v, r: 15 * v, d: 1, glow: true },
      { x: .22 * W + 9 * v, y: H - 3 * v, r: 9 * v, d: .8, glow: false }
    ];
    rings = defs.map((g, i) => ({
      hx: g.x, hy: g.y, x: g.x, y: g.y, d: g.d, r: g.r, glow: g.glow,
      ph: i * 2.1, sp: .06 + i * .02, amp: 8 + i * 3, a: .17, boost: 0
    }));
  }

  function draw(t, dt) {
    ctx.clearRect(0, 0, W, H);
    const ft = t / 1000;
    const kc = 1 - Math.exp(-dt * 6), kp = 1 - Math.exp(-dt * 2.2), kb = 1 - Math.exp(-dt * 3);
    if (m.on) { m.x += (m.tx - m.x) * kc; m.y += (m.ty - m.y) * kc; }
    m.px += (m.tpx - m.px) * (1 - Math.exp(-dt * 2)); m.py += (m.tpy - m.py) * (1 - Math.exp(-dt * 2));

    for (const g of rings) {
      let tx = g.hx, ty = g.hy, near = 0;
      if (!reduce) {
        tx += Math.sin(ft * g.sp * 6.283 + g.ph) * g.amp + m.px * g.d * 18;
        ty += Math.cos(ft * g.sp * 5 + g.ph) * g.amp + m.py * g.d * 18;
        if (m.on) {
          const dx = g.x - m.x, dy = g.y - m.y, dist = Math.hypot(dx, dy) || 1, R = 200 + g.r * .6;
          if (dist < R) {
            const k = 1 - dist / R, f = k * k * (3 - 2 * k);
            near = k; tx += dx / dist * f * 90 * g.d; ty += dy / dist * f * 90 * g.d;
          }
        }
        g.x += (tx - g.x) * kp; g.y += (ty - g.y) * kp;
        g.boost += (near - g.boost) * kb;
      }
      const rr = g.r * (1 + g.boost * .08);
      if (g.glow) {
        const gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, rr);
        gr.addColorStop(0, `rgba(${RGB},${.06 + g.boost * .06})`); gr.addColorStop(1, `rgba(${RGB},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(g.x, g.y, rr, 0, 6.2832); ctx.fill();
      }
      ctx.strokeStyle = `rgba(${RGB},${g.a + g.boost * .25})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(g.x, g.y, rr, 0, 6.2832); ctx.stroke();
    }
  }

  function loop(ts) {
    const dt = Math.min(.05, (ts - last) / 1000 || .016); last = ts;
    draw(ts, dt); raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  addEventListener("pointermove", e => {
    if (!m.on) { m.x = e.clientX; m.y = e.clientY; }
    m.on = true; m.tx = e.clientX; m.ty = e.clientY;
    m.tpx = (e.clientX / W - .5) * -2; m.tpy = (e.clientY / H - .5) * -2;
  }, { passive: true });
  const off = () => { m.on = false; m.tpx = 0; m.tpy = 0; };
  addEventListener("pointerup", e => { if (e.pointerType !== "mouse") off(); }, { passive: true });
  addEventListener("pointercancel", off, { passive: true });
  document.documentElement.addEventListener("mouseleave", off);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  addEventListener("resize", size, { passive: true });

  size(); start();
})();
