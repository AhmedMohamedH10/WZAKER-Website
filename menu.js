/* القائمة الجانبية: الحساب + اختصارات لكل ميزة (بتفتح مكانها وتأشّر عليها) */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const mn = $("mn"), ov = $("mn-ov"), btn = $("mn-btn");
  if (!mn || !btn) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // data-go -> [العنصر اللي يتأشّر عليه, العنصر اللي لازم يكون ظاهر عشان الاختصار يشتغل]
  const T = {
    contest: ["#contest .ct-card", "#contest"],
    tap: ["#tap", "#tap"],
    friends: ["#mk", "#mk"],
    daily: ["#daily .dy-card", "#daily"],
    board: ["#lb", "#board"],
    download: ["#download .downloads", "#download"],
  };
  const q = s => document.querySelector(s);
  let last = null;

  function sync() {   // الاختصار اللي قسمه مخفي (مسابقة/هدف يومي) ما يظهرش
    for (const b of mn.querySelectorAll(".mn-i")) { const t = q(T[b.dataset.go][1]); b.hidden = !t || t.closest("[hidden]") !== null; }
  }
  function open() {
    sync(); last = document.activeElement; ov.hidden = false;
    requestAnimationFrame(() => { mn.classList.add("on"); ov.classList.add("on"); });
    mn.setAttribute("aria-hidden", "false"); btn.setAttribute("aria-expanded", "true"); document.body.classList.add("mn-lock");
    setTimeout(() => { const f = mn.querySelector(".mn-x"); f && f.focus({ preventScroll: true }); }, 60);
    setTimeout(() => { if (mn.classList.contains("on")) dispatchEvent(new Event("wz-menu")); }, reduce ? 80 : 380);   // يرسم زر جوجل بعد ما القائمة تتفتح بالكامل
  }
  function close(refocus = true) {
    mn.classList.remove("on"); ov.classList.remove("on");
    mn.setAttribute("aria-hidden", "true"); btn.setAttribute("aria-expanded", "false"); document.body.classList.remove("mn-lock");
    setTimeout(() => { if (!mn.classList.contains("on")) ov.hidden = true; }, 320);
    if (refocus && last && last.focus) last.focus({ preventScroll: true });
  }
  function point(el) {
    el.classList.remove("pointed"); void el.offsetWidth; el.classList.add("pointed");
    setTimeout(() => el.classList.remove("pointed"), 2000);
  }
  function go(key) {
    const el = q(T[key][0]); if (!el) return;
    close(false);
    setTimeout(() => {
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: key === "board" ? "start" : "center" });
      setTimeout(() => point(el), reduce ? 0 : 450);
    }, 200);
  }
  btn.addEventListener("click", () => mn.classList.contains("on") ? close() : open());
  ov.addEventListener("click", () => close());
  $("mn-x").addEventListener("click", () => close());
  addEventListener("keydown", e => { if (e.key === "Escape" && mn.classList.contains("on")) close(); });
  mn.addEventListener("click", e => { const b = e.target.closest(".mn-i"); if (b) go(b.dataset.go); });
  // الشعار: منع السحب وقائمة الحفظ (ردع للنسخ السهل، مش حماية مطلقة)
  for (const ev of ["dragstart", "contextmenu"]) document.addEventListener(ev, e => { if (e.target.closest && e.target.closest(".wz-logo,.mn-logo,h1,.app-stage")) e.preventDefault(); });
  // نزول ناعم بمنحنى تسارع/تباطؤ: بيحسب مكان الهدف كل فريم (علشان لو الصفحة اتحرّكت وقت النزول مايتعلقش)، وبيقف لو المستخدم لمس الشاشة أو لف العجلة
  function glideTo(el, center, done) {
    const y0 = scrollY, t0 = performance.now();
    const goal = () => {
      const r = el.getBoundingClientRect(), y = r.top + scrollY - (center ? (innerHeight - r.height) / 2 : 0);
      return Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight));
    };
    if (reduce) { scrollTo(0, goal()); done && done(); return; }
    const dur = Math.min(1200, 500 + Math.abs(goal() - y0) * 0.18);
    const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    let stopped = false;
    const halt = () => { stopped = true; };
    const evs = ["wheel", "touchstart", "keydown"];
    for (const e of evs) addEventListener(e, halt, { passive: true, once: true });
    (function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      if (!stopped) scrollTo(0, y0 + (goal() - y0) * ease(p));
      if (stopped || p >= 1) { for (const e of evs) removeEventListener(e, halt); if (!stopped && done) done(); return; }
      requestAnimationFrame(step);
    })(t0);
  }
  // رابط خارجي (من تطبيق الأندرويد مثلاً): wzaker.site/#contest أو ?go=contest ينزل للقسم ويأشّر عليه.
  // القسم (المسابقة / الهدف اليومي) بيبقى مخفي لحد ما السيرفر يرد، فالمتصفح مش بيلاقيه وقت التحميل، فبنستنى ظهوره (لحد ٨ ثواني).
  // وبعد ظهوره بنستنى الصفحة تخلّص تحميل وتهدى (سكريبت جوجل بيتحمّل وقتها) قبل ما ننزل، علشان النزول يبقى ناعم من غير تعليق
  (() => {
    let key = location.hash.slice(1);
    if (!T[key]) key = new URLSearchParams(location.search).get("go") || "";
    if (!T[key]) return;
    let tries = 0;
    const t = setInterval(() => {
      const sec = q(T[key][1]), el = q(T[key][0]);
      if (sec && sec.closest("[hidden]") === null && el && document.readyState === "complete") {
        clearInterval(t);
        setTimeout(() => glideTo(el, key !== "board", () => setTimeout(() => point(el), 100)), reduce ? 0 : 600);
      } else if (++tries > 80) clearInterval(t);
    }, 100);
  })();
  window.WZ_menu = { open, close };
})();
