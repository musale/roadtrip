# Neon Velocity — Production Design System Kit

A complete, production‑ready design system and Tailwind setup for your trip‑recording web app. This kit includes a token architecture (primitive → semantic), motion choreography, accessible components with all states/variants, cross‑platform rules, and performance‑minded CSS.

---

## 0) Project Structure

```
/roadtrip/
  ├─ package.json
  ├─ postcss.config.cjs
  ├─ tailwind.config.cjs
  ├─ src/
  │   ├─ index.html
  │   ├─ css/
  │   │   └─ styles.css
  │   └─ components/
  │       ├─ button.html
  │       ├─ card.html
  │       ├─ stat-tiles.html
  │       ├─ input.html
  │       ├─ navbar.html
  │       ├─ tabs.html
  │       ├─ tooltip.htmlß
  │       ├─ dialog.html
  │       └─ hud-readout.html
  └─ README.md
```

---

## 1) Token System

### 1.1 Primitive Tokens (CSS variables)

```css
:root {
  /** Color Primitives (Neon Velocity) */
  --nv-black: #0d0d0d;
  --nv-graphite: #3a3a3a;
  --nv-white: #f5f7fb;

  --nv-cyan-50: #e9fffb;
  --nv-cyan-100: #c6fff6;
  --nv-cyan-200: #8ffce9;
  --nv-cyan-300: #4ef9e0;
  --nv-cyan-400: #1ff9d9;
  --nv-cyan-500: #00f5d4; /* core neon */
  --nv-cyan-600: #00c6ac;
  --nv-cyan-700: #009c8a;

  --nv-magenta-400: #ff55bd;
  --nv-magenta-500: #ff1b9b; /* secondary neon */
  --nv-magenta-600: #d40c7f;

  --nv-yellow-500: #ffe66d; /* alert/attention */
  --nv-green-500: #3ef08c; /* success */
  --nv-red-500: #ff4d4f; /* error */

  /** Elevation & Shadows */
  --nv-shadow-1: 0 1px 2px rgba(0, 0, 0, 0.4);
  --nv-shadow-2: 0 4px 12px rgba(0, 0, 0, 0.45);
  --nv-shadow-3: 0 10px 30px rgba(0, 0, 0, 0.55);

  /** Typography primitives */
  --nv-font-display: "Orbitron", ui-sans-serif, system-ui, -apple-system, Segoe
      UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans",
    sans-serif;
  --nv-font-body: "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, Segoe
      UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans",
    sans-serif;
  --nv-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;

  /** Spacing & Radii */
  --nv-space-1: 4px;
  --nv-space-2: 8px;
  --nv-space-3: 12px;
  --nv-space-4: 16px;
  --nv-space-5: 20px;
  --nv-space-6: 24px;
  --nv-space-8: 32px;
  --nv-space-10: 40px;
  --nv-radius-sm: 8px;
  --nv-radius-md: 14px;
  --nv-radius-lg: 20px;
  --nv-radius-full: 999px;

  /** Motion primitives */
  --nv-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --nv-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --nv-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --nv-ease-glow: cubic-bezier(
    0.22,
    1,
    0.36,
    1
  ); /* elastic-ish for neon pulses */

  --nv-dur-fast: 120ms;
  --nv-dur-med: 220ms;
  --nv-dur-slow: 360ms;

  /** Layout */
  --nv-container-w: 1200px;
}

/* Dark theme baseline (default) */
:root {
  --nv-bg: var(--nv-black);
  --nv-surface: #121212;
  --nv-surface-2: #171717;
  --nv-border: #2b2b2b;
  --nv-text: #e9f5f3;
  --nv-muted: #9ca3af;
}

/* Light theme (optional) */
:root.light {
  --nv-bg: #f8fbfb;
  --nv-surface: #ffffff;
  --nv-surface-2: #f4f7f7;
  --nv-border: #e5e7eb;
  --nv-text: #0c0e10;
  --nv-muted: #556166;
}
```

### 1.2 Semantic Tokens (map primitives → intent)

```css
:root {
  /* Brand & Accent */
  --color-brand: var(--nv-cyan-500);
  --color-brand-fg-on-dark: #051a17; /* contrast on cyan glow */
  --color-accent: var(--nv-magenta-500);

  /* Text */
  --color-text-primary: var(--nv-text);
  --color-text-muted: var(--nv-muted);
  --color-text-inverse: #0b0b0b;

  /* Surfaces */
  --color-bg: var(--nv-bg);
  --color-surface: var(--nv-surface);
  --color-surface-strong: var(--nv-surface-2);
  --color-border: var(--nv-border);

  /* States */
  --color-success: var(--nv-green-500);
  --color-warning: var(--nv-yellow-500);
  --color-danger: var(--nv-red-500);

  /* Focus */
  --focus-ring: 0 0 0 3px rgba(0, 245, 212, 0.2), 0 0 0 2px var(--nv-cyan-500);
}
```

---

## 2) Tailwind Setup

### 2.1 package.json

```json
{
  "name": "neon-velocity",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tailwindcss -i ./src/css/styles.css -o ./dist/styles.css -m && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "vite": "^5.4.8"
  }
}
```

### 2.2 postcss.config.cjs

```js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

### 2.3 tailwind.config.cjs

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", ":root:not(.light)"],
  content: ["./src/**/*.{html,js,ts}"],
  theme: {
    container: { center: true, screens: { xl: "1200px" } },
    extend: {
      fontFamily: {
        display: ["Orbitron", "ui-sans-serif", "system-ui"],
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo"],
      },
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        surfaceStrong: "var(--color-surface-strong)",
        border: "var(--color-border)",
        brand: "var(--color-brand)",
        accent: "var(--color-accent)",
        text: {
          DEFAULT: "var(--color-text-primary)",
          muted: "var(--color-text-muted)",
          inverse: "var(--color-text-inverse)",
        },
        state: {
          success: "var(--color-success)",
          warning: "var(--color-warning)",
          danger: "var(--color-danger)",
        },
      },
      borderRadius: {
        sm: "var(--nv-radius-sm)",
        md: "var(--nv-radius-md)",
        lg: "var(--nv-radius-lg)",
        full: "var(--nv-radius-full)",
      },
      boxShadow: {
        nv1: "var(--nv-shadow-1)",
        nv2: "var(--nv-shadow-2)",
        nv3: "var(--nv-shadow-3)",
        focus: "var(--focus-ring)",
      },
      spacing: {
        1: "var(--nv-space-1)",
        2: "var(--nv-space-2)",
        3: "var(--nv-space-3)",
        4: "var(--nv-space-4)",
        5: "var(--nv-space-5)",
        6: "var(--nv-space-6)",
        8: "var(--nv-space-8)",
        10: "var(--nv-space-10)",
      },
      keyframes: {
        glowPulse: {
          "0%": { boxShadow: "0 0 0 0 rgba(0,245,212,0.2)" },
          "70%": { boxShadow: "0 0 0 8px rgba(0,245,212,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(0,245,212,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glitchIn: {
          "0%": {
            opacity: 0,
            transform: "translate3d(-2px,0,0) skewX(-10deg)",
          },
          "50%": {
            opacity: 0.9,
            transform: "translate3d(2px,0,0) skewX(10deg)",
          },
          "100%": { opacity: 1, transform: "translate3d(0,0,0) skewX(0)" },
        },
      },
      animation: {
        glowPulse: "glowPulse 1.6s var(--nv-ease-glow) infinite",
        shimmer: "shimmer 1.2s linear infinite",
        glitchIn: "glitchIn var(--nv-dur-med) steps(20, end) 1",
      },
      transitionTimingFunction: {
        nvIn: "var(--nv-ease-in)",
        nvOut: "var(--nv-ease-out)",
        nv: "var(--nv-ease-in-out)",
        glow: "var(--nv-ease-glow)",
      },
      transitionDuration: {
        fast: "var(--nv-dur-fast)",
        med: "var(--nv-dur-med)",
        slow: "var(--nv-dur-slow)",
      },
    },
  },
  plugins: [
    function ({ addVariant }) {
      addVariant("hocus", ["&:hover", "&:focus-visible"]);
      addVariant("reduced-motion", "@media (prefers-reduced-motion: reduce) &");
    },
  ],
};
```

### 2.4 src/css/styles.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Inject tokens first */
:root {
  @apply text-text bg-bg;
}

/* Focus visible ring */
.focus-visible:focus-visible {
  box-shadow: var(--focus-ring);
  outline: none;
}

/* Neon borders utility */
.nv-neon {
  box-shadow: 0 0 0 1px rgba(0, 245, 212, 0.35), 0 0 22px rgba(
        0,
        245,
        212,
        0.16
      ) inset;
}
.nv-neon-strong {
  box-shadow: 0 0 0 1px rgba(0, 245, 212, 0.6), 0 0 48px rgba(0, 245, 212, 0.2) inset;
}

/* Elevated surfaces */
.nv-surface {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.02),
    rgba(255, 255, 255, 0)
  );
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 3) Components (HTML + Tailwind)

### 3.1 Buttons (variants + states)

```html
<!-- Primary -->
<button
  class="focus-visible rounded-md px-5 py-3 font-display text-[15px] tracking-wide
  text-bg bg-brand nv-neon-strong shadow-nv2 transition-[transform,box-shadow] duration-fast ease-nv
  hocus:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none"
>
  Start Trip
</button>

<!-- Secondary (ghost) -->
<button
  class="focus-visible rounded-md px-5 py-3 font-display text-[15px] tracking-wide
  text-text border border-border bg-surface/40 shadow-nv1 transition duration-fast ease-nv
  hocus:border-brand hocus:text-brand"
>
  View Trips
</button>

<!-- Destructive -->
<button
  class="focus-visible rounded-md px-5 py-3 font-display text-[15px] tracking-wide
  text-bg bg-state-danger shadow-nv2 transition duration-fast ease-nv hocus:opacity-90"
>
  Delete
</button>
```

States covered: hover/focus-visible/active/disabled. Focus uses high‑contrast ring.

### 3.2 Icon Button

```html
<button
  aria-label="Settings"
  class="focus-visible grid place-items-center size-10 rounded-full nv-neon bg-surface text-text transition duration-fast ease-nv hocus:bg-surfaceStrong"
>
  <svg
    class="size-5"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      d="M19.14,12.94a7.14,7.14,0,1,1-7.14-7.14,7.14,7.14,0,0,1,7.14,7.14Z"
    />
  </svg>
</button>
```

### 3.3 Cards / Panels

```html
<article
  class="rounded-lg border border-border bg-surface nv-surface shadow-nv2 p-6 text-text"
>
  <h3 class="font-display text-xl mb-2">Trip Summary</h3>
  <p class="text-text/80">
    Distance: <span class="font-mono">12.4 km</span> • Time:
    <span class="font-mono">00:46:21</span>
  </p>
</article>
```

### 3.4 Stat Tiles (glowing)

```html
<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <div class="rounded-lg p-5 bg-surfaceStrong nv-neon">
    <div class="text-text/70 text-xs uppercase tracking-widest">Speed</div>
    <div class="mt-2 font-display text-3xl">
      32.8 <span class="text-text/70 text-base">km/h</span>
    </div>
  </div>
  <div class="rounded-lg p-5 bg-surfaceStrong nv-neon">
    <div class="text-text/70 text-xs uppercase tracking-widest">Distance</div>
    <div class="mt-2 font-display text-3xl">
      14.21 <span class="text-text/70 text-base">km</span>
    </div>
  </div>
  <div class="rounded-lg p-5 bg-surfaceStrong nv-neon">
    <div class="text-text/70 text-xs uppercase tracking-widest">Max Speed</div>
    <div class="mt-2 font-display text-3xl">
      58.9 <span class="text-text/70 text-base">km/h</span>
    </div>
  </div>
  <div class="rounded-lg p-5 bg-surfaceStrong nv-neon">
    <div class="text-text/70 text-xs uppercase tracking-widest">Elev. Gain</div>
    <div class="mt-2 font-display text-3xl">
      122 <span class="text-text/70 text-base">m</span>
    </div>
  </div>
</div>
```

### 3.5 Inputs

```html
<label class="block text-text/80 text-sm mb-2">Trip Name</label>
<input
  type="text"
  class="w-full rounded-md border border-border bg-surface px-4 py-3 text-text placeholder:text-text/40
  focus-visible:outline-none focus-visible:shadow-focus"
/>
```

### 3.6 Tabs (underline neon)

```html
<div
  role="tablist"
  aria-label="Views"
  class="flex gap-6 border-b border-border"
>
  <button
    role="tab"
    aria-selected="true"
    class="relative pb-3 text-text focus-visible"
  >
    Overview
    <span
      class="absolute left-0 -bottom-[1px] h-[2px] w-full bg-brand animate-glowPulse"
    ></span>
  </button>
  <button
    role="tab"
    aria-selected="false"
    class="relative pb-3 text-text/70 hover:text-text focus-visible"
  >
    Stats
  </button>
  <button
    role="tab"
    aria-selected="false"
    class="relative pb-3 text-text/70 hover:text-text focus-visible"
  >
    Video
  </button>
</div>
```

### 3.7 Navbar (glass + neon accent)

```html
<header
  class="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-bg/40 border-b border-border"
>
  <div class="container mx-auto flex items-center justify-between py-4">
    <a class="font-display text-lg tracking-widest"
      >NEON<span class="text-brand">•</span>VELOCITY</a
    >
    <nav class="hidden md:flex gap-6 text-text/80">
      <a class="hocus:text-text" href="#">Product</a>
      <a class="hocus:text-text" href="#">Pricing</a>
      <a class="hocus:text-text" href="#">Docs</a>
    </nav>
    <button
      class="md:hidden focus-visible size-10 rounded-md nv-neon"
      aria-label="Open menu"
    >
      ≡
    </button>
  </div>
</header>
```

### 3.8 Tooltip (pure CSS focus/hover)

```html
<div class="relative inline-block">
  <button class="focus-visible rounded-md px-3 py-2 nv-neon bg-surface">
    ?
    <span class="sr-only">Show hint</span>
  </button>
  <div
    role="tooltip"
    class="pointer-events-none absolute left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-md bg-surfaceStrong px-3 py-2 text-sm text-text shadow-nv2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-fast ease-nv"
  >
    Heads-up display shows speed/time.
  </div>
</div>
```

### 3.9 Dialog (accessible, focus trap note)

```html
<!-- Minimal structure; wire focus trap with a tiny JS module or use dialog element -->
<dialog
  id="nvDialog"
  class="backdrop:bg-black/60 rounded-lg border border-border bg-surface text-text w-[min(92vw,520px)] p-6"
>
  <form method="dialog">
    <h3 class="font-display text-xl mb-2">Export Trip</h3>
    <p class="text-text/80 mb-4">Choose format:</p>
    <div class="flex gap-3">
      <button class="focus-visible rounded-md px-4 py-2 bg-brand text-bg">
        GPX
      </button>
      <button class="focus-visible rounded-md px-4 py-2 border border-border">
        GeoJSON
      </button>
    </div>
  </form>
</dialog>
```

### 3.10 HUD Readout (site, not canvas)

```html
<div class="grid grid-cols-3 gap-4">
  <div class="rounded-lg p-4 nv-neon bg-surfaceStrong">
    <div class="text-xs text-text/60 uppercase tracking-widest">Speed</div>
    <div class="font-display text-2xl">
      23.4 <span class="text-sm text-text/70">km/h</span>
    </div>
  </div>
  <div class="rounded-lg p-4 nv-neon bg-surfaceStrong">
    <div class="text-xs text-text/60 uppercase tracking-widest">Time</div>
    <div class="font-display text-2xl">00:08:12</div>
  </div>
  <div class="rounded-lg p-4 nv-neon bg-surfaceStrong">
    <div class="text-xs text-text/60 uppercase tracking-widest">Distance</div>
    <div class="font-display text-2xl">
      1.92 <span class="text-sm text-text/70">km</span>
    </div>
  </div>
</div>
```

---

## 4) Motion Choreography (system‑level)

**Page/Section Entrances**

- Default: `opacity 0→1` & `translateY(8px→0)` over `var(--nv-dur-med)` easing `var(--nv-ease-out)`.
- Hero polylines: `animation: glitchIn` once, then idle.

**Interactive Elements**

- Buttons: subtle lift `transform: translateY(-1px)` on hover/focus; return on active. Neon ring pulse via `glowPulse` on primary CTAs only (not everywhere).

**Feedback**

- Success toasts slide from top with blur (220ms). Warning flashes edge highlight using `box-shadow` accent for 180ms.

**Reduced Motion**

- Respect `prefers-reduced-motion: reduce` with instant transitions and no glow pulse animations.

---

## 5) Accessibility Standards

- **Color Contrast:** Primary text vs. `--color-bg` ≥ 4.5:1; neon accents are used on dark surfaces with sufficient luminance. Provide text alternatives.
- **Focus Visible:** Always show `:focus-visible` ring using `--focus-ring` with high contrast; avoid relying only on glow.
- **Keyboard:** All interactive components are reachable in logical order. Dialog uses `<dialog>` for native semantics; when opening, call `.showModal()` and focus the first interactive element.
- **ARIA:** Tabs have `role="tablist"`, `role="tab"`, and `aria-selected`. Tooltips use `role="tooltip"` and are paired with `aria-describedby` when dynamic.
- **Live Regions:** HUD textual mirror uses `aria-live="polite"` for screen readers if the canvas HUD is used elsewhere.

---

## 6) Cross‑Platform Adaptation

- **Mobile DPR:** Scale stroke widths and neon shadows to devicePixelRatio; Tailwind utilities already produce crisp text. Keep canvas HUD at 720p internally for performance.
- **Safe Areas:** Use `pt-[env(safe-area-inset-top)]` and `pb-[env(safe-area-inset-bottom)]` for navbar/footer spacing on iOS.
- **Input Modes:** Increase touch targets to 44×44 min.
- **Fallback Fonts:** If Orbitron is unavailable, fall back to system heading sans.

---

## 7) Performance Strategy

- Prefer **GPU transforms** for motion (translate/opacity), avoid animating box-shadows except short pulses.
- Use `content-visibility: auto;` on below-the-fold sections.
- `contain: layout paint;` for self-contained cards to reduce repaint cost.
- Defer heavy JS; keep CSS under 50KB minified. Tailwind purge via `content` globs.
- Reduce blur/backdrop on low-end devices (feature‑detect and toggle a `.lowpower` class).

---

## 8) Example Page (src/index.html)

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Neon Velocity UI</title>
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;700&family=Orbitron:wght@600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="bg-bg text-text">
    <header class="sticky top-0 z-50 backdrop-blur border-b border-border">
      <div class="container mx-auto flex items-center justify-between py-4">
        <a class="font-display text-lg tracking-widest"
          >NEON<span class="text-brand">•</span>VELOCITY</a
        >
        <nav class="hidden md:flex gap-6 text-text/80">
          <a class="hocus:text-text" href="#">Product</a>
          <a class="hocus:text-text" href="#">Pricing</a>
          <a class="hocus:text-text" href="#">Docs</a>
        </nav>
        <div class="flex items-center gap-3">
          <button
            class="focus-visible rounded-md px-4 py-2 border border-border hocus:border-brand hocus:text-brand"
          >
            Sign in
          </button>
          <button
            class="focus-visible rounded-md px-4 py-2 bg-brand text-bg nv-neon-strong shadow-nv2"
          >
            Get Started
          </button>
        </div>
      </div>
    </header>

    <main class="container mx-auto px-4 py-10">
      <section class="grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 class="font-display text-5xl leading-tight">
            Futuristic tracking.
            <span class="text-brand">Real‑world rides.</span>
          </h1>
          <p class="mt-4 text-text/80 text-lg">
            Record trips, overlay a live neon HUD, and export everything —
            straight from your browser.
          </p>
          <div class="mt-8 flex gap-4">
            <button
              class="focus-visible rounded-md px-5 py-3 bg-brand text-bg nv-neon-strong shadow-nv2"
            >
              Start Free
            </button>
            <button
              class="focus-visible rounded-md px-5 py-3 border border-border hocus:border-brand hocus:text-brand"
            >
              See Demo
            </button>
          </div>
        </div>
        <div class="rounded-xl p-6 bg-surfaceStrong nv-neon shadow-nv3">
          <div class="grid grid-cols-3 gap-4">
            <div class="rounded-lg p-4 nv-neon bg-surface">
              <div class="text-xs text-text/60 uppercase tracking-widest">
                Speed
              </div>
              <div class="font-display text-3xl">
                32.8 <span class="text-sm text-text/70">km/h</span>
              </div>
            </div>
            <div class="rounded-lg p-4 nv-neon bg-surface">
              <div class="text-xs text-text/60 uppercase tracking-widest">
                Time
              </div>
              <div class="font-display text-3xl">00:14:22</div>
            </div>
            <div class="rounded-lg p-4 nv-neon bg-surface">
              <div class="text-xs text-text/60 uppercase tracking-widest">
                Distance
              </div>
              <div class="font-display text-3xl">
                6.12 <span class="text-sm text-text/70">km</span>
              </div>
            </div>
          </div>
          <div class="mt-6 rounded-lg border border-border p-6">
            <p class="text-text/80">
              Glowing HUD, dual‑camera PiP, single exportable file. All in a
              PWA.
            </p>
          </div>
        </div>
      </section>

      <section class="mt-16">
        <h2 class="font-display text-3xl mb-6">Feature Highlights</h2>
        <div class="grid md:grid-cols-3 gap-6">
          <article class="rounded-lg p-5 bg-surface nv-surface shadow-nv2">
            <h3 class="font-display text-xl mb-2">Neon HUD</h3>
            <p class="text-text/80">
              Speed, distance, direction baked into the video via canvas
              compositing.
            </p>
          </article>
          <article class="rounded-lg p-5 bg-surface nv-surface shadow-nv2">
            <h3 class="font-display text-xl mb-2">Local‑first</h3>
            <p class="text-text/80">
              Offline PWA with IndexedDB + OPFS for video chunks and trip data.
            </p>
          </article>
          <article class="rounded-lg p-5 bg-surface nv-surface shadow-nv2">
            <h3 class="font-display text-xl mb-2">Export Ready</h3>
            <p class="text-text/80">
              GPX/GeoJSON export and video share via Web Share Target.
            </p>
          </article>
        </div>
      </section>
    </main>

    <footer class="border-t border-border mt-16">
      <div class="container mx-auto py-8 text-text/60 text-sm">
        © 2025 Neon Velocity
      </div>
    </footer>
  </body>
</html>
```

---

## 9) Notes on Integration with Your App

- Drop the token vars into your global CSS before Tailwind layers (as shown). Tailwind utility classes reference CSS variables, so theming is instant via toggling `.light` or swapping values.
- For canvas HUD, keep visual consistency by sampling the same brand colors: `ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary');` and `--color-brand` for accent strokes.
- For JS components (tabs, dialog), a small headless controller can manage ARIA and keyboard interactions; keep the HTML structure/utility classes from this kit.

---

## 10) Ready‑to‑Ship Checklist

- [ ] Run `npm run dev` to preview with Vite.
- [ ] Confirm contrast ratios in dark + light.
- [ ] Verify focus rings on all interactive controls.
- [ ] Test reduced motion; ensure animations disable gracefully.
- [ ] Lighthouse performance ≥ 90 on mobile; reduce backdrop blur if needed.
- [ ] Purge CSS via Tailwind build for < 20KB gzipped utilities.

---

This delivers a cohesive, high‑impact **Neon Velocity** aesthetic with strong accessibility and performance. Adapt any component by swapping semantic tokens — the neon vibe stays consistent while remaining production‑solid.
