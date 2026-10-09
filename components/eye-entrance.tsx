"use client";
import { useEffect, useRef } from "react";

/**
 * Calypto entrance: a seam of light opens into an eye, the iris turns, and the
 * camera falls through the pupil into the site. Drawn on a 2D canvas.
 * `draw(t)` is deterministic so the same timeline can be rendered to video.
 */
export const ENTRANCE_MS = 5500;

type Fibre = {
  a: number;
  len: number;
  w: number;
  c: string;
  alpha: number;
  band: number;
};

const PALETTE = {
  void: "#080809",
  sclera: "#120a0e",
  lid: "#ead2d9",
  red: "#d32435",
  redLight: "#f34352",
  wine: "#6e1430",
  mauve: "#c8a0ad",
  rose: "#e5b9cb",
};

function makeFibres(seed = 11): Fibre[] {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cols = [
    "#d32435",
    "#f34352",
    "#8a1530",
    "#c8a0ad",
    "#e5b9cb",
    "#5e0f26",
    "#e8a07f",
  ];
  const weights = [0.26, 0.12, 0.2, 0.14, 0.1, 0.14, 0.04];
  const pick = () => {
    let r = rnd();
    for (let i = 0; i < cols.length; i++)
      if ((r -= weights[i]) <= 0) return cols[i];
    return cols[0];
  };
  return Array.from({ length: 520 }, () => ({
    a: rnd() * Math.PI * 2,
    len: 0.35 + rnd() * 0.65,
    w: 0.6 + rnd() * 1.8,
    c: pick(),
    alpha: 0.35 + rnd() * 0.6,
    band: rnd(),
  }));
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (v: number) =>
  v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

// [time s, x, y] in eye units; each move is a fast saccade, then a hold
const GAZE: [number, number, number][] = [
  [0, 0, 0],
  [2.15, 0, 0],
  [2.3, -0.62, 0.08],
  [2.55, -0.62, 0.08],
  [2.68, 0.6, -0.22],
  [2.95, 0.6, -0.22],
  [3.05, 0.18, 0.28],
  [3.2, 0.18, 0.28],
  [3.36, 0, 0],
];

function gaze(t: number): [number, number] {
  for (let i = 1; i < GAZE.length; i++) {
    const [t1, x1, y1] = GAZE[i];
    const [t0, x0, y0] = GAZE[i - 1];
    if (t <= t1) {
      const k = easeOut(clamp((t - t0) / (t1 - t0)));
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k];
    }
  }
  return [0, 0];
}

// lids struggle: lift, droop, flutter, try again, then burst fully open
const LID: [number, number][] = [
  [0.85, 0],
  [1.05, 0.26],
  [1.2, 0.08],
  [1.38, 0.4],
  [1.47, 0.27],
  [1.55, 0.36],
  [1.63, 0.24],
  [1.8, 0.14],
  [2.0, 1.05],
  [2.15, 1],
];

function lidOpen(t: number) {
  if (t <= LID[0][0]) return 0;
  for (let i = 1; i < LID.length; i++) {
    const [t1, v1] = LID[i];
    const [t0, v0] = LID[i - 1];
    if (t <= t1) {
      const v = v0 + (v1 - v0) * ease((t - t0) / (t1 - t0));
      // tremble while straining, fading out once fully open
      const strain = t < 1.9 ? 0.025 * Math.sin(t * 83) * Math.sin(t * 31) : 0;
      return Math.max(0, v + strain * v);
    }
  }
  return 1;
}

// heartbeat: a double thump every 0.85s while the eye is open
const BEAT_START = 1.9;
const BEAT_END = 3.45;
const BEAT_PERIOD = 0.85;

function heartbeat(t: number) {
  if (t < BEAT_START || t > BEAT_END + 0.3) return 0;
  const ph = (t - BEAT_START) % BEAT_PERIOD;
  return (
    Math.exp(-(((ph - 0.04) / 0.06) ** 2)) +
    0.6 * Math.exp(-(((ph - 0.24) / 0.07) ** 2))
  );
}

function beatTimes() {
  const out: number[] = [];
  for (let b = BEAT_START; b <= BEAT_END; b += BEAT_PERIOD)
    out.push(b, b + 0.2);
  return out;
}

function almond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
) {
  ctx.beginPath();
  ctx.moveTo(cx - w, cy);
  ctx.bezierCurveTo(
    cx - w * 0.45,
    cy - h * 1.32,
    cx + w * 0.45,
    cy - h * 1.32,
    cx + w,
    cy,
  );
  ctx.bezierCurveTo(
    cx + w * 0.45,
    cy + h * 1.32,
    cx - w * 0.45,
    cy + h * 1.32,
    cx - w,
    cy,
  );
  ctx.closePath();
}

export function drawEntrance(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  ms: number,
  fibres: Fibre[],
) {
  const t = ms / 1000;
  const cx = W / 2,
    cy = H / 2;
  const unit = Math.min(W, H * 1.6);
  const eyeW = unit * 0.4;
  const irisR = eyeW * 0.4;

  // timeline (seconds)
  const seam = seg(t, 0.15, 0.9); // light seam grows
  const open = lidOpen(t); // lids part
  const rings = easeOut(seg(t, 1.0, 2.6)); // outline rings ripple out
  const dive = seg(t, 3.45, 4.75); // fall into the pupil
  const flash = seg(t, 4.45, 4.95);
  const zoom = Math.exp(Math.pow(dive, 2.2) * 5.2); // 1 -> ~180x

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);

  // ambient glow behind the eye
  const amb = ctx.createRadialGradient(cx, cy, 0, cx, cy, eyeW * 2.2);
  const pulse = heartbeat(t) * (1 - dive);
  amb.addColorStop(0, `rgba(211,36,53,${(0.16 + 0.32 * pulse) * open})`);
  amb.addColorStop(1, "rgba(8,8,9,0)");
  ctx.fillStyle = amb;
  ctx.fillRect(cx - eyeW * 3, cy - eyeW * 3, eyeW * 6, eyeW * 6);

  // shockwaves: each heartbeat sends a bright outline rippling out from the eye
  for (const b of beatTimes()) {
    const age = t - b;
    if (age < 0 || age > 1.2) continue;
    const k = age / 1.2;
    const strong = Math.abs((b - BEAT_START) % BEAT_PERIOD) < 0.01;
    ctx.strokeStyle = `rgba(243,67,82,${(strong ? 0.75 : 0.4) * (1 - k) * (1 - dive)})`;
    ctx.lineWidth = ((strong ? 2.6 : 1.6) * (1 - k * 0.6)) / zoom;
    almond(
      ctx,
      cx,
      cy,
      eyeW * (1 + easeOut(k) * 1.1),
      eyeW * 0.42 * open * (1 + easeOut(k) * 1.6),
    );
    ctx.stroke();
  }

  // seam of light before the lids part
  if (open < 1) {
    const sw = eyeW * 1.15 * easeOut(seam);
    const g = ctx.createLinearGradient(cx - sw, 0, cx + sw, 0);
    g.addColorStop(0, "rgba(243,67,82,0)");
    g.addColorStop(0.5, `rgba(255,214,222,${0.9 * seam * (1 - open)})`);
    g.addColorStop(1, "rgba(243,67,82,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - sw, cy - 1.2, sw * 2, 2.4);
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, sw);
    halo.addColorStop(0, `rgba(211,36,53,${0.25 * seam * (1 - open)})`);
    halo.addColorStop(1, "rgba(211,36,53,0)");
    ctx.save();
    ctx.scale(1, 0.12);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy / 0.12, sw, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // outline rings rippling outward
  if (rings > 0) {
    for (let k = 1; k <= 9; k++) {
      const grow = 1 + k * 0.17 * rings;
      const fade = (1 - k / 10) * rings * (1 - dive);
      ctx.strokeStyle =
        k % 3 === 0
          ? `rgba(229,185,203,${0.55 * fade})`
          : `rgba(243,67,82,${0.7 * fade})`;
      ctx.lineWidth = (k % 3 === 0 ? 1.1 : 0.8) / zoom;
      almond(
        ctx,
        cx,
        cy,
        eyeW * grow,
        eyeW * 0.42 * open * (1 + k * 0.1 * rings),
      );
      ctx.stroke();
    }
  }

  const lidH = eyeW * 0.42 * open;
  if (lidH > 0.5) {
    ctx.save();
    almond(ctx, cx, cy, eyeW, lidH);
    ctx.clip();
    // sclera
    const sc = ctx.createRadialGradient(cx, cy, irisR * 0.8, cx, cy, eyeW);
    sc.addColorStop(0, "#2a1620");
    sc.addColorStop(1, PALETTE.sclera);
    ctx.fillStyle = sc;
    ctx.fillRect(cx - eyeW, cy - eyeW, eyeW * 2, eyeW * 2);

    const spin = t * 0.35 + dive * 1.4;
    const pupilR =
      irisR *
      (0.3 + 0.06 * Math.sin(t * 1.7) * (1 - dive) - 0.05 * seg(t, 2.9, 3.4)) *
      (1 - 0.14 * pulse);

    // gaze: quick saccades around the room, back to centre before the dive
    const [gx, gy] = gaze(t);
    ctx.save();
    ctx.translate(gx * eyeW * 0.42, gy * lidH * 0.55);

    // iris base
    const ib = ctx.createRadialGradient(cx, cy, pupilR, cx, cy, irisR);
    ib.addColorStop(0, "#3a0a18");
    ib.addColorStop(0.35, "#8a1530");
    ib.addColorStop(0.75, "#5e0f26");
    ib.addColorStop(1, "#1a0710");
    ctx.fillStyle = ib;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
    ctx.fill();

    // fibres
    ctx.lineCap = "round";
    for (const f of fibres) {
      const a = f.a + spin * (f.band > 0.5 ? 1 : -0.6);
      const r0 = pupilR * 1.05 + (irisR - pupilR) * f.band * 0.35;
      const r1 = r0 + (irisR * 0.98 - r0) * f.len;
      const wob = 0.08 * Math.sin(a * 7 + t);
      ctx.strokeStyle = f.c;
      ctx.globalAlpha = f.alpha * open;
      ctx.lineWidth = (f.w * irisR) / 220;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.quadraticCurveTo(
        cx + Math.cos(a + wob) * (r0 + r1) * 0.5,
        cy + Math.sin(a + wob) * (r0 + r1) * 0.5,
        cx + Math.cos(a + wob * 2) * r1,
        cy + Math.sin(a + wob * 2) * r1,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // collarette: a ring of folded-veil facets around the pupil
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-spin * 0.8);
    for (let k = 0; k < 18; k++) {
      ctx.rotate((Math.PI * 2) / 18);
      ctx.fillStyle = k % 2 ? "rgba(243,67,82,.55)" : "rgba(229,185,203,.35)";
      ctx.beginPath();
      ctx.moveTo(pupilR * 1.12, 0);
      ctx.lineTo(pupilR * 1.55, -pupilR * 0.12);
      ctx.lineTo(pupilR * 1.42, pupilR * 0.16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // the iris flares with each beat
    if (pulse > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      const fl = ctx.createRadialGradient(cx, cy, pupilR, cx, cy, irisR * 1.15);
      fl.addColorStop(0, `rgba(243,67,82,${0.45 * pulse})`);
      fl.addColorStop(0.7, `rgba(211,36,53,${0.25 * pulse})`);
      fl.addColorStop(1, "rgba(211,36,53,0)");
      ctx.fillStyle = fl;
      ctx.beginPath();
      ctx.arc(cx, cy, irisR * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    // limbal ring
    const lr = ctx.createRadialGradient(
      cx,
      cy,
      irisR * 0.86,
      cx,
      cy,
      irisR * 1.04,
    );
    lr.addColorStop(0, "rgba(8,4,6,0)");
    lr.addColorStop(1, "rgba(8,4,6,.95)");
    ctx.fillStyle = lr;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR * 1.04, 0, Math.PI * 2);
    ctx.fill();

    // pupil, with a deep red heart that becomes the tunnel
    const pg = ctx.createRadialGradient(cx, cy, 0, cx, cy, pupilR);
    const heart = 0.15 + 0.55 * dive;
    pg.addColorStop(0, `rgba(211,36,53,${heart})`);
    pg.addColorStop(0.55, `rgba(60,6,20,${0.6 + 0.3 * dive})`);
    pg.addColorStop(1, "#040203");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(cx, cy, pupilR, 0, Math.PI * 2);
    ctx.fill();
    // tunnel rings seen inside the pupil as we approach
    if (dive > 0.2) {
      for (let k = 0; k < 7; k++) {
        const rr = pupilR * (((k / 7 + t * 0.9) % 1) * 0.95);
        ctx.strokeStyle = `rgba(243,67,82,${0.5 * (rr / pupilR) * seg(dive, 0.2, 0.6)})`;
        ctx.lineWidth = 1.2 / zoom;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // catch-light
    ctx.strokeStyle = `rgba(255,236,240,${0.75 * open * (1 - dive)})`;
    ctx.lineWidth = irisR * 0.035;
    ctx.beginPath();
    ctx.arc(cx - irisR * 0.42, cy - irisR * 0.38, irisR * 0.11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,236,240,${0.35 * open * (1 - dive)})`;
    ctx.beginPath();
    ctx.arc(cx + irisR * 0.5, cy + irisR * 0.42, irisR * 0.035, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // lid shadow
    const ls = ctx.createLinearGradient(
      0,
      cy - lidH * 1.32,
      0,
      cy + lidH * 1.32,
    );
    ls.addColorStop(0, "rgba(4,2,3,.85)");
    ls.addColorStop(0.3, "rgba(4,2,3,0)");
    ls.addColorStop(0.8, "rgba(4,2,3,0)");
    ls.addColorStop(1, "rgba(4,2,3,.6)");
    ctx.fillStyle = ls;
    ctx.fillRect(cx - eyeW, cy - eyeW, eyeW * 2, eyeW * 2);
    ctx.restore();

    // lid rim highlight
    ctx.strokeStyle = `rgba(${234 + 21 * pulse},${210 - 120 * pulse},${217 - 110 * pulse},${0.85 * (1 - dive * 0.8)})`;
    ctx.lineWidth = (2.2 + 1.6 * pulse) / Math.sqrt(zoom);
    almond(ctx, cx, cy, eyeW, lidH);
    ctx.stroke();
    ctx.strokeStyle = `rgba(211,36,53,${0.6 * (1 - dive)})`;
    ctx.lineWidth = 1 / zoom;
    almond(ctx, cx, cy, eyeW * 1.04, lidH * 1.12);
    ctx.stroke();
  }
  ctx.restore();

  // flash of red light as we pass through
  if (flash > 0) {
    const f = Math.sin(Math.PI * flash);
    const fg = ctx.createRadialGradient(
      cx,
      cy,
      0,
      cx,
      cy,
      Math.hypot(W, H) / 2,
    );
    fg.addColorStop(0, `rgba(255,226,232,${0.95 * f})`);
    fg.addColorStop(0.35, `rgba(243,67,82,${0.75 * f})`);
    fg.addColorStop(1, `rgba(110,20,48,${0.6 * f})`);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, W, H);
  }

  // reveal: an opening iris of transparency lets the site show through
  const reveal = easeOut(seg(t, 4.7, 5.5));
  if (reveal > 0) {
    const R = Math.hypot(W, H) * 0.62 * reveal;
    const hole = ctx.createRadialGradient(
      cx,
      cy,
      R * 0.55,
      cx,
      cy,
      Math.max(R, 1),
    );
    hole.addColorStop(0, "rgba(0,0,0,1)");
    hole.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = hole;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = reveal * reveal;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}

export default function EyeEntrance({ onDone, onReveal }: { onDone: () => void; onReveal: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  const reveal = useRef(onReveal);
  done.current = onDone;
  reveal.current = onReveal;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return done.current();
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      const id = setTimeout(() => done.current(), 300);
      return () => clearTimeout(id);
    }
    const fibres = makeFibres();
    let raf = 0;
    let revealed = false;
    const start = performance.now();
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(window.innerWidth * dpr);
      el.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    const frame = (now: number) => {
      const ms = now - start;
      drawEntrance(ctx, el.width, el.height, Math.min(ms, ENTRANCE_MS), fibres);
      // the overlay starts opaque (no flash of the page); hand over to the canvas once it paints
      if (el.parentElement) el.parentElement.style.background = "transparent";
      // Start the homepage title behind the pupil dive, before transparency opens at 4.7s.
      if (!revealed && ms >= 3700) {
        revealed = true;
        reveal.current();
      }
      if (ms >= ENTRANCE_MS) return done.current();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas ref={canvas} className="eye-entrance-canvas" aria-hidden="true" />
  );
}
