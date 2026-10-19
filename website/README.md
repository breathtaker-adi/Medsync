# Medsync

> **Medicine in Sync. Life on Schedule.**
> A motion-heavy, Awwwards-grade single-page experience for the Medsync
> prescription-adherence ecosystem — connecting patients, doctors and
> pharmacies on one living timeline.

Built as a dark, "Cyber-Clinical Noir" showcase: a WebGL glass capsule with a
DNA helix, a boot-sequence preloader, butter-smooth Lenis scrolling, GSAP
scroll-driven storytelling, an interactive bento grid of product modules,
a velocity-reactive metrics marquee, a custom player for the real pitch film,
and a terminal-style live sync console.

---

## Quick start

Requires **Node.js 20.9+** (or Bun 1.1+).

```bash
# npm
npm install
npm run dev

# pnpm
pnpm install
pnpm dev

# bun
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).
The first compile takes a moment (three.js + fonts); subsequent routes are instant.

### Scripts

| Command         | What it does                                    |
| --------------- | ----------------------------------------------- |
| `npm run dev`   | Start the dev server on port 3000               |
| `npm run build` | Production build (type-checked, no errors ignored) |
| `npm run start` | Serve the production build                      |
| `npm run lint`  | ESLint (Next core-web-vitals + TypeScript)      |

---

## Tech stack

| Layer          | Choice                                                        |
| -------------- | ------------------------------------------------------------- |
| Framework      | **Next.js 16** (App Router) + **React 19** + **TypeScript 5** |
| Styling        | **Tailwind CSS v4** (CSS-first config in `globals.css`)       |
| Smooth scroll  | **Lenis** (`lerp: 0.08`) wired into GSAP's ticker             |
| Animation      | **motion** (`motion/react` springs/gestures) + **GSAP** w/ ScrollTrigger |
| 3D             | **three.js** via **@react-three/fiber** + **@react-three/drei** |
| Icons          | lucide-react                                                  |
| UI primitives  | Radix (`react-slider`) — the one shadcn/ui component used     |

> Note: the project was originally specced on Next.js 15; it runs on **16**
> here (everything used — App Router, `next/font`, `next/dynamic` — is
> API-compatible across both).

---

## Project structure

```
medsync/
├── public/
│   ├── medsync-film.mp4        # the pitch film (see "Swapping the film")
│   ├── film-poster.jpg         # poster frame shown before playback
│   ├── medsync-mark.svg        # favicon / capsule mark
│   ├── logo.svg
│   └── robots.txt
├── src/
│   ├── app/
│   │   ├── layout.tsx          # fonts (Plus Jakarta Sans + JetBrains Mono), metadata
│   │   ├── page.tsx            # section composition (the whole page)
│   │   └── globals.css         # ⭐ design tokens, materials, keyframes — start here
│   ├── components/
│   │   ├── providers.tsx       # MotionConfig + Lenis + preloader + cursor + grain
│   │   ├── nav/nav.tsx         # glass pill nav, hides on scroll down
│   │   ├── hero/               # "Sync Matrix" hero
│   │   │   ├── hero.tsx        # layout, entrance timeline, CTAs, chips
│   │   │   ├── capsule-canvas.tsx  # dynamic-import wrapper (ssr: false)
│   │   │   ├── capsule-scene.tsx   # R3F scene: glass capsule, DNA helix, orbits
│   │   │   ├── kinetic-headline.tsx# per-char GSAP headline reveal
│   │   │   └── telemetry-badge.tsx # live-latency chip
│   │   ├── bento/              # 6-module asymmetric bento grid
│   │   │   ├── bento.tsx       # grid layout
│   │   │   ├── adherence-card.tsx      # clickable doses → particle bursts + score ring
│   │   │   ├── sync-bridge-card.tsx    # patient⇄provider⇄pharmacy SVG beams
│   │   │   ├── refill-radar-card.tsx   # radar sweep, blip detection, auto-order
│   │   │   ├── hologram-card.tsx       # holo vault lock + specular sweep
│   │   │   ├── vault-card.tsx          # encrypted data at rest
│   │   │   ├── dosage-card.tsx         # weight/dose slider calculator
│   │   │   └── console-teaser.tsx      # terminal teaser strip (opens console)
│   │   ├── day/day-in-medsync.tsx  # 440vh pinned scroll story (08:00/13:00/19:00)
│   │   ├── metrics/metrics.tsx    # velocity-reactive marquee + count-up stats
│   │   ├── film/film.tsx          # custom glass video player + chapter seek
│   │   ├── footer/footer.tsx      # early-access form + kinetic giant type
│   │   ├── console/terminal.tsx   # fixed bottom WS-frame console drawer
│   │   ├── fx/                    # reusable motion primitives
│   │   │   ├── smooth-scroll.tsx  # Lenis provider (GSAP ticker bridge)
│   │   │   ├── cursor.tsx         # magnetic cursor (pointer:fine only)
│   │   │   ├── preloader.tsx      # boot sequence + wipe reveal
│   │   │   ├── grain.tsx          # film grain overlay
│   │   │   ├── magnetic.tsx       # magnetic hover wrapper
│   │   │   ├── sync-button.tsx    # primary CTA (beam border + ripple)
│   │   │   ├── reveal.tsx         # scroll-reveal wrapper
│   │   │   ├── section-heading.tsx# eyebrow + title pattern
│   │   │   └── atoms.tsx          # BorderBeam, CornerTicks, Spotlight…
│   │   └── ui/slider.tsx         # shadcn/ui slider (Radix)
│   ├── hooks/
│   │   └── use-motion-prefs.ts   # reduced-motion + media-query hooks
│   └── lib/
│       ├── utils.ts              # cn()
│       ├── gsap.ts               # gsap + ScrollTrigger + useGSAP re-export
│       ├── scroll.ts             # Lenis singleton access
│       └── events.ts             # typed mini event bus (preloader → hero, etc.)
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
└── components.json              # shadcn CLI config (in case you add more ui/*)
```

---

## Design system — "Cyber-Clinical Noir"

All tokens live in **`src/app/globals.css`** under `@theme` — change them there
and every Tailwind utility (`bg-obsidian`, `text-bio`, `border-coral`, …)
follows instantly.

| Token      | Hex       | Use                                    |
| ---------- | --------- | -------------------------------------- |
| `obsidian` | `#040711` | page background                        |
| `midnight` | `#0B0F19` | raised surfaces                        |
| `bio`      | `#00F0FF` | primary glow — cyan telemetry accents  |
| `pulse`    | `#10B981` | emerald — "healthy / synced" states    |
| `coral`    | `#FF5C5C` | alerts — interaction warnings, spikes  |

- **Type**: Plus Jakarta Sans (display, tight `-0.03em` tracking) +
  JetBrains Mono (`font-telemetry` — uppercase, wide-tracked micro labels).
- **Materials**: `.glass` panels (1px white/8 border + backdrop blur),
  `.holo-border` (animated conic gradient), `.border-beam` (rotating beam
  mask via `@property`), `.blueprint-grid` / `.dot-grid` backdrops.
- **Keyframes**: radar sweep, ECG dash, mesh drift, shimmer, ping — all in
  `globals.css`, all disabled under `prefers-reduced-motion`.

---

## Anatomy of the page

1. **Preloader** — boot readout, 0→100 counter, scroll-locked, wipes up and
   fires `BUS.ready` so the hero timeline starts mid-wipe.
2. **Nav** — glass pill, hides on scroll down, smooth-scrolls to sections.
3. **Hero "Sync Matrix"** — 3D glass capsule (drag your cursor across it),
   kinetic per-char headline, live latency badge, magnetic CTAs.
4. **Bento** — six live modules: take doses and watch the adherence ring,
   scrub the dose calculator, let the refill radar sweep.
5. **A Day in Medsync** — 440vh pinned story: 08:00 dose → 13:00 heart-rate
   spike + food-interaction intercept → 19:00 refill + courier.
6. **Metrics** — marquee that speeds up / reverses with your scroll velocity,
   plus count-up stats.
7. **Film** — the real pitch film in a custom player (play, scrub, chapters,
   mute, fullscreen).
8. **Footer** — early-access intake with floating-label physics and a
   per-char hover-glow giant headline.
9. **Terminal drawer** — click the console teaser (or the FAB) for a
   simulated live WebSocket frame stream.

## Swapping the film

Replace these two files, keeping the names:

- `public/medsync-film.mp4` — ideally ≤ 10 MB, H.264 + AAC, 1080p or less
- `public/film-poster.jpg` — first-frame poster

Chapter ticks in `src/components/film/film.tsx` (`CHAPTERS` array) are
hard-coded to the current film's scenes — adjust the timestamps there.

## Motion & accessibility

- Every animated component reads `useReducedMotion()`; with
  `prefers-reduced-motion` the site skips the preloader, Lenis, pins and
  marquee and renders static content.
- The 3D capsule is `next/dynamic` with `ssr: false`, pauses its render loop
  off-screen, and caps DPR at 1.75.
- Interactive widgets use real semantics: `role="slider"` on the scrub bar,
  `aria-live` on the adherence score, focus-visible rings everywhere.

## Performance notes

- Only `transform` / `opacity` are animated — compositor-only, 60→120fps.
- GSAP's ticker drives Lenis (single rAF loop, `lagSmoothing(0)`).
- `document.fonts.ready` triggers a single `ScrollTrigger.refresh()` so
  pinned sections measure correctly after webfonts settle.

## Repo

Product/codebase: [github.com/breathtaker-adi/Medsync](https://github.com/breathtaker-adi/Medsync)
