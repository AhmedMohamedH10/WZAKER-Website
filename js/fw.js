/* الفونت الزخرفي بقاعدتين بس، والباقي بالفونت العادي (تناسق بصري من غير مدّ في الكلام):
   1) اسم «وذكر» في أي مكان في الموقع.
   2) أول كلمة في العناوين والنصوص المميّزة لو بتنتهي بتاء مربوطة (مَكْرُمَةُ، لوحة، سياسة، المسابقة): شكلها بيحلو من غير تطويل.
   بيشتغل تلقائي، وكمان على النصوص اللي بتتغيّر بالجافاسكربت (المسابقة، السبحة...). */
(() => {
  const SEL = "h2, .tap-l, .gate-t, .ct-win, .ct-h, .soon b, footer .by";
  const M = "[\\u064B-\\u065F\\u0670\\u0640]";                       // التشكيل والتطويل
  const BRAND = new RegExp("(?<![\\u0621-\\u064A])\u0648" + M + "*\u0630" + M + "*\u0643" + M + "*\u0631" + M + "*(?![\\u0621-\\u064A])", "g");
  const HAS = new RegExp(BRAND.source);
  const MARKS = new RegExp(M, "g");
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "OPTION", "TITLE"]);
  const span = t => { const s = document.createElement("span"); s.className = "fw"; s.textContent = t; return s; };
  const textNodes = root => {
    const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const p = n.parentElement; if (p && !SKIP.has(p.tagName) && !p.closest(".fw")) out.push(n); }
    return out;
  };
  function brand(root) {
    for (const tn of textNodes(root)) {
      if (!HAS.test(tn.data)) continue;
      const f = document.createDocumentFragment(); let last = 0;
      for (const m of tn.data.matchAll(BRAND)) { if (m.index > last) f.append(tn.data.slice(last, m.index)); f.append(span(m[0])); last = m.index + m[0].length; }
      if (last < tn.data.length) f.append(tn.data.slice(last));
      tn.replaceWith(f);
    }
  }
  function first(el) {
    const tn = textNodes(el).find(n => n.data.trim());
    if (!tn) return;
    const m = /^(\s*)(\S+)([\s\S]*)$/.exec(tn.data); if (!m) return;
    if (!/\u0629$/.test(m[2].replace(MARKS, "").replace(/[^\u0621-\u064A]+$/, ""))) return;   // بتنتهي بتاء مربوطة؟
    const f = document.createDocumentFragment();
    if (m[1]) f.append(m[1]); f.append(span(m[2])); if (m[3]) f.append(m[3]);
    tn.replaceWith(f);
  }
  function scan(root) {
    if (root.nodeType !== 1) root = root.parentElement;
    if (!root) return;
    brand(root);
    const own = root.closest(SEL); if (own) first(own);
    for (const el of root.querySelectorAll(SEL)) first(el);
  }
  let q = new Set(), raf = 0;
  const flush = () => { raf = 0; const l = q; q = new Set(); for (const n of l) if (n.isConnected) scan(n); };
  const later = n => { q.add(n); if (!raf) raf = requestAnimationFrame(flush); };
  scan(document.body);
  new MutationObserver(ms => { for (const m of ms) { if (m.type === "characterData") later(m.target); else for (const n of m.addedNodes) later(n); } })
    .observe(document.body, { childList: true, subtree: true, characterData: true });
})();
