import { gsap } from 'gsap';

export function wrapLetters(el, text = el.textContent.trim()) {
  el.innerHTML = [...text].map((c) => `<span class="ch">${c}</span>`).join('');
  return [...el.children];
}

// The opening: a ball bounces in, the "I" of the name drops above it like a "!",
// tips over to spill out the rest of the name, then every letter flips into the title,
// which glides down to its place while the particle portrait gathers behind it.
export function createIntro({ hero, title, meta, nav, name, particles, onDone }) {
  const word = title.textContent.trim();
  const finalSpans = wrapLetters(title, word);
  const fs = parseFloat(getComputedStyle(title).fontSize);
  const heroBox = hero.getBoundingClientRect();
  const titleBox = title.getBoundingClientRect();
  const finalX = finalSpans.map((s) => s.getBoundingClientRect().left - titleBox.left);

  // Measure the name in the same type, centred on the title.
  const probe = document.createElement('div');
  probe.className = 'word';
  probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden';
  wrapLetters(probe, name);
  const baseMark = document.createElement('span');
  baseMark.style.cssText = 'display:inline-block;width:0;height:0';
  probe.append(baseMark);
  hero.append(probe);
  const probeBox = probe.getBoundingClientRect();
  const nameSpans = [...probe.querySelectorAll('.ch')];
  const shift = (titleBox.width - probeBox.width) / 2;
  const nameX = nameSpans.map((s) => s.getBoundingClientRect().left - probeBox.left + shift);
  const nameW = nameSpans.map((s) => s.getBoundingClientRect().width);
  const baseline = baseMark.getBoundingClientRect().top - probeBox.top;
  probe.remove();

  const titleTop = titleBox.top - heroBox.top;
  const dy = heroBox.height / 2 - (titleTop + baseline - 0.36 * fs);
  const aboveHero = -(dy + titleTop);
  const p = name.includes('I') ? name.indexOf('I') : Math.floor(name.length / 2);
  const n = Math.max(name.length, word.length);

  const layer = document.createElement('div');
  layer.className = 'intro word';
  layer.setAttribute('aria-hidden', 'true');
  Object.assign(layer.style, {
    left: `${titleBox.left - heroBox.left}px`,
    top: `${titleTop}px`,
    width: `${titleBox.width}px`,
    height: `${titleBox.height}px`,
  });
  const letters = Array.from({ length: n }, (_, i) => {
    const el = document.createElement('span');
    el.className = 'ch';
    el.textContent = i < name.length ? name[i] : word[i];
    layer.append(el);
    return el;
  });
  const flash = document.createElement('span');
  flash.className = 'intro__flash';
  const ball = document.createElement('span');
  ball.className = 'intro__ball';
  layer.prepend(flash);
  layer.append(ball);
  hero.append(layer);

  const pivot = letters[p];
  const ballD = 0.15 * fs;
  const ballX = nameX[p] + nameW[p] / 2 - ballD / 2;
  const ballY = baseline + 0.08 * fs;
  const rand = (a, b) => a + Math.random() * (b - a);

  gsap.set(layer, { y: dy });
  gsap.set(letters, { transformPerspective: 700, opacity: 0 });
  gsap.set(pivot, { x: nameX[p], y: aboveHero - fs * 1.2, opacity: 1, transformOrigin: `50% ${baseline}px` });
  gsap.set(ball, { x: ballX + heroBox.width * 0.35, y: aboveHero - ballD * 2 });
  gsap.set(flash, { x: nameX[p] + nameW[p] / 2, y: baseline - 0.36 * fs, opacity: 0 });
  for (let i = 0; i < n; i++) {
    if (i === p) continue;
    if (i >= name.length) gsap.set(letters[i], { x: finalX[i] });
    else if (i < p)
      gsap.set(letters[i], {
        x: nameX[p] - nameW[i] * 0.3,
        y: -0.1 * fs,
        rotationZ: rand(-75, -45),
        rotationY: rand(-160, -110),
        rotationX: rand(-40, 40),
        scale: 0.5,
      });
    else gsap.set(letters[i], { x: nameX[p] + nameW[p], y: -0.15 * fs, rotationY: 110, rotationZ: 25, scale: 0.55 });
  }

  const ps = particles;
  const tl = gsap.timeline({ paused: true });

  // 1. The ball drops in from the top right and bounces to rest.
  tl.to(ball, { x: ballX, duration: 1, ease: 'power1.out' }, 0.3);
  tl.to(ball, { y: ballY, duration: 1, ease: 'bounce.out' }, 0.3);

  // 2. The "I" falls above it: "!"
  tl.to(pivot, { y: 0, duration: 0.4, ease: 'power3.in' }, 1.25);
  tl.to(pivot, { scaleY: 0.82, scaleX: 1.14, duration: 0.07, ease: 'power1.out' }, 1.65);
  tl.to(pivot, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1, 0.45)' }, 1.72);
  tl.to(ball, { y: ballY + 0.03 * fs, duration: 0.07, yoyo: true, repeat: 1 }, 1.65);
  tl.to(flash, { opacity: 1, scale: 1, duration: 0.15, ease: 'power2.out', startAt: { scale: 0.5 } }, 1.65);
  tl.to(flash, { opacity: 0.35, scale: 1.25, duration: 0.6 }, 1.8);

  // 3. It tips left and the letters before it tumble out.
  tl.to(pivot, { rotation: -58, duration: 0.3, ease: 'power2.in' }, 2.25);
  for (let i = p - 1, k = 0; i >= 0; i--, k++) {
    const t = 2.4 + k * 0.07;
    tl.to(letters[i], { opacity: 1, duration: 0.15 }, t);
    tl.to(letters[i], { x: nameX[i], rotationZ: 0, rotationY: 0, rotationX: 0, scale: 1, duration: 0.85, ease: 'back.out(1.2)' }, t);
    tl.to(letters[i], { y: -0.42 * fs, duration: 0.3, ease: 'power2.out' }, t);
    tl.to(letters[i], { y: 0, duration: 0.55, ease: 'bounce.out' }, t + 0.3);
  }

  // 4. It swings right and the letters after it flip in.
  tl.to(pivot, { rotation: 26, duration: 0.32, ease: 'power2.inOut' }, 2.62);
  for (let i = p + 1, k = 0; i < name.length; i++, k++) {
    const t = 2.75 + k * 0.08;
    tl.to(letters[i], { opacity: 1, duration: 0.15 }, t);
    tl.to(letters[i], { x: nameX[i], y: 0, rotationY: 0, rotationZ: 0, scale: 1, duration: 0.7, ease: 'back.out(1.4)' }, t);
  }

  // 5. It stands up straight and the ball rolls away.
  tl.to(pivot, { rotation: 0, duration: 0.5, ease: 'back.out(2.4)' }, 3.0);
  tl.to(flash, { opacity: 0, duration: 0.6 }, 3.0);
  tl.to(ball, { y: ballY + fs, opacity: 0, duration: 0.45, ease: 'power2.in' }, 3.35);

  // 6. Letter by letter, the name flips into the title.
  const tM = 3.85;
  for (let i = 0; i < n; i++) {
    const el = letters[i];
    const t = tM + i * 0.075 + 0.11;
    if (i < name.length) {
      if (i < word.length) tl.to(el, { x: finalX[i], duration: 0.95, ease: 'power3.inOut' }, tM);
      tl.to(el, { rotationX: 90, duration: 0.11, ease: 'power1.in' }, t - 0.11);
      if (i < word.length) {
        tl.call(() => (el.textContent = word[i]), null, t);
        tl.fromTo(el, { rotationX: -90 }, { rotationX: 0, duration: 0.22, ease: 'power2.out', immediateRender: false }, t);
      } else {
        tl.to(el, { opacity: 0, duration: 0.1 }, t);
      }
    } else {
      tl.fromTo(el, { rotationX: -90, opacity: 0 }, { rotationX: 0, opacity: 1, duration: 0.24, ease: 'power2.out', immediateRender: false }, t);
    }
  }

  // 7. The title glides down, the role and nav arrive, the portrait gathers.
  const tMove = tM + n * 0.075 + 0.5;
  tl.to(layer, { y: 0, duration: 1.05, ease: 'power3.inOut' }, tMove);
  tl.to(ps, { dust: 1, duration: 1.2, ease: 'power1.out' }, tMove + 0.3);
  tl.fromTo(meta, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', immediateRender: false }, tMove + 0.65);
  tl.call(swap, null, tMove + 1.05);
  tl.to(ps, { progress: 1, duration: 2.6, ease: 'none' }, tMove + 1);
  tl.fromTo(nav, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, tMove + 1.3);
  tl.call(finish, null, tMove + 2.2);

  let swapped = false;
  let done = false;
  function swap() {
    if (swapped) return;
    swapped = true;
    title.style.opacity = '1';
    layer.remove();
  }
  function finish() {
    if (done) return;
    done = true;
    swap();
    document.body.classList.remove('is-intro');
    gsap.set([nav, meta, title], { clearProps: 'opacity,transform' });
    removeEventListener('wheel', skip);
    removeEventListener('touchmove', skip);
    removeEventListener('keydown', onKey);
    removeEventListener('resize', onResize);
    onDone?.();
  }
  function skip() {
    if (done) return;
    tl.progress(1);
    finish();
  }
  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'ArrowDown' || e.key === 'PageDown') skip();
  }
  // Measurements go stale if the width changes (a phone's toolbar only changes the height).
  const startWidth = innerWidth;
  function onResize() {
    if (Math.abs(innerWidth - startWidth) > 40) skip();
  }
  addEventListener('wheel', skip, { passive: true });
  addEventListener('touchmove', skip, { passive: true });
  addEventListener('keydown', onKey);
  addEventListener('resize', onResize);

  return { play: () => tl.play(), skip, timeline: tl };
}
