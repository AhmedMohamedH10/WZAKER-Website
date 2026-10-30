/* نقل حساب التحدي (الاسم والعدّ) من العناوين القديمة للدومين الجديد، علشان المتصفح بيحفظ لكل عنوان لوحده */
(() => {
  const NEW = "wzaker.site", OLD = ["wzaker-website.pages.dev", "www.wzaker.site"];
  const get = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const json = s => { try { return JSON.parse(s || "{}") || {}; } catch (e) { return {}; } };
  const sum = o => (+o.total || 0) + (+o.pending || 0);

  if (OLD.includes(location.hostname)) {            // عنوان قديم: ابعت الحساب مع التحويل
    const d = { s: get("wz_tasbeeh"), v: get("wz_vid") };
    const h = (d.s || d.v) ? "#wzmig=" + encodeURIComponent(JSON.stringify(d)) : "";
    location.replace("https://" + NEW + location.pathname + location.search + h);
    return;
  }
  const m = location.hash.match(/^#wzmig=(.+)$/);     // الدومين الجديد: استقبل الحساب
  if (!m) return;
  try {
    const d = json(decodeURIComponent(m[1])), inc = json(d.s), cur = json(get("wz_tasbeeh"));
    if (inc.id && (!cur.id || sum(inc) >= sum(cur))) set("wz_tasbeeh", d.s);   // الأكبر عدّاً هو اللي يفضل
    if (/^[a-z0-9]{10}$/.test(d.v || "")) set("wz_vid", d.v);
  } catch (e) {}
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
})();
