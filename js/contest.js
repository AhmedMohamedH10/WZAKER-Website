/* دخول جوجل + حساب اللاعب + "مَكْرُمَةُ ذِي الأَلْف": جولة أسبوعية تلقائية (خميس 10 مساءً بتوقيت البلد). العدّاد والتوقيت والنتايج كلها على السيرفر، والمتصفح بيعرض بس */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("contest")) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AR = s => String(s).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  const num = n => Number(n).toLocaleString("ar-EG").replace(/\u066C/g, ",");
  const CID = typeof GOOGLE_CLIENT_ID !== "undefined" ? GOOGLE_CLIENT_ID : "";
  const TSK = typeof TURNSTILE_SITEKEY !== "undefined" ? TURNSTILE_SITEKEY : "";
  let user = null, authOn = false, editing = false, claimEdit = false, ST = null, offset = 0, pending = 0, busy = false, lastTap = 0, seen = false, tsId = null, tsTok = "";

  const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; } })();   // السيرفر بيعتمد على توقيت Cloudflare، ده احتياطي بس
  async function api(path, body) {
    const r = await fetch("/api/" + path + (body ? "" : "?tz=" + encodeURIComponent(TZ)), body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, tz: TZ }) } : {});
    if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(r.status); e.status = r.status; e.code = j.error; throw e; }
    return r.json();
  }
  const say = (id, t) => { $(id).textContent = t || ""; };
  const localId = () => { try { return (JSON.parse(localStorage.getItem("wz_tasbeeh") || "{}").id) || null; } catch (e) { return null; } };
  const dur = ms => { const t = Math.max(0, Math.round(ms / 1000)), m = Math.floor(t / 60), s = t % 60; return (m ? num(m) + " د " : "") + num(s) + " ث"; };
  const rate = r => Number(r).toLocaleString("ar-EG", { maximumFractionDigits: 1 }).replace(/\u066C/g, ",") + " تسبيحة/ث";
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

  // ───── دخول جوجل ─────
  function gbtns() {
    if (!window.google || !google.accounts) return;
    for (const id of ["g-btn", "g-btn2", "g-btn3"]) { $(id).replaceChildren(); google.accounts.id.renderButton($(id), { theme: "filled_black", size: "large", shape: "pill", text: "signin_with", locale: "ar" }); }
  }
  addEventListener("wz-gate", () => setTimeout(gbtns, 0));
  addEventListener("wz-menu", () => { if (!user) setTimeout(gbtns, 0); });   // القائمة الجانبية: نرسم زر جوجل بعد ما تبقى ظاهرة (جوجل بيرسمه فاضي لو الحاوية مخفية)   // القائمة كانت مخفية: نرسم الزر بعد ظهورها
  function loadGsi() {
    if (!CID || !authOn || window.google && google.accounts) return;
    const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => {
      google.accounts.id.initialize({ client_id: CID, callback: onCred, ux_mode: "popup" });
      gbtns();
    };
    document.head.append(s);
  }
  async function onCred(resp) {
    say("acct-msg", ""); say("ct-msg", "");
    try { setUser(await api("auth/google", { credential: resp.credential, id: localId() })); }
    catch (e) { const m = e.code === "banned" ? "هذا الحساب موقوف." : "تعذّر تسجيل الدخول، حاول مرة أخرى."; say("acct-msg", m); say("ct-msg", m); }
  }
  function setUser(u) { user = u; editing = false; dispatchEvent(new CustomEvent("wz-login", { detail: u })); acct(); loadState(); }

  // ───── صندوق الحساب: الصورة + الاسم اللي اللاعب كتبه (مش اسم جوجل) ─────
  function acct() {
    $("acct").hidden = !authOn; $("gate-g").hidden = !authOn || !!user;
    $("gate-t").textContent = authOn ? "سجّل دخولك الآن" : "التسجيل غير متاح حاليًا"; $("gate-s").textContent = authOn ? "ليُحفظ تسبيحك ويظهر اسمك في الترتيب." : "جرّب مرة أخرى بعد قليل.";
    $("g-btn").hidden = !!user; $("acct-card").hidden = !user;
    $("acct-t").textContent = user ? "" : "سجّل الدخول لحفظ تقدّمك.";
    $("acct-name").hidden = !(user && (!user.named || editing));
    if (!user) return;
    $("acct-nm").textContent = user.name || "بلا اسم";
    $("av-l").textContent = [...(user.name || "؟")][0];
    const img = $("av-img"); img.hidden = true;
    if (user.avatar) { img.onload = () => { img.hidden = false; }; img.onerror = () => { img.hidden = true; }; img.src = user.avatar; }
    $("acct-hint").textContent = user.named ? "اكتب الاسم الجديد." : "الاسم الذي سيظهر للآخرين.";
    $("acct-ed").hidden = !user.named || editing;
    $("acct-cancel").hidden = !user.named;
    $("acct-act").hidden = !!(editing && user.named);   // وقت التعديل: الفورم بس، من غير أزرار تانية
  }
  $("acct-ed").addEventListener("click", () => { editing = true; acct(); $("acct-in").value = user.name || ""; $("acct-in").focus(); });
  $("acct-cancel").addEventListener("click", () => { editing = false; say("acct-msg", ""); acct(); });
  $("ct-name-go").addEventListener("click", () => { window.WZ_menu ? WZ_menu.open() : 0; setTimeout(() => $("acct-in").focus({ preventScroll: true }), 400); });
  $("acct-name").addEventListener("submit", async e => {
    e.preventDefault(); say("acct-msg", "");
    try { setUser(await api("account/name", { name: $("acct-in").value })); }
    catch (err) { say("acct-msg", err.status === 400 ? "الاسم غير مقبول. اكتب حرفين على الأقل، وتجنّب كلمات مثل «أدمن» و«وذكر»." : "حدث خطأ، حاول مرة أخرى."); }
  });
  $("acct-out").addEventListener("click", async () => {
    try { if (window.WZ_flush) await window.WZ_flush(); await api("auth/logout", {}); } catch (e) {}
    user = null; pending = 0; editing = false; dispatchEvent(new Event("wz-logout")); acct(); loadState();
  });

  // ───── حالة المسابقة ─────
  async function loadState() {
    try {
      const s = await api("contest/state");
      if (s.authOn !== undefined) authOn = s.authOn;
      if (!s.on) { $("contest").hidden = true; ST = null; return; }
      ST = s; offset = s.now - Date.now();
      if (!s.auth && user) { user = null; dispatchEvent(new Event("wz-nosession")); acct(); }
      if (s.auth && user && user.named !== s.named) { user.named = s.named; acct(); }
      $("contest").hidden = false; loadGsi(); paint();
    } catch (e) {}
  }
  const now = () => Date.now() + offset;
  const isLive = () => ST && ST.auth && ST.named && ST.entered && !ST.done && now() >= ST.start && now() < ST.end;
  const cnt = () => ST ? Math.min(ST.target, ST.me + pending) : 0;

  // عدّاد مبسّط: أيام ← (آخر يوم) ساعات ← (آخر ساعة) دقائق ← (آخر دقيقة) ثواني
  const unit = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : AR(n) + " " + (n <= 10 ? few : many);
  function cd(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000)), d = Math.floor(t / 86400), h = Math.floor(t / 3600), m = Math.ceil(t / 60);
    if (d >= 1) return unit(d, "يوم واحد", "يومان", "أيام", "يومًا");
    if (h >= 1) return unit(h, "ساعة واحدة", "ساعتان", "ساعات", "ساعة");
    if (t >= 60) return unit(m, "دقيقة واحدة", "دقيقتان", "دقائق", "دقيقة");
    return unit(Math.max(1, t), "ثانية واحدة", "ثانيتان", "ثوانٍ", "ثانية");
  }
  function paintCount() {
    const c = cnt(); $("cn").textContent = num(c); $("cbar").style.strokeDashoffset = 100 - c / ST.target * 100;
  }
  function row(cls, cells) { const li = el("li", cls); for (const c of cells) li.append(c); return li; }

  // Turnstile (لو متفعّل): تأكيد إنه إنسان قبل ما يدخل المسابقة
  function mountTs() {
    if (!ST.captcha || tsId !== null) return;
    if (!TSK) { say("ct-msg", "إعداد التحقق غير مكتمل."); return; }
    tsId = -1;
    const go = () => { tsId = turnstile.render("#ct-ts", { sitekey: TSK, theme: "dark", language: "ar",
      callback: t => { tsTok = t; $("ct-go").disabled = false; }, "expired-callback": () => { tsTok = ""; $("ct-go").disabled = true; }, "error-callback": () => { say("ct-msg", "تعذّر التحقق، أعد تحميل الصفحة وحاول ثانية."); } }); };
    if (window.turnstile) return go();
    const sc = document.createElement("script"); sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; sc.async = true; sc.onload = go; document.head.append(sc);
  }
  $("ct-go").addEventListener("click", async () => {
    $("ct-go").disabled = true; say("ct-msg", "");
    try { await api("contest/enter", { ts: tsTok }); loadState(); }
    catch (e) {
      say("ct-msg", e.code === "captcha" ? "تعذّر التحقق من أنك إنسان، حاول مرة أخرى." : "حدث خطأ، حاول مرة أخرى.");
      if (window.turnstile && tsId >= 0) turnstile.reset(tsId); tsTok = ""; $("ct-go").disabled = !!ST.captcha;
    }
  });

  const region = cc => { try { return cc ? new Intl.DisplayNames(["ar"], { type: "region" }).of(cc) || cc : ""; } catch (e) { return cc || ""; } };
  const sameDay = ms => new Date(ms).toLocaleDateString("ar-EG", { day: "numeric", month: "long" });
  function paint() {
    if (!ST) return;
    const t = now(), started = t >= ST.start, w = ST.winner;
    const needEnter = ST.auth && ST.named && !ST.entered;
    $("ct-wait").hidden = started;                       // العدّ التنازلي لحد بداية الجولة (بعد ما الجولة اللي فاتت اتكسبت)
    $("ct-in").hidden = !(ST.entered && !started);
    $("ct-login").hidden = ST.auth || !authOn;
    $("ct-name").hidden = !(ST.auth && !ST.named);
    $("ct-enter").hidden = !needEnter;
    $("ct-live").hidden = !isLive();
    $("ct-done").hidden = !(ST.rej || (w && w.mine));
    $("ct-end").hidden = !w || w.mine;
    $("ct-hall").hidden = !(ST.hall && ST.hall.length);
    if (!$("ct-wait").hidden) {
      $("ct-cd").textContent = cd(ST.start - t);
      const at = o => { try { return new Date(ST.start).toLocaleString("ar-EG", Object.assign({ timeZone: ST.tz }, o)); } catch (e) { return new Date(ST.start).toLocaleString("ar-EG", o); } };
      $("ct-day").textContent = at({ weekday: "long", day: "numeric", month: "long" }); $("ct-hr").textContent = at({ hour: "numeric", minute: "2-digit" });
    }
    if (needEnter) {
      $("ct-enter-t").textContent = "أثبت أنك إنسان ثم ادخل المسابقة."; $("ct-enter-t").hidden = !ST.captcha;
      if (ST.captcha) { mountTs(); $("ct-go").disabled = !tsTok; } else $("ct-go").disabled = false;
      $("ct-ts").hidden = !ST.captcha;
    }
    if (!$("ct-live").hidden) {
      $("ct-of").textContent = "من " + num(ST.target); paintCount();
      const ol = $("ct-top"); ol.replaceChildren();
      (ST.top || []).forEach((p, i) => ol.append(row("", [el("span", "rk", num(i + 1)), el("span", "nm", p.name), el("span", "ct", num(p.c))])));
    }
    if (!$("ct-done").hidden) {
      if (ST.rej) { $("ct-done-t").textContent = "استُبعدت نتيجتك بعد المراجعة."; $("ct-done-s").textContent = "نلتقي في الجولة القادمة بإذن الله."; }
      else {
        $("ct-done-t").textContent = `مبارك! بلغتَ ${num(ST.target)} تسبيحة في ${dur(w.d)}`;
        $("ct-done-s").textContent = "أنت صاحب «مَكْرُمَةُ ذِي الأَلْف» لهذه الجولة، وسيُخلَّد اسمك في لوحة المكرَّمين.";
      }
    }
    const left = ST.claim ? ST.claim.until - t : 0, cl = ST.claim && left > 0 ? ST.claim : null; $("ct-claimp").hidden = !cl;
    if (cl) {
      const open = !cl.c || claimEdit, h = Math.floor(left / 3600e3), m = Math.floor(left % 3600e3 / 60e3);
      $("ct-claim").hidden = !open; $("ct-claimed").hidden = open; $("ct-claim-ed").hidden = open;
      $("ct-claim-left").textContent = "المهلة المتبقية لتسجيل بياناتك: " + (h ? num(h) + " ساعة و" : "") + num(m) + " دقيقة.";
    }
    if (!$("ct-end").hidden) {
      const c = region(w.cc);
      $("ct-win").textContent = `المُكرَّم في الجولة الماضية: ${w.name}`;
      $("ct-win-s").textContent = `بلغ ${num(ST.target)} تسبيحة في ${dur(w.d)}` + (c ? " · " + c : "");
    }
    if (!$("ct-hall").hidden) {
      const ol = $("ct-hall-l"); ol.replaceChildren();
      ST.hall.forEach((f, i) => {
        const nm = el("span", "nm"), sub = el("small", "sub"), c = region(f.cc);
        nm.append(el("b", "", f.n)); sub.append(el("span", "", sameDay(f.t)), ...(c ? [el("span", "", c)] : [])); nm.append(sub);
        ol.append(row(i === 0 ? "first" : "", [el("span", "rk", num(i + 1)), nm, el("span", "ct", dur(f.d))]));
      });
    }
  }
  setInterval(() => {
    if (!ST || !seen || document.hidden) return;
    const st = now() >= ST.start;
    if (!st) { ST._s = false; paint(); }                                   // العدّ التنازلي بيتحدّث كل ثانية
    else if (ST._s === false) { ST._s = true; paint(); loadState(); }      // الجولة بدأت: نجيب الحالة الجديدة (من غير فايز الجولة اللي فاتت)
  }, 1000);
  new IntersectionObserver(en => { seen = en[0].isIntersecting; if (seen) loadState(); }).observe($("contest"));
  setInterval(() => { if (seen && !document.hidden) loadState(); }, 5000);

  // ───── التسبيح في المسابقة ─────
  async function flush() {
    if (busy || !isLive() || (!pending && !(ST.me >= ST.target))) return;   // (ST.me>=target: وصل الهدف والفايز اتستبعد، السيرفر هيحسم له الفوز)
    busy = true;
    try {
      const r = await api("contest/sync", { delta: Math.min(pending, 200) });
      ST.me = Math.min(r.count, ST.target); pending = Math.max(0, pending - r.accepted);
      if (r.done) { ST.done = true; pending = 0; setTimeout(loadState, 200); }
      else if (r.closed) { pending = 0; loadState(); }
    } catch (e) {
      if (e.status === 401) { user = null; ST.auth = false; pending = 0; dispatchEvent(new Event("wz-nosession")); acct(); }
      if (e.status === 409) { pending = 0; loadState(); }   // الجولة خلصت (فايز أو انتهى الوقت) أو لسه ما بدأتش
      if (e.status === 403) { pending = 0; loadState(); }
    }
    busy = false; paint();
    if (pending > 0 && !ST.done) setTimeout(flush, 1000);   // السيرفر بيقبل بسرعة محدودة، والباقي بيتبعت بعد ثانية
  }
  setInterval(flush, 1500);
  addEventListener("pagehide", flush);
  $("ctap").addEventListener("click", e => {
    if (!e.isTrusted) return;                                // ضغطة مولّدة بسكربت (مش ضغطة حقيقية) ما تتعدّش
    const t = performance.now(); if (t - lastTap < 115 || !isLive() || cnt() >= ST.target) return; lastTap = t;
    pending++; paintCount();
    try { navigator.vibrate && navigator.vibrate(8); } catch (_) {}
    if (cnt() >= ST.target) flush();
    if (reduce || !$("ctap").animate) return;
    try {
      const g = $("cglow").getBoundingClientRect();
      $("cglow").style.setProperty("--px", (e.detail ? e.clientX - g.left : g.width / 2) + "px");
      $("cglow").style.setProperty("--py", (e.detail ? e.clientY - g.top : g.height / 2) + "px");
      $("cglow").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: "ease-out" });
      $("ctap").animate([{ transform: "scale(.94)" }, { transform: "scale(1)" }], { duration: 200, easing: "ease-out", pseudoElement: "::before" });
      $("cn").animate([{ transform: "scale(1.09)" }, { transform: "scale(1)" }], { duration: 180, easing: "ease-out" });
    } catch (_) {}
  });
  $("ctap").addEventListener("keydown", e => { if (e.repeat) e.preventDefault(); });

  $("ct-claim").addEventListener("submit", async e => {
    e.preventDefault();
    try { await api("contest/claim", { contact: $("ct-contact").value }); say("ct-msg", ""); claimEdit = false; $("ct-contact").value = ""; loadState(); }
    catch (err) { say("ct-msg", err.status === 400 ? "اكتب رقماً أو حساباً صحيحاً." : "حدث خطأ، حاول مرة أخرى."); }
  });
  $("ct-claim-ed").addEventListener("click", () => { claimEdit = true; paint(); $("ct-contact").focus(); });

  // ───── بداية: مين داخل بجوجل؟ ─────
  (async () => {
    try {
      const m = await api("auth/me"); authOn = m.authOn;
      if (m.user) { user = m.user; dispatchEvent(new CustomEvent("wz-login", { detail: m.user })); }
      else dispatchEvent(new Event("wz-nosession"));
    } catch (e) {}
    acct(); loadGsi(); loadState();
  })();
})();
