# The London Journal

A premium, offline-first travel companion for four slow days in London —
16–19 July, then a train to York. Built for one traveller, by hand.

Not an itinerary generator. It reads like a beautifully set city guide:
paper, ink, editorial margins, and notes written in the voice of an
architect friend who quietly knows London.

## The experience

- **Turn the pages.** Swipe horizontally between the cover, each day, and
  the hunt list — like a printed journal. Arrow keys work too.
- **Every day is composed, not listed.** A dek, a single mission, weather
  and budget, then an intelligent route (clustered geographically to
  minimise walking and Tube changes — with the *reasons* spelled out),
  the stops with full logistics, and editorial notes: coffee, meals,
  a photography mission, a design-safari observation, a hidden gem, one
  mandatory slow moment, and a reflection.
- **Real logistics on every stop.** Address, hours, visit duration,
  nearest Tube (with correctly-coloured line chips), walking time and
  distance from the previous stop, accessibility notes, and one-tap
  **Apple Maps** + **Google Maps** deep links that open the native app.

## Signature feature — the passport

Finish a day and press its stamp. An ink stamp presses onto the page with a
satisfying settle, and the day is recorded in your **Passport** (the ✦ in
the footer), where the collected stamps live. Everything persists between
sessions.

## Also remembered

- The **hunt list** (shopping) — tick items off; they stay ticked.
- A **margin note** on every day, for a line you want to keep.
- Your **theme** choice.

## Craft notes

- **Offline-first PWA.** A service worker precaches the entire shell —
  HTML, CSS, JS, icons, and all fonts — so the guide opens with no signal.
  Only the map links need the outside world. Installable to the iPhone
  home screen.
- **Self-hosted type.** Cormorant Garamond (display), Inter (body) and
  IBM Plex Mono (labels) are bundled as latin-subset `woff2` (~320 KB
  total) — no CDN, genuinely offline.
- **Light & dark**, both hand-tuned around a warm-paper / charcoal-ink
  palette with a single muted London-Underground-red accent.
- **Accessible & calm.** Large touch targets, keyboard navigation,
  `prefers-reduced-motion` honoured throughout.
- **No build step.** Static files. Open `index.html` behind any static
  server (a service worker needs `http://`, not `file://`).

## Run it

```sh
# any static server works, e.g.
python3 -m http.server 8000
# then open http://localhost:8000
```

## Structure

```
index.html                 shell + masthead + spine nav + passport overlay
css/app.css                the design system
js/data.js                 the trip — every place and note, handwritten
js/app.js                  rendering, navigation, stamp, persistence
sw.js                      offline precache
manifest.webmanifest       PWA install metadata
assets/fonts/              self-hosted woff2 (latin subsets)
assets/icon-*.png          the roundel, generated
```
