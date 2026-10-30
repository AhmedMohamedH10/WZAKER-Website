/* روابط التحميل: لكل نظام بنجيب أحدث إصدار فيه ملف مناسب له (علشان لو الإصدار الأخير فيه ويندوز بس، لينكس يفضل شغال من اللي قبله) */
const TARGETS = {
  "dl-win":     [/setup.*\.exe$/i, /\.exe$/i],
  "dl-linux":   [/\.AppImage$/i, /\.deb$/i],
  "dl-android": [/android.*\.apk$/i]          /* لازم اسم الملف يحتوي android، علشان حزمة Alpine (.apk) ما تتلخبطش معاه */
};
const RELEASES = "https://github.com/" + REPO + "/releases";
document.getElementById("gh").href = "https://github.com/" + REPO;
const fmt = b => (b / 1048576).toFixed(1) + " MB";

function apply(rels){
  const v = document.getElementById("ver");
  if (v && rels[0] && rels[0].tag_name) v.textContent = "الإصدار " + rels[0].tag_name.replace(/^v/i, "");
  for (const [id, list] of Object.entries(TARGETS)){
    const el = document.getElementById(id);
    let hit = null, tag = "";
    find: for (const rel of rels) for (const re of list){
      const a = (rel.assets || []).find(x => re.test(x.name));
      if (a){ hit = a; tag = rel.tag_name || ""; break find; }
    }
    if (hit){
      el.href = hit.browser_download_url;
      el.classList.remove("off");
      const meta = el.querySelector(".meta"); meta.replaceChildren();          /* سطرين: الحجم فوق، ورقم الإصدار تحته */
      for (const [c, t] of [["sz", fmt(hit.size)], ["vr", tag.replace(/^v/i, "v")]]) { const s = document.createElement("span"); s.className = c; s.textContent = t; meta.append(s); }
    } else if (id !== "dl-android"){
      el.href = RELEASES;                       /* لو الملف لسه مش مرفوع: يفتح صفحة الإصدارات */
    }
  }
}
function fallback(){
  for (const id of ["dl-win","dl-linux"]) document.getElementById(id).href = RELEASES;
}
(async () => {
  const KEY = "wz_releases2", TTL = 10 * 60 * 1000;
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (c && Date.now() - c.t < TTL) return apply(c.d);
  } catch (e) {}
  try {
    const r = await fetch("https://api.github.com/repos/" + REPO + "/releases?per_page=8",
                          {headers:{Accept:"application/vnd.github+json"}});
    if (!r.ok) throw 0;
    const d = (await r.json()).filter(x => !x.draft && !x.prerelease).map(x => ({
      tag_name: x.tag_name,
      assets: (x.assets || []).map(a => ({name:a.name, size:a.size, browser_download_url:a.browser_download_url}))
    }));
    if (!d.length) throw 0;
    try { sessionStorage.setItem(KEY, JSON.stringify({t:Date.now(), d})); } catch (e) {}
    apply(d);
  } catch (e) { fallback(); }
})();

/* مديا فاير: قايمة منسدلة فيها نسخة الكمبيوتر والتليفون */
(() => {
  const btn = document.getElementById("dl-mf"), box = document.getElementById("mf");
  if (!btn || !box) return;
  for (const [id, url] of [["mf-pc", MEDIAFIRE.pc], ["mf-phone", MEDIAFIRE.phone]]) {
    const a = document.getElementById(id);
    if (url) a.href = url;
    else { a.removeAttribute("href"); a.classList.add("off"); a.querySelector(".t").textContent += " (قريباً)"; }
  }
  const set = open => { box.hidden = !open; btn.setAttribute("aria-expanded", open); };
  btn.addEventListener("click", e => { e.stopPropagation(); set(box.hidden); });
  document.addEventListener("click", e => { if (!box.hidden && !box.contains(e.target)) set(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !box.hidden) { set(false); btn.focus(); } });
})();
