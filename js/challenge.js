/* تحدي التسبيح: العد محفوظ في المتصفح دايماً (مش بيتصفر)، ويتزامن مع السيرفر لما يكون متاح */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("tap")) return;
  const KEY = "wz_tasbeeh";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const S = { id: null, name: "", total: 0, pending: 0, room: null, g: false };   // g: داخل بحساب جوجل (الاسم بيتدار من صندوق الحساب)
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const D = { on: false, goal: 0, count: 0, done: false, end: 0, off: 0, reached: 0 };   // الهدف اليومي (من السيرفر)
  const fromUrl = (new URLSearchParams(location.search).get("c") || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
  if (fromUrl.length >= 4) { S.room = fromUrl; save(); }
  const FROM = "wz_from";
  (() => {
    const u = new URL(location.href), r = (u.searchParams.get("r") || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
    try { if (r.length === 10 && !localStorage.getItem("wz_vid") && !localStorage.getItem(FROM)) localStorage.setItem(FROM, r); } catch (e) {}
    if (u.searchParams.has("r")) { u.searchParams.delete("r"); history.replaceState(null, "", u.pathname + u.search + u.hash); }
  })();
  const num = n => Number(n).toLocaleString("ar-EG").replace(/\u066C/g, ",");   // أرقام هندية (٤٨٠)
  const rnd = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
  const say = t => { $("msg").textContent = t || ""; };
  const sayA = t => { $("act-msg").textContent = t || ""; };   // رسائل الأزرار اللي تحت (نسخ الرابط) بتظهر جنبها

  async function api(path, body) {
    const r = await fetch("/api/" + path, body
      ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true } : {});
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  // ───── حلقة السبحة: خرز زمرد بفيزياء كاملة (js/beads.js) ─────
  const paintBeads = n => window.WZ_beads && WZ_beads.set(n);
  // وضع المكرمة: لما تبدأ بتتصفّر السبحة وتعدّ للمكرمة بس (contest.js بيحدّث WZ_ct)، ولما تخلص بترجع لأرقامك القديمة
  window.WZ_ct = { on: false, count: 0 };
  const TAPL = document.querySelector("#tap .tap-l"), TAPL0 = TAPL ? TAPL.textContent : "";
  const showCount = () => {
    const n = WZ_ct.on ? WZ_ct.count : S.total + S.pending; $("n").textContent = num(n); paintBeads(n);
    const mine = $("acct-cnt"); if (mine) mine.textContent = num(S.total + S.pending);   // «عدد تسبيحاتي» في صندوق الحساب: إجمالي تسبيحك حتى لو اسمك مخفي
    if (D.on) paintDaily();
  };
  let ctWas = false;
  addEventListener("wz-ct", () => {
    const sw = WZ_ct.on !== ctWas; ctWas = WZ_ct.on;
    if (TAPL) { TAPL.textContent = WZ_ct.on ? "مَكْرُمَةُ ذِي الأَلْف" : TAPL0; TAPL.classList.toggle("ct", !!WZ_ct.on); }
    showCount();
    if (sw && !reduce && $("n").animate) { try { $("n").animate([{ opacity: 0, transform: "scale(.88)" }, { opacity: 1, transform: "scale(1)" }], { duration: 700, easing: "ease-out" }); } catch (_) {} }   // رجوع/تصفير ناعم
  });

  let view = S.room ? "room" : "global";
  function render() {
    showCount();
    if (S.g) $("gate").hidden = true; $("hello").hidden = true;
    $("t-r").hidden = !S.room; $("mk").hidden = !!S.room; $("cp").hidden = !S.room; $("lv").hidden = !S.room;
    if (!S.room) view = "global";
    $("t-g").setAttribute("aria-pressed", view === "global"); $("t-r").setAttribute("aria-pressed", view === "room");
  }

  // ───── قائمة التسجيل: تظهر عند أول تسبيحة لمن لم يسجّل دخوله أو يكتب اسمه ─────
  let gateDone = false, hinted = false;
  function nudge() {
    if (S.g) { if (!S.name && !hinted) { hinted = true; say("اختر اسمك من القائمة ليُحتسب تسبيحك."); } return; }
    if (gateDone) return; gateDone = true;
    const g = $("gate"); g.hidden = false; dispatchEvent(new Event("wz-gate"));
    if (!reduce && g.animate) g.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "ease-out" });
  }
  $("gate-x").addEventListener("click", () => { $("gate").hidden = true; });

  // ───── التسبيح ─────
  let lastTap = 0, lastCount = 0;
  const MIN_GAP = 90;                              // حد أقصى ≈ 11 تسبيحة في الثانية (أقل من حد السيرفر)
  $("tap").addEventListener("keydown", e => { if (e.repeat) e.preventDefault(); });   // الضغط المستمر على Enter ما يعدّش
  let idleT; const wake = () => { $("tap").classList.remove("idle"); clearTimeout(idleT); idleT = setTimeout(() => $("tap").classList.add("idle"), 5000); };
  $("tap").addEventListener("click", e => {
    const t = performance.now(); if (t - lastCount < MIN_GAP) return; lastCount = t;
    const first = Date.now() - lastTap > 60000; lastTap = Date.now(); if (first) ping();
    if (WZ_ct.on) { if (e.isTrusted) dispatchEvent(new CustomEvent("wz-tap")); wake(); }   // أثناء المكرمة: الضغطة للمكرمة بس، وأرقامك القديمة محفوظة
    else { S.pending++; save(); showCount(); wake(); nudge(); }
    const done = (WZ_ct.on ? WZ_ct.count : S.total + S.pending) % 33 === 0;
    try { navigator.vibrate && navigator.vibrate(done ? [30, 50, 30] : 8); } catch (_) {}
    if (reduce || !$("tap").animate) return;
    try {
      $("n").animate([{ transform: "scale(1.09)" }, { transform: "scale(1)" }], { duration: 180, easing: "ease-out" });
    } catch (_) {}
    if (done && window.WZ_beads) WZ_beads.ripple();
  });

  // ───── المزامنة ─────
  let busy = false;
  async function sync() {
    if (busy || !S.g || !S.name || !S.pending) return;     // المزامنة لحسابات جوجل بس. من غير دخول العدّ بيفضل على جهازك
    busy = true;
    try {
      const d = Math.min(S.pending, 2000);
      const r = await api("sync", { id: S.id, delta: d, room: S.room });
      S.total = r.total; S.pending -= (typeof r.accepted === "number" ? r.accepted : d); save();
      if (r.daily) { const was = D.done; Object.assign(D, { on: true, count: r.daily.count, goal: r.daily.goal, done: r.daily.done }); if (D.done && !was) dailyLoad(); }   // بلغ الهدف الآن: نحدّث قايمة أول 3
    } catch (e) {
      if (e.message === "401") say("سجّل دخولك بجوجل ليُحتسب تسبيحك في الترتيب والهدف اليومي.");
    }
    busy = false; render();
  }
  setInterval(sync, 5000);
  window.WZ_flush = sync;
  /* دخول/خروج جوجل (من contest.js): الحساب بياخد مكان الاسم والعدّ المحلي، والتسبيحات اللي لسه ما اتبعتتش بتتبعت على الحساب */
  addEventListener("wz-login", e => { const d = e.detail || {}; if (!d.id) return; S.id = d.id; S.name = d.name; S.total = d.total; S.g = true; save(); say(""); render(); board(); dailyLoad(); sync(); });
  addEventListener("wz-logout", () => { S.id = null; S.name = ""; S.total = 0; S.pending = 0; S.g = false; save(); render(); board(); dailyLoad(); });
  addEventListener("wz-nosession", () => { if (!S.g) return; S.g = false; save(); render(); });   // الجلسة خلصت: الاسم والعدّ يفضلوا، بس المزامنة محتاجة دخول تاني
  addEventListener("pagehide", sync);
  document.addEventListener("visibilitychange", () => { if (document.hidden) sync(); else { board(); dailyLoad(); ping(); } });

  // ───── لوحة الترتيب ─────
  async function board() {
    const ol = $("board");
    try {
      const q = new URLSearchParams(); if (S.id) q.set("id", S.id); if (view === "room" && S.room) q.set("room", S.room);
      const { top } = await api("top?" + q); top.splice(3);
      ol.replaceChildren();
      if (!top.length) { const li = document.createElement("li"); li.className = "empty"; li.textContent = "لا أحد هنا بعد، كن أول المسبّحين."; ol.append(li); return; }
      top.forEach((p, i) => {
        const li = document.createElement("li"); if (p.me) li.className = "me";
        for (const [c, t] of [["rk", num(i + 1)], ["nm", p.name], ["ct", num(p.c)]]) { const s = document.createElement("span"); s.className = c; s.textContent = t; li.append(s); }
        ol.append(li);
      });
    } catch (e) {
      ol.replaceChildren(); const li = document.createElement("li"); li.className = "empty"; li.textContent = "تعذّر تحميل الترتيب الآن، وعدّك محفوظ لديك."; ol.append(li);
    }
  }
  for (const [id, v] of [["t-g", "global"], ["t-r", "room"]]) $(id).addEventListener("click", () => { view = v; render(); board(); });
  let seen = true;
  new IntersectionObserver(en => { seen = en[0].isIntersecting; if (seen) board(); }).observe($("challenge"));
  setInterval(() => { if (seen && !document.hidden) board(); }, 10000);

  // ───── الغرف ─────
  const link = () => location.origin + location.pathname + "?c=" + S.room;
  async function share() {
    try { if (navigator.share) { await navigator.share({ title: "سبّح معنا", text: "هلمّ نسبّح معاً", url: link() }); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(link()); sayA("نُسخ الرابط، أرسله إلى أصحابك."); } catch (e) { sayA(link()); }
  }
  $("mk").addEventListener("click", () => {
    S.room = rnd(6);
    save(); view = "room"; history.replaceState(null, "", "?c=" + S.room); render(); board(); share();
  });
  $("cp").addEventListener("click", share);
  $("lv").addEventListener("click", () => { S.room = null; save(); view = "global"; history.replaceState(null, "", location.pathname); render(); board(); sayA(""); });

  // ───── الحضور والإحصائيات (زائر مجهول بمعرّف عشوائي، من غير أي بيانات شخصية) ─────
  const vid = (() => {
    let v = ""; try { v = localStorage.getItem("wz_vid") || ""; } catch (e) {}
    if (!/^[a-z0-9]{10}$/.test(v)) { v = rnd(10); try { localStorage.setItem("wz_vid", v); } catch (e) {} }
    return v;
  })();
  /* الرقم بيعدّ بسلاسة من القيمة القديمة للجديدة (من غير حركة لو المستخدم مقلّل الحركة) */
  function countTo(el, to) {
    to = Number(to) || 0;
    const from = Number(el.dataset.v);
    el.dataset.v = to;
    if (reduce || !isFinite(from) || from === to) { el.textContent = num(to); return; }
    const t0 = performance.now(), D = 900;
    const step = t => {
      const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      el.textContent = num(Math.round(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  async function ping() {
    if (document.hidden) return;
    try {
      let from = ""; try { from = localStorage.getItem(FROM) || ""; } catch (e) {}
      const s = await api("ping", { vid, tap: Date.now() - lastTap < 60000, ref: from });
      countTo($("s-v"), s.visitors); countTo($("s-o"), s.online); countTo($("s-t"), s.tapping);
      if (s.taps != null) { $("gt").classList.add("on"); countTo($("s-g"), s.taps); }
      hintStats();
      refs(s.refs);
    } catch (e) {}
  }
  /* الوصف جنب الرقم: عند اللمس يبقى ثانيتين ثم يُطوى، ومرة واحدة عند أول تحميل للإيحاء بذلك.
     الحركة بأسلوب FLIP: نحسب المكان النهائي للأزرار مرة واحدة ونحرّكها بـtransform فقط (بدون إعادة ترتيب كل فريم)،
     والوصف يظهر بقصّ (clip) تدريجي. مؤقّت واحد مشترك وقفل قصير للـhover عشان ما يفتح ويقفل بتكرار. */
  const STS = [...document.querySelectorAll(".st")];
  const PULSE = document.querySelector(".pulse");
  let hinted0 = false, stT = [], hoverT = 0;
  const stClear = () => { stT.forEach(clearTimeout); stT = []; clearTimeout(hoverT); };
  /* واحد بس مفتوح في الوقت؛ الوصف بيتفتح بالـCSS (grid 0fr → 1fr) فالحركة ناعمة والصف مبيتداخلش */
  function stSet(target) { STS.forEach(e => e.classList.toggle("open", e === target)); }
  function hintStats() {
    if (hinted0 || reduce) return; hinted0 = true;
    STS.forEach((el, i) => {
      stT.push(setTimeout(() => stSet(el), 700 + i * 2000));
      stT.push(setTimeout(() => stSet(null), 700 + i * 2000 + 1500));
    });
  }
  STS.forEach(el => {
    el.addEventListener("click", e => {
      if (e.pointerType === "mouse") return;
      stClear();
      const was = el.classList.contains("open");
      stSet(was ? null : el);
      if (!was) stT.push(setTimeout(() => stSet(null), 2600));
    });
    /* الماوس: تأخير بسيط ونتأكد إن المؤشر لسه فوق الزر، عشان الصف وهو بيتحرّك ما يفتح ويقفل بتكرار */
    el.addEventListener("pointerenter", e => {
      if (e.pointerType !== "mouse") return;
      stClear();
      hoverT = setTimeout(() => { if (el.matches(":hover")) stSet(el); }, 90);
    });
  });
  if (PULSE) PULSE.addEventListener("pointerleave", e => {
    if (e.pointerType === "mouse") { stClear(); stT.push(setTimeout(() => stSet(null), 250)); }
  });
  setInterval(ping, 60000);

  // ───── مشاركة الموقع: رابط إحالة خاص بكل زائر، ويُحصى من انضمّ عبره وسبّح ─────
  const who = n => n === 1 ? "مسبّح واحد" : n === 2 ? "مسبّحان" : n <= 10 ? num(n) + " مسبّحين" : num(n) + " مسبّحاً";
  function refs(n) { n = Number(n) || 0; $("ref").hidden = !n; if (n) $("ref").textContent = "انضمّ عبر رابطك " + who(n) + "."; }
  $("sh").addEventListener("click", async () => {
    const url = location.origin + "/?r=" + vid;
    try { if (navigator.share) { await navigator.share({ title: "وذكر", text: "وذكر: سبحة عائمة للأذكار على سطح المكتب. سبّح معي.", url }); return; } } catch (e) { if (e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); sayA("نُسخ رابط الدعوة، شاركه مع من تحب."); } catch (e) { sayA(url); }
  });

  // ───── الأذكار تحت الدايرة: ضغطة تبدّل الذكر، وضغطتين تضيف ذكر (أو تعدّل اللي أضافه) ─────
  (() => {
    const BASE0 = ["سبحان الله", "الحمد لله", "لا إله إلا الله وحده لا شريك له له الملك وله الحمد وهو على كل شيء قدير", "لا حول ولا قوة إلا بالله", "استغفر الله"];
    const MORE = ["الله أكبر", "لا إله إلا الله", "سبحان الله وبحمده", "سبحان الله العظيم", "سبحان الله وبحمده، سبحان الله العظيم",
      "سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر", "أستغفر الله العظيم وأتوب إليه", "اللهم صلِّ وسلِّم على نبينا محمد",
      "لا إله إلا أنت سبحانك إني كنت من الظالمين", "حسبي الله لا إله إلا هو عليه توكلت وهو رب العرش العظيم", "رضيت بالله ربًّا وبالإسلام دينًا وبمحمد نبيًّا",
      "اللهم إنك عفو تحب العفو فاعف عني", "يا حي يا قيوم برحمتك أستغيث", "ربِّ اغفر لي وتب عليَّ إنك أنت التواب الرحيم",
      "الحمد لله حمدًا كثيرًا طيبًا مباركًا فيه", "سبحان الله وبحمده عدد خلقه ورضا نفسه وزنة عرشه ومداد كلماته"];
    const BASE = [...BASE0, ...MORE];
    const K = "wz_dhikr2", cur = $("dk-cur"), form = $("dk-edit"), inp = $("dk-in"), hint = $("dk-hint");
    let st = { i: 0, mine: [], hid: [] };
    try { Object.assign(st, JSON.parse(localStorage.getItem(K) || "{}")); } catch (e) {}
    if (!Array.isArray(st.mine)) st.mine = [];
    if (st.v !== 2) { if (st.i >= BASE0.length) st.i += MORE.length; st.v = 2; }   // الأذكار الجاهزة زادت: نحافظ على الذكر المختار والمضاف
    st.mine = st.mine.filter(x => typeof x === "string").slice(0, 20);
    st.hid = Array.isArray(st.hid) ? st.hid.filter(x => BASE.includes(x)) : [];
    const base = () => BASE.filter(x => !st.hid.includes(x));
    const all = () => [...base(), ...st.mine];
    if (!all().length) st.hid = [];   // أمان: لازم يفضل ذكر واحد على الأقل
    if (!(st.i >= 0 && st.i < all().length)) st.i = 0;
    const keep = () => { try { localStorage.setItem(K, JSON.stringify(st)); } catch (e) {} };
    let editing = -1;
    const wrap = $("dk-w"), xBtn = $("dk-x");
    // موضع X: بجوار حافة الكلام الفعلية من أعلى اليسار بمسافة صغيرة (وفوق الحافة إن ضاق العرض)
    function placeX() {
      if (xBtn.hidden || wrap.hidden) return;
      const r = document.createRange(); r.selectNodeContents(cur);
      const rs = [...r.getClientRects()].filter(x => x.width > 0); if (!rs.length) return;
      const wr = wrap.getBoundingClientRect(), L = Math.min(...rs.map(x => x.left)), T = Math.min(...rs.map(x => x.top)), sz = 16, gap = 6;
      let left = L - wr.left - sz - gap, top = T - wr.top - 2;
      if (L - sz - gap < 6) { left = L - wr.left - 2; top = T - wr.top - sz - 2; }
      xBtn.style.left = Math.round(left) + "px"; xBtn.style.top = Math.round(top) + "px";
    }
    function paint(anim) {   // anim: 1 = من اليمين، -1 = من اليسار، true = ظهور هادئ
      const t = all()[st.i]; cur.textContent = t; xBtn.hidden = all().length <= 1; placeX();
      cur.classList.toggle("long", t.length > 30);
      if (anim && !reduce && cur.animate) { const dx = (anim === 1 ? 1 : anim === -1 ? -1 : 0) * 14; const t0 = { transform: dx ? "translateX(" + dx + "px)" : "translateY(4px)" }, o = { duration: 320, easing: "cubic-bezier(.22,.61,.36,1)" }; cur.animate([{ opacity: 0, ...t0 }, { opacity: 1, transform: "none" }], o); xBtn.animate([{ opacity: 0, ...t0 }, { transform: "none" }], o); }
    }
    // اتجاه الحركة: السحب لليسار = التالي، ولليمين = السابق (وفق اتجاه القراءة العربية)
    let busy = false;
    const go = d => {
      const n = all().length; if (n < 2 || busy) return;
      const swap = () => { st.i = (st.i + d + n) % n; keep(); paint(d); dismissHint(); };
      if (reduce || !cur.animate) return swap();
      busy = true;   // خروج هادئ للذكر الحالي ثم دخول الجديد
      const kf = [{ transform: "none" }, { opacity: 0, transform: "translateX(" + (-d * 14) + "px)" }], op = { duration: 160, easing: "ease-in", fill: "forwards" };
      const out = cur.animate(kf, op), xo = xBtn.animate(kf, op);
      out.onfinish = () => { out.cancel(); xo.cancel(); swap(); busy = false; };
      out.oncancel = () => { xo.cancel(); busy = false; };
    };
    const next = () => go(1), prev = () => go(-1);
    // سحب أفقي = تبديل الذكر | ضغطة مطوّلة = إضافة ذكر (أو تعديل المضاف)
    let lpT = 0, lpDone = false, lpX = 0, lpY = 0, down = false;
    const lpStop = () => { clearTimeout(lpT); lpT = 0; };
    cur.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      down = true; lpDone = false; lpX = e.clientX; lpY = e.clientY; lpStop();
      lpT = setTimeout(() => { lpT = 0; lpDone = true; down = false; try { navigator.vibrate && navigator.vibrate(12); } catch (_) {} dismissHint(); openEdit(); }, 520);
    });
    cur.addEventListener("pointermove", e => { if (lpT && Math.hypot(e.clientX - lpX, e.clientY - lpY) > 10) lpStop(); });
    cur.addEventListener("pointerup", e => {
      lpStop();
      if (lpDone) { lpDone = false; return; }
      if (!down) return; down = false;
      const dx = e.clientX - lpX, dy = e.clientY - lpY;
      if (e.pointerType === "mouse") { if (Math.hypot(dx, dy) < 8) next(); }   // الماوس: نقرة عادية تبدّل الذكر
      else if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.4) { dx < 0 ? next() : prev(); }   // اللمس: سحب أفقي
    });
    for (const ev of ["pointerleave", "pointercancel"]) cur.addEventListener(ev, () => { lpStop(); down = false; });
    cur.addEventListener("contextmenu", e => e.preventDefault());
    cur.addEventListener("dblclick", e => e.preventDefault());
    function openEdit() {
      editing = st.i >= base().length ? st.i - base().length : -1;     // ذكر مضاف: تعديل، غير كده: إضافة جديد
      inp.value = editing >= 0 ? st.mine[editing] : "";
      form.hidden = false; wrap.hidden = true; hint.hidden = true; inp.focus();
    }
    function closeEdit() { form.hidden = true; wrap.hidden = false; hint.hidden = false; placeX(); }
    cur.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); if (e.shiftKey) openEdit(); else next(); } else if (e.key === "ArrowLeft") { e.preventDefault(); next(); } else if (e.key === "ArrowRight") { e.preventDefault(); prev(); } });   // الأسهم أو Enter تبدّل | Shift+Enter تضيف
    form.addEventListener("submit", e => {
      e.preventDefault();
      const t = inp.value.replace(/\s+/g, " ").replace(/[،,]/g, "").trim().slice(0, 90);
      if (editing >= 0) { if (t) st.mine[editing] = t; else { st.mine.splice(editing, 1); st.i = 0; } }   // فاضي = مسح الذكر المضاف
      else if (t) { st.mine.push(t); st.i = all().length - 1; }
      keep(); closeEdit(); paint(true);
    });
    inp.addEventListener("keydown", e => { if (e.key === "Escape") closeEdit(); });
    // حذف الذكر الحالي (X صغيرة): الجاهز بيتخبّى، والمضاف بيتمسح. لازم يفضل ذكر واحد على الأقل
    xBtn.addEventListener("click", e => {
      e.preventDefault(); e.stopPropagation();
      if (all().length <= 1) return;
      const i = st.i, nb = base().length;
      if (i < nb) st.hid.push(base()[i]); else st.mine.splice(i - nb, 1);
      st.i = Math.min(i, all().length - 1); keep(); paint(true);
    });
    window.addEventListener("resize", placeX); if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeX);
    // تلميح الإيماءات: يظهر مرة واحدة فقط في أول زيارة ثم يختفي
    const HK = "wz_dkhint", dk = $("dk"); let hintT = 0;
    function dismissHint() { clearTimeout(hintT); if (!dk.classList.contains("dk-first")) return; dk.classList.remove("dk-first"); try { localStorage.setItem(HK, "1"); } catch (e) {} }
    let seen = false; try { seen = !!localStorage.getItem(HK); } catch (e) {}
    if (!seen) { setTimeout(() => dk.classList.add("dk-first"), 1200); hintT = setTimeout(dismissHint, 11000); }
    paint();
  })();

  // ───── الهدف اليومي: هدف عشوائي كل يوم. أول 3 يبلغوه بيظهروا لحد نهاية اليوم. العدّ والتوقيت على السيرفر، والمتصفح بيعرض بس ─────
  const hm = ms => new Date(ms).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });
  const left = ms => { const m = Math.max(0, Math.ceil(ms / 60000)), h = Math.floor(m / 60); return (h ? num(h) + " س " : "") + num(m % 60) + " د"; };
  function paintDaily() {
    $("daily").hidden = !D.on; if (!D.on) return;
    const reg = S.g && !!S.name, mine = reg ? D.count + S.pending : 0, p = D.goal ? Math.min(mine, D.goal) : 0, ok = D.done || (reg && D.goal > 0 && mine >= D.goal);
    const pct = D.goal ? Math.round(p / D.goal * 100) : 0;
    $("dy-g").textContent = num(D.goal);
    $("dy-u").style.width = (p > 0 ? Math.max(pct, 2) : 0) + "%"; $("dy-bar").setAttribute("aria-valuenow", pct);
    $("dy-pc").textContent = reg ? num(pct) + "٪" : "";
    $("dy-t1").textContent = reg ? num(p) : "–"; $("dy-t2").textContent = reg ? num(Math.max(0, D.goal - p)) : "–";
    $("dy-t3").textContent = D.end ? left(D.end - (Date.now() + D.off)) : "–";
    $("dy-me").classList.toggle("done", ok);
    $("daily").classList.toggle("ok", ok);
    $("dy-me").textContent = !S.g ? "سجّل دخولك ليُحتسب تسبيحك." : !S.name ? "اختر اسمك من القائمة ليُحتسب تسبيحك." : ok ? "ما شاء الله، بلغتَ هدف اليوم." : "";
    $("dy-note").textContent = D.reached > 3 ? "بلغ الهدف اليوم " + who(D.reached) + "." : "";
  }
  function paintDailyTop(top) {
    const ol = $("dy-top"); ol.replaceChildren();
    $("dy-k").hidden = ol.hidden = !top.length;               // مفيش قائمة فاضية ولا عنوان لها
    if (!top.length) return;
    top.forEach((p, i) => {
      const li = document.createElement("li"); if (p.me) li.className = "me";
      for (const [c, t] of [["rk", num(i + 1)], ["nm", p.name], ["ct", hm(p.t)]]) { const s = document.createElement("span"); s.className = c; s.textContent = t; li.append(s); }
      ol.append(li);
    });
  }
  let dseq = 0;
  async function dailyLoad() {
    const n = ++dseq;
    try {
      const r = await api("daily/state" + (S.g && S.id ? "?id=" + S.id : ""));
      if (n !== dseq) return;                                  // وصل رد أحدث، نتجاهل ده
      D.on = !!r.on; if (!D.on) { paintDaily(); return; }
      Object.assign(D, { goal: r.goal, end: r.end, off: r.now - Date.now(), reached: r.reached });
      if (!busy) { D.count = r.me.count; D.done = r.me.done; }  // لو فيه مزامنة شغالة دلوقتي، رقمها هو الأحدث
      paintDailyTop(r.top); paintDaily();
    } catch (e) {}                                             // فشل الاتصال: بنسيب اللي معروض زي ما هو
  }
  setInterval(() => { if (seen && !document.hidden) dailyLoad(); }, 10000);

  render(); board(); sync(); ping(); dailyLoad();
})();
