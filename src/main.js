import '@fontsource-variable/montserrat';
import '@fontsource-variable/inter';
import '@fontsource-variable/inter/wght-italic.css';
import './styles.css';
import { createPortrait } from './particles.js';
import { createIntro, wrapLetters } from './intro.js';
import portraitUrl from '../photos/portrait-cutout.png';

const hero = document.querySelector('.hero');
const title = document.querySelector('.hero__title');
const meta = document.querySelector('.hero__meta');
const nav = document.querySelector('.nav');
const canvas = document.querySelector('.hero__canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

boot();

async function boot() {
  // A link straight to a section (or reduced motion) skips the show.
  const skipIntro = reduced || location.hash.length > 1;
  if (!skipIntro) scrollTo(0, 0);

  await Promise.all([
    document.fonts.load('900 100px "Montserrat Variable"'),
    document.fonts.load('400 16px "Inter Variable"'),
    document.fonts.load('italic 400 16px "Inter Variable"'),
  ]).catch(() => {});

  // The intro animates this state straight away; the portrait reads it once it's ready.
  const particles = { dust: 0, progress: skipIntro ? 1 : 0, scatter: 0 };
  let portrait = null;
  createPortrait(canvas, portraitUrl, { reduced, state: particles })
    .then((p) => {
      portrait = p;
      if (!p) hero.classList.add('no-webgl');
    })
    .catch((err) => {
      console.warn('Particle portrait unavailable:', err);
      hero.classList.add('no-webgl');
    });

  setupMenu();
  setupNavBackground();
  setupActiveLink();
  setupReveal();
  setupScatter(particles, () => portrait?.invalidate());

  if (skipIntro) {
    wrapLetters(title);
    document.body.classList.remove('is-intro');
    if (location.hash.length > 1) document.querySelector(location.hash)?.scrollIntoView();
    return;
  }

  const intro = createIntro({
    hero,
    title,
    meta,
    nav,
    particles,
    name: hero.dataset.introName || 'SUFIAN',
  });
  document.querySelector('.hero__skip').addEventListener('click', intro.skip);
  if (import.meta.env.DEV) window.__intro = intro.timeline;
  intro.play();
}

function setupMenu() {
  const toggle = document.querySelector('.nav__toggle');
  const menu = document.getElementById('menu');
  const set = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
    document.documentElement.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => set(menu.hidden));
  menu.addEventListener('click', (e) => e.target.closest('a') && set(false));
  addEventListener('keydown', (e) => e.key === 'Escape' && !menu.hidden && set(false));
}

// The nav gets a solid backing once content scrolls under it.
function setupNavBackground() {
  const update = () => nav.classList.toggle('is-scrolled', scrollY > 40);
  addEventListener('scroll', update, { passive: true });
  update();
}

function setupActiveLink() {
  const links = [...document.querySelectorAll('.nav__links a')];
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = `#${entry.target.id}`;
        links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === id));
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  document.querySelectorAll('main > section[id]').forEach((s) => io.observe(s));
}

function setupReveal() {
  const io = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach((e, i) => {
          e.target.style.transitionDelay = `${i * 90}ms`;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        });
    },
    { threshold: 0.15 },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
}

// Scrolling away from the hero blows the portrait apart.
function setupScatter(particles, redraw) {
  let queued = false;
  addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        particles.scatter = Math.min(1, Math.max(0, scrollY / (hero.offsetHeight * 0.75)));
        redraw();
      });
    },
    { passive: true },
  );
}
