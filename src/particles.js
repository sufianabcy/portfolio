// Particle portrait: the cut-out photo becomes a cloud of tiny glowing points that
// swirls together into a face, shimmers, moves aside for the pointer and scatters on scroll.
// Tween `state.dust`, `state.progress` and `state.scatter` (0..1) to drive it.

const VERT = /* glsl */ `
precision highp float;
attribute vec2 a_target;   // position in the photo, px
attribute vec2 a_offset;   // where it waits before gathering, in portrait heights
attribute vec4 a_rand;     // delay, size, phase, speed
attribute float a_bright;
attribute float a_swirl;

uniform vec2 u_res;        // canvas size, css px
uniform vec4 u_rect;       // portrait box: x, y, w, h (css px)
uniform vec2 u_img;        // photo size, px
uniform vec2 u_pivot;      // swirl centre (the face), css px
uniform float u_time;
uniform float u_progress;
uniform float u_dust;
uniform float u_scatter;
uniform vec3 u_mouse;      // x, y, strength
uniform float u_dpr;

varying float v_alpha;
varying float v_bright;

void main() {
  vec2 target = u_rect.xy + a_target / u_img * u_rect.zw;
  float t = u_time * a_rand.w;
  vec2 drift = vec2(sin(t * 0.35 + a_rand.z * 6.2831), cos(t * 0.29 + a_rand.z * 4.0)) * 14.0;
  vec2 start = target + a_offset * u_rect.w + drift;

  float p = clamp((u_progress - a_rand.x * 0.5) / 0.5, 0.0, 1.0);
  float e = p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) * 0.5;

  vec2 pos = mix(start, target, e);
  float ang = a_swirl * (1.0 - e);
  vec2 d = pos - u_pivot;
  float cs = cos(ang);
  float sn = sin(ang);
  pos = u_pivot + vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);

  pos += vec2(sin(u_time * 1.7 + a_rand.z * 40.0), cos(u_time * 1.3 + a_rand.w * 31.0)) * 0.3 * e;

  vec2 dm = pos - u_mouse.xy;
  float dist = length(dm);
  float push = u_mouse.z * e * (1.0 - smoothstep(0.0, 110.0, dist));
  pos += (dm / max(dist, 1.0)) * push * 26.0;

  vec2 sdir = normalize(vec2(a_rand.z - 0.5, -0.55 - a_rand.y * 0.6));
  pos += sdir * u_scatter * (160.0 + 620.0 * a_rand.y) * (0.6 + 0.4 * a_rand.w);

  gl_Position = vec4(pos.x / u_res.x * 2.0 - 1.0, 1.0 - pos.y / u_res.y * 2.0, 0.0, 1.0);

  // Twinkle lives mostly in the gathering dust; once formed the face holds steady enough to read.
  float twinkle = 1.0 - (0.12 + 0.2 * (1.0 - e)) * (0.5 + 0.5 * sin(u_time * (1.2 + a_rand.w * 3.0) + a_rand.z * 50.0));
  float dustA = u_dust * 0.3 * (1.0 - e);
  float formedA = e * (0.5 + 0.5 * pow(a_bright, 0.8));
  v_alpha = (dustA + formedA) * twinkle * (1.0 - u_scatter);
  v_bright = a_bright;
  gl_PointSize = (1.15 + a_rand.y * 0.6 + a_bright * 0.45) * u_dpr;
}
`;

const FRAG = /* glsl */ `
precision mediump float;
varying float v_alpha;
varying float v_bright;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = (1.0 - smoothstep(0.15, 0.5, d)) * v_alpha;
  vec3 col = mix(vec3(0.6, 0.68, 0.95), vec3(1.0), clamp(v_bright * 1.3, 0.0, 1.0));
  gl_FragColor = vec4(col * a, a);
}
`;

const STRIDE = 10;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} src  transparent PNG of the person
 * @param {{ reduced?: boolean, focus?: [number, number], state?: object }} options
 *   focus: where the face is in the photo (0..1), kept centred on screen
 *   state: { dust, progress, scatter } to read every frame, so it can be animated before this resolves
 */
export async function createPortrait(
  canvas,
  src,
  { reduced = false, focus = [0.5, 0.38], state = { dust: 0, progress: 0, scatter: 0 } } = {},
) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const program = buildProgram(gl);
  if (!program) return null;

  // Not img.decode(): Chrome can hold that back while the tab is in the background.
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = src;
  });

  const mouse = { x: -9999, y: -9999, strength: 0, target: 0 };
  let width = 0, height = 0, dpr = 1, rect = [0, 0, 1, 1], pivot = [0, 0];

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  let particles = null;
  let sampledWidth = 0;
  // One particle per ~1.35 css px where the photo is brightest, so it's redone when the size changes a lot.
  function build() {
    particles = sample(img, 1.35 / (rect[2] / img.naturalWidth), 80000);
    sampledWidth = rect[2];
    gl.bufferData(gl.ARRAY_BUFFER, particles.data, gl.STATIC_DRAW);
  }
  measure();
  build();
  const bytes = STRIDE * 4;
  const attrs = [['a_target', 2, 0], ['a_offset', 2, 2], ['a_rand', 4, 4], ['a_bright', 1, 8], ['a_swirl', 1, 9]];
  for (const [name, size, offset] of attrs) {
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, bytes, offset * 4);
  }
  const u = {};
  for (const name of ['u_res', 'u_rect', 'u_img', 'u_pivot', 'u_time', 'u_progress', 'u_dust', 'u_scatter', 'u_mouse', 'u_dpr']) {
    u[name] = gl.getUniformLocation(program, name);
  }
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.clearColor(0, 0, 0, 0);
  gl.uniform2f(u.u_img, particles.w, particles.h);

  function measure() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const aspect = img.naturalWidth / img.naturalHeight;
    const landscape = width / height >= 1;
    const h = landscape ? height * 0.9 : Math.min(height * 0.7, width * 1.45);
    const top = landscape ? height * 0.08 : height * 0.1;
    const w = h * aspect;
    rect = [width / 2 - w * focus[0], top, w, h];
    pivot = [width / 2, top + h * focus[1]];
  }

  let raf = 0, running = false, visible = true, dirty = true;
  const t0 = performance.now();

  function draw(now) {
    const time = reduced ? 0 : (now - t0) / 1000;
    mouse.strength += (mouse.target - mouse.strength) * 0.08;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.u_res, width, height);
    gl.uniform4f(u.u_rect, rect[0], rect[1], rect[2], rect[3]);
    gl.uniform2f(u.u_pivot, pivot[0], pivot[1]);
    gl.uniform1f(u.u_time, time);
    gl.uniform1f(u.u_progress, state.progress);
    gl.uniform1f(u.u_dust, state.dust);
    gl.uniform1f(u.u_scatter, state.scatter);
    gl.uniform3f(u.u_mouse, mouse.x, mouse.y, reduced ? 0 : mouse.strength);
    gl.uniform1f(u.u_dpr, dpr);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (state.scatter < 1 && (state.dust > 0 || state.progress > 0)) {
      gl.drawArrays(gl.POINTS, 0, particles.count);
    }
  }

  function loop(now) {
    raf = 0;
    if (!visible || document.hidden) {
      running = false;
      return;
    }
    if (reduced && !dirty) {
      running = false;
      return;
    }
    dirty = false;
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function wake() {
    dirty = true;
    if (!running) {
      running = true;
      raf = requestAnimationFrame(loop);
    }
  }

  new ResizeObserver(() => {
    measure();
    if (Math.abs(rect[2] / sampledWidth - 1) > 0.25) build();
    wake();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => document.hidden || wake());

  if (!reduced) {
    window.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.target = e.pointerType === 'mouse' ? 1 : 0;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => (mouse.target = 0));
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    running = false;
    canvas.closest('.hero')?.classList.add('no-webgl');
  });

  wake();
  return { state, invalidate: wake };
}

function buildProgram(gl) {
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

// Stipple the photo into particle spots. Error diffusion (Floyd–Steinberg) spaces them evenly,
// so shading and small features like eyelids and the smile survive instead of drowning in noise.
// `cell` is the spacing in photo px where the photo is brightest; `max` caps the count.
function sample(img, cell, max) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  const n = w * h;
  const lum = new Float32Array(n);
  const alpha = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    alpha[i] = data[i * 4 + 3] / 255;
    lum[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  }
  // Two scales of detail: fine for lids, lashes and lips, broad for eye sockets and smile lines.
  const fine = boxBlur(lum, w, h, 2);
  const broad = boxBlur(boxBlur(lum, w, h, 6), w, h, 6);
  const bright = new Float32Array(n);
  const density = new Float32Array(n);
  let mass = 0;
  for (let i = 0; i < n; i++) {
    const l = Math.min(1, Math.max(0, lum[i] + (lum[i] - fine[i]) * 0.9 + (lum[i] - broad[i]) * 0.5));
    // Below the chin a white shirt would soak up the particles the face needs.
    const body = i / w / h > 0.62 ? 0.6 : 1;
    // Soften the photo's cropped left and right edges.
    const x = (i % w) / w;
    const sides = smoothstep(0, 0.12, x) * smoothstep(0, 0.12, 1 - x);
    bright[i] = l;
    density[i] = alpha[i] * body * sides * (0.03 + 0.97 * Math.pow(smoothstep(0.04, 0.86, l), 1.2));
    mass += density[i];
  }

  // Grid of cells, one possible particle each; widen the cells if that would exceed `max`.
  const step = Math.max(cell, Math.sqrt(mass / max));
  const gw = Math.ceil(w / step);
  const gh = Math.ceil(h / step);
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const sx = Math.min(w - 1, ((gx + 0.5) * step) | 0);
      const sy = Math.min(h - 1, ((gy + 0.5) * step) | 0);
      grid[gy * gw + gx] = density[sy * w + sx];
    }
  }
  const spots = [];
  for (let gy = 0; gy < gh; gy++) {
    const dir = gy % 2 ? -1 : 1;
    for (let k = 0; k < gw; k++) {
      const gx = dir > 0 ? k : gw - 1 - k;
      const i = gy * gw + gx;
      const on = grid[i] > 0.5;
      const err = grid[i] - (on ? 1 : 0);
      if (on) spots.push(gx, gy);
      const ahead = gx + dir >= 0 && gx + dir < gw;
      const behind = gx - dir >= 0 && gx - dir < gw;
      if (ahead) grid[i + dir] += (err * 7) / 16;
      if (gy + 1 < gh) {
        if (behind) grid[i + gw - dir] += (err * 3) / 16;
        grid[i + gw] += (err * 5) / 16;
        if (ahead) grid[i + gw + dir] += err / 16;
      }
    }
  }

  const count = spots.length / 2;
  const out = new Float32Array(count * STRIDE);
  for (let k = 0; k < count; k++) {
    const x = Math.min(w - 1, (spots[k * 2] + 0.5 + (Math.random() - 0.5) * 0.6) * step);
    const y = Math.min(h - 1, (spots[k * 2 + 1] + 0.5 + (Math.random() - 0.5) * 0.6) * step);
    const i = (y | 0) * w + (x | 0);
    const o = k * STRIDE;
    const ambient = Math.random() < 0.18;
    const spread = ambient ? 1.4 : 0.32;
    out[o] = x;
    out[o + 1] = y;
    out[o + 2] = gauss() * spread * (ambient ? 1.3 : 1);
    out[o + 3] = gauss() * spread * 0.8 - (ambient ? 0 : 0.05);
    out[o + 4] = Math.min(1, Math.random() * 0.6 + Math.hypot(x / w - 0.5, y / h - 0.38) * 0.45);
    out[o + 5] = Math.random();
    out[o + 6] = Math.random();
    out[o + 7] = 0.5 + Math.random();
    out[o + 8] = bright[i];
    out[o + 9] = (Math.random() - 0.5) * 2.4;
  }
  return { data: out, count, w, h };
}

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x < w; x++) {
      if (x + r < w) acc += src[y * w + x + r];
      if (x - r - 1 >= 0) acc -= src[y * w + x - r - 1];
      if (x >= 0) tmp[y * w + x] = acc / (Math.min(w - 1, x + r) - Math.max(0, x - r) + 1);
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y < h; y++) {
      if (y + r < h) acc += tmp[(y + r) * w + x];
      if (y - r - 1 >= 0) acc -= tmp[(y - r - 1) * w + x];
      if (y >= 0) dst[y * w + x] = acc / (Math.min(h - 1, y + r) - Math.max(0, y - r) + 1);
    }
  }
  return dst;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function gauss() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}
