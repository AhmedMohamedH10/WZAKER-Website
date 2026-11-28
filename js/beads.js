/* سبحة الزمرد: نفس شكل وفيزياء التطبيق (16 خرزة، زنبرك + تصادم + تدحرج + هزّة + موجة الإتمام).
   الخرزة بتترسم مرة واحدة كصورة جاهزة (sprite) وبعدين كل فريم = drawImage بس، والحركة بتشتغل وقت الضغط وبس.
   الأجهزة الضعيفة: دقة أقل + خطوات فيزياء أقل + من غير توهّج سفلي، وبتتفعّل لوحدها لو الفريمات بطيّأت.
   الواجهة: WZ_beads.set(n) = إجمالي التسبيحات | WZ_beads.ripple() = موجة إتمام اللفّة */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const base = $("beads-b"), cv = $("beads"), tap = $("tap");
  if (!base || !cv || !tap || !base.getContext) { window.WZ_beads = { set() {}, ripple() {} }; return; }

  // ───── ثوابت (نفس التطبيق) ─────
  const N = 16, STEP = 360 / N, TAU = Math.PI * 2;
  const R = 120, RR = R * 0.841, BK = 0.127, BR = R * BK;                 // نصف قطر الدايرة | الحبل | الخرزة (وحدة 240px)
  const CSS = 300, C = CSS / 2, EXT = 1.25; let SHK = 240 / 176, k = 1;      // حجم الكانفاس (فيه مكان للتوهّج) | مدى الصورة | معامل الهزّة
  const MIN_SEP = 2 * BK / 0.841 * 180 / Math.PI, ROLL = 0.841 / BK;
  const K_SPRING = 150, K_DAMP = 9, K_REST = 0.72, K_KICK = 190, K_SPIN = 560;
  const PAL = [["#22B574", "#0B6E45", "#032B1B"], ["#1CAA6B", "#095F3C", "#022417"], ["#1BA882", "#0A5E49", "#03281F"], ["#26B97A", "#0C6B43", "#032A1A"]];
  const ACC = "61,255,163";

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 2;
  let dpr = Math.min(window.devicePixelRatio || 1, weak ? 1.5 : 2), sub = weak ? 2 : 4, fancy = !weak, degraded = false;

  // ───── الحالة ─────
  const th = new Float32Array(N), vel = new Float32Array(N), spin = new Float32Array(N), spinV = new Float32Array(N);
  const glow = new Float32Array(N), glowOut = new Float32Array(N);
  const sp = [0, 0, 0], sv = [0, 0, 0];
  let shDir = 1, rippleT = -1, pulseT = -1, taps = 0, start = (Math.random() * N) | 0, inited = false, vis = true;
  let raf = 0, last = 0, slow = 0, frames = 0;

  const targets = () => {                                           // اللي اتعدّ في اللفّة = 0.5 | الحالية = 1 | الباقي 0
    const cur = (start + taps) % N, a = taps % N, t = new Array(N);
    for (let i = 0; i < N; i++) { const b = ((cur - i) % N + N) % N; t[i] = b === 0 ? 1 : b <= a ? 0.5 : 0; }
    return t;
  };

  // ───── صور جاهزة ─────
  let unit = 64, px = 160, spr = null;
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
  const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${a})`;
  function rad(g, x, y, r, stops) { const q = g.createRadialGradient(x, y, 0, x, y, r); for (const s of stops) q.addColorStop(s[0], s[1]); return q; }
  function sprite(draw) { const c = mk(px, px), g = c.getContext("2d"); g.translate(px / 2, px / 2); g.scale(unit, unit); draw(g); return c; }

  function body(v) {
    return sprite(g => {
      const r = rng(v * 7919 + 211), p = PAL[v % 4];
      g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fillStyle = rad(g, -0.15, -0.2, 2.2, [[0, p[0]], [0.58, p[1]], [1, p[2]]]); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.clip();
      for (let k = 0; k < 8; k++) {                                  // سحب رخامية فاتحة وغامقة
        const x = (r() - .5) * 1.7, y = (r() - .5) * 1.7, rd = .30 + r() * .42;
        const col = k % 2 === 0 ? [1, 20, 12, .38 + r() * .24] : [90, 235, 165, .10 + r() * .10];
        g.fillStyle = rad(g, x, y, rd, [[0, rgba(...col)], [1, rgba(col[0], col[1], col[2], 0)]]);
        g.beginPath(); g.arc(x, y, rd, 0, TAU); g.fill();
      }
      const vein = (col, w, lit) => {                                // عروق (المنوّرة ليها هالتين)
        const a1 = r() * TAU, a2 = a1 + Math.PI + (r() - .5) * 1.4, m = () => [(r() - .5) * 1.2, (r() - .5) * 1.2], m1 = m(), m2 = m();
        g.beginPath(); g.moveTo(Math.cos(a1) * 1.12, Math.sin(a1) * 1.12);
        g.bezierCurveTo(m1[0], m1[1], m2[0], m2[1], Math.cos(a2) * 1.12, Math.sin(a2) * 1.12);
        g.lineCap = "round";
        const s = (ww, c) => { g.lineWidth = ww; g.strokeStyle = c; g.stroke(); };
        if (lit) { s(w * 4.2, rgba(70, 255, 170, .16)); s(w * 2.2, rgba(120, 255, 200, .22)); s(w * .8, col); } else s(w, col);
      };
      for (let k = 0; k < 4; k++) vein(rgba(215, 255, 238, .45 + r() * .2), .05 + r() * .03, true);
      for (let k = 0; k < 2; k++) vein(rgba(0, 14, 8, (.55 + r() * .2) * .7), .055 + r() * .045, false);
      for (let k = 0; k < 40; k++) {                                 // حبيبات
        g.fillStyle = r() < .5 ? "rgba(210,255,234,.25)" : "rgba(0,0,0,.53)";
        g.beginPath(); g.arc((r() - .5) * 2, (r() - .5) * 2, .025 + r() * .035, 0, TAU); g.fill();
      }
      g.restore();
    });
  }
  function light() {                                                 // الإضاءة الثابتة + التلميع
    return sprite(g => {
      const disc = (fill) => { g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fillStyle = fill; g.fill(); };
      disc(rad(g, 0, .1, 1.9, [[0, rgba(40, 200, 125, .30)], [.6, rgba(30, 170, 105, .12)], [1, rgba(30, 170, 105, 0)]]));
      disc(rad(g, -.3, -.38, 2.24, [[0, "rgba(0,0,0,0)"], [.5, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,.72)"]]));
      disc(rad(g, -.42, -.5, 1.16, [[0, "rgba(232,255,244,.30)"], [.6, "rgba(232,255,244,.08)"], [1, "rgba(232,255,244,0)"]]));
      g.fillStyle = "rgba(255,255,255,.7)"; g.beginPath(); g.arc(-.38, -.46, .1, 0, TAU); g.fill();
      g.fillStyle = "rgba(255,255,255,.5)"; g.beginPath(); g.arc(-.2, -.6, .035, 0, TAU); g.fill();
      g.lineCap = "round";
      g.beginPath(); g.arc(0, 0, .88, .35, 1.6); g.strokeStyle = rgba(61, 255, 163, .3); g.lineWidth = .075; g.stroke();
      g.beginPath(); g.arc(0, 0, .985, 0, TAU); g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = .035; g.stroke();
      g.save(); g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.clip();      // تلميع الزمرد: ضوء ناعم من تحت + هلال لمعة
      g.beginPath(); g.arc(0, .62, .7, 0, TAU); g.fillStyle = rad(g, 0, .62, .7, [[0, rgba(61, 255, 163, .22)], [.45, rgba(61, 255, 163, .11)], [1, rgba(61, 255, 163, 0)]]); g.fill();
      g.restore();
      g.beginPath(); g.arc(0, 0, .82, Math.PI * 1.07, Math.PI * 1.49); g.strokeStyle = "rgba(255,255,255,.22)"; g.lineWidth = .04; g.stroke();
    });
  }
  const soft = (r0, stops) => sprite(g => { g.beginPath(); g.arc(0, 0, r0, 0, TAU); g.fillStyle = rad(g, 0, 0, r0, stops); g.fill(); });

  function build() {
    const w = tap.clientWidth || 240; SHK = w / 176;                 // الدايرة بتكبر وتصغر مع الشاشة (٢٤٠ هي المرجع)
    const sz = Math.max(150, Math.round(w * 1.25 * dpr)); k = sz / CSS;
    for (const c of [base, cv]) { c.width = sz; c.height = sz; }
    unit = Math.max(40, Math.min(160, Math.round(BR * k * 2.4 / 4) * 4)); px = Math.ceil(unit * 2 * EXT);
    spr = { body: [], light: light(),
      shadow: soft(1, [[0, "rgba(0,0,0,.65)"], [.6, "rgba(0,0,0,.35)"], [1, "rgba(0,0,0,0)"]]),
      halo: soft(1, [[.30, rgba(61, 255, 163, .5)], [.62, rgba(61, 255, 163, .2)], [1, rgba(61, 255, 163, 0)]]),
      under: soft(1, [[.25, rgba(61, 255, 163, 1)], [.6, rgba(61, 255, 163, .38)], [1, rgba(61, 255, 163, 0)]]) };
    const my = spr, fill = (from) => {                                // الأجسام على دفعات (٤ كل مرة) علشان الجهاز الضعيف ما يتجمّدش
      if (spr !== my) return;
      for (let i = from; i < Math.min(N, from + 4); i++) my.body[i] = body(i * 5 + 1);
      draw();
      if (from + 4 < N) setTimeout(() => fill(from + 4), 16);
    };
    paintBase(); setTimeout(() => fill(0), 0);
  }

  // ───── الطبقة الثابتة: الخيط + الإضاءة الخلفية (بتترسم مرة) ─────
  function paintBase() {
    const g = base.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, CSS, CSS);
    g.beginPath(); g.arc(C, C + R * .012, RR, 0, TAU); g.lineWidth = R * .062; g.strokeStyle = "rgba(0,0,0,.5)"; g.stroke();
    const nt = 640, tw = 52, amp = R * .0125, back = [[], []], front = [[], []];
    for (let s = 0; s < 2; s++) {                                    // فتلة خيطين: أجزاء خلفية وأمامية
      const sg = s ? -1 : 1; let seg = null, wasF = null;
      for (let k = 0; k <= nt; k++) {
        const a = k / nt * TAU, ph = tw * a, rd = RR + sg * amp * Math.sin(ph), isF = sg * Math.cos(ph) > 0, x = C + rd * Math.cos(a), y = C + rd * Math.sin(a);
        if (seg === null || isF !== wasF) { if (seg) seg.push([x, y]); seg = [[x, y]]; (isF ? front : back)[s].push(seg); wasF = isF; } else seg.push([x, y]);
      }
    }
    const stroke = (list, w, col) => { g.lineWidth = w; g.strokeStyle = col; g.lineCap = g.lineJoin = "round"; g.beginPath(); for (const s of list) for (const part of s) { part.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); } g.stroke(); };
    stroke(back[0].concat(back[1]).map(x => [x]), R * .027, "#0A3524");
    const f = front[0].concat(front[1]).map(x => [x]);
    stroke(f, R * .036, "#062417"); stroke(f, R * .030, "#1E9E6A"); stroke(f, R * .0096, "rgba(184,255,224,.6)");
    const out = RR + BR * 2.2;                                       // إضاءة خلفية ناعمة ورا الحبل كله
    g.beginPath(); g.arc(C, C, out, 0, TAU);
    g.fillStyle = rad(g, C, C, out, [[0, rgba(61, 255, 163, 0)], [Math.max(0, (RR - BR * 1.6) / out), rgba(61, 255, 163, 0)], [RR / out, rgba(61, 255, 163, .34)], [1, rgba(61, 255, 163, 0)]]);
    g.fill();
  }

  // ───── رسم الفريم ─────
  const blit = (g, img, cx, cy, s) => g.drawImage(img, cx - EXT * s, cy - EXT * s, 2 * EXT * s, 2 * EXT * s);
  function draw() {
    const g = cv.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, CSS, CSS);
    const pos = [], tg = [];
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + i * TAU / N + th[i] * Math.PI / 180;
      pos.push([C + RR * Math.cos(a), C + RR * Math.sin(a)]); tg.push(a + Math.PI / 2);
    }
    for (let i = 0; i < N; i++) {                                    // الهالات أول (تحت كل الخرز)
      const gl = glowOut[i], [x, y] = pos[i];
      if (fancy) { g.globalAlpha = Math.min(1, .09 + .38 * Math.min(1, gl)); blit(g, spr.under, x, y + BR * .55, BR * 1.9); }
      if (gl > .01) { g.globalAlpha = Math.min(1, gl); blit(g, spr.halo, x, y, BR * 2.1); }
    }
    g.globalAlpha = 1;
    for (let i = 0; i < N; i++) {
      const [x, y] = pos[i], gl = glowOut[i];
      blit(g, spr.shadow, x + BR * .16, y + BR * .3, BR * 1.3);     // ظل
      g.save(); g.translate(x, y); g.rotate((spin[i] + th[i] * ROLL) * Math.PI / 180 + i * 1.3);
      if (spr.body[i]) blit(g, spr.body[i], 0, 0, BR);                // جسم الحجر (بيلف)
      else { g.beginPath(); g.arc(0, 0, BR, 0, TAU); g.fillStyle = PAL[i % 4][1]; g.fill(); }
      g.restore();
      if (gl > .01) {                                                // تفتيح بلون البراند
        g.globalCompositeOperation = "lighter"; g.fillStyle = `rgba(${ACC},${(.16 * gl).toFixed(3)})`;
        g.beginPath(); g.arc(x, y, BR, 0, TAU); g.fill(); g.globalCompositeOperation = "source-over";
      }
      g.save(); g.translate(x, y); g.rotate(tg[i]); g.fillStyle = "rgba(2,7,6,.9)";   // فتحة الخيط
      for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * BR * .93, 0, BR * .1, BR * .22, 0, 0, TAU); g.fill(); }
      g.restore();
      blit(g, spr.light, x, y, BR);                                   // الإضاءة (ثابتة)
      if (gl > .01) { g.beginPath(); g.arc(x, y, BR * .97, 0, TAU); g.lineWidth = BR * .09; g.strokeStyle = `rgba(${ACC},${Math.min(1, .55 * gl).toFixed(3)})`; g.stroke(); }
      const ringA = Math.max(0, Math.min(1, (gl - .5) / .5)) * .85;  // حلقة الخرزة الحالية
      if (ringA > .02) {
        g.beginPath(); g.arc(x, y, BR + R * .019, 0, TAU); g.lineWidth = R * .03; g.strokeStyle = `rgba(${ACC},${(ringA * .2).toFixed(3)})`; g.stroke();
        g.beginPath(); g.arc(x, y, BR + R * .017, 0, TAU); g.lineWidth = R * .014; g.strokeStyle = `rgba(${ACC},${ringA.toFixed(3)})`; g.stroke();
      }
    }
  }

  // ───── الفيزياء ─────
  function shake(s) {
    shDir = -shDir; sv[0] += shDir * 11 * s; sv[1] += 4 * s * (shDir > 0 ? 1 : -.6); sv[2] += -shDir * 21 * s;
    const mx = [16, 11, 30]; for (let a = 0; a < 3; a++) sv[a] = Math.max(-mx[a], Math.min(mx[a], sv[a]));
  }
  function kick() {
    const cur = (start + taps) % N, idx = (cur - 1 + N) % N;
    vel[idx] += K_KICK; spinV[idx] += K_SPIN; shake(1.3); pulseT = 0;
  }
  const KS = [230, 300, 170], ZS = [.55, .6, .5];
  function step(dt) {
    let busy = false;
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (let i = 0; i < N; i++) {
        vel[i] += (-K_SPRING * th[i] - K_DAMP * vel[i]) * h; th[i] += vel[i] * h;
        spin[i] += spinV[i] * h; spinV[i] *= Math.exp(-5 * h);
      }
      for (let a = 0; a < 3; a++) { sv[a] += (-KS[a] * sp[a] - 2 * ZS[a] * Math.sqrt(KS[a]) * sv[a]) * h; sp[a] += sv[a] * h; }
      for (let pass = 0; pass < 2; pass++) {                         // خبطة بين كل خرزتين متجاورتين
        for (let i = 0; i < N; i++) {
          const j = (i + 1) % N, sep = STEP + th[j] - th[i];
          if (sep < MIN_SEP) {
            const ov = (MIN_SEP - sep) / 2; th[i] -= ov; th[j] += ov;
            if (vel[i] > vel[j]) {
              const a = vel[i], c = vel[j];
              vel[i] = ((1 - K_REST) * a + (1 + K_REST) * c) / 2; vel[j] = ((1 + K_REST) * a + (1 - K_REST) * c) / 2;
              const hit = (a - c) / K_KICK; if (hit > .12) shake(Math.min(.55, hit * .5));
            }
          }
        }
      }
    }
    for (let i = 0; i < N; i++) if (Math.abs(th[i]) > .02 || Math.abs(vel[i]) > .2 || Math.abs(spinV[i]) > 1) busy = true;
    for (let a = 0; a < 3; a++) if (Math.abs(sp[a]) > .004 || Math.abs(sv[a]) > .05) busy = true;
    const tg = targets(), k = 1 - Math.exp(-dt / .16);               // التوهّج بيقرّب من هدفه بنعومة
    for (let i = 0; i < N; i++) {
      glow[i] += (tg[i] - glow[i]) * k;
      if (Math.abs(tg[i] - glow[i]) > .01) busy = true; else glow[i] = tg[i];
      glowOut[i] = glow[i];
    }
    if (rippleT >= 0) {                                              // موجة الإتمام: ضوء بيعدّي على الخرز واحدة واحدة
      rippleT += dt; const cur = (start + taps) % N; let any = false;
      for (let q = 0; q < N; q++) {
        const t = (rippleT - q * .034) / .52;
        if (t < 1) any = true;
        if (t > 0 && t < 1) { const u = t < .35 ? t / .35 * .5 : .5 + (t - .35) / .65 * .5, b = Math.sin(Math.PI * u), i = (cur + q) % N; glowOut[i] = glow[i] + (1 - glow[i]) * b; }
      }
      if (any) busy = true; else rippleT = -1;
    }
    return busy;
  }
  function applyShake() {
    let sc = 1;
    if (pulseT >= 0) { sc = 1 + .028 * Math.sin(Math.min(1, pulseT / .32) * Math.PI); }
    tap.style.transform = `translate(${(sp[0] * SHK).toFixed(2)}px,${(sp[1] * SHK).toFixed(2)}px) rotate(${sp[2].toFixed(2)}deg) scale(${sc.toFixed(4)})`;
  }
  function rest() {
    th.fill(0); vel.fill(0); spinV.fill(0); sp[0] = sp[1] = sp[2] = sv[0] = sv[1] = sv[2] = 0; pulseT = -1;
    tap.style.transform = ""; tap.style.willChange = "";
  }

  function degrade() {                                               // الفريمات بطيّأت: نخفّف الرسم (مرة واحدة)
    if (degraded) return; degraded = true; dpr = 1; sub = 2; fancy = false; build(); draw();
  }
  function tick(now) {
    raf = 0;
    const raw = last ? (now - last) / 1000 : .016; last = now;
    const dt = Math.min(.033, raw);
    if (++frames > 8) { slow = raw > .045 ? slow + 1 : Math.max(0, slow - 1); if (slow >= 12) degrade(); }
    if (pulseT >= 0) { pulseT += dt; if (pulseT > .32) pulseT = -1; }
    const busy = step(dt) || pulseT >= 0;
    if (!reduce) applyShake();
    draw();
    if (busy) raf = requestAnimationFrame(tick); else { rest(); draw(); last = 0; frames = 0; slow = 0; }
  }
  function run() {
    if (!vis) return;
    if (!raf) { last = 0; tap.style.willChange = "transform"; raf = requestAnimationFrame(tick); }
  }
  function snap() {
    th.fill(0); vel.fill(0); spinV.fill(0); rippleT = -1;
    const tg = targets(); for (let i = 0; i < N; i++) glow[i] = glowOut[i] = tg[i];
  }

  // ───── الواجهة ─────
  function set(n) {
    n = Math.max(0, n | 0); const d = n - taps; taps = n;
    if (!inited) { inited = true; snap(); draw(); return; }
    if (d > 0 && d <= 3 && vis) { if (!reduce) kick(); run(); }
    else { snap(); rest(); draw(); }
  }
  function ripple() { if (reduce || !vis) return; rippleT = 0; run(); }

  try {
    build(); snap(); draw();
    if ("ResizeObserver" in window) { let lw = tap.clientWidth, rt = 0; new ResizeObserver(() => { const w = tap.clientWidth; if (!w || w === lw) return; lw = w; clearTimeout(rt); rt = setTimeout(() => { build(); draw(); }, 120); }).observe(tap); }
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { vis = es[es.length - 1].isIntersecting; if (vis) { snap(); draw(); } }).observe(tap);
  } catch (e) { window.WZ_beads = { set() {}, ripple() {} }; return; }
  window.WZ_beads = { set, ripple };
})();
