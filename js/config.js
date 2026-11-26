/* GitHub repo (must be Public): owner/name */
const REPO = "AhmedMohamedH10/WZAKER";

/* MediaFire links. Leave "" if not ready and the site shows "soon" */
const MEDIAFIRE = { pc: "https://www.mediafire.com/file/k0k2m025igwyrsw/WZAKER+3.6.10.zip/file", phone: "https://www.mediafire.com/file/r7uunkb46dydx1n/WZAKER+App+1.0.3+No+Internet.apk/file" };


/* ريبو الأندرويد العام (فيه WZAKER.apk في Releases) */
const ANDROID_REPO = "AhmedMohamedH10/wzaker-app-release";

/* دخول جوجل: الـ Client ID بتاع Google Cloud (بيبان للناس عادي، مش سر). سيبه "" لو لسه ما اتفعّلش وزرار الدخول والمسابقة مش هيظهروا */
const GOOGLE_CLIENT_ID = "13720239105-n581u7t24i4ecr9sq8u8tqb0gk0jrtd8.apps.googleusercontent.com";
/* Cloudflare Turnstile (اختياري، بيتأكد إن اللي داخل المسابقة إنسان). الـ Site Key بيبان للناس عادي. سيبه "" لو مش عاوزه */
const TURNSTILE_SITEKEY = "";

/* بلور الكروت على الموبايل: بيبدأ من ذاكرة 2GB+ (المتصفح بيعرض جهاز 3GB كأنه 2GB) و6 أنوية+، ومن غير توفير بيانات أو تقليل حركة.
   علشان الجهاز ما يتعلّقش: (1) بنقيس سلاسة الفريمات وهو من غير بلور، ولو سلس بس نفتح البلور (بنعومة)،
   (2) بعد ما يتفتح بنراقبه ثواني، ولو الجهاز اتقل بنقفله بنعومة ونفتكر ده (localStorage) */
(function () {
  try {
    var n = navigator, c = n.connection || {}, de = document.documentElement, bad = false;
    var dbg = location.hash === "#blur";   /* افتح الموقع بـ #blur في آخر الرابط: بيصفّر القفل القديم ويعرض الحالة */
    try { if (dbg) localStorage.removeItem("noblur"); bad = localStorage.getItem("noblur") === "1"; } catch (e) {}
    var info = "cores=" + n.hardwareConcurrency + " mem=" + n.deviceMemory + " coarse=" + matchMedia("(pointer: coarse)").matches +
      " saveData=" + !!c.saveData + " net=" + (c.effectiveType || "?") + " reduceMotion=" + matchMedia("(prefers-reduced-motion: reduce)").matches;
    var badge = function (msg) {
      if (!dbg) return;
      var put = function () {
        var d = document.getElementById("blurdbg") || document.body.appendChild(document.createElement("div"));
        d.id = "blurdbg"; d.textContent = msg + " | " + info;
        d.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;padding:8px 10px;border-radius:10px;background:#000c;color:#3dffa3;font:12px/1.5 monospace;direction:ltr;text-align:left";
      };
      document.body ? put() : addEventListener("DOMContentLoaded", put);
    };
    var ok = !bad && matchMedia("(pointer: coarse)").matches && !c.saveData && !/(^|-)2g$/.test(c.effectiveType || "") &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches && (n.hardwareConcurrency || 0) >= 6 && (n.deviceMemory === undefined || n.deviceMemory >= 2);
    if (!ok) { badge("BLUR OFF (device check)" + (bad ? ", noblur flag set" : "")); return; }

    /* بيعدّ عدد فريمات ويرجّع {fps, slow} (slow = عدد الفريمات الأبطأ من 50ms). لو التبويب اتخبّى بيرجّع null */
    var measure = function (count, cb) {
      var t0 = 0, last = 0, f = 0, slow = 0;
      var step = function (t) {
        if (document.hidden) { cb(null); return; }
        if (last && t - last > 50) slow++;
        if (!t0) t0 = t;
        last = t; f++;
        if (f < count) { requestAnimationFrame(step); return; }
        cb({ fps: (f - 1) / ((t - t0) / 1000), slow: slow });
      };
      requestAnimationFrame(step);
    };
    var idle = function (fn) { "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 800); };

    var watch = function () {   /* بعد ما البلور يتفتح: نراقب، ولو الجهاز اتقل نقفله بنعومة */
      setTimeout(function () {
        measure(90, function (r) {
          if (!r) return setTimeout(watch, 4000);
          var off = r.fps < 38 || r.slow > 8;
          if (off) {
            de.classList.remove("blur-ok");   /* الـ transition في CSS بيخلي القفل تدريجي */
            try { localStorage.setItem("noblur", "1"); } catch (e) {}
          }
          badge((off ? "BLUR OFF (slow with blur: " : "BLUR ON (smooth: ") + r.fps.toFixed(0) + "fps, " + r.slow + " slow frames)");
        });
      }, 1200);
    };
    var probe = function () {   /* قبل ما نفتح البلور: لو الجهاز مش سلس أصلًا من غير بلور، مش هنفتحه خالص */
      idle(function () {
        measure(45, function (r) {
          if (!r) return setTimeout(probe, 4000);
          if (r.fps >= 52 && r.slow <= 2) { de.classList.add("blur-ok"); badge("BLUR ON, monitoring (baseline " + r.fps.toFixed(0) + "fps)"); watch(); }
          else badge("BLUR OFF (device not smooth without blur: " + r.fps.toFixed(0) + "fps, " + r.slow + " slow frames)");
        });
      });
    };
    addEventListener("load", function () { setTimeout(probe, 1500); });
  } catch (e) {}
})();
