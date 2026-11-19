/* ============================================================
   LANGUAGE SWITCH: English / Nederlands
   English is written in the HTML. Dutch comes from nl.js.
   The chosen language is remembered in the browser.
   ============================================================ */
(function () {
  const KEY = "cbfl-lang";
  const params = new URLSearchParams(location.search);
  const read = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  };
  const save = (v) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {}
  };

  let lang = params.get("lang");
  if (lang === "nl" || lang === "en") save(lang);
  else lang = read() || ((navigator.language || "").toLowerCase().startsWith("nl") ? "nl" : "en");

  const I18N = (window.CBFL_I18N = {
    lang,
    set(next) {
      if (next === lang) return;
      save(next);
      // Reload so every part of the page (including forms and live content) is redrawn in the new language
      const url = new URL(location.href);
      url.searchParams.delete("lang");
      location.replace(url.toString());
    },
    // Translate a single string used by scripts (falls back to English)
    t(en) {
      return lang === "nl" ? lookup(norm(en)) || en : en;
    },
  });

  document.documentElement.lang = lang;
  if (lang !== "nl") return;

  const DICT = window.CBFL_NL || {};
  const PATTERNS = (window.CBFL_NL_PATTERNS || []).map(([re, out]) => [new RegExp("^" + re + "$"), out]);
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "SVG", "CODE"]);
  const INLINE = new Set(["B", "STRONG", "I", "EM", "A", "SPAN", "BR", "SMALL"]);
  const ATTRS = ["placeholder", "alt", "title", "aria-label"];

  const norm = (s) => s.replace(/\s+/g, " ").trim();
  function lookup(k) {
    if (!k) return null;
    if (Object.prototype.hasOwnProperty.call(DICT, k)) return DICT[k];
    for (const [re, out] of PATTERNS) {
      const m = k.match(re);
      if (m) return out.replace(/\$(\d)/g, (_, i) => m[i]);
    }
    return null;
  }

  // Numbers that scripts fill in (founding year, years in business) are keyed as "#"
  function richKey(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll("[data-founded],[data-years]").forEach((x) => (x.textContent = "#"));
    return norm(c.innerHTML);
  }
  // Mixed text and inline tags (e.g. a sentence with a link) are translated as one piece
  const isRich = (el) =>
    el.children.length > 0 &&
    [...el.childNodes].some((n) => n.nodeType === 3 && /[A-Za-z]/.test(n.nodeValue)) &&
    [...el.querySelectorAll("*")].every((d) => INLINE.has(d.tagName));

  const skipped = (el) =>
    !el || SKIP.has(el.tagName) || el.closest("[data-no-i18n], .code, svg");

  function translateText(node) {
    const raw = node.nodeValue;
    const k = norm(raw);
    if (!k || !/[A-Za-z]/.test(k)) return;
    const out = lookup(k);
    if (out != null && out !== k) node.nodeValue = raw.match(/^\s*/)[0] + out + raw.match(/\s*$/)[0];
  }

  function translateAttrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v) {
        const out = lookup(norm(v));
        if (out) el.setAttribute(a, out);
      }
    }
  }

  function walk(el) {
    if (el.nodeType === 3) {
      if (!skipped(el.parentElement)) translateText(el);
      return;
    }
    if (el.nodeType !== 1 || skipped(el)) return;
    translateAttrs(el);
    if (isRich(el)) {
      const out = lookup(richKey(el));
      if (out != null) {
        el.innerHTML = out;
        if (window.CBFL && window.CBFL.fillNumbers) window.CBFL.fillNumbers(el);
        return;
      }
    }
    [...el.childNodes].forEach(walk);
  }

  let mo;
  function run(root) {
    if (mo) mo.disconnect();
    walk(root);
    if (mo) mo.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    const t = lookup(norm(document.title));
    if (t) document.title = t;
    const d = document.querySelector('meta[name="description"]');
    if (d) {
      const o = lookup(norm(d.content));
      if (o) d.content = o;
    }
    mo = new MutationObserver((list) => {
      mo.disconnect();
      for (const m of list)
        m.addedNodes.forEach((n) => {
          if (n.isConnected) walk(n);
        });
      mo.observe(document.body, { childList: true, subtree: true });
    });
    run(document.body);
  }
  I18N.run = run;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
