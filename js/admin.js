/* لوحة التحكم: الفائزون + المسابقة وترتيب المتسابقين + اللاعبون + الإحصائيات. تطلب /api/admin/*. كل النصوص بـ textContent (مفيش innerHTML) */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY = ""; try { KEY = sessionStorage.getItem("wz_ak") || ""; } catch (e) {}
  var CT = null, timer = 0, tick = 0, poll = 0, toastT = 0, BEADS = 33, DAY = 864e5, CUR = "w", SEL = null, RSIG = "", PQ = 0, BANF = false, PT = 0, TD = false;
  var LOC = "ar-EG-u-nu-latn";

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmt(ms) {                                     // «20 نوفمبر · 9:36 ص» (والسنة لو مختلفة عن الحالية)
    try {
      var d = new Date(ms), y = d.getFullYear() !== new Date().getFullYear();
      return d.toLocaleDateString(LOC, y ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "long" }) + " · " + d.toLocaleTimeString(LOC, { hour: "numeric", minute: "2-digit" });
    } catch (e) { return new Date(ms).toISOString(); }
  }
  function p2(n) { return String(n).padStart(2, "0"); }
  function dur(s) { return p2(Math.floor(s / 60)) + ":" + p2(s % 60); }
  function region(cc) { try { return cc ? new Intl.DisplayNames(["ar"], { type: "region" }).of(cc) || cc : ""; } catch (e) { return cc || ""; } }
  function toast(t, err) {
    var b = $("ad-toast"); b.textContent = t; b.className = "toast on" + (err ? " err" : "");
    clearTimeout(toastT); toastT = setTimeout(function () { b.className = "toast" + (err ? " err" : ""); }, 2600);
  }
  function call(path, body) {
    return fetch("/api/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ key: KEY }, body || {})), cache: "no-store" })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); });
  }
  function copy(btn, text) {
    var o = btn.textContent, done = function () { btn.textContent = "تم النسخ"; setTimeout(function () { btn.textContent = o; }, 1400); };
    try { navigator.clipboard.writeText(text).then(done, done); } catch (e) { done(); }
  }

  /* ───── الفائزون ───── */
  function kv(label, value, extra) {
    var r = el("div", "kv"); r.appendChild(el("span", null, label)); r.appendChild(el("bdi", null, value));
    var b = el("button", "btn sm", "نسخ"); b.type = "button"; b.onclick = function () { copy(b, value); }; r.appendChild(b);
    if (extra) r.appendChild(extra);
    return r;
  }
  function renderWinners(d) {
    var box = $("ad-wl"); box.textContent = "";
    if (!d.winners.length) { box.appendChild(el("div", "empty", "لا يوجد فائزون بعد")); return; }
    d.winners.forEach(function (w) {
      var c = el("article", "w" + (w.status === "rejected" ? " rej" : "")), h = el("div", "w-h");
      h.appendChild(el("div", "av", (w.name || "؟").charAt(0)));
      var n = el("div", "w-n"); n.appendChild(el("b", null, w.name || "بلا اسم"));
      n.appendChild(el("small", null, fmt(w.fa)));
      n.appendChild(el("small", null, [region(w.cc), "المدة " + dur(w.secs)].filter(Boolean).join(" · ")));
      h.appendChild(n); c.appendChild(h);
      var chip;
      if (w.status === "rejected") chip = el("span", "chip no", "مستبعد");
      else if (w.contact) chip = el("span", "chip ok", "سُجّل الرقم");
      else if (w.open) { var l = w.fa + d.claimMs - d.now; chip = el("span", "chip wait", "بانتظار الرقم · " + Math.floor(l / 36e5) + " س " + p2(Math.floor(l % 36e5 / 6e4)) + " د"); }
      else chip = el("span", "chip no", "انتهت المهلة");
      h.appendChild(chip);
      if (w.contact) {
        var digits = w.contact.replace(/[\s\-()]/g, ""), wa = null;
        if (/^\+?\d{8,15}$/.test(digits)) { wa = el("a", "btn sm wa", "واتساب"); wa.href = "https://wa.me/" + digits.replace(/^\+/, ""); wa.target = "_blank"; wa.rel = "noopener noreferrer"; }
        c.appendChild(kv("الرقم", w.contact, wa));
      }
      if (w.email) c.appendChild(kv("البريد", w.email));
      /* مؤشرات المراجعة (تقدير مش حكم: الشبكة المشتركة ممكن تطلع من نفس الواي فاي أو شبكة موبايل) */
      var s3 = el("div", "w-s");
      [["السرعة", w.rate ? w.rate + " في الثانية" : "—"], ["الانتظام", w.cv == null ? "—" : String(w.cv)], ["نفس الشبكة", String(w.ipn || 0)]].forEach(function (x) {
        var d3 = el("div"); d3.appendChild(el("small", null, x[0])); d3.appendChild(el("b", null, x[1])); s3.appendChild(d3);
      });
      c.appendChild(s3);
      var fl = [];
      if (w.rate >= 7) fl.push("سرعة قريبة من الحد الأقصى");
      if (w.cv != null && w.cv < 0.1) fl.push("انتظام عالي جدًا");
      if (w.ipn > 0) fl.push(w.ipn + " حساب آخر من نفس الشبكة");
      if (w.banned && w.status !== "rejected") fl.push("المتسابق محظور");
      var dn = /contacted/.test(w.status || ""), hid = /hidden/.test(w.status || "");
      if (dn) fl.push("تم التواصل");
      if (hid) fl.push("مخفي من اللوحة");
      if (fl.length) { var fb = el("div", "w-fl"); fl.forEach(function (t) { fb.appendChild(el("span", "chip wait", t)); }); c.appendChild(fb); }
      var f = el("div", "w-f"), id = el("button", "lnk", "نسخ المعرّف"); id.type = "button"; id.onclick = function () { copy(id, w.pid); };
      f.appendChild(id);
      if (w.status !== "rejected") {
        var ct = el("button", "btn sm", dn ? "إعادة فتح التعديل" : "تم التواصل معه"); ct.type = "button";
        ct.onclick = function () { act("admin/winner/flag", { cid: w.cid, pid: w.pid, contacted: !dn }); };
        f.appendChild(ct);
        var hd = el("button", "btn sm", hid ? "إظهار في اللوحة" : "إخفاء من اللوحة"); hd.type = "button";
        hd.onclick = function () { if (hid || confirm("إخفاء اسم " + (w.name || "الفائز") + " من لوحة المكرَّمين؟")) act("admin/winner/flag", { cid: w.cid, pid: w.pid, hidden: !hid }); };
        f.appendChild(hd);
        var rj = el("button", "btn sm danger", "استبعاد وحظر"); rj.type = "button";
        rj.onclick = function () { if (confirm("استبعاد " + (w.name || "الفائز") + " وحظره؟ الجولة هتتفتح تاني لباقي المتسابقين.")) act("admin/winner/reject", { cid: w.cid, pid: w.pid }); };
        f.appendChild(rj);
      }
      c.appendChild(f);
      box.appendChild(c);
    });
  }

  /* ───── حلقة المسبحة ───── */
  var beads = [];
  (function build() {
    var svg = document.querySelector("#ad-ring svg"), NS = "http://www.w3.org/2000/svg";
    for (var i = 0; i < BEADS; i++) {
      var a = i / BEADS * 2 * Math.PI - Math.PI / 2, c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", (110 + 96 * Math.cos(a)).toFixed(2)); c.setAttribute("cy", (110 + 96 * Math.sin(a)).toFixed(2)); c.setAttribute("r", 5.2);
      c.setAttribute("class", "bd"); c.style.setProperty("--i", i); svg.appendChild(c); beads.push(c);
    }
  })();
  function light(n) { for (var i = 0; i < BEADS; i++) beads[i].classList.toggle("on", i < n); }
  function paintHero() { paintBase(); applyPrev(); }
  function applyPrev() {                                 // معاينة الهدف المكتوب في الحلقة (مش بتغيّر الجولة الفعلية)
    var t = target(), on = TD && t && (!CT || !CT.round || CT.round.target !== t);
    $("ad-ring").classList.toggle("prev", !!on);
    if (on) { $("ad-rk").textContent = "الهدف الجديد"; $("ad-rv").textContent = t; $("ad-rs").textContent = "معاينة فقط · اضغط «ابدأ الآن» لتطبيقه"; }
  }
  function paintBase() {
    var d = CT; if (!d) return;
    var ring = $("ad-ring"), r = d.round, now = Date.now() + (d.now - d.at0);
    ring.classList.remove("live");
    if (!r) { light(0); $("ad-rk").textContent = ""; $("ad-rv").textContent = "—"; $("ad-rs").textContent = "لا توجد جولة"; $("ad-f1").textContent = "0"; $("ad-f2").textContent = "—"; return; }
    $("ad-f1").textContent = r.entries; $("ad-f2").textContent = r.manual ? "يدوية" : "أسبوعية";
    if (r.live) {
      ring.classList.add("live"); light(BEADS);
      $("ad-rk").textContent = "الهدف"; $("ad-rv").textContent = r.target; $("ad-rs").textContent = "جارية منذ " + fmt(r.at);
    } else {
      var left = Math.max(0, r.at - now), t = Math.ceil(left / 1000), dd = Math.floor(t / 86400);
      light(Math.round(BEADS * (1 - Math.min(1, left / DAY))));
      $("ad-rk").textContent = dd ? dd + " يوم" : "تبدأ بعد";
      $("ad-rv").textContent = p2(Math.floor(t % 86400 / 3600)) + ":" + p2(Math.floor(t % 3600 / 60)) + ":" + p2(t % 60);
      $("ad-rs").textContent = fmt(r.at);
    }
  }

  /* ───── التحكم في المسابقة ───── */
  function mrow(m, now) {
    var r = el("div", "mr"), t = el("div");
    t.appendChild(el("span", null, fmt(m.at))); t.appendChild(el("small", null, "الهدف " + m.target + (m.entries ? " · " + m.entries + " مشارك" : "")));
    r.appendChild(t);
    var done = m.at <= now && m.won > 0, canceled = m.status === "canceled";
    var chip = canceled ? el("span", "chip no", "ملغاة") : m.at > now ? el("span", "chip wait", "مجدولة") : done ? el("span", "chip", "منتهية") : el("span", "chip ok", "جارية");
    r.appendChild(chip);
    if (!canceled && !done) {
      var b = el("button", "btn sm", m.at > now ? "إلغاء" : "إنهاء"); b.type = "button";
      b.onclick = function () { if (confirm(m.at > now ? "إلغاء الجولة المجدولة؟" : "إنهاء الجولة الجارية؟")) act("admin/contest/cancel", { id: m.id }); };
      r.appendChild(b);
    }
    return r;
  }
  function renderSt(s) {
    var sel = $("ad-rsel"), box = $("ad-sl"), sig = s.rounds.map(function (r) { return r.id + ":" + r.entries + ":" + r.won; }).join(",");
    if (sig !== RSIG) {                                  // منعيدش بناء القائمة لو ما اتغيرتش (علشان ما تقفلش وانت بتختار)
      RSIG = sig; sel.textContent = "";
      s.rounds.forEach(function (r) { var o = el("option", null, fmt(r.at) + " · " + r.entries + " مشارك" + (r.won ? " · انتهت" : "")); o.value = String(r.id); sel.appendChild(o); });
    }
    sel.hidden = !s.rounds.length; sel.value = String(s.cid);
    box.textContent = "";
    if (!s.rows.length) { box.appendChild(el("div", "empty", "لا يوجد مشاركون في هذه الجولة بعد")); return; }
    s.rows.forEach(function (r, i) {
      var row = el("div", "sr" + (r.win ? " win" : "") + (r.rej ? " rej" : "")), m = el("div", "si");
      row.appendChild(el("i", "rk", String(i + 1)));
      m.appendChild(el("b", null, r.name || "بلا اسم"));
      var rg = region(r.cc); if (rg) m.appendChild(el("small", null, rg));
      var bar = el("div", "bar"), u = el("u"); u.style.width = (s.target ? Math.min(100, Math.round(r.n / s.target * 100)) : 0) + "%"; bar.appendChild(u); m.appendChild(bar);
      row.appendChild(m);
      var sc = el("div", "sc"); sc.appendChild(el("bdi", null, r.n + " / " + s.target));
      if (r.win) sc.appendChild(el("span", "chip ok", "★ الفائز"));
      else if (r.rej) sc.appendChild(el("span", "chip no", "مستبعد"));
      else if (r.ban) sc.appendChild(el("span", "chip no", "محظور"));
      row.appendChild(sc); box.appendChild(row);
    });
  }
  function renderCt(d) {
    d.at0 = Date.now(); CT = d; if (d.st) renderSt(d.st);
    $("ad-warn").hidden = d.v7; $("ad-ctl").hidden = !d.v7;
    $("ad-wk").setAttribute("aria-checked", d.weeklyOn ? "true" : "false");
    var ml = $("ad-ml"); ml.textContent = ""; d.list.forEach(function (m) { ml.appendChild(mrow(m, d.now)); });
    $("ad-at").min = new Date(Date.now() + 120000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    paintHero(); clearInterval(tick); tick = setInterval(paintHero, 1000);
  }
  var ERR = { id: "بيانات غير صحيحة.", "migrate-v7": "نفّذ migrate-v7.sql أولًا.", "migrate-v8": "نفّذ migrate-v8.sql أولًا.", range: "المدى غير صحيح: الأقل 10 أو أكثر، والأعلى بعده وحتى 100000.", time: "الموعد بعد دقيقتين على الأقل.", exists: "توجد جولة في الموعد نفسه.", auth: "المفتاح غير صحيح." };
  function act(path, body) {
    return call(path, body).then(function (x) {
      if (x.s === 200) { TD = false; toast("تم"); load(); } else toast(ERR[x.j && x.j.error] || "حدث خطأ.", true);
    }).catch(function () { toast("تعذّر الاتصال.", true); });
  }
  function loadCt() { return call("admin/contest", { cid: SEL }).then(function (x) { if (x.s === 200) renderCt(x.j); }).catch(function () {}); }
  $("ad-rsel").onchange = function () { SEL = +this.value || null; loadCt(); };
  $("ad-t").oninput = function () { TD = true; paintHero(); };
  function target() { var n = Math.floor(+$("ad-t").value); return n >= 10 && n <= 100000 ? n : 0; }
  $("ad-now").onclick = function () {
    var t = target(); if (!t) return toast("الهدف بين 10 و100000.", true);
    if (confirm("بدء جولة الآن بهدف " + t + "؟ هتحل محل الجولة الشغالة.")) act("admin/contest/start", { target: t });
  };
  $("ad-sched").onclick = function () {
    var t = target(), v = $("ad-at").value, at = v ? new Date(v).getTime() : 0;
    if (!t) return toast("الهدف بين 10 و100000.", true);
    if (!at) return toast("اختر الموعد.", true);
    if (confirm("جدولة جولة في " + fmt(at) + "؟")) act("admin/contest/schedule", { at: at, target: t });
  };
  $("ad-wk").onclick = function () {
    var on = CT && CT.weeklyOn;
    if (confirm(on ? "إيقاف الجولات الأسبوعية؟" : "تشغيل الجولات الأسبوعية؟")) act("admin/contest/weekly", { on: !on });
  };

  /* ───── الهدف اليومي ───── */
  var DD = null, DTD = false, DMD = false;               // DTD/DMD: كتبت في الحقل ولسه ما طبّقتش (نمنع التحديث التلقائي من مسح كتابتك)
  function left(ms) { var m = Math.max(0, Math.ceil(ms / 6e4)); return Math.floor(m / 60) + " س " + p2(m % 60) + " د"; }
  function renderDaily(d) {
    DD = d; $("ad-dwarn").hidden = d.v8; $("ad-dbody").hidden = !d.v8;
    if (!d.v8) return;
    $("ad-dg").classList.toggle("off", !d.on);
    $("ad-dv").textContent = d.goal; $("ad-dm").textContent = (d.on ? "" : "متوقف · ") + (d.manual ? "حدّدته أنت" : "عشوائي");
    $("ad-d1").textContent = d.reached; $("ad-d2").textContent = d.entries; $("ad-d3").textContent = left(d.end - d.now);
    $("ad-don").setAttribute("aria-checked", d.on ? "true" : "false");
    if (!DTD) $("ad-dt").value = d.goal;
    if (!DMD) { $("ad-dmin").value = d.min; $("ad-dmax").value = d.max; }
    var box = $("ad-dl"); box.textContent = "";
    if (!d.rows.length) { box.appendChild(el("div", "empty", "لم يبلغ أحد الهدف اليوم بعد")); return; }
    d.rows.forEach(function (r, i) {
      var row = el("div", "sr" + (r.ban ? " rej" : "")), m = el("div", "si");
      row.appendChild(el("i", "rk", String(i + 1)));
      m.appendChild(el("b", null, r.name || "بلا اسم")); m.appendChild(el("small", null, "وصل في " + fmt(r.fa)));
      row.appendChild(m);
      var sc = el("div", "sc");
      if (r.ban) sc.appendChild(el("span", "chip no", "محظور"));
      else {
        var bn = el("button", "btn sm danger", "حظر"); bn.type = "button";
        bn.onclick = function () {
          if (!confirm("حظر " + (r.name || "المتسابق") + "؟ هيختفي من القائمة وهيتسجّل خروجه ومش هيقدر يسبّح.")) return;
          call("admin/player/ban", { pid: r.pid, banned: true }).then(function (x) {
            if (x.s === 200) { toast("تم"); loadDaily(); } else toast(ERR[x.j && x.j.error] || "حدث خطأ.", true);
          }).catch(function () { toast("تعذّر الاتصال.", true); });
        };
        sc.appendChild(bn);
      }
      row.appendChild(sc); box.appendChild(row);
    });
  }
  function loadDaily() { return call("admin/daily").then(function (x) { if (x.s === 200) renderDaily(x.j); }).catch(function () {}); }
  function actD(path, body, after) {
    return call(path, body).then(function (x) {
      if (x.s === 200) { toast("تم"); if (after) after(x.j); loadDaily(); } else toast(ERR[x.j && x.j.error] || "حدث خطأ.", true);
    }).catch(function () { toast("تعذّر الاتصال.", true); });
  }
  function range(id) { var n = Math.floor(+$(id).value); return n >= 10 && n <= 100000 ? n : 0; }
  $("ad-dt").oninput = function () { DTD = true; };
  $("ad-dmin").oninput = $("ad-dmax").oninput = function () { DMD = true; };
  $("ad-dset").onclick = function () {
    var n = range("ad-dt"); if (!n) return toast("الهدف بين 10 و100000.", true);
    if (confirm("تحديد هدف اليوم بـ " + n + "؟")) actD("admin/daily/set", { goal: n }, function () { DTD = false; });
  };
  $("ad-dre").onclick = function () { if (confirm("اختيار هدف عشوائي جديد لليوم؟")) actD("admin/daily/set", {}, function () { DTD = false; }); };
  $("ad-dsave").onclick = function () {
    var a = range("ad-dmin"), b = range("ad-dmax");
    if (!a || !b || a > b) return toast("اكتب مدى صحيحًا: الأقل أولًا والأعلى بعده.", true);
    actD("admin/daily/config", { min: a, max: b }, function () { DMD = false; });
  };
  $("ad-don").onclick = function () {
    var on = DD && DD.on;
    if (confirm(on ? "إيقاف الهدف اليومي؟ هيختفي من الموقع." : "تشغيل الهدف اليومي؟")) actD("admin/daily/config", { on: !on });
  };

  /* ───── اللاعبون ───── */
  function renderPl(d) {
    var box = $("ad-pl"); box.textContent = "";
    if (!d.players.length) { box.appendChild(el("div", "empty", "لا توجد نتائج")); return; }
    d.players.forEach(function (p) {
      var r = el("div", "mr"), t = el("div"), sm = el("small");
      t.appendChild(el("b", null, p.name || "بلا اسم"));
      sm.appendChild(document.createTextNode(p.total + " تسبيحة"));
      if (p.email) { sm.appendChild(document.createTextNode(" · ")); sm.appendChild(el("bdi", null, p.email)); }
      t.appendChild(sm); r.appendChild(t);
      if (p.banned) r.appendChild(el("span", "chip no", "محظور"));
      var b = el("button", "btn sm" + (p.banned ? "" : " danger"), p.banned ? "فك الحظر" : "حظر"); b.type = "button";
      b.onclick = function () {
        if (!confirm(p.banned ? "فك حظر " + (p.name || "المتسابق") + "؟" : "حظر " + (p.name || "المتسابق") + "؟ هيتسجّل خروجه ومش هيقدر يسبّح في المسابقة.")) return;
        call("admin/player/ban", { pid: p.pid, banned: !p.banned }).then(function (x) {
          if (x.s === 200) { toast("تم"); loadPl(); } else toast(ERR[x.j && x.j.error] || "حدث خطأ.", true);
        }).catch(function () { toast("تعذّر الاتصال.", true); });
      };
      r.appendChild(b); box.appendChild(r);
    });
  }
  function loadPl() {
    var n = ++PQ;                                        // نتجاهل أي رد قديم وصل بعد بحث أحدث
    return call("admin/players", { q: $("ad-q").value, banned: BANF }).then(function (x) {
      if (n === PQ && x.s === 200) renderPl(x.j);
    }).catch(function () {});
  }
  $("ad-q").oninput = function () { clearTimeout(PT); PT = setTimeout(loadPl, 350); };
  $("ad-bf").onclick = function () { BANF = !BANF; this.classList.toggle("on", BANF); this.setAttribute("aria-pressed", BANF ? "true" : "false"); loadPl(); };

  /* ───── الإحصائيات ───── */
  function renderStats(d) {
    var box = $("ad-sg"); box.textContent = "";
    var G = ""; function head(t, g) { G = g || ""; box.appendChild(el("h2", null, t)); }
    function cell(label, n, hot) { var c = el("div", "c" + (hot ? " hot" : "") + (G ? " " + G : "")); c.appendChild(el("b", null, String(n))); c.appendChild(el("small", null, label)); box.appendChild(c); }
    head("الزوار", "vs");
    if (d.v) {
      cell("متصلون الآن", d.v.online, true); cell("يسبّحون الآن", d.v.tapping, true);
      cell("زوار جدد (آخر 24 ساعة)", d.v.fresh); cell("نشطون (آخر 24 ساعة)", d.v.active);
      cell("إجمالي الزوار", d.v.total); cell("جاءوا من رابط دعوة", d.v.ref);
    } else box.appendChild(el("p", "warn", "جدول الزوار غير موجود. شغّل آخر 3 أسطر من schema.sql."));
    head("المتسابقون", "pl");
    if (d.p) { cell("إجمالي المتسابقين", d.p.total); cell("لديهم اسم", d.p.named); cell("سجّلوا الدخول", d.p.google); cell("محظورون", d.p.banned); }
    else box.appendChild(el("p", "warn", "تعذّر قراءة جدول المتسابقين."));
  }
  function loadStats() { return call("admin/stats").then(function (x) { if (x.s === 200) renderStats(x.j); }).catch(function () {}); }

  /* ───── الدخول والتبويبات ───── */
  function tab(t) {
    CUR = t;
    document.querySelectorAll(".tab").forEach(function (b) { var on = b.dataset.t === t; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    ["w", "c", "d", "p", "s"].forEach(function (k) { $("p-" + k).hidden = k !== t; });
    if (t === "p") loadPl(); else if (t === "s") loadStats(); else if (t === "d") loadDaily();
  }
  document.querySelectorAll(".tab").forEach(function (b) { b.onclick = function () { tab(b.dataset.t); }; });

  function load() {
    return call("admin/winners").then(function (x) {
      if (x.s === 200) {
        try { sessionStorage.setItem("wz_ak", KEY); } catch (e) {}
        $("ad-login").hidden = true; $("ad-app").hidden = false; $("ad-err").textContent = "";
        renderWinners(x.j); loadCt(); clearTimeout(timer); timer = setTimeout(load, 60000);
        if (!poll) poll = setInterval(function () {      // تحديث أسرع (10 ث) للتبويب المفتوح: ترتيب المتسابقين والإحصائيات
          if (document.hidden || $("ad-app").hidden) return;
          if (CUR === "c") loadCt(); else if (CUR === "s") loadStats(); else if (CUR === "d") loadDaily();
        }, 10000);
      } else if (x.s === 401) { logout(); $("ad-err").textContent = "المفتاح غير صحيح."; }
      else if (x.s === 429) { logout(); $("ad-err").textContent = "محاولات كتير غلط. استنى 15 دقيقة وجرّب تاني."; }
      else if (x.s === 503) { logout(); $("ad-err").textContent = "اللوحة غير مفعّلة."; }
      else toast("حدث خطأ.", true);
    }).catch(function () { toast("تعذّر الاتصال.", true); });
  }
  function logout() {
    KEY = ""; try { sessionStorage.removeItem("wz_ak"); } catch (e) {}
    clearTimeout(timer); clearInterval(tick); clearInterval(poll); poll = 0; $("ad-app").hidden = true; $("ad-login").hidden = false; $("ad-key").value = "";
  }
  $("ad-login").addEventListener("submit", function (e) { e.preventDefault(); KEY = $("ad-key").value.trim(); if (KEY) load(); });
  $("ad-refresh").onclick = function () { load().then(function () { if (CUR === "p") loadPl(); else if (CUR === "s") loadStats(); else if (CUR === "d") loadDaily(); toast("تم التحديث"); }); };
  $("ad-out").onclick = function () { logout(); };
  if (KEY) load();
})();
