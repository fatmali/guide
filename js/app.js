/* The London Journal — behaviour.
   Renders the journal, remembers what you touched, and presses the stamp. */

(function () {
  "use strict";
  const J = window.JOURNAL;
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem("tlj." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("tlj." + k, JSON.stringify(v)); } catch {} },
  };

  /* ---- Underground line colours ---- */
  const LINE = {
    Bakerloo:     ["#8D5A2B", "#fff"],
    Central:      ["#DC241F", "#fff"],
    Circle:       ["#E9B60E", "#241f00"],
    District:     ["#007D32", "#fff"],
    "H&C":        ["#D799AF", "#241f1a"],
    Jubilee:      ["#868F98", "#fff"],
    Metropolitan: ["#9B0056", "#fff"],
    Northern:     ["#1a1a1a", "#fff"],
    Piccadilly:   ["#0450A1", "#fff"],
    Victoria:     ["#009FE0", "#fff"],
    "W&C":        ["#76C4B0", "#123"],
    Elizabeth:    ["#6950A1", "#fff"],
  };

  /* ---- inline icons ---- */
  const ICON = {
    apple: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.2 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3 .9-3.8 2.4-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.4-1-2.4-3.7zM14 5.8c.6-.8 1-1.9.9-3-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.8-.9 2.8 1 .1 2-.5 2.6-1.2z"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M9 3L3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3z"/><path d="M9 3v15M15 6v15"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h3l1.4-2h7.2L18 8h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.1"/></svg>',
  };
  const glyphFor = (type) => ({
    coffee: "☕", breakfast: "◷", lunch: "❍", dinner: "✦", bakery: "❊",
    photo: "◉", design: "▤", shop: "❖", gem: "◇", slow: "❋", reflection: "❞", eating: "◑",
  }[type] || "·");
  const labelFor = (type) => ({
    coffee: "Coffee", breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
    bakery: "Bakery", photo: "Photography", design: "Design safari",
    shop: "Shopping", gem: "Hidden gem", slow: "Slow moment", reflection: "Reflection",
    eating: "On eating",
  }[type] || type);
  const MUSE = new Set(["photo", "design", "slow", "reflection"]);
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

  /* ---- geography, for the wayfinder ---- */
  const haversine = (a, b) => {
    const R = 6371000, rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const fmtDist = (m) =>
    m < 950 ? `${Math.round(m / 10) * 10} m`
    : m < 10000 ? `${(m / 1000).toFixed(1)} km`
    : `${Math.round(m / 1000).toLocaleString()} km`;
  const walkMin = (m) => Math.max(1, Math.round(m / 80)); // ~4.8 km/h
  const dirApple = (s) => `https://maps.apple.com/?daddr=${s.lat},${s.lng}&dirflg=w`;
  const dirGoogle = (s) => `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=walking`;

  // every stop, flattened in trip order, tagged with its day and city
  const ALL_STOPS = [];
  J.days.forEach((d) => (d.stops || []).forEach((s) => {
    if (s.lat != null) ALL_STOPS.push(Object.assign({ dayId: d.id, city: d.city || "London" }, s));
  }));

  const lineChips = (lines) => (lines || []).map((ln) => {
    const [bg, fg] = LINE[ln] || ["#888", "#fff"];
    return `<span class="line-chip" style="background:${bg};color:${fg}">${ln}</span>`;
  }).join(" ");

  /* ---- the pressed stamp artwork ---- */
  function stampSVG(day) {
    return `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="60" cy="60" r="55" stroke-width="2.2"/>
      <circle cx="60" cy="60" r="45" stroke-width="1"/>
      <path id="tp-${day.id}" d="M60,60 m-33,0 a33,33 0 1,1 66,0 a33,33 0 1,1 -66,0" fill="none" stroke="none"/>
      <text font-family="IBM Plex Mono, monospace" font-size="7.5" letter-spacing="2.5" fill="currentColor" stroke="none">
        <textPath href="#tp-${day.id}" startOffset="0%">· ${(day.city || "London").toUpperCase()} · ${day.date.toUpperCase()} · ADMITTED ·</textPath>
      </text>
      <text x="60" y="52" text-anchor="middle" font-family="Cormorant Garamond, serif" font-style="italic" font-size="19" fill="currentColor" stroke="none">${day.title.split(" ")[0]}</text>
      <text x="60" y="70" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="8" letter-spacing="2" fill="currentColor" stroke="none">${day.date.replace(/ /g, " ")}</text>
      <line x1="30" y1="78" x2="90" y2="78" stroke-width="1"/>
    </svg>`;
  }

  /* ---- passport stamps: one per place, varied by shape / ink / angle ---- */
  let stampUid = 0;
  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const stampKey = (day, stop) => day.id + "|" + slugify(stop.name);
  const dayComplete = (d) => (d.stops || []).length > 0 && d.stops.every((s) => stampState[stampKey(d, s)]);
  const STAMP_INK = ["var(--red)", "var(--brass)", "var(--sage)"];
  const shortDate = (ds) => { const m = String(ds).match(/(\d+)\D+([A-Za-z]{3})/); return m ? `${m[1]} ${m[2].toUpperCase()}` : String(ds).toUpperCase(); };
  function stampLines(name) {
    const n = name.split("&")[0].split(",")[0].trim();
    const w = n.split(" ");
    if (n.length <= 12 || w.length === 1) return [n];
    let cut = 1, diff = 1e9;
    for (let i = 1; i < w.length; i++) {
      const d = Math.abs(w.slice(0, i).join(" ").length - w.slice(i).join(" ").length);
      if (d < diff) { diff = d; cut = i; }
    }
    return [w.slice(0, cut).join(" "), w.slice(cut).join(" ")];
  }
  function placeStampSVG(day, stop) {
    const h = hashStr(stampKey(day, stop));
    const tpl = h % 3, color = STAMP_INK[(h >>> 2) % 3], rot = ((h >>> 5) % 15) - 7, uid = "st" + (stampUid++);
    const city = (day.city || "London").toUpperCase(), date = shortDate(day.date);
    const lines = stampLines(stop.name), two = lines.length > 1, nf = two ? 12.5 : (lines[0].length > 9 ? 15 : 18);
    const nameAt = (cy) => lines.map((ln, i) =>
      `<text x="60" y="${(two ? cy - 6 + i * 13 : cy + 4).toFixed(1)}" text-anchor="middle" font-family="Cormorant Garamond, serif" font-style="italic" font-size="${nf}" fill="${color}" stroke="none">${ln}</text>`).join("");
    let body;
    if (tpl === 0) {
      body = `<circle cx="60" cy="60" r="54" stroke-width="2"/><circle cx="60" cy="60" r="45" stroke-width="0.8"/>`
        + `<path id="${uid}t" d="M60,60 m-37,0 a37,37 0 1,1 74,0" fill="none" stroke="none"/>`
        + `<path id="${uid}b" d="M60,60 m-37,0 a37,37 0 1,0 74,0" fill="none" stroke="none"/>`
        + `<text font-family="IBM Plex Mono, monospace" font-size="7" letter-spacing="3" fill="${color}" stroke="none"><textPath href="#${uid}t" startOffset="10%">${city}</textPath></text>`
        + `<text font-family="IBM Plex Mono, monospace" font-size="6.5" letter-spacing="2.5" fill="${color}" stroke="none"><textPath href="#${uid}b" startOffset="14%">${date}</textPath></text>`
        + nameAt(60) + `<line x1="43" y1="${two ? 80 : 74}" x2="77" y2="${two ? 80 : 74}" stroke-width="0.8"/>`;
    } else if (tpl === 1) {
      body = `<rect x="8" y="26" width="104" height="68" rx="7" stroke-width="2"/><rect x="13" y="31" width="94" height="58" rx="4" stroke-width="0.7"/>`
        + `<text x="60" y="43" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="7" letter-spacing="2.5" fill="${color}" stroke="none">${city}</text>`
        + `<line x1="26" y1="48" x2="94" y2="48" stroke-width="0.7"/>` + nameAt(62)
        + `<line x1="26" y1="78" x2="94" y2="78" stroke-width="0.7"/>`
        + `<text x="60" y="87" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="6.5" letter-spacing="1.5" fill="${color}" stroke="none">${date} · VISITED</text>`;
    } else {
      body = `<ellipse cx="60" cy="60" rx="55" ry="41" stroke-width="2"/><ellipse cx="60" cy="60" rx="47" ry="33" stroke-width="0.8"/>`
        + `<text x="60" y="41" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="7" letter-spacing="3" fill="${color}" stroke="none">${city}</text>`
        + nameAt(61)
        + `<text x="60" y="85" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="6.5" letter-spacing="2" fill="${color}" stroke="none">${date}</text>`;
    }
    return `<svg viewBox="0 0 120 120" fill="none" stroke="${color}" style="transform:rotate(${rot}deg)" aria-hidden="true">${body}</svg>`;
  }
  function collectStamp(btn, day, stop) {
    const key = stampKey(day, stop);
    if (stampState[key]) return;
    stampState[key] = { at: Date.now() };
    store.set("stamps", stampState);
    const ink = btn.querySelector(".postmark__ink");
    ink.innerHTML = placeStampSVG(day, stop);
    btn.classList.add("is-stamped");
    btn.setAttribute("aria-pressed", "true");
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ink.classList.add("press");
      if (navigator.vibrate) navigator.vibrate(10);
    }
    markSpineDone();
    renderPassport();
  }
  // Reliable tap for touch: a scroll-snap pager eats plain clicks on small
  // targets, so handle the raw touch — a stationary touchend fires the action
  // and preventDefault kills the ghost click. Click stays for mouse/desktop
  // (guarded so it doesn't double-fire right after a touch).
  function bindTap(el, fn) {
    let sx = 0, sy = 0, moved = false, tapped = 0;
    el.addEventListener("touchstart", (e) => {
      moved = false; const t = e.touches[0]; if (t) { sx = t.clientX; sy = t.clientY; }
    }, { passive: true });
    el.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      if (t && (Math.abs(t.clientX - sx) > 12 || Math.abs(t.clientY - sy) > 12)) moved = true;
    }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (!moved) { e.preventDefault(); tapped = Date.now(); fn(); }
    }, { passive: false });
    el.addEventListener("click", () => { if (Date.now() - tapped > 600) fn(); });
  }

  /* ==========================================================
     Photographs — private, kept on your device (IndexedDB).
     Step one of the shared travel album: capture here now; a
     private cloud can sync these between phones later. Nothing
     in here leaves the device on its own.
     ========================================================== */
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const cssEsc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&"));

  const PhotoDB = (() => {
    let dbp;
    const open = () => (dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open("tlj-photos", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("photos", { keyPath: "id", autoIncrement: true }).createIndex("place", "place");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    })));
    const os = async (mode) => (await open()).transaction("photos", mode).objectStore("photos");
    const done = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    return {
      async add(rec) { return done((await os("readwrite")).add(rec)); },
      async del(id) { return done((await os("readwrite")).delete(id)); },
      async countAll() { return done((await os("readonly")).count()); },
      async all() {
        const store = await os("readonly");
        return new Promise((res, rej) => {
          const out = [], r = store.openCursor();
          r.onsuccess = () => { const c = r.result; if (c) { out.push(c.value); c.continue(); } else res(out); };
          r.onerror = () => rej(r.error);
        });
      },
      async byPlace(place) {
        const store = await os("readonly");
        return new Promise((res, rej) => {
          const out = [], r = store.index("place").openCursor(IDBKeyRange.only(place));
          r.onsuccess = () => { const c = r.result; if (c) { out.push(c.value); c.continue(); } else res(out.sort((a, b) => a.at - b.at)); };
          r.onerror = () => rej(r.error);
        });
      },
    };
  })();

  // shrink to a sane size before storing. Modern Safari/Chrome auto-apply the
  // photo's EXIF rotation when it's drawn, so the canvas comes out upright.
  const loadImage = (file) => new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("decode")); };
    img.src = url;
  });
  async function compressImage(file, max = 1600, quality = 0.82) {
    const { img, url } = await loadImage(file);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const scale = Math.min(1, max / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale)), h = Math.max(1, Math.round(ih * scale));
    const cv = el("canvas"); cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", quality));
    return { blob: blob || file, w, h };
  }

  function photoThumb(rec) {
    const b = el("button", "pthumb");
    b.type = "button";
    b.style.backgroundImage = `url("${URL.createObjectURL(rec.blob)}")`;
    b.dataset.id = rec.id;
    b.setAttribute("aria-label", "View photo");
    b.addEventListener("click", () => openLightbox(rec.place, rec.id));
    return b;
  }

  function fillStrip(strip, place) {
    strip.querySelectorAll(".pthumb").forEach((t) => t.remove());
    const add = strip.querySelector(".photos__add"); // null in read-only album view
    PhotoDB.byPlace(place).then((rows) => rows.forEach((r) => strip.insertBefore(photoThumb(r), add)));
  }

  // keep every strip for a place (a day page, the album) in sync after a change
  function photosChanged(place) {
    document.querySelectorAll(`.photos[data-place="${cssEsc(place)}"] .photos__strip`).forEach((s) => fillStrip(s, place));
    updatePhotoCount();
  }
  async function updatePhotoCount() {
    const tally = document.getElementById("ppTally");
    if (!tally) return;
    const n = await PhotoDB.countAll().catch(() => 0);
    tally.textContent = n ? ` · ${n} photograph${n === 1 ? "" : "s"} kept` : "";
  }

  function photosEl(place, opts = {}) {
    const wrap = el("div", "photos" + (opts.mini ? " photos--mini" : ""));
    wrap.dataset.place = place;
    if (opts.label) wrap.appendChild(el("div", "photos__cap", opts.label));
    const strip = el("div", "photos__strip");
    if (!opts.readonly) {
      const add = el("button", "photos__add", `${ICON.camera}<span>Add<br>photo</span>`);
      add.type = "button";
      const input = el("input"); input.type = "file"; input.accept = "image/*"; input.multiple = true; input.hidden = true;
      add.addEventListener("click", () => input.click());
      input.addEventListener("change", async () => {
        const files = [...input.files]; input.value = "";
        add.classList.add("is-busy");
        for (const f of files) {
          if (!f.type.startsWith("image/")) continue;
          try {
            const c = await compressImage(f);
            const id = await PhotoDB.add({ place, blob: c.blob, w: c.w, h: c.h, at: Date.now() });
            strip.insertBefore(photoThumb({ id, place, blob: c.blob }), add);
          } catch (e) { /* skip an unreadable image */ }
        }
        add.classList.remove("is-busy");
        photosChanged(place);
      });
      strip.appendChild(add); strip.appendChild(input);
    }
    wrap.appendChild(strip);
    fillStrip(strip, place);
    return wrap;
  }

  /* ---- full-screen viewer ---- */
  let lb;
  function ensureLightbox() {
    if (lb) return lb;
    const root = el("div", "lightbox");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <button class="lightbox__x" type="button" aria-label="Close">&times;</button>
      <button class="lightbox__nav lb-prev" type="button" aria-label="Previous">&lsaquo;</button>
      <img class="lightbox__img" alt="Trip photograph">
      <button class="lightbox__nav lb-next" type="button" aria-label="Next">&rsaquo;</button>
      <div class="lightbox__bar"><span class="lightbox__count"></span><button class="lightbox__del" type="button">Remove photo</button></div>`;
    document.body.appendChild(root);
    lb = { root, img: root.querySelector(".lightbox__img"), count: root.querySelector(".lightbox__count"), rows: [], i: 0, url: null };
    lb.show = () => {
      if (lb.url) URL.revokeObjectURL(lb.url);
      lb.url = URL.createObjectURL(lb.rows[lb.i].blob);
      lb.img.src = lb.url;
      lb.count.textContent = `${lb.i + 1} / ${lb.rows.length}`;
      root.classList.toggle("is-solo", lb.rows.length < 2);
    };
    const go = (d) => { lb.i = (lb.i + d + lb.rows.length) % lb.rows.length; lb.show(); };
    root.querySelector(".lb-prev").addEventListener("click", () => go(-1));
    root.querySelector(".lb-next").addEventListener("click", () => go(1));
    root.querySelector(".lightbox__x").addEventListener("click", closeLightbox);
    root.addEventListener("click", (e) => { if (e.target === root) closeLightbox(); });
    root.querySelector(".lightbox__del").addEventListener("click", async () => {
      const rec = lb.rows[lb.i];
      await PhotoDB.del(rec.id);
      photosChanged(rec.place);
      lb.rows.splice(lb.i, 1);
      if (!lb.rows.length) return closeLightbox();
      if (lb.i >= lb.rows.length) lb.i = lb.rows.length - 1;
      lb.show();
    });
    let sx = 0;
    root.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    root.addEventListener("touchend", (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1); }, { passive: true });
    addEventListener("keydown", (e) => {
      if (lb.root.getAttribute("aria-hidden") === "true") return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    });
    return lb;
  }
  async function openLightbox(place, id) {
    const L = ensureLightbox();
    L.rows = await PhotoDB.byPlace(place);
    if (!L.rows.length) return;
    L.i = Math.max(0, L.rows.findIndex((r) => r.id === id));
    L.show();
    L.root.setAttribute("aria-hidden", "false");
    document.body.classList.add("lb-open");
  }
  function closeLightbox() {
    if (!lb) return;
    if (lb.url) { URL.revokeObjectURL(lb.url); lb.url = null; }
    lb.img.removeAttribute("src");
    lb.root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lb-open");
  }

  /* ==========================================================
     Back up / restore — carry the journal to another device or
     send it to your partner. Bundles the stamps, notes, hunt
     ticks and every photograph into one portable file.
     ========================================================== */
  const blobToDataURL = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
  const dataURLToBlob = (d) => fetch(d).then((r) => r.blob());
  const BACKUP_MERGE = ["tlj.stamps", "tlj.hunt", "tlj.notes"];

  async function exportJournal() {
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("tlj.")) dump[k] = localStorage.getItem(k);
    }
    const photos = [];
    for (const r of await PhotoDB.all()) {
      photos.push({ place: r.place, at: r.at, w: r.w, h: r.h, data: await blobToDataURL(r.blob) });
    }
    const payload = { app: "travel-journal", version: 1, exportedAt: new Date().toISOString(), store: dump, photos };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const fname = `travel-journal-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([blob], fname, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Travel Journal" }); return "shared"; }
      catch (e) { if (e && e.name === "AbortError") return "cancel"; }
    }
    const url = URL.createObjectURL(blob);
    const a = el("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "downloaded";
  }

  async function importJournal(file) {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== "travel-journal") throw new Error("not a journal backup");
    for (const [k, v] of Object.entries(data.store || {})) {
      if (!k.startsWith("tlj.")) continue;
      if (BACKUP_MERGE.includes(k)) {
        try {
          const incoming = JSON.parse(v);
          const cur = JSON.parse(localStorage.getItem(k) || (Array.isArray(incoming) ? "[]" : "{}"));
          const merged = Array.isArray(incoming) ? Array.from(new Set([...cur, ...incoming])) : Object.assign({}, cur, incoming);
          localStorage.setItem(k, JSON.stringify(merged));
        } catch { localStorage.setItem(k, v); }
      } else {
        localStorage.setItem(k, v);
      }
    }
    const existing = await PhotoDB.all();
    const seen = new Set(existing.map((r) => r.place + "|" + r.at));
    let added = 0;
    for (const ph of (data.photos || [])) {
      const sig = ph.place + "|" + ph.at;
      if (seen.has(sig)) continue;
      await PhotoDB.add({ place: ph.place, at: ph.at, w: ph.w, h: ph.h, blob: await dataURLToBlob(ph.data) });
      seen.add(sig); added++;
    }
    return { added };
  }

  /* ==========================================================
     Build pages
     ========================================================== */
  const pager = $("#pager");
  const stampState = store.get("stamps", {});
  const pages = [];

  function coverPage() {
    const p = el("section", "page");
    p.dataset.nav = "Cover";
    const c = el("div", "col");
    const cover = el("div", "cover");
    cover.innerHTML = `
      <div class="cover__kicker rise">A field guide · for Fatma</div>
      <h1 class="cover__title rise">The London<br><em>Journal</em></h1>
      <div class="cover__rule rise"></div>
      <div class="cover__dates rise">${J.meta.dates} <span>· ${J.meta.onward}</span></div>
      <p class="cover__colophon rise">${J.meta.colophon}</p>
      <div class="cover__hint rise">Swipe to begin <span class="arrow">→</span></div>`;
    c.appendChild(cover);
    p.appendChild(c);
    return p;
  }

  function factRow(k, v, wide) {
    if (!v) return "";
    return `<div class="fact${wide ? " fact--wide" : ""}"><span class="fact__k">${k}</span><span class="fact__v">${v}</span></div>`;
  }

  function transitFact(stop) {
    // London stops ride the Underground; York & Edinburgh are walked.
    if (stop.tube) {
      return `<div class="fact fact--wide"><span class="fact__k">Nearest Tube</span>
        <span class="fact__v tube"><span class="tube__station">${stop.tube}</span> ${lineChips(stop.lines)}</span></div>`;
    }
    if (stop.transit) {
      return `<div class="fact fact--wide"><span class="fact__k">Getting there</span><span class="fact__v">${stop.transit}</span></div>`;
    }
    return "";
  }

  function stopEl(stop, day) {
    const s = el("article", "stop rise");
    const facts = [
      transitFact(stop),
      factRow("Walk from previous", stop.walkFromPrev),
      factRow("Walking distance", stop.walkDistance),
      factRow("Visit for", stop.duration),
      factRow("Hours", stop.hours),
      factRow("Address", stop.address, true),
      factRow("Accessibility", stop.access, true),
    ].join("");
    const done = !!stampState[stampKey(day, stop)];
    s.innerHTML = `
      ${stop.time ? `<div class="stop__time">${stop.time}</div>` : ""}
      <div class="stop__top">
        <div class="stop__head">
          <h3 class="stop__name">${stop.name}</h3>
          ${stop.kind ? `<span class="stop__kind">${stop.kind}</span>` : ""}
        </div>
        <button class="postmark${done ? " is-stamped" : ""}" type="button" aria-pressed="${done}" aria-label="Collect the stamp for ${stop.name}">
          <span class="postmark__hint">press<br>to stamp</span>
          <span class="postmark__ink">${done ? placeStampSVG(day, stop) : ""}</span>
        </button>
      </div>
      <p class="stop__note">${stop.note}</p>
      <div class="facts">${facts}</div>
      <div class="maplinks">
        <a class="maplink maplink--apple" href="${stop.apple}" target="_blank" rel="noopener">${ICON.apple} Apple&nbsp;Maps</a>
        <a class="maplink" href="${stop.google}" target="_blank" rel="noopener">${ICON.map} Google&nbsp;Maps</a>
      </div>`;
    const pm = s.querySelector(".postmark");
    bindTap(pm, () => collectStamp(pm, day, stop));
    s.appendChild(photosEl(stampKey(day, stop), { label: "Your photographs" }));
    return s;
  }

  // "Worth the hype" — the viral, casual breakfast/lunch picks for the day.
  function viralEl(day) {
    const v = day.viral;
    if (!v || !v.length) return null;
    const wrap = el("div", "rise");
    wrap.appendChild(el("div", "sectlabel", "Worth the hype"));
    const box = el("div", "viral");
    box.innerHTML = v.map((x) => `
      <article class="viral__item">
        <div class="viral__meal">${x.meal}${x.tag ? `<span class="viral__tag">${x.tag}</span>` : ""}</div>
        <h4 class="viral__name">${x.name}</h4>
        <p class="viral__note">${x.note}</p>
        <div class="maplinks">
          <a class="maplink maplink--apple" href="${x.apple}" target="_blank" rel="noopener">${ICON.apple} Apple&nbsp;Maps</a>
          <a class="maplink" href="${x.google}" target="_blank" rel="noopener">${ICON.map} Google&nbsp;Maps</a>
        </div>
      </article>`).join("");
    wrap.appendChild(box);
    return wrap;
  }

  function noteEl(note) {
    const muse = MUSE.has(note.type);
    const n = el("article", "notecard rise" + (muse ? " notecard--muse" : ""));
    const place = note.place ? `<div class="notecard__place">${note.place}</div>` : "";
    const links = (note.apple && note.google)
      ? `<div class="maplinks"><a class="maplink maplink--apple" href="${note.apple}" target="_blank" rel="noopener">${ICON.apple} Apple&nbsp;Maps</a><a class="maplink" href="${note.google}" target="_blank" rel="noopener">${ICON.map} Google&nbsp;Maps</a></div>`
      : "";
    n.innerHTML = `
      <div class="notecard__label"><span class="notecard__glyph">${glyphFor(note.type)}</span>${labelFor(note.type)}${note.time ? `<span class="notecard__time">${note.time}</span>` : ""}</div>
      <h3 class="notecard__title">${note.title}</h3>
      ${place}
      <p class="notecard__body">${note.body}</p>
      ${links}`;
    return n;
  }

  function routeEl(day) {
    const wrap = el("div", "rise");
    wrap.appendChild(el("div", "sectlabel", "The route · why this order"));
    wrap.appendChild(el("p", "why", day.routeWhy));
    const ol = el("ol", "route");
    day.route.forEach((r, i) => {
      const li = el("li", "route__stop");
      li.innerHTML = `${r.time ? `<div class="route__time">${r.time}</div>` : ""}
        <div class="route__dot"></div>
        <div class="route__name">${r.name}</div>
        <div class="route__note">${r.note || ""}</div>`;
      ol.appendChild(li);
      if (i < day.route.length - 1) ol.appendChild(el("li", "route__link"));
    });
    wrap.appendChild(ol);
    return wrap;
  }

  // Each day gets a real OpenStreetMap (Leaflet) map when online, and a
  // hand-drawn SVG schematic — built from the same coordinates — when offline.
  const mapEntries = [];
  let currentDayId = null;
  let mapPref = store.get("mapPref", "street");   // "street" (tiles) | "schematic" (no tiles, flag-proof)

  // The offline schematic: pure SVG from data we already hold, no tiles.
  function schematicSVG(day, pts) {
    const W = 100, H = 62, m = 12;                    // viewBox + inner margin
    const midLat = pts.reduce((a, s) => a + s.lat, 0) / pts.length;
    const kx = Math.cos((midLat * Math.PI) / 180);    // compress lng to match lat on the ground
    const wx = (s) => s.lng * kx, wy = (s) => -s.lat; // north up
    const xs = pts.map(wx), ys = pts.map(wy);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const spanX = Math.max(x1 - x0, 1e-5), spanY = Math.max(y1 - y0, 1e-5);
    const scale = Math.min((W - 2 * m) / spanX, (H - 2 * m) / spanY);
    const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
    const px = (s) => offX + (wx(s) - x0) * scale;
    const py = (s) => offY + (wy(s) - y0) * scale;
    const P = pts.map((s) => ({ x: px(s), y: py(s), name: s.name }));

    const line = P.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");

    // a "nice" round scale bar
    const mPerUnit = 111320 / scale;
    const target = 26 * mPerUnit;
    const nice = [100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000]
      .reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    const barU = nice / mPerUnit;
    const barLabel = nice < 1000 ? nice + " m" : nice / 1000 + " km";

    const dots = P.map((p, i) => {
      const start = i === 0;
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${start ? 1.8 : 1.3}"
        style="fill:${start ? "var(--red)" : "var(--paper)"};stroke:var(--red);stroke-width:${start ? 0 : 0.7}"/>`;
    }).join("");

    // greedy label placement so numbers splay out of tight clusters instead of stacking
    const overlaps = (a, b) => !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
    const dotZones = P.map((p) => ({ x: p.x - 2, y: p.y - 2, w: 4, h: 4 }));
    const placed = [];
    const cand = [[2.3, 1.1, "start"], [-2.3, 1.1, "end"], [0, -2, "middle"], [0, 4, "middle"],
      [2.3, -1.6, "start"], [-2.3, -1.6, "end"], [2.3, 3.6, "start"], [-2.3, 3.6, "end"]];
    const nums = P.map((p, i) => {
      const label = String(i + 1);
      const w = label.length * 1.8 + 0.6, h = 3;
      let ch = null;
      for (const [dx, dy, anchor] of cand) {
        const bx = anchor === "end" ? p.x + dx - w : anchor === "middle" ? p.x + dx - w / 2 : p.x + dx;
        const box = { x: bx, y: p.y + dy - 2.4, w, h };
        if (!placed.some((q) => overlaps(box, q)) && !dotZones.some((q) => overlaps(box, q))) { ch = { dx, dy, anchor, box }; break; }
      }
      if (!ch) ch = { dx: 2.3, dy: 1.1, anchor: "start", box: { x: p.x + 2.3, y: p.y - 1.3, w, h } };
      placed.push(ch.box);
      return `<text x="${(p.x + ch.dx).toFixed(1)}" y="${(p.y + ch.dy).toFixed(1)}" text-anchor="${ch.anchor}"
        style="fill:var(--ink-soft);font-family:var(--mono);font-size:2.8px">${label}</text>`;
    }).join("");

    const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of ${day.title}'s route">
      <path d="${line}" style="fill:none;stroke:var(--ink-faint);stroke-width:0.5;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1.7 1.5"/>
      ${dots}${nums}
      <g style="stroke:var(--ink-faint);stroke-width:0.45">
        <line x1="5" y1="${H - 4}" x2="${(5 + barU).toFixed(1)}" y2="${H - 4}"/>
        <line x1="5" y1="${H - 5}" x2="5" y2="${H - 3}"/>
        <line x1="${(5 + barU).toFixed(1)}" y1="${H - 5}" x2="${(5 + barU).toFixed(1)}" y2="${H - 3}"/>
      </g>
      <text x="5" y="${H - 5.5}" style="fill:var(--ink-faint);font-family:var(--mono);font-size:2.5px;letter-spacing:0.1px">${barLabel}</text>
      <g transform="translate(${W - 5} 5)">
        <line x1="0" y1="1.5" x2="0" y2="6" style="stroke:var(--ink-faint);stroke-width:0.45"/>
        <path d="M0 0 L-1.2 1.9 L1.2 1.9 Z" style="fill:var(--red)"/>
        <text x="0" y="9.5" text-anchor="middle" style="fill:var(--ink-faint);font-family:var(--mono);font-size:2.7px">N</text>
      </g>
    </svg>`;

    return svg;
  }

  function dayMapEl(day) {
    const pts = (day.stops || []).filter((s) => s.lat != null);
    if (pts.length < 2) return null;

    const legend = pts.map((s, i) =>
      `<li><b>${i + 1}</b> ${s.name.split(/[,&]/)[0].trim()}</li>`).join("");

    const wrap = el("div", "rise");
    wrap.appendChild(el("div", "sectlabel", "The day, mapped"));
    const fig = el("figure", "daymap");
    fig.innerHTML =
      `<div class="daymap__live"></div>` +
      `<div class="daymap__fallback">${schematicSVG(day, pts)}</div>` +
      `<button class="daymap__toggle" type="button"></button>` +
      `<ul class="daymap__key">${legend}</ul>`;
    if (mapPref === "schematic") fig.classList.add("prefer-schematic");
    const toggle = fig.querySelector(".daymap__toggle");
    toggle.textContent = mapPref === "schematic" ? "Show the street map" : "Show the schematic";
    toggle.addEventListener("click", () => {
      mapPref = mapPref === "street" ? "schematic" : "street";
      store.set("mapPref", mapPref);
      mapEntries.forEach(applyMapPref);
    });
    wrap.appendChild(fig);
    mapEntries.push({ dayId: day.id, pts, fig, map: null, tileErr: 0 });
    return wrap;
  }

  // Reflect the street/schematic preference on a day's map (init tiles only when needed).
  function applyMapPref(entry) {
    const schema = mapPref === "schematic";
    entry.fig.classList.toggle("prefer-schematic", schema);
    const btn = entry.fig.querySelector(".daymap__toggle");
    if (btn) btn.textContent = schema ? "Show the street map" : "Show the schematic";
    if (!schema && entry.dayId === currentDayId) {
      initDayMap(entry);
      if (entry.map) setTimeout(() => { if (entry.map) entry.map.invalidateSize(); }, 80);
    }
  }

  // Build the live Leaflet map for a day, lazily, once it's on screen and online.
  function initDayMap(entry) {
    if (!entry || entry.map || !window.L || !navigator.onLine || mapPref === "schematic") return;
    const live = entry.fig.querySelector(".daymap__live");
    entry.fig.classList.add("is-live");          // give the mount a size before init
    try {
      const latlngs = entry.pts.map((s) => [s.lat, s.lng]);
      const map = L.map(live, { scrollWheelZoom: false });
      // Leaflet's default attribution prefix carries a Ukrainian-flag SVG that
      // renders large on mobile; drop the prefix (tile credit below stays).
      map.attributionControl.setPrefix(false);
      // Esri's basemaps are permissive (no referer-blocking, no "blocked tile" flag placeholder)
      const tiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — OpenStreetMap contributors',
      });
      // if tiles can't load at all (offline captive wifi, provider outage), drop back to the schematic
      let loaded = 0, decided = false;
      tiles.on("tileload", () => { loaded++; });
      tiles.on("tileerror", () => {
        if (!decided && loaded === 0 && ++entry.tileErr >= 5) {
          decided = true; map.remove(); entry.map = null; entry.fig.classList.remove("is-live");
        }
      });
      tiles.addTo(map);
      L.polyline(latlngs, { color: "#B23A2E", weight: 3.5, opacity: 0.9, dashArray: "2 7", lineCap: "round" }).addTo(map);
      entry.pts.forEach((s, i) => {
        const icon = L.divIcon({
          className: "mapmark" + (i === 0 ? " mapmark--start" : ""),
          html: `<span>${i + 1}</span>`, iconSize: [22, 22], iconAnchor: [11, 11],
        });
        L.marker([s.lat, s.lng], { icon, keyboard: false }).addTo(map).bindTooltip(s.name, { direction: "top", offset: [0, -9] });
      });
      map.fitBounds(latlngs, { padding: [28, 28] });
      entry.map = map;
      setTimeout(() => { if (entry.map === map) map.invalidateSize(); }, 60);
    } catch (e) {
      entry.fig.classList.remove("is-live");     // fall back to the schematic
    }
  }
  function activateDayMap(dayId) {
    const e = mapEntries.find((x) => x.dayId === dayId);
    if (!e) return;
    initDayMap(e);
    if (e.map) setTimeout(() => { if (e.map) e.map.invalidateSize(); }, 80);
  }
  addEventListener("online", () => { if (currentDayId) activateDayMap(currentDayId); });

  // "The shape of the day" — a quiet timeline read from the route's times.
  function rhythmEl(day) {
    const items = (day.route || []).filter((r) => r.time);
    if (items.length < 2) return null;
    const mins = items.map((r) => toMin(r.time));
    const lo = Math.min(...mins), hi = Math.max(...mins), span = (hi - lo) || 1;
    const pos = (m) => ((m - lo) / span) * 100;

    const wrap = el("div", "rise");
    wrap.appendChild(el("div", "sectlabel", "The shape of the day"));
    const r = el("div", "rhythm");

    const dots = items.map((it) =>
      `<span class="rhythm__dot" style="left:${pos(toMin(it.time))}%" title="${it.time} · ${it.name}"></span>`
    ).join("");
    // faint boundary ticks where a period begins, if the day crosses it
    const bounds = [[720, "Noon"], [1020, "5pm"], [1260, "9pm"]];
    const ticks = bounds
      .filter(([m]) => m > lo && m < hi)
      .map(([m]) => `<span class="rhythm__tick" style="left:${pos(m)}%"></span>`)
      .join("");

    // period captions, placed over the part of the day they actually cover
    const periods = [
      ["Morning", 0, 720], ["Afternoon", 720, 1020],
      ["Evening", 1020, 1260], ["Night", 1260, 1560],
    ];
    const caps = periods.map(([name, a, b]) => {
      const s = Math.max(a, lo), e = Math.min(b, hi);
      if (e <= s) return "";
      return `<span class="rhythm__period" style="left:${(pos(s) + pos(e)) / 2}%">${name}</span>`;
    }).join("");

    r.innerHTML = `
      <div class="rhythm__track">${ticks}${dots}</div>
      <div class="rhythm__ends"><span>${items[0].time}</span><span>${items[items.length - 1].time}</span></div>
      <div class="rhythm__periods">${caps}</div>`;
    wrap.appendChild(r);
    return wrap;
  }

  /* ==========================================================
     Wayfinder — "up next" from where you actually are
     Position is held in memory only; never stored, never sent.
     ========================================================== */
  let userPos = null;
  let wfStatus = "idle";       // idle | locating | located | denied | unavailable
  const upnextCards = [];

  function upNextCard(day) {
    const card = el("section", "upnext rise");
    card.setAttribute("aria-live", "polite");
    upnextCards.push({ el: card, dayId: day.id });
    return card;
  }

  function wayfinderData() {
    if (!userPos) return null;
    let here = ALL_STOPS[0], best = Infinity;
    ALL_STOPS.forEach((s) => { const d = haversine(userPos, s); if (d < best) { best = d; here = s; } });
    // "up next" stays within the city you're actually in — never suggest
    // walking the 300 miles between London, York and Edinburgh.
    const cityStops = ALL_STOPS.filter((s) => s.city === here.city);
    const idx = cityStops.indexOf(here);
    const next = cityStops[idx + 1] || null;
    return {
      here, hereDist: best, next,
      nextDist: next ? haversine(userPos, next) : null,
      then: cityStops.slice(idx + 2, idx + 4),
      far: best > 25000,
    };
  }

  function renderUpNext(data) {
    const g = `<span class="upnext__glyph">◎</span>`;
    if (wfStatus === "locating") {
      return `<div class="upnext__label">${g}Finding you</div>
        <p class="upnext__lede">One moment — taking a reading…</p>`;
    }
    if (wfStatus === "denied" || wfStatus === "unavailable") {
      const why = wfStatus === "denied"
        ? "Location's switched off — no trouble at all."
        : "Couldn't take a reading just now.";
      return `<div class="upnext__label">${g}Where next</div>
        <p class="upnext__lede">${why} Follow the route below — the walking times are already written in. You can switch it on whenever.</p>
        <button class="upnext__btn" data-loc>Try again</button>`;
    }
    if (wfStatus === "located" && data) {
      if (data.far) {
        const first = ALL_STOPS[0];
        const firstTransit = first.tube ? `Nearest Tube · ${first.tube} ${lineChips(first.lines)}` : (first.transit || "");
        return `<div class="upnext__label">${g}Not in London yet</div>
          <p class="upnext__lede">You're about ${fmtDist(data.hereDist)} out. This wakes up once you land. When you're ready, the week begins here —</p>
          <h3 class="upnext__name">${first.name}</h3>
          <div class="upnext__meta">${firstTransit}</div>
          <div class="maplinks"><a class="maplink maplink--apple" href="${dirApple(first)}" target="_blank" rel="noopener">${ICON.map} Directions</a></div>
          <button class="upnext__relink" data-loc>Refresh</button>`;
      }
      if (!data.next) {
        const order = ["London", "York", "Edinburgh"];
        const onward = order[order.indexOf(data.here.city) + 1];
        const lede = onward
          ? `You've walked all of ${data.here.city}. From here the train carries you north — ${onward} is waiting.`
          : "This is the end of the line. Window seat for the way home, and a short list of what you'll come back for.";
        return `<div class="upnext__label">${g}${onward ? data.here.city + " · done" : "Journey's end"}</div>
          <div class="upnext__near">You're nearest <b>${data.here.name}</b> · ${fmtDist(data.hereDist)} away</div>
          <p class="upnext__lede">${lede}</p>
          <button class="upnext__relink" data-loc>Refresh</button>`;
      }
      const n = data.next;
      const nTransit = n.tube ? " · " + n.tube : (n.transit ? " · " + n.transit : "");
      const chips = n.lines ? lineChips(n.lines) : "";
      // beyond a pleasant walk it's a Tube/transit hop, not a stroll — say so
      const far = data.nextDist > 2500;
      const metaLine = far
        ? `Across town · ${fmtDist(data.nextDist)}${nTransit} ${chips}`
        : `${walkMin(data.nextDist)} min walk · ${fmtDist(data.nextDist)}${nTransit} ${chips}`;
      const goApple = far ? `https://maps.apple.com/?daddr=${n.lat},${n.lng}&dirflg=r` : dirApple(n);
      const goGoogle = far ? `https://www.google.com/maps/dir/?api=1&destination=${n.lat},${n.lng}&travelmode=transit` : dirGoogle(n);
      const goLabel = far ? "Directions" : "Walk there";
      return `<div class="upnext__label">${g}Up next</div>
        <div class="upnext__near">You're nearest <b>${data.here.name}</b> · ${fmtDist(data.hereDist)} away</div>
        <h3 class="upnext__name">${n.name}</h3>
        <div class="upnext__meta">${metaLine}</div>
        <div class="maplinks">
          <a class="maplink maplink--apple upnext__go" href="${goApple}" target="_blank" rel="noopener">${ICON.apple} ${goLabel}</a>
          <a class="maplink" href="${goGoogle}" target="_blank" rel="noopener">${ICON.map} Google</a>
        </div>
        ${data.then.length ? `<div class="upnext__then">Then · ${data.then.map((s) => s.name).join(" · ")}</div>` : ""}
        <button class="upnext__relink" data-loc>Refresh</button>`;
    }
    return `<div class="upnext__label">${g}Where next</div>
      <p class="upnext__lede">Turn on location and the guide points you to your next stop — the walk, the way there, and what follows.</p>
      <button class="upnext__btn" data-loc>Find my place</button>
      <p class="upnext__fine">Stays on your phone. Nothing leaves it.</p>`;
  }

  function paintUpNext() {
    const html = renderUpNext(wayfinderData());
    upnextCards.forEach(({ el: card }) => {
      card.innerHTML = html;
      card.querySelectorAll("[data-loc]").forEach((b) => b.addEventListener("click", locate));
    });
  }

  function locate() {
    if (!navigator.geolocation) { wfStatus = "unavailable"; paintUpNext(); return; }
    wfStatus = "locating"; paintUpNext();
    navigator.geolocation.getCurrentPosition(
      (p) => { userPos = { lat: p.coords.latitude, lng: p.coords.longitude }; wfStatus = "located"; store.set("locOptIn", true); paintUpNext(); },
      (err) => { wfStatus = err && err.code === 1 ? "denied" : "unavailable"; paintUpNext(); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  function stampZone(day) {
    const zone = el("div", "stampzone rise");
    const done = !!stampState[day.id];
    zone.innerHTML = `
      <div class="stampzone__hint">${done ? "This day is in your passport" : "When the day is done"}</div>
      <button class="stampbtn" aria-pressed="${done}" aria-label="Stamp ${day.title} into your passport">
        <span class="stampbtn__txt">Press<br>to<br>stamp</span>
        <span class="stamp"></span>
      </button>`;
    const btn = $(".stampbtn", zone);
    const stamp = $(".stamp", zone);
    if (done) {
      zone.classList.add("is-stamped");
      stamp.classList.add("stamp--static");
      stamp.innerHTML = stampSVG(day);
    }
    btn.addEventListener("click", () => {
      if (stampState[day.id]) return;
      stampState[day.id] = { at: Date.now() };
      store.set("stamps", stampState);
      zone.classList.add("is-stamped");
      stamp.innerHTML = stampSVG(day);
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      stamp.classList.add(reduce ? "stamp--static" : "stamp--animate");
      btn.setAttribute("aria-pressed", "true");
      $(".stampzone__hint", zone).textContent = "This day is in your passport";
      if (!reduce && navigator.vibrate) navigator.vibrate(12);
      markSpineDone();
      renderPassport();
    });
    return zone;
  }

  function marginEl(day) {
    const m = el("div", "margin rise");
    const key = "note." + day.id;
    m.innerHTML = `<div class="margin__label">In the margin</div>
      <textarea placeholder="A line for later — what you noticed, what you'd return to…"></textarea>`;
    const ta = $("textarea", m);
    ta.value = store.get(key, "");
    let t;
    const grow = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
    ta.addEventListener("input", () => {
      grow();
      clearTimeout(t);
      t = setTimeout(() => store.set(key, ta.value), 250);
    });
    requestAnimationFrame(grow);
    return m;
  }

  function huntPage() {
    const p = el("section", "page");
    p.dataset.nav = "Hunt";
    const c = el("div", "col");
    c.appendChild(el("header", "dayhead rise", `
      <div class="dayhead__kicker">The hunt list <span class="date">Shopping</span></div>
      <h2 class="dayhead__title">Things to find</h2>
      <p class="dayhead__dek">Not a to-do list. A set of small excuses to walk into the right shops. Tick them off; they'll be here next time you open this.</p>`));

    const state = store.get("hunt", {});
    const list = el("ul", "hunt rise");
    J.hunt.forEach((item) => {
      const li = el("li", "hunt__item");
      li.setAttribute("role", "checkbox");
      li.tabIndex = 0;
      li.setAttribute("aria-checked", state[item.id] ? "true" : "false");
      if (state[item.id]) li.classList.add("is-checked");
      li.innerHTML = `
        <span class="hunt__box">${ICON.check}</span>
        <span><span class="hunt__label">${item.label}</span><span class="hunt__hint">${item.hint}</span></span>`;
      const toggle = () => {
        const now = !li.classList.contains("is-checked");
        li.classList.toggle("is-checked", now);
        li.setAttribute("aria-checked", now ? "true" : "false");
        state[item.id] = now;
        store.set("hunt", state);
        if (now && !matchMedia("(prefers-reduced-motion: reduce)").matches && navigator.vibrate) navigator.vibrate(8);
      };
      li.addEventListener("click", toggle);
      li.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
      list.appendChild(li);
    });
    c.appendChild(list);
    c.appendChild(el("p", "endnote rise", "The best thing you buy won't be on this list."));
    p.appendChild(c);
    return p;
  }

  function dayPage(day) {
    const p = el("section", "page");
    p.dataset.nav = day.label;
    p.dataset.dayId = day.id;
    const c = el("div", "col");

    c.appendChild(el("header", "dayhead rise", `
      <div class="dayhead__kicker">${day.kicker} <span class="date">${day.date}</span></div>
      <h2 class="dayhead__title">${day.title}</h2>
      <span class="dayhead__weekday">${day.weekday}</span>
      <p class="dayhead__dek">${day.dek}</p>`));

    c.appendChild(el("div", "strip rise", `
      <div class="strip__row"><span class="strip__k">Today</span><span class="strip__v mission">${day.mission}</span></div>
      <div class="strip__row"><span class="strip__k">Weather</span><span class="strip__v">${day.weather}</span></div>
      <div class="strip__row"><span class="strip__k">Budget</span><span class="strip__v">${day.budget}</span></div>`));

    const rhythm = rhythmEl(day);
    if (rhythm) c.appendChild(rhythm);

    const dmap = dayMapEl(day);
    if (dmap) c.appendChild(dmap);

    if (day.id !== "arrival") c.appendChild(upNextCard(day));

    c.appendChild(routeEl(day));

    if (day.stops && day.stops.length) {
      c.appendChild(el("div", "sectlabel rise", "The stops"));
      day.stops.forEach((s) => c.appendChild(stopEl(s, day)));
    }

    // group notes: food & find, then the muses
    const order = ["coffee", "breakfast", "lunch", "dinner", "bakery", "shop", "gem", "photo", "design", "slow", "reflection"];
    const notes = (day.notes || []).slice().sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    if (notes.length) {
      c.appendChild(el("div", "sectlabel rise", "Notes for the day"));
      notes.forEach((n) => c.appendChild(noteEl(n)));
    }

    const viral = viralEl(day);
    if (viral) c.appendChild(viral);

    c.appendChild(marginEl(day));

    p.appendChild(c);
    return p;
  }

  // Assemble
  pager.appendChild(coverPage());
  J.days.forEach((d) => pager.appendChild(dayPage(d)));
  pager.appendChild(huntPage());
  pages.push(...pager.querySelectorAll(".page"));

  // wayfinder: render idle cards; if she's opted in before, pick up where she is
  paintUpNext();
  if (store.get("locOptIn", false)) locate();

  /* ==========================================================
     Spine navigation
     ========================================================== */
  const spine = $("#spine");
  const spineTrack = el("div", "spine__track");
  spine.appendChild(spineTrack);
  pages.forEach((page, i) => {
    if (i > 0) spineTrack.appendChild(el("span", "spine__sep"));
    const tab = el("button", "spine__tab", page.dataset.nav);
    tab.dataset.idx = i;
    const dd = page.dataset.dayId && J.days.find((x) => x.id === page.dataset.dayId);
    if (dd && dayComplete(dd)) tab.classList.add("is-done");
    tab.addEventListener("click", () => goTo(i));
    spineTrack.appendChild(tab);
  });
  // passport tab
  spineTrack.appendChild(el("span", "spine__sep"));
  const ppTab = el("button", "spine__tab", "✦");
  ppTab.setAttribute("aria-label", "Open passport");
  ppTab.addEventListener("click", openPassport);
  spineTrack.appendChild(ppTab);

  const tabs = [...spineTrack.querySelectorAll(".spine__tab")].slice(0, pages.length);

  function goTo(i) {
    pages[i].scrollIntoView({ behavior: "smooth", inline: "start" });
    pages[i].focus?.({ preventScroll: true });
  }
  // keep the current tab within view on the scrollable spine
  function centerSpine(i) {
    const t = tabs[i];
    if (!t || spine.scrollWidth <= spine.clientWidth + 1) return;
    const tr = t.getBoundingClientRect(), sr = spine.getBoundingClientRect();
    spine.scrollBy({ left: (tr.left + tr.width / 2) - (sr.left + sr.width / 2), behavior: "smooth" });
  }
  function markSpineDone() {
    pages.forEach((page, i) => {
      const d = page.dataset.dayId && J.days.find((x) => x.id === page.dataset.dayId);
      if (d) tabs[i].classList.toggle("is-done", dayComplete(d));
    });
  }

  /* ==========================================================
     Active page tracking (reveal + labels)
     ========================================================== */
  const mastDay = $("#mastDay");
  let current = 0;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.intersectionRatio > 0.55) {
        e.target.classList.add("is-active");
        const i = pages.indexOf(e.target);
        current = i;
        currentDayId = e.target.dataset.dayId || null;
        if (currentDayId) activateDayMap(currentDayId);
        tabs.forEach((t, ti) => t.classList.toggle("is-current", ti === i));
        centerSpine(i);
        mastDay.textContent = e.target === pages[0] ? "Cover"
          : e.target.dataset.nav === "Hunt" ? "Hunt list"
          : e.target.dataset.dayId
            ? (() => { const d = J.days.find((x) => x.id === e.target.dataset.dayId); return `${d.city} · ${d.date}`; })()
            : e.target.dataset.nav;
      }
    });
  }, { root: pager, threshold: [0.55] });
  pages.forEach((p) => io.observe(p));
  pages[0].classList.add("is-active");
  tabs[0].classList.add("is-current");

  // keyboard: left/right between pages
  addEventListener("keydown", (e) => {
    if (e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowRight" && current < pages.length - 1) goTo(current + 1);
    if (e.key === "ArrowLeft" && current > 0) goTo(current - 1);
  });

  /* ==========================================================
     Passport overlay
     ========================================================== */
  const sheet = $("#passport");
  const ppPages = $("#passportPages");
  const ppIntro = $("#passportIntro");

  function renderPassport() {
    const daysWithStops = J.days.filter((d) => (d.stops || []).length);
    const keys = daysWithStops.flatMap((d) => d.stops.map((s) => stampKey(d, s)));
    const got = keys.filter((k) => stampState[k]).length;
    const lead = got === 0
      ? "Empty pages. Press the postmark on any stop and its stamp lands here."
      : got === keys.length
      ? `Every place stamped — all ${got}. The whole line, walked and kept.`
      : `${got} of ${keys.length} places stamped. Keep collecting.`;
    ppIntro.innerHTML = `${lead}<span id="ppTally"></span>`;
    ppPages.innerHTML = "";
    daysWithStops.forEach((d) => {
      const n = d.stops.filter((s) => stampState[stampKey(d, s)]).length;
      const section = el("section", "ppday");
      section.innerHTML = `
        <div class="ppday__head">
          <div>
            <div class="ppday__city">${d.city} · ${d.date}</div>
            <h3 class="ppday__title">${d.title}</h3>
          </div>
          <span class="ppday__count${n === d.stops.length ? " is-full" : ""}">${n}/${d.stops.length}</span>
        </div>
        <div class="ppday__grid">
          ${d.stops.map((s) => stampState[stampKey(d, s)]
            ? `<div class="ppslot" data-place="${stampKey(d, s)}">${placeStampSVG(d, s)}</div>`
            : `<div class="ppslot is-empty"><span class="ppslot__wait">${s.name.split(/[,&]/)[0].trim()}</span></div>`).join("")}
        </div>`;
      // hang each stamped place's photographs beneath its stamp
      section.querySelectorAll(".ppslot[data-place]").forEach((slot) =>
        slot.appendChild(photosEl(slot.dataset.place, { readonly: true, mini: true })));
      ppPages.appendChild(section);
    });
    updatePhotoCount();
  }
  function openPassport() { renderPassport(); sheet.classList.add("is-open"); sheet.setAttribute("aria-hidden", "false"); }
  function closePassport() { sheet.classList.remove("is-open"); sheet.setAttribute("aria-hidden", "true"); }
  $("#passportClose").addEventListener("click", closePassport);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closePassport(); });

  /* ---- back up / restore ---- */
  const kStatus = $("#keepsakeStatus");
  const setKStatus = (t) => { if (kStatus) kStatus.textContent = t || ""; };
  $("#backupBtn").addEventListener("click", async () => {
    setKStatus("Preparing your journal…");
    try {
      const r = await exportJournal();
      setKStatus(r === "shared" ? "Sent." : r === "cancel" ? "" : "Backup file saved.");
    } catch (e) { setKStatus("Couldn't build the backup — try again."); }
  });
  $("#restoreBtn").addEventListener("click", () => $("#restoreInput").click());
  $("#restoreInput").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    setKStatus("Restoring…");
    try {
      const { added } = await importJournal(f);
      setKStatus(`Restored — ${added} new photograph${added === 1 ? "" : "s"}. Refreshing…`);
      setTimeout(() => location.reload(), 1000);
    } catch (err) { setKStatus("That doesn't look like a journal backup file."); }
  });

  /* ==========================================================
     Theme toggle
     ========================================================== */
  const themeBtn = $("#themeBtn");
  const saved = store.get("theme", null);
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  themeBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const sysDark = matchMedia("(prefers-color-scheme: dark)").matches;
    const next = cur ? (cur === "dark" ? "light" : "dark") : (sysDark ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", next);
    store.set("theme", next);
  });

  /* ==========================================================
     Service worker
     ========================================================== */
  if ("serviceWorker" in navigator) {
    addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
