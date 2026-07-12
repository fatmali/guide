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
  };
  const glyphFor = (type) => ({
    coffee: "☕", breakfast: "◷", lunch: "❍", dinner: "✦", bakery: "❊",
    photo: "◉", design: "▤", shop: "❖", gem: "◇", slow: "❋", reflection: "❞",
  }[type] || "·");
  const labelFor = (type) => ({
    coffee: "Coffee", breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner",
    bakery: "Bakery", photo: "Photography", design: "Design safari",
    shop: "Shopping", gem: "Hidden gem", slow: "Slow moment", reflection: "Reflection",
  }[type] || type);
  const MUSE = new Set(["photo", "design", "slow", "reflection"]);

  /* ---- the pressed stamp artwork ---- */
  function stampSVG(day) {
    return `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="60" cy="60" r="55" stroke-width="2.2"/>
      <circle cx="60" cy="60" r="45" stroke-width="1"/>
      <path id="tp-${day.id}" d="M60,60 m-33,0 a33,33 0 1,1 66,0 a33,33 0 1,1 -66,0" fill="none" stroke="none"/>
      <text font-family="IBM Plex Mono, monospace" font-size="7.5" letter-spacing="2.5" fill="currentColor" stroke="none">
        <textPath href="#tp-${day.id}" startOffset="0%">· LONDON · ${day.date.toUpperCase()} · ADMITTED ·</textPath>
      </text>
      <text x="60" y="52" text-anchor="middle" font-family="Cormorant Garamond, serif" font-style="italic" font-size="19" fill="currentColor" stroke="none">${day.title.split(" ")[0]}</text>
      <text x="60" y="70" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="8" letter-spacing="2" fill="currentColor" stroke="none">${day.date.replace(/ /g, " ")}</text>
      <line x1="30" y1="78" x2="90" y2="78" stroke-width="1"/>
    </svg>`;
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

  function tubeFact(stop) {
    if (!stop.tube) return "";
    const chips = (stop.lines || []).map((ln) => {
      const [bg, fg] = LINE[ln] || ["#888", "#fff"];
      return `<span class="line-chip" style="background:${bg};color:${fg}">${ln}</span>`;
    }).join(" ");
    return `<div class="fact fact--wide"><span class="fact__k">Nearest Tube</span>
      <span class="fact__v tube"><span class="tube__station">${stop.tube}</span> ${chips}</span></div>`;
  }

  function stopEl(stop) {
    const s = el("article", "stop rise");
    const facts = [
      tubeFact(stop),
      factRow("Walk from previous", stop.walkFromPrev),
      factRow("Walking distance", stop.walkDistance),
      factRow("Visit for", stop.duration),
      factRow("Hours", stop.hours),
      factRow("Address", stop.address, true),
      factRow("Accessibility", stop.access, true),
    ].join("");
    s.innerHTML = `
      <div class="stop__top">
        <h3 class="stop__name">${stop.name}</h3>
        <span class="stop__kind">${stop.kind || ""}</span>
      </div>
      <p class="stop__note">${stop.note}</p>
      <div class="facts">${facts}</div>
      <div class="maplinks">
        <a class="maplink maplink--apple" href="${stop.apple}" target="_blank" rel="noopener">${ICON.apple} Apple&nbsp;Maps</a>
        <a class="maplink" href="${stop.google}" target="_blank" rel="noopener">${ICON.map} Google&nbsp;Maps</a>
      </div>`;
    return s;
  }

  function noteEl(note) {
    const muse = MUSE.has(note.type);
    const n = el("article", "notecard rise" + (muse ? " notecard--muse" : ""));
    const place = note.place ? `<div class="notecard__place">${note.place}</div>` : "";
    const links = (note.apple && note.google)
      ? `<div class="maplinks"><a class="maplink maplink--apple" href="${note.apple}" target="_blank" rel="noopener">${ICON.apple} Apple&nbsp;Maps</a><a class="maplink" href="${note.google}" target="_blank" rel="noopener">${ICON.map} Google&nbsp;Maps</a></div>`
      : "";
    n.innerHTML = `
      <div class="notecard__label"><span class="notecard__glyph">${glyphFor(note.type)}</span>${labelFor(note.type)}</div>
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
      li.innerHTML = `<div class="route__dot"></div>
        <div class="route__name">${r.name}</div>
        <div class="route__note">${r.note || ""}</div>`;
      ol.appendChild(li);
      if (i < day.route.length - 1) ol.appendChild(el("li", "route__link"));
    });
    wrap.appendChild(ol);
    return wrap;
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

    c.appendChild(routeEl(day));

    if (day.stops && day.stops.length) {
      c.appendChild(el("div", "sectlabel rise", "The stops"));
      day.stops.forEach((s) => c.appendChild(stopEl(s)));
    }

    // group notes: food & find, then the muses
    const order = ["coffee", "breakfast", "lunch", "dinner", "bakery", "shop", "gem", "photo", "design", "slow", "reflection"];
    const notes = (day.notes || []).slice().sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    if (notes.length) {
      c.appendChild(el("div", "sectlabel rise", "Notes for the day"));
      notes.forEach((n) => c.appendChild(noteEl(n)));
    }

    c.appendChild(marginEl(day));
    c.appendChild(stampZone(day));

    p.appendChild(c);
    return p;
  }

  // Assemble
  pager.appendChild(coverPage());
  J.days.forEach((d) => pager.appendChild(dayPage(d)));
  pager.appendChild(huntPage());
  pages.push(...pager.querySelectorAll(".page"));

  /* ==========================================================
     Spine navigation
     ========================================================== */
  const spine = $("#spine");
  pages.forEach((page, i) => {
    if (i > 0) spine.appendChild(el("span", "spine__sep"));
    const tab = el("button", "spine__tab", page.dataset.nav);
    tab.dataset.idx = i;
    if (page.dataset.dayId && stampState[page.dataset.dayId]) tab.classList.add("is-done");
    tab.addEventListener("click", () => goTo(i));
    spine.appendChild(tab);
  });
  // passport tab
  spine.appendChild(el("span", "spine__sep"));
  const ppTab = el("button", "spine__tab", "✦");
  ppTab.setAttribute("aria-label", "Open passport");
  ppTab.addEventListener("click", openPassport);
  spine.appendChild(ppTab);

  const tabs = [...spine.querySelectorAll(".spine__tab")].slice(0, pages.length);

  function goTo(i) {
    pages[i].scrollIntoView({ behavior: "smooth", inline: "start" });
    pages[i].focus?.({ preventScroll: true });
  }
  function markSpineDone() {
    pages.forEach((page, i) => {
      if (page.dataset.dayId && stampState[page.dataset.dayId]) tabs[i].classList.add("is-done");
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
        tabs.forEach((t, ti) => t.classList.toggle("is-current", ti === i));
        mastDay.textContent = e.target === pages[0] ? "Cover"
          : e.target.dataset.nav === "Hunt" ? "Hunt list"
          : e.target.dataset.dayId ? J.days.find((d) => d.id === e.target.dataset.dayId).date
          : e.target.dataset.nav;
        // reset internal scroll of newly-entered page for a clean top
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
    const total = J.days.length;
    const count = J.days.filter((d) => stampState[d.id]).length;
    ppIntro.innerHTML = count === 0
      ? "Empty pages. Finish a day and press its stamp — it lands here."
      : count === total
      ? "Every day stamped. Four days walked slowly, and kept."
      : `${count} of ${total} days stamped. The rest are waiting.`;
    ppPages.innerHTML = "";
    J.days.forEach((d, i) => {
      const stamped = !!stampState[d.id];
      const pp = el("div", "pp" + (stamped ? "" : " pp--empty"));
      pp.innerHTML = `<span class="pp__num">No. ${String(i + 1).padStart(2, "0")}</span>
        ${stamped ? `<span class="pp__stamp">${stampSVG(d)}</span>`
                  : `<span class="pp__wait">${d.title}</span>`}`;
      ppPages.appendChild(pp);
    });
  }
  function openPassport() { renderPassport(); sheet.classList.add("is-open"); sheet.setAttribute("aria-hidden", "false"); }
  function closePassport() { sheet.classList.remove("is-open"); sheet.setAttribute("aria-hidden", "true"); }
  $("#passportClose").addEventListener("click", closePassport);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closePassport(); });

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
