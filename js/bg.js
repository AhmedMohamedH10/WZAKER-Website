/* خلفية الزخارف: وردات إسلامية هندسية بتلف ببطء (طبقتين عكس بعض)، بنفس أخضر الموقع، وبتبعد برفق عن مؤشر الماوس */
(() => {
  const cv = document.getElementById("bg");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  /* تقليل الحركة: رسم ثابت. الهواتف (اللمس): حركة هادية بس (دوران + إزاحة مع السكرول) بمعدل 30 فريم علشان البطارية */
  const conn = navigator.connection, lite = !!conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || lite;
  const touch = matchMedia("(pointer: coarse)").matches;
  const FRAME = touch ? 1000 / 30 : 0;
  let sy = 0, tsy = 0, born = 0, scrollAt = -1e9;
  const RGB = "61,255,163", TAU = Math.PI * 2;
  let W = innerWidth, H = innerHeight, dpr = 1, rosettes = [], raf = 0, last = 0;
  const m = { x: 0, y: 0, tx: 0, ty: 0, on: false, px: 0, py: 0, tpx: 0, tpy: 0 };

  /* نقطة على دايرة */
  const pt = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];

  /* نجمة n-ضلع: بتوصل كل k-ـة نقطة (مثلاً 8 و 3 = نجمة ثمانية حادة، 8 و 2 = مربعين متقاطعين) */
  function star(c, n, k, r, rot) {
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const [x, y] = pt(r, rot + (i * k % n) / n * TAU);
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath(); c.stroke();
  }

  /* وردة واحدة متناسقة: كل الرؤوس على نفس الزوايا، فبتلف كلها مع بعض من غير ما الخطوط تتخانق */
  function rosette(c, R, n) {
    const top = -Math.PI / 2, kOut = n === 8 ? 3 : 5;          /* 8: نجمة ثمانية حادة، 12: نجمة اتناشرية */
    /* إطار */
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke();
    c.beginPath(); c.arc(0, 0, R * .955, 0, TAU); c.stroke();
    /* النجمة الكبيرة */
    star(c, n, kOut, R * .9, top);
    /* نجمة تانية مزاحة نص خطوة: بتعمل شبكة متداخلة زي الجِرِه الإسلامية */
    c.globalAlpha = .5;
    star(c, n, kOut, R * .78, top + Math.PI / n);
    /* حلقة أقواس صغيرة على الإطار */
    c.globalAlpha = .6;
    for (let i = 0; i < n * 2; i++) {
      const a = i / (n * 2) * TAU + top, [x1, y1] = pt(R * .955, a - .5 / n), [x2, y2] = pt(R * .955, a + .5 / n), [cx, cy] = pt(R * .985, a);
      c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y2); c.stroke();
    }
    /* مربعين متقاطعين (خاتم سليمان الثمانية) أو سداسيين لو 12 */
    c.globalAlpha = .8;
    star(c, n, 2, R * .62, top);
    star(c, n, 2, R * .62, top + TAU / n);
    /* بتلات: دواير صغيرة بين رؤوس النجمة */
    c.globalAlpha = .55;
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(R * .4, i / n * TAU + top + Math.PI / n);
      c.beginPath(); c.arc(x, y, R * .2, 0, TAU); c.stroke();
    }
    /* حلقة داخلية رفيعة */
    c.globalAlpha = .4;
    c.beginPath(); c.arc(0, 0, R * .3, 0, TAU); c.stroke();
    /* القلب */
    c.globalAlpha = .9;
    c.beginPath(); c.arc(0, 0, R * .17, 0, TAU); c.stroke();
    star(c, n, n === 8 ? 3 : 5, R * .17, top);
    c.beginPath(); c.arc(0, 0, R * .03 + .6, 0, TAU); c.fill();
    c.globalAlpha = 1;
  }

  /* حلقة نقط خفيفة بتلف عكس الوردة */
  function dots(c, R, n) {
    for (let i = 0; i < n * 2; i++) {
      const [x, y] = pt(R * 1.045, i / (n * 2) * TAU);
      c.beginPath(); c.arc(x, y, i % 2 ? .9 : 1.5, 0, TAU); c.fill();
    }
  }

  /* بنرسم كل طبقة مرة واحدة على canvas صغير، وبعدين بنلفه بس (أخف بكتير من إعادة الرسم كل فريم) */
  function sprite(R, n, fn, alpha) {
    const s = document.createElement("canvas"), pad = 6, S = Math.ceil((R + pad) * 2 * dpr);
    s.width = s.height = S;
    const c = s.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, S / 2, S / 2);
    c.strokeStyle = `rgba(${RGB},${alpha})`; c.fillStyle = `rgba(${RGB},${alpha})`;
    c.lineWidth = 1; c.lineJoin = "round";
    fn(c, R, n);
    return s;
  }

  function size() {
    W = innerWidth; dpr = Math.min(touch ? 1.5 : 2, devicePixelRatio || 1);
    /* الموبايل: الارتفاع بيثبت على أكبر ارتفاع للشاشة (والشريط مخفي) علشان الدواير ما تتمطّش ولا تتغير وقت السكرول */
    H = touch ? Math.max(innerHeight, Math.min(screen.height || innerHeight, Math.round(innerHeight * 1.25))) : innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.cssText = `position:fixed;left:0;top:0;right:auto;bottom:auto;width:${W}px;height:${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    build();
    if (reduce) draw(0, 0);
  }

  /* نفس أماكن الحلقات الأصلية (ركن فوق شمال، يمين تحت، تحت شمال)، بس زخارف بدل دوائر فاضية */
  function build() {
    const v = Math.min(W, H) / 100 * (touch ? 1.25 : 1);
    const defs = [
      { x: 13 * v, y: 11 * v, r: 25 * v, n: 8,  d: .6, a: .17, glow: false, s1: .006, s2: -.010 },
      { x: W - 7 * v, y: H - 23 * v, r: 17 * v, n: 12, d: 1, a: .20, glow: true,  s1: -.007, s2: .012 },
      { x: .22 * W + 9 * v, y: H - 3 * v, r: 11 * v, n: 8, d: .8, a: .15, glow: false, s1: .008, s2: -.013 }
    ];
    rosettes = defs.map((g, i) => ({
      hx: g.x, hy: g.y, x: g.x, y: g.y, d: g.d, r: g.r, glow: g.glow, a: g.a,
      s1: g.s1, s2: g.s2, ph: i * 2.1, sp: .06 + i * .02, amp: 8 + i * 3, boost: 0,
      o: sprite(g.r, g.n, rosette, g.a), i: sprite(g.r, g.n, dots, g.a * 1.3)
    }));
  }

  function spin(img, x, y, ang, alpha, sc = 1) {
    const h = img.width / dpr / 2;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc);
    ctx.drawImage(img, -h, -h, h * 2, h * 2); ctx.restore();
  }

  function draw(t, dt) {
    ctx.clearRect(0, 0, W, H);
    const ft = t / 1000;
    const kc = 1 - Math.exp(-dt * 6), kp = 1 - Math.exp(-dt * 2.2), kb = 1 - Math.exp(-dt * 3);
    if (m.on) { m.x += (m.tx - m.x) * kc; m.y += (m.ty - m.y) * kc; }
    m.px += (m.tpx - m.px) * (1 - Math.exp(-dt * 2)); m.py += (m.tpy - m.py) * (1 - Math.exp(-dt * 2));
    if (!touch) { tsy = scrollY; sy += (tsy - sy) * (1 - Math.exp(-dt * 14)); }   /* الموبايل: الخلفية ثابتة مع السكرول (أنعم وأخف) */
    const intro = reduce ? 1 : Math.min(1, (t - born) / 1800), ease = 1 - Math.pow(1 - intro, 3);   /* ظهور تدريجي أول ما الصفحة تفتح */

    for (const g of rosettes) {
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
      if (g.glow) {
        const gr = ctx.createRadialGradient(g.x, g.y - sy * g.d * .06, 0, g.x, g.y - sy * g.d * .06, g.r);
        gr.addColorStop(0, `rgba(${RGB},${.07 + g.boost * .06})`); gr.addColorStop(1, `rgba(${RGB},0)`);
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(g.x, g.y - sy * g.d * .06, g.r, 0, TAU); ctx.fill();
      }
      const shimmer = reduce ? 1 : .88 + .12 * Math.sin(ft * .7 + g.ph * 2);   /* نبض نور هادي */
      const al = (1 + g.boost * 1.2) * shimmer * ease;   /* تنوّر بهدوء لما الماوس يقرّب */
      const sc = .94 + .06 * ease;
      const gy = g.y - sy * g.d * .06;   /* إزاحة خفيفة مع السكرول، بتتبع الإصبع مباشرة */
      spin(g.o, g.x, gy, ft * g.s1 * TAU, Math.min(1, al), sc);
      spin(g.i, g.x, gy, ft * g.s2 * TAU, Math.min(1, al), sc);
    }
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (touch && ts - scrollAt < 160) { last = ts; return; }   /* الموبايل: بنوقّف الرسم وقت السكرول علشان الصفحة تمشي بدون تقطيع، والدوران البطيء مش بيبان */
    if (FRAME && ts - last < FRAME - 2) return;
    const dt = Math.min(.05, (ts - last) / 1000 || .016); last = ts;
    draw(ts, dt);
  }
  function start() { if (!raf && !reduce) { last = performance.now(); if (!born) born = last; raf = requestAnimationFrame(loop); } }
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
  addEventListener("scroll", () => { scrollAt = performance.now(); }, { passive: true });
  /* على الموبايل شريط المتصفح بيطلع وينزل وقت السكرول ويغيّر الارتفاع بس: منعيدش بناء الزخارف وقتها */
  addEventListener("resize", () => { if (touch && Math.abs(innerWidth - W) < 2) return; size(); }, { passive: true });

  const go = () => { size(); start(); };
  "requestIdleCallback" in window ? requestIdleCallback(go, { timeout: 800 }) : setTimeout(go, 200);   // بعد ما المحتوى يظهر، علشان النت الضعيف
})();
