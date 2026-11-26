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
   وعلشان الجهاز ما يتعلّقش: بعد ما البلور يشتغل بنقيس سلاسة الفريمات ثواني، ولو الجهاز ضعيف بنقفل البلور لوحده ونفتكر ده (localStorage) */
(function () {
  try {
    var n = navigator, c = n.connection || {}, de = document.documentElement, bad = false;
    try { bad = localStorage.getItem("noblur") === "1"; } catch (e) {}
    var ok = !bad && matchMedia("(pointer: coarse)").matches && !c.saveData && !/(^|-)2g$/.test(c.effectiveType || "") &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches && (n.hardwareConcurrency || 0) >= 6 && (n.deviceMemory === undefined || n.deviceMemory >= 2);
    if (!ok) return;
    de.classList.add("blur-ok");
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
        if (fps < 40 || worst > 220) {
          de.classList.remove("blur-ok");
          try { localStorage.setItem("noblur", "1"); } catch (e) {}
        }
      };
      requestAnimationFrame(step);
    };
    addEventListener("load", function () { setTimeout(guard, 2000); });
  } catch (e) {}
})();
