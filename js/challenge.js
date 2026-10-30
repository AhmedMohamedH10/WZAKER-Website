/* تحدي التسبيح: العد محفوظ في المتصفح دايماً (مش بيتصفر)، ويتزامن مع السيرفر لما يكون متاح */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("tap")) return;
  const KEY = "wz_tasbeeh";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const S = { id: null, name: "", total: 0, pending: 0, room: null };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const fromUrl = (new URLSearchParams(location.search).get("c") || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  if (fromUrl.length >= 4) { S.room = fromUrl; save(); }
  const num = n => Number(n).toLocaleString("ar-EG");   // أرقام هندية (٤٨٠)
  const rnd = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  const say = t => { $("msg").textContent = t || ""; };

  async function api(path, body) {
    const r = await fetch("/api/" + path, body
      ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true } : {});
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  // ───── حلقة السبحة: 33 حبة، بتنوّر مع العد وبتكمل دورة كل 33 ─────
  const NS = "http://www.w3.org/2000/svg", BEADS = [];
  (() => {
    const svg = $("beads"), mk = (t, at) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
    svg.append(mk("circle", { class: "ring", cx: 120, cy: 120, r: 117 }));
    for (let i = 0; i < 33; i++) {
      const a = i / 33 * 2 * Math.PI - Math.PI / 2;
      const c = mk("circle", { class: "b", cx: (120 + 104 * Math.cos(a)).toFixed(2), cy: (120 + 104 * Math.sin(a)).toFixed(2), r: i === 0 ? 4 : 3 });
      c.style.setProperty("--i", i); BEADS.push(c); svg.append(c);
    }
  })();
  let lit = -1;
  function paintBeads(n) {
    const k = n > 0 && n % 33 === 0 ? 33 : n % 33;
    if (k === lit) return; lit = k;
    BEADS.forEach((c, i) => { c.classList.toggle("on", i < k); c.classList.toggle("head", i === k - 1); });
  }
  const showCount = () => {
    const n = S.total + S.pending; $("n").textContent = num(n); paintBeads(n);
  };

  let view = S.room ? "room" : "global";
  function render() {
    showCount();
    const has = !!S.name;
    $("who").hidden = has; $("hello").hidden = !has;
    if (has) { $("hello").textContent = ""; const b = document.createElement("b"); b.textContent = S.name; $("hello").append("أهلاً ", b); }
    $("t-r").hidden = !S.room; $("mk").hidden = !!S.room; $("cp").hidden = !S.room; $("lv").hidden = !S.room;
    if (!S.room) view = "global";
    $("t-g").setAttribute("aria-pressed", view === "global"); $("t-r").setAttribute("aria-pressed", view === "room");
  }

  // ───── التسبيح ─────
  let lastTap = 0, lastCount = 0;
  const MIN_GAP = 90;                              // حد أقصى ≈ 11 تسبيحة في الثانية (أقل من حد السيرفر)
  $("tap").addEventListener("keydown", e => { if (e.repeat) e.preventDefault(); });   // الضغط المستمر على Enter ما يعدّش
  let idleT; const wake = () => { $("tap").classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => $("tap").classList.add("idle"), 5000); };
  $("tap").addEventListener("click", e => {
    const t = performance.now(); if (t - lastCount < MIN_GAP) return; lastCount = t;
    const first = Date.now() - lastTap > 60000; lastTap = Date.now(); if (first) ping();
    S.pending++; save(); showCount(); wake();
    const done = (S.total + S.pending) % 33 === 0;
    try { navigator.vibrate && navigator.vibrate(done ? [30, 50, 30] : 8); } catch (_) {}
    if (reduce || !$("tap").animate) return;
    try {
      const g = $("glow").getBoundingClientRect();                      // الوهج يطلع من مكان الضغط (ولو بالكيبورد من النص)
      $("glow").style.setProperty("--px", (e.detail ? e.clientX - g.left : g.width / 2) + "px");
      $("glow").style.setProperty("--py", (e.detail ? e.clientY - g.top : g.height / 2) + "px");
      $("glow").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: "ease-out" });
      $("tap").animate([{ transform: "scale(.94)" }, { transform: "scale(1)" }], { duration: 200, easing: "ease-out", pseudoElement: "::before" });
      $("tap").animate([{ transform: "scale(1)", opacity: .8 }, { transform: "scale(1.2)", opacity: 0 }], { duration: 560, easing: "ease-out", pseudoElement: "::after" });
      $("n").animate([{ transform: "scale(1.09)" }, { transform: "scale(1)" }], { duration: 180, easing: "ease-out" });
    } catch (_) {}
    if (done) { const s = $("beads"); s.classList.remove("wave"); void s.getBoundingClientRect(); s.classList.add("wave"); setTimeout(() => s.classList.remove("wave"), 1300); }
  });

  // ───── المزامنة ─────
  let busy = false;
  async function sync() {
    if (busy || !S.name || !S.pending) return;
    busy = true;
    try {
      if (!S.id) { const j = await api("join", { name: S.name, seed: S.total }); S.id = j.id; S.total = j.total; }
      const d = Math.min(S.pending, 2000);
      const r = await api("sync", { id: S.id, delta: d, room: S.room });
      S.total = r.total; S.pending -= (typeof r.accepted === "number" ? r.accepted : d); save();
    } catch (e) { if (e.message === "404") { S.id = null; save(); } }
    busy = false; render();
  }
  setInterval(sync, 5000);
  addEventListener("pagehide", sync);
  document.addEventListener("visibilitychange", () => { if (document.hidden) sync(); else { board(); ping(); } });

  // ───── الاسم ─────
  $("who").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("nm").value.replace(/\s+/g, " ").trim().slice(0, 20);
    if (name.length < 2) return say("اكتب اسم من حرفين على الأقل");
    S.name = name; save(); render();
    try { const j = await api("join", { id: S.id, name, seed: S.total }); S.id = j.id; S.total = j.total; save(); say(""); }
    catch (e) { say("الاسم اتحفظ على جهازك، وهيظهر في الترتيب أول ما السيرفر يتصل."); }
    await sync(); render(); board();
  });

  // ───── لوحة الترتيب ─────
  async function board() {
    const ol = $("board");
    try {
      const q = new URLSearchParams(); if (S.id) q.set("id", S.id); if (view === "room" && S.room) q.set("room", S.room);
      const { top } = await api("top?" + q); top.splice(3);
      ol.replaceChildren();
      if (!top.length) { const li = document.createElement("li"); li.className = "empty"; li.textContent = "لسه مفيش حد، كن أول واحد!"; ol.append(li); return; }
      top.forEach((p, i) => {
        const li = document.createElement("li"); if (p.me) li.className = "me";
        for (const [c, t] of [["rk", num(i + 1)], ["nm", p.name], ["ct", num(p.c)]]) { const s = document.createElement("span"); s.className = c; s.textContent = t; li.append(s); }
        ol.append(li);
      });
    } catch (e) {
      ol.replaceChildren(); const li = document.createElement("li"); li.className = "empty"; li.textContent = "الترتيب مش متاح دلوقتي، وعدّك محفوظ عندك."; ol.append(li);
    }
  }
  for (const [id, v] of [["t-g", "global"], ["t-r", "room"]]) $(id).addEventListener("click", () => { view = v; render(); board(); });
  let seen = true;
  new IntersectionObserver(en => { seen = en[0].isIntersecting; if (seen) board(); }).observe($("challenge"));
  setInterval(() => { if (seen && !document.hidden) board(); }, 10000);

  // ───── الغرف ─────
  const link = () => location.origin + location.pathname + "?c=" + S.room;
  async function share() {
    try { if (navigator.share) { await navigator.share({ title: "تحدي التسبيح", text: "تعال نسبّح مع بعض", url: link() }); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(link()); say("اتنسخ رابط التحدي، ابعته لأصحابك."); } catch (e) { say(link()); }
  }
  $("mk").addEventListener("click", () => {
    S.room = rnd(6);
    save(); view = "room"; history.replaceState(null, "", "?c=" + S.room); render(); board(); share();
  });
  $("cp").addEventListener("click", share);
  $("lv").addEventListener("click", () => { S.room = null; save(); view = "global"; history.replaceState(null, "", location.pathname); render(); board(); say(""); });

  // ───── الحضور والإحصائيات (زائر مجهول بمعرّف عشوائي، من غير أي بيانات شخصية) ─────
  const vid = (() => {
    let v = ""; try { v = localStorage.getItem("wz_vid") || ""; } catch (e) {}
    if (!/^[a-z0-9]{10}$/.test(v)) { v = rnd(10); try { localStorage.setItem("wz_vid", v); } catch (e) {} }
    return v;
  })();
  async function ping() {
    if (document.hidden) return;
    try {
      const s = await api("ping", { vid, tap: Date.now() - lastTap < 60000 });
      $("s-v").textContent = num(s.visitors); $("s-o").textContent = num(s.online); $("s-t").textContent = num(s.tapping);
    } catch (e) {}
  }
  setInterval(ping, 60000);

  // ───── الأذكار تحت الدايرة: ضغطة تبدّل الذكر، وضغطتين تضيف ذكر (أو تعدّل اللي أضافه) ─────
  (() => {
    const BASE = ["سبحان الله", "الحمد لله", "لا إله إلا الله وحده لا شريك له له الملك وله الحمد وهو على كل شيء قدير", "لا حول ولا قوة إلا بالله", "استغفر الله"];
    const K = "wz_dhikr2", cur = $("dk-cur"), form = $("dk-edit"), inp = $("dk-in"), hint = $("dk-hint");
    let st = { i: 0, mine: [] };
    try { Object.assign(st, JSON.parse(localStorage.getItem(K) || "{}")); } catch (e) {}
    if (!Array.isArray(st.mine)) st.mine = [];
    st.mine = st.mine.filter(x => typeof x === "string").slice(0, 20);
    const all = () => [...BASE, ...st.mine];
    if (!(st.i >= 0 && st.i < all().length)) st.i = 0;
    const keep = () => { try { localStorage.setItem(K, JSON.stringify(st)); } catch (e) {} };
    let editing = -1;
    function paint(anim) {
      const t = all()[st.i]; cur.textContent = t;
      cur.classList.toggle("long", t.length > 30);
      if (anim && !reduce && cur.animate) cur.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "ease-out" });
    }
    let timer = 0;
    cur.addEventListener("click", () => {
      clearTimeout(timer);
      timer = setTimeout(() => { st.i = (st.i + 1) % all().length; keep(); paint(true); }, 260);   // نستنى شوية علشان الضغطتين ما يبدّلوش الذكر
    });
    function openEdit() {
      editing = st.i >= BASE.length ? st.i - BASE.length : -1;     // ذكر مضاف: تعديل، غير كده: إضافة جديد
      inp.value = editing >= 0 ? st.mine[editing] : "";
      form.hidden = false; cur.hidden = true; hint.hidden = true; inp.focus();
    }
    function closeEdit() { form.hidden = true; cur.hidden = false; hint.hidden = false; }
    cur.addEventListener("dblclick", e => { e.preventDefault(); clearTimeout(timer); openEdit(); });
    cur.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); st.i = (st.i + 1) % all().length; keep(); paint(true); } });
    form.addEventListener("submit", e => {
      e.preventDefault();
      const t = inp.value.replace(/\s+/g, " ").replace(/[،,]/g, "").trim().slice(0, 90);
      if (editing >= 0) { if (t) st.mine[editing] = t; else { st.mine.splice(editing, 1); st.i = 0; } }   // فاضي = مسح الذكر المضاف
      else if (t) { st.mine.push(t); st.i = all().length - 1; }
      keep(); closeEdit(); paint(true);
    });
    inp.addEventListener("keydown", e => { if (e.key === "Escape") closeEdit(); });
    paint();
  })();

  render(); board(); sync(); ping();
})();
