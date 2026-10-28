# Sufian Choudhury · Portfolio

A one-page portfolio. A white ball bounces in, the "I" of SUFIAN drops onto it as a "!", the name tumbles out and
flips into PORTFOLIO, and a particle portrait gathers behind the title. Scroll and it scatters.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. `npm run build` puts the finished site in `dist/`, ready for Vercel, Netlify or
GitHub Pages.

## Where things are

- `index.html`: all the text (role, bio, projects, stack, contact). The intro name is `data-intro-name` on the hero.
- `src/intro.js`: the opening animation (GSAP).
- `src/particles.js`: the WebGL particle portrait, made from `photos/portrait-cutout.png`.
- `src/styles.css`: the look.
- `photos/`: `headshot-suit.jpg` is the photo the site uses. `headshot-about.jpg` (the About card) and
  `portrait-cutout.png` (the particles) are made from it. `headshot-dark.jpg` and `headshot-light.jpg` are the
  earlier retouched photos, no longer used.

Visitors can skip the intro (Skip intro, Esc or scrolling). It doesn't play for people who prefer reduced motion,
or when a link opens a section directly (like `/#work`).
