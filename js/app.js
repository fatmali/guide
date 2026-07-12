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

  // every stop, flattened in trip order, tagged with its day
  const ALL_STOPS = [];
  J.days.forEach((d) => (d.stops || []).forEach((s) => {
    if (s.lat != null) ALL_STOPS.push(Object.assign({ dayId: d.id, dayLabel: d.kicker }, s));
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
      ${stop.time ? `<div class="stop__time">${stop.time}</div>` : ""}
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
    const idx = ALL_STOPS.indexOf(here);
    const next = ALL_STOPS[idx + 1] || null;
    return {
      here, hereDist: best, next,
      nextDist: next ? haversine(userPos, next) : null,
      then: ALL_STOPS.slice(idx + 2, idx + 4),
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
        return `<div class="upnext__label">${g}Not in London yet</div>
          <p class="upnext__lede">You're about ${fmtDist(data.hereDist)} out. This wakes up once you land. When you're ready, the four days begin here —</p>
          <h3 class="upnext__name">${first.name}</h3>
          <div class="upnext__meta">Nearest Tube · ${first.tube} ${lineChips(first.lines)}</div>
          <div class="maplinks"><a class="maplink maplink--apple" href="${dirApple(first)}" target="_blank" rel="noopener">${ICON.map} Directions</a></div>
          <button class="upnext__relink" data-loc>Refresh</button>`;
      }
      if (!data.next) {
        return `<div class="upnext__label">${g}Journey's end</div>
          <div class="upnext__near">Nearest you · ${data.here.name} · ${fmtDist(data.hereDist)}</div>
          <p class="upnext__lede">This is where London hands you to the train. Window seat, left-hand side, going north.</p>
          <button class="upnext__relink" data-loc>Refresh</button>`;
      }
      const n = data.next;
      return `<div class="upnext__label">${g}Up next</div>
        <div class="upnext__near">You're nearest <b>${data.here.name}</b> · ${fmtDist(data.hereDist)} away</div>
        <h3 class="upnext__name">${n.name}</h3>
        <div class="upnext__meta">${walkMin(data.nextDist)} min walk · ${fmtDist(data.nextDist)}${n.tube ? " · " + n.tube : ""} ${lineChips(n.lines)}</div>
        <div class="maplinks">
          <a class="maplink maplink--apple upnext__go" href="${dirApple(n)}" target="_blank" rel="noopener">${ICON.apple} Walk there</a>
          <a class="maplink" href="${dirGoogle(n)}" target="_blank" rel="noopener">${ICON.map} Google</a>
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

    if (day.id !== "arrival") c.appendChild(upNextCard(day));

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

  // wayfinder: render idle cards; if she's opted in before, pick up where she is
  paintUpNext();
  if (store.get("locOptIn", false)) locate();

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
