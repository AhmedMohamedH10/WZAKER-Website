/* GitHub repo (must be Public): owner/name */
const REPO = "AhmedMohamedH10/WZAKER";

/* ريبو الأندرويد العام (فيه WZAKER.apk في Releases) */
const ANDROID_REPO = "AhmedMohamedH10/wzaker-app-release";

/* دخول جوجل: الـ Client ID بتاع Google Cloud (بيبان للناس عادي، مش سر). سيبه "" لو لسه ما اتفعّلش وزرار الدخول والمسابقة مش هيظهروا */
const GOOGLE_CLIENT_ID = "13720239105-n581u7t24i4ecr9sq8u8tqb0gk0jrtd8.apps.googleusercontent.com";
/* Cloudflare Turnstile (اختياري، بيتأكد إن اللي داخل المسابقة إنسان). الـ Site Key بيبان للناس عادي. سيبه "" لو مش عاوزه */
const TURNSTILE_SITEKEY = "";

/* بلور الكروت على الموبايل: بيبدأ من ذاكرة 2GB+ (المتصفح بيعرض جهاز 3GB كأنه 2GB) و6 أنوية+، ومن غير توفير بيانات أو تقليل حركة.
   وعلشان الجهاز ما يتعلّقش: بعد ما البلور يشتغل بنقيس سلاسة الفريمات ثواني، ولو الجهاز ضعيف بنقفل البلور لوحده ونفتكر ده (localStorage) */
(function () {
  try {
    var n = navigator, c = n.connection || {}, de = document.documentElement, bad = false;
    var dbg = location.hash === "#blur";   /* افتح الموقع بـ #blur في آخر الرابط: بيصفّر قفل البلور القديم ويعرض سبب التفعيل/العدم */
    try { if (dbg) localStorage.removeItem("noblur"); bad = localStorage.getItem("noblur") === "1"; } catch (e) {}
    var badge = function (msg) {
      if (!dbg) return;
      addEventListener("DOMContentLoaded", function () {
        var d = document.getElementById("blurdbg") || document.body.appendChild(document.createElement("div"));
        d.id = "blurdbg"; d.textContent = msg;
        d.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;padding:8px 10px;border-radius:10px;background:#000c;color:#3dffa3;font:12px/1.5 monospace;direction:ltr;text-align:left";
      });
    };
    var info = "cores=" + n.hardwareConcurrency + " mem=" + n.deviceMemory + " coarse=" + matchMedia("(pointer: coarse)").matches +
      " saveData=" + !!c.saveData + " net=" + (c.effectiveType || "?") + " reduceMotion=" + matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ok = !bad && matchMedia("(pointer: coarse)").matches && !c.saveData && !/(^|-)2g$/.test(c.effectiveType || "") &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches && (n.hardwareConcurrency || 0) >= 6 && (n.deviceMemory === undefined || n.deviceMemory >= 2);
    if (!ok) { badge("BLUR OFF (device check) | " + info + (bad ? " | noblur flag set" : "")); return; }
    de.classList.add("blur-ok");
    badge("BLUR ON, measuring... | " + info);
    /* الحارس: بعد ثانيتين من التحميل، بنعدّ 90 فريم. لو المتوسط أقل من ~40fps أو فيه تهنيج كبير، البلور يتقفل */
    var guard = function () {
      var t0 = 0, last = 0, frames = 0, worst = 0;
      var step = function (t) {
        if (document.hidden) { setTimeout(guard, 3000); return; }
        if (last) { worst = Math.max(worst, t - last); }
        if (!t0) t0 = t;
        last = t; frames++;
        if (frames < 90) { requestAnimationFrame(step); return; }
        var fps = (frames - 1) / ((t - t0) / 1000);
        var off = fps < 40 || worst > 220;
        if (off) {
          de.classList.remove("blur-ok");
          try { localStorage.setItem("noblur", "1"); } catch (e) {}
        }
        badge((off ? "BLUR OFF (slow: " : "BLUR ON (smooth: ") + fps.toFixed(0) + "fps, worst frame " + worst.toFixed(0) + "ms) | " + info);
      };
      requestAnimationFrame(step);
    };
    addEventListener("load", function () { setTimeout(guard, 2000); });
  } catch (e) {}
})();
