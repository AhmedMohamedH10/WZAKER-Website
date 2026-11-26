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

/* بلور الكروت على الموبايل: بيتفعّل بس على الأجهزة القوية (ذاكرة 4GB+ و6 أنوية+) ومن غير توفير بيانات أو تقليل حركة، علشان السكرول ما يتقطّعش على الضعيفة */
(function () {
  try {
    var n = navigator, c = n.connection || {};
    var ok = matchMedia("(pointer: coarse)").matches && !c.saveData && !/(^|-)2g$/.test(c.effectiveType || "") &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches && (n.hardwareConcurrency || 0) >= 6 && (n.deviceMemory === undefined || n.deviceMemory >= 4);
    if (ok) document.documentElement.classList.add("blur-ok");
  } catch (e) {}
})();
