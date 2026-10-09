"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- plain links on purpose: the page transition and a fresh stage need full navigations */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUp, ArrowUpRight, Command, CornerDownLeft, Menu, Search, X } from "lucide-react";
import { Socials } from "@/components/socials";

/* ============================================================================
 * Calypto edge kit: shared pieces for every public page.
 * The faceted "C" from the logo is the one object the whole site is built on.
 * ========================================================================== */

export const reduceMotion = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- logo ---------------- */
export const C_PATH = "M35 7 13 14 6 32 28 41 40 28 25 32 17 27 21 18Z";
export function CMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d={C_PATH} fill="currentColor" />
      <path d="m13 14 8 4-4 9-11 5Z" fill="#080809" opacity=".28" />
      <path d="m6 32 11-5 8 5 3 9Z" fill="#080809" opacity=".16" />
    </svg>
  );
}

/* ---------------- 3D model of the C ---------------- */
type V3 = [number, number, number];
type Face = { pts: V3[]; n: V3; kind: "front" | "back" | "side"; i: number; c: V3 };
const OUT: [number, number][] = [[35, 7], [13, 14], [6, 32], [28, 41], [40, 28], [25, 32], [17, 27], [21, 18]];
const FOLD = [0, 3, 0, 2, 0, 6, 7, 6];
const TRIS = [[0, 1, 7], [1, 6, 7], [1, 2, 6], [2, 5, 6], [2, 3, 5], [3, 4, 5]];
function buildC(): Face[] {
  const DEPTH = 6;
  const front: V3[] = OUT.map(([x, y], i) => [x - 23, y - 24, FOLD[i]]);
  const back: V3[] = front.map(([x, y, z]) => [x, y, z - DEPTH]);
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const nrm = (p: V3[]) => norm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
  const cen = (p: V3[]): V3 => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length, p.reduce((s, q) => s + q[2], 0) / p.length];
  const inside = (x: number, y: number) => { let c = false; for (let i = 0, j = OUT.length - 1; i < OUT.length; j = i++) { const [xi, yi] = OUT[i], [xj, yj] = OUT[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const faces: Face[] = [];
  TRIS.forEach((t, i) => {
    let p = t.map(k => front[k]) as V3[]; let n = nrm(p); if (n[2] < 0) { p = p.reverse(); n = [-n[0], -n[1], -n[2]]; }
    faces.push({ pts: p, n, kind: "front", i, c: cen(p) });
    let q = t.map(k => back[k]) as V3[]; let m = nrm(q); if (m[2] > 0) { q = q.reverse(); m = [-m[0], -m[1], -m[2]]; }
    faces.push({ pts: q, n: m, kind: "back", i, c: cen(q) });
  });
  OUT.forEach((_, i) => {
    const j = (i + 1) % OUT.length;
    let p: V3[] = [front[i], front[j], back[j], back[i]]; let n = nrm(p);
    const mx = (OUT[i][0] + OUT[j][0]) / 2, my = (OUT[i][1] + OUT[j][1]) / 2;
    if (inside(mx + n[0] * 0.6, my + n[1] * 0.6)) { p = p.reverse(); n = [-n[0], -n[1], -n[2]]; }
    faces.push({ pts: p, n, kind: "side", i: 6 + i, c: cen(p) });
  });
  return faces;
}

/* ---------------- the C's moods ----------------
 * The C is Calypto's visible presence. Anything on the page can tell it what is happening:
 *   idle    drifting, scattered where the section puts it
 *   listen  you are typing to it: it pulls itself together and turns to face you
 *   think   an answer is on its way: it spins and its facets breathe open and shut
 *   speak   an answer is streaming: light runs across its facets
 * Each caller has its own source name, and the busiest mood wins.
 */
export type Mood = "idle" | "listen" | "think" | "speak";
export function setMood(mood: Mood, source = "page", at?: Element | null) {
  if (typeof window === "undefined") return;
  let x: number | undefined, y: number | undefined;
  if (at) { const r = at.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  dispatchEvent(new CustomEvent("calypto:mood", { detail: { mood, source, x, y } }));
}
/** A small kick, e.g. on every keystroke. */
export const nudge = (amount = 1) => typeof window !== "undefined" && dispatchEvent(new CustomEvent("calypto:nudge", { detail: amount }));
/** Leave for another page through the C. */
export const go = (href: string) => typeof window !== "undefined" && dispatchEvent(new CustomEvent("calypto:go", { detail: href }));

/* ---------------- the stage: one C that lives behind the whole page ----------------
 * Any section can steer it with data-shard="x y size explode opacity spin tone":
 *   x, y     position as a share of the viewport (0..1)
 *   size     height as a share of the shorter viewport side
 *   explode  0 = assembled, 1 = shattered into floating shards
 *   opacity  0..1
 *   spin     extra turning speed
 *   tone     0 = blood red, 1 = black (for red sections)
 * The stage blends between the sections nearest the middle of the screen.
 */
type ShardState = [number, number, number, number, number, number, number];
const DEFAULT_STATE: ShardState = [0.5, 0.5, 0.6, 0, 1, 0, 0];
export function ShardStage() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext("2d");
    if (!g) return;
    const FACES = buildC();
    const reduce = reduceMotion();
    let W = 0, H = 0, dpr = 1, raf = 0;
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); };
    size();
    const RED = ["#120105", "#3f0510", "#7e0e1f", "#b01d2d", "#d32435"].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
    const BLK = ["#020101", "#0a0304", "#170609", "#26090e", "#3a0d14"].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
    const shade = (v: number, tone: number) => {
      v = Math.max(0, Math.min(0.999, v)) * 4; const a = Math.floor(v), m = v - a;
      const col = [0, 1, 2].map(i => { const r = RED[a][i] + (RED[a + 1][i] - RED[a][i]) * m, b = BLK[a][i] + (BLK[a + 1][i] - BLK[a][i]) * m; return Math.round(r + (b - r) * tone); });
      return `rgb(${col.join(",")})`;
    };
    const Lv: V3 = (() => { const v = [-0.5, -0.6, 0.65], n = Math.hypot(...v); return v.map(x => x / n) as V3; })();
    let mx = 0, my = 0;
    const onMove = (e: PointerEvent) => { mx = e.clientX / W - 0.5; my = e.clientY / H - 0.5; };
    addEventListener("pointermove", onMove, { passive: true });
    const onResize = () => size();
    addEventListener("resize", onResize);
    // moods
    const RANK: Record<Mood, number> = { idle: 0, speak: 1, listen: 2, think: 3 };
    const sources = new Map<string, { mood: Mood; x?: number; y?: number }>();
    let listen = 0, think = 0, speak = 0, kick = 0, fx = 0.5, fy = 0.5, leaving = 0, leaveOn = false;
    const onMood = (ev: Event) => { const d = (ev as CustomEvent).detail; if (d.mood === "idle") sources.delete(d.source); else sources.set(d.source, d); };
    const onNudge = (ev: Event) => { kick = Math.min(1.6, kick + ((ev as CustomEvent).detail ?? 1) * 0.45); };
    const onLeave = () => { leaveOn = true; };
    addEventListener("calypto:mood", onMood); addEventListener("calypto:nudge", onNudge); addEventListener("calypto:leave", onLeave);
    const top = () => { let best: { mood: Mood; x?: number; y?: number } = { mood: "idle" }; sources.forEach(v => { if (RANK[v.mood] > RANK[best.mood]) best = v; }); return best; };

    const read = (): ShardState => {
      const els = [...document.querySelectorAll<HTMLElement>("[data-shard]")];
      if (!els.length) return DEFAULT_STATE;
      const mid = H / 2;
      const anchors = els.map(el => {
        const r = el.getBoundingClientRect();
        const v = (el.dataset.shard || "").split(/\s+/).map(Number);
        const st = DEFAULT_STATE.map((d, i) => (Number.isFinite(v[i]) ? v[i] : d)) as ShardState;
        return { y: r.top + Math.min(r.height, H) / 2, top: r.top, bottom: r.bottom, st };
      });
      const inside = anchors.find(a => a.top <= mid && a.bottom >= mid && a.bottom - a.top > H * 1.2);
      if (inside) return inside.st;
      const i = anchors.findIndex(a => a.y > mid);
      if (i === -1) return anchors[anchors.length - 1].st;
      if (i === 0) return anchors[0].st;
      const a = anchors[i - 1], b = anchors[i];
      let t = (mid - a.y) / Math.max(1, b.y - a.y); t = t * t * (3 - 2 * t);
      return a.st.map((v, k) => v + (b.st[k] - v) * t) as ShardState;
    };

    let cur: ShardState = [...DEFAULT_STATE] as ShardState;
    let first = true, spinAcc = 0, yaw = 0, pitch = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const target = read();
      if (first) { cur = [...target] as ShardState; first = false; }
      const k = reduce ? 1 : 0.08;
      cur = cur.map((v, i) => v + (target[i] - v) * k) as ShardState;
      const [x, y, s0, e0, o, spin, tone] = cur;
      const m = top();
      if (m.x != null && m.y != null) { fx = m.x / W; fy = m.y / H; }
      listen += ((m.mood === "listen" ? 1 : 0) - listen) * 0.07;
      think += ((m.mood === "think" ? 1 : 0) - think) * 0.06;
      speak += ((m.mood === "speak" ? 1 : 0) - speak) * 0.07;
      kick *= 0.9;
      if (leaveOn) leaving = Math.min(1, leaving + 0.045);
      const breath = 0.5 + 0.5 * Math.sin(t * 6.5);
      const intro = reduce ? 0 : Math.max(0, 1 - (t - 0.2) / 1.6);
      // listening or speaking pulls the shards together; thinking makes them breathe; keystrokes jolt them
      const focus = Math.max(listen, speak);
      const e = Math.min(1, Math.max(0, e0 * (1 - 0.88 * focus) + think * (0.08 + 0.16 * breath) + kick * 0.07 + intro * intro * 1.2 + leaving * leaving * 1.4));
      const s = s0 * (1 + kick * 0.035 + think * 0.04 * breath + leaving * 0.6);
      spinAcc += spin * 0.012 + think * 0.07 + leaving * 0.12;
      // it turns to face whatever it's listening to
      const lookYaw = Math.max(-0.5, Math.min(0.5, (fx - x) * 1.2)), lookPitch = Math.max(-0.32, Math.min(0.32, (fy - y) * 0.9));
      const idleYaw = reduce ? 0 : mx * 0.9 + Math.sin(t * 0.4) * 0.35, idlePitch = reduce ? 0 : my * 0.6 + Math.sin(t * 0.27) * 0.12;
      yaw += (idleYaw * (1 - focus) + lookYaw * focus + spinAcc - yaw) * 0.06;
      pitch += (idlePitch * (1 - focus) + lookPitch * focus - pitch) * 0.06;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      if (o < 0.01) return;
      const cx = x * W, cy = y * H, sc = (s * Math.min(W, H)) / 40;
      g.globalAlpha = o;
      // halo
      const halo = g.createRadialGradient(cx, cy, 0, cx, cy, sc * 34);
      halo.addColorStop(0, `rgba(211,36,53,${(0.22 + think * 0.22 * breath + speak * 0.12 + listen * 0.08) * (1 - tone)})`); halo.addColorStop(1, "rgba(211,36,53,0)");
      g.fillStyle = halo; g.fillRect(cx - sc * 40, cy - sc * 40, sc * 80, sc * 80);
      const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const rot = (v: V3): V3 => { const x1 = v[0] * cy_ + v[2] * sy_, z1 = -v[0] * sy_ + v[2] * cy_; return [x1, v[1] * cp - z1 * sp, v[1] * sp + z1 * cp]; };
      const drawn = FACES.map(f => {
        // shattering: every face flies out from the centre and turns on its own
        const dir = Math.hypot(f.c[0], f.c[1]) || 1, ph = f.i * 1.7;
        const off: V3 = [(f.c[0] / dir) * e * 14 + Math.sin(t * 0.6 + ph) * e * 2.2, (f.c[1] / dir) * e * 14 + Math.cos(t * 0.5 + ph) * e * 2.2, f.c[2] + (f.i % 3 - 1) * e * 6];
        const a = e * (f.i % 2 ? 1 : -1) * (0.6 + 0.4 * Math.sin(t * 0.3 + ph));
        const ca = Math.cos(a), sa = Math.sin(a);
        const pts = f.pts.map(p => {
          const lx = p[0] - f.c[0], ly = p[1] - f.c[1];
          const q: V3 = [f.c[0] + off[0] - f.c[0] + f.c[0] + lx * ca - ly * sa, f.c[1] + off[1] + lx * sa + ly * ca, p[2] + (off[2] - f.c[2])];
          const r = rot([q[0] * sc, q[1] * sc, q[2] * sc * 1.2]);
          const kz = 1400 / (1400 - r[2]);
          return [cx + r[0] * kz, cy + r[1] * kz, r[2]];
        });
        const n0 = f.n; const nr = rot([n0[0] * ca - n0[1] * sa, n0[0] * sa + n0[1] * ca, n0[2]]);
        const lit = Math.max(0, nr[0] * Lv[0] + nr[1] * Lv[1] + nr[2] * Lv[2]);
        let lum = f.kind === "side" ? 0.1 + 0.55 * lit : 0.18 + 0.82 * lit;
        // speaking: a band of light sweeps across the facets
        if (speak > 0.01) lum += speak * 0.32 * Math.max(0, Math.cos(t * 5 - f.i * 0.55)) ** 3;
        return { pts, z: pts.reduce((q, p) => q + p[2], 0) / pts.length, vis: nr[2] > 0.001 || e > 0.25, lum, side: f.kind === "side" };
      }).filter(d => d.vis).sort((a, b) => a.z - b.z);
      for (const d of drawn) {
        g.fillStyle = shade(d.lum, tone);
        g.beginPath(); d.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
        g.strokeStyle = tone > 0.5 ? `rgba(0,0,0,${0.3})` : `rgba(255,170,178,${0.08 + d.lum * 0.18 + think * 0.25 * breath})`;
        g.lineWidth = 1; g.lineJoin = "miter"; g.stroke();
      }
      g.globalAlpha = 1;
    };
    if (reduce) {
      const once = () => draw(performance.now() + 5000);
      once();
      addEventListener("scroll", once, { passive: true });
      return () => { removeEventListener("scroll", once); removeEventListener("resize", onResize); removeEventListener("pointermove", onMove); removeEventListener("calypto:mood", onMood); removeEventListener("calypto:nudge", onNudge); removeEventListener("calypto:leave", onLeave); };
    }
    const loop = (now: number) => { draw(now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); removeEventListener("resize", onResize); removeEventListener("pointermove", onMove);
      removeEventListener("calypto:mood", onMood); removeEventListener("calypto:nudge", onNudge); removeEventListener("calypto:leave", onLeave);
    };
  }, []);
  return <canvas ref={ref} className="ek-stage" aria-hidden="true" />;
}


/* ---------------- the glass stage (WebGL) ----------------
 * Same C, same moods, rendered on the graphics card:
 *   - the C is polished obsidian-red glass with reflections, rim light and glinting facet edges
 *   - behind it, a field of shattered glass drifts with the scroll and clears under your cursor
 *   - red sections flood the glass itself
 * Falls back to the 2D stage when WebGL is unavailable.
 */
const BG_VS = `attribute vec2 p;void main(){gl_Position=vec4(p,0.999,1.);}`;
const BG_FS = `precision mediump float;
uniform vec2 uRes;uniform float uTime,uScroll,uFlood,uThink;uniform vec2 uMouse,uC;uniform float uCs;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 h22(vec2 p){float n=h21(p);return vec2(n,h21(p+n));}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p*=2.03;a*=.5;}return s;}
vec3 vor(vec2 x){vec2 n=floor(x),f=fract(x);float d1=8.,d2=8.;float id=0.;
for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j));vec2 o=h22(n+g);o=.5+.42*sin(uTime*.12+6.2831*o);vec2 r=g+o-f;float d=dot(r,r);
if(d<d1){d2=d1;d1=d;id=h21(n+g);}else if(d<d2)d2=d;}
return vec3(sqrt(d1),sqrt(d2),id);}
void main(){
vec2 px=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y);float s=min(uRes.x,uRes.y);vec2 p=px/s;
vec3 v=vor(p*4.2+vec2(0.,uScroll/s*1.25));
float edge=v.y-v.x;float line=1.-smoothstep(0.,.03,edge);
float dm=length(px-uMouse)/s;float lens=exp(-dm*dm*16.);
float dc=length(px-uC)/max(uCs,1.);float cg=exp(-dc*dc*1.1);
vec3 red=vec3(.827,.141,.208);vec3 col=vec3(.026,.02,.023);
float f=fbm(p*1.5+vec2(uTime*.018,-uScroll/s*.25));
col+=red*.13*f*f;
col+=red*cg*(.22+.25*uThink);
col+=red*v.z*.03*(.35+lens*2.4);
col+=mix(red,vec3(1.,.7,.74),lens*.5)*line*(.03+lens*.5+cg*.1);
vec3 fl=red*(.86+.16*v.z+.08*f);fl=mix(fl,vec3(.42,.03,.07),line*.6);fl+=vec3(1.,.8,.82)*line*lens*.25;
col=mix(col,fl,uFlood);
vec2 u=px/uRes-.5;col*=1.-dot(u,u)*(1.-uFlood*.55);
col+=(h21(px+fract(uTime*7.)*91.)-.5)*.03;
gl_FragColor=vec4(col,1.);}`;
const M_VS = `attribute vec3 aP;attribute vec3 aN;attribute vec3 aB;attribute float aK;uniform vec2 uRes;
varying vec3 vN;varying vec3 vB;varying float vK;
void main(){vN=aN;vB=aB;vK=aK;vec2 c=aP.xy/uRes*2.-1.;gl_Position=vec4(c.x,-c.y,clamp(-aP.z/4000.,-1.,1.),1.);}`;
const M_FS = `#extension GL_OES_standard_derivatives : enable
precision mediump float;uniform float uTone,uThink,uAlpha,uTime;varying vec3 vN;varying vec3 vB;varying float vK;
void main(){vec3 N=normalize(vN);
vec3 L=normalize(vec3(-.5,-.6,.65));vec3 L2=normalize(vec3(.7,.35,.5));vec3 V=vec3(0.,0.,1.);vec3 R=reflect(-V,N);
float dif=max(dot(N,L),0.),dif2=max(dot(N,L2),0.);
float sp=pow(max(dot(R,L),0.),26.),sp2=pow(max(dot(R,L2),0.),10.);
float fr=pow(1.-abs(N.z),2.5);
vec3 red=vec3(.827,.141,.208);
vec3 cR=mix(vec3(.16,.012,.035),red,dif)+red*dif2*.25+vec3(1.,.78,.8)*sp*.95+red*sp2*.35+red*fr*.55;
vec3 cK=mix(vec3(.008,.005,.006),vec3(.09,.02,.03),dif)+vec3(.9,.3,.35)*sp*.5+vec3(.25,.02,.05)*fr;
vec3 col=mix(cR,cK,uTone);
vec3 w=fwidth(vB);vec3 e3=smoothstep(vec3(0.),w*1.4,vB);float ed=1.-min(min(e3.x,e3.y),e3.z);
col+=mix(vec3(1.,.62,.66),vec3(.85,.12,.2),uTone)*ed*(.45+.35*uThink);
col+=red*vK*.55;
gl_FragColor=vec4(col,uAlpha);}`;
function GLStage() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const gl = cv.getContext("webgl", { antialias: true, alpha: false, depth: true, powerPreference: "high-performance" }) as WebGLRenderingContext | null;
    if (!gl || !gl.getExtension("OES_standard_derivatives")) { dispatchEvent(new Event("calypto:nogl")); return; }
    const compile = (vs: string, fs: string) => {
      const mk = (t: number, src: string) => { const s = gl.createShader(t)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader"); return s; };
      const pr = gl.createProgram()!; gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr) || "link");
      return pr;
    };
    let bg: WebGLProgram, mp: WebGLProgram;
    try { bg = compile(BG_VS, BG_FS); mp = compile(M_VS, M_FS); } catch (err) { console.warn("calypto stage", err); dispatchEvent(new Event("calypto:nogl")); return; }
    const U = (pr: WebGLProgram, n: string) => gl.getUniformLocation(pr, n);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const mesh = gl.createBuffer();
    const FACES = buildC();
    const reduce = reduceMotion();
    let W = 0, H = 0, dpr = 1, raf = 0;
    const size = () => {
      W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 1.5);
      if (W * H * dpr * dpr > 3.2e6) dpr = Math.sqrt(3.2e6 / (W * H));
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    };
    size();
    let mx = 0, my = 0, pmx = W / 2, pmy = H / 2, lmx = W / 2, lmy = H / 2;
    const onMove = (e: PointerEvent) => { mx = e.clientX / W - 0.5; my = e.clientY / H - 0.5; pmx = e.clientX; pmy = e.clientY; };
    addEventListener("pointermove", onMove, { passive: true });
    const onResize = () => size();
    addEventListener("resize", onResize);
    const RANK: Record<Mood, number> = { idle: 0, speak: 1, listen: 2, think: 3 };
    const sources = new Map<string, { mood: Mood; x?: number; y?: number }>();
    let listen = 0, think = 0, speak = 0, kick = 0, fx = 0.5, fy = 0.5, leaving = 0, leaveOn = false, flood = 0;
    const onMood = (ev: Event) => { const d = (ev as CustomEvent).detail; if (d.mood === "idle") sources.delete(d.source); else sources.set(d.source, d); };
    const onNudge = (ev: Event) => { kick = Math.min(1.6, kick + ((ev as CustomEvent).detail ?? 1) * 0.45); };
    const onLeave = () => { leaveOn = true; };
    addEventListener("calypto:mood", onMood); addEventListener("calypto:nudge", onNudge); addEventListener("calypto:leave", onLeave);
    const topMood = () => { let best: { mood: Mood; x?: number; y?: number } = { mood: "idle" }; sources.forEach(v => { if (RANK[v.mood] > RANK[best.mood]) best = v; }); return best; };
    const read = (): ShardState => {
      const els = [...document.querySelectorAll<HTMLElement>("[data-shard]")];
      if (!els.length) return DEFAULT_STATE;
      const mid = H / 2;
      const anchors = els.map(el => {
        const r = el.getBoundingClientRect(); const v = (el.dataset.shard || "").split(/\s+/).map(Number);
        return { y: r.top + Math.min(r.height, H) / 2, top: r.top, bottom: r.bottom, st: DEFAULT_STATE.map((d, i) => (Number.isFinite(v[i]) ? v[i] : d)) as ShardState };
      });
      const inside = anchors.find(a => a.top <= mid && a.bottom >= mid && a.bottom - a.top > H * 1.2);
      if (inside) return inside.st;
      const i = anchors.findIndex(a => a.y > mid);
      if (i === -1) return anchors[anchors.length - 1].st;
      if (i === 0) return anchors[0].st;
      const a = anchors[i - 1], b = anchors[i];
      let t = (mid - a.y) / Math.max(1, b.y - a.y); t = t * t * (3 - 2 * t);
      return a.st.map((v, k) => v + (b.st[k] - v) * t) as ShardState;
    };
    // vertex layout: pos3 normal3 bary3 k1
    const STRIDE = 10, buf = new Float32Array(FACES.length * 6 * STRIDE);
    let cur: ShardState = [...DEFAULT_STATE] as ShardState, first = true, spinAcc = 0, yaw = 0, pitch = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const target = read();
      if (first) { cur = [...target] as ShardState; first = false; }
      const k = reduce ? 1 : 0.08;
      cur = cur.map((v, i) => v + (target[i] - v) * k) as ShardState;
      const [x, y, s0, e0, o, spin, tone] = cur;
      const m = topMood();
      if (m.x != null && m.y != null) { fx = m.x / W; fy = m.y / H; }
      listen += ((m.mood === "listen" ? 1 : 0) - listen) * 0.07;
      think += ((m.mood === "think" ? 1 : 0) - think) * 0.06;
      speak += ((m.mood === "speak" ? 1 : 0) - speak) * 0.07;
      kick *= 0.9;
      flood += ((document.documentElement.classList.contains("ek-flooded") ? 1 : 0) - flood) * 0.06;
      if (leaveOn) leaving = Math.min(1, leaving + 0.045);
      lmx += (pmx - lmx) * 0.12; lmy += (pmy - lmy) * 0.12;
      const breath = 0.5 + 0.5 * Math.sin(t * 6.5);
      const intro = reduce ? 0 : Math.max(0, 1 - (t - 0.2) / 1.6);
      const focus = Math.max(listen, speak);
      const e = Math.min(1, Math.max(0, e0 * (1 - 0.88 * focus) + think * (0.08 + 0.16 * breath) + kick * 0.07 + intro * intro * 1.2 + leaving * leaving * 1.4));
      const s = s0 * (1 + kick * 0.035 + think * 0.04 * breath + leaving * 0.6);
      spinAcc += spin * 0.012 + think * 0.07 + leaving * 0.12;
      const lookYaw = Math.max(-0.5, Math.min(0.5, (fx - x) * 1.2)), lookPitch = Math.max(-0.32, Math.min(0.32, (fy - y) * 0.9));
      const idleYaw = reduce ? 0 : mx * 0.9 + Math.sin(t * 0.4) * 0.35, idlePitch = reduce ? 0 : my * 0.6 + Math.sin(t * 0.27) * 0.12;
      yaw += (idleYaw * (1 - focus) + lookYaw * focus + spinAcc - yaw) * 0.06;
      pitch += (idlePitch * (1 - focus) + lookPitch * focus - pitch) * 0.06;
      const cx = x * W, cy = y * H, sc = (s * Math.min(W, H)) / 40;
      // ---- background
      gl.viewport(0, 0, cv.width, cv.height);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.useProgram(bg);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      const pa = gl.getAttribLocation(bg, "p"); gl.enableVertexAttribArray(pa); gl.vertexAttribPointer(pa, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(U(bg, "uRes"), cv.width, cv.height);
      gl.uniform1f(U(bg, "uTime"), reduce ? 3 : t);
      gl.uniform1f(U(bg, "uScroll"), scrollY * dpr);
      gl.uniform1f(U(bg, "uFlood"), flood);
      gl.uniform1f(U(bg, "uThink"), think);
      gl.uniform2f(U(bg, "uMouse"), lmx * dpr, lmy * dpr);
      gl.uniform2f(U(bg, "uC"), cx * dpr, cy * dpr);
      gl.uniform1f(U(bg, "uCs"), sc * 26 * dpr * o);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(pa);
      if (o < 0.01) return;
      // ---- the C
      const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const rot = (v: V3): V3 => { const x1 = v[0] * cy_ + v[2] * sy_, z1 = -v[0] * sy_ + v[2] * cy_; return [x1, v[1] * cp - z1 * sp, v[1] * sp + z1 * cp]; };
      let n = 0;
      const put = (p: number[], nr: V3, b: V3, kk: number) => { buf.set([p[0] * dpr, p[1] * dpr, p[2], nr[0], nr[1], nr[2], b[0], b[1], b[2], kk], n * STRIDE); n++; };
      for (const f of FACES) {
        const dir = Math.hypot(f.c[0], f.c[1]) || 1, ph = f.i * 1.7;
        const off: V3 = [(f.c[0] / dir) * e * 14 + Math.sin(t * 0.6 + ph) * e * 2.2, (f.c[1] / dir) * e * 14 + Math.cos(t * 0.5 + ph) * e * 2.2, f.c[2] + (f.i % 3 - 1) * e * 6];
        const a = e * (f.i % 2 ? 1 : -1) * (0.6 + 0.4 * Math.sin(t * 0.3 + ph));
        const ca = Math.cos(a), sa = Math.sin(a);
        const pts = f.pts.map(p => {
          const lx = p[0] - f.c[0], ly = p[1] - f.c[1];
          const q: V3 = [f.c[0] + off[0] + lx * ca - ly * sa, f.c[1] + off[1] + lx * sa + ly * ca, p[2] + (off[2] - f.c[2])];
          const r = rot([q[0] * sc, q[1] * sc, q[2] * sc * 1.2]);
          const kz = 1400 / (1400 - r[2]);
          return [cx + r[0] * kz, cy + r[1] * kz, r[2]];
        });
        const nr = rot([f.n[0] * ca - f.n[1] * sa, f.n[0] * sa + f.n[1] * ca, f.n[2]]);
        const kk = speak > 0.01 ? speak * Math.max(0, Math.cos(t * 5 - f.i * 0.55)) ** 3 : 0;
        if (pts.length === 3) { put(pts[0], nr, [1, 0, 0], kk); put(pts[1], nr, [0, 1, 0], kk); put(pts[2], nr, [0, 0, 1], kk); }
        else { // quad: hide the diagonal so only real facet edges glint
          put(pts[0], nr, [1, 1, 0], kk); put(pts[1], nr, [0, 1, 0], kk); put(pts[2], nr, [0, 1, 1], kk);
          put(pts[0], nr, [1, 0, 1], kk); put(pts[2], nr, [0, 1, 1], kk); put(pts[3], nr, [0, 0, 1], kk);
        }
      }
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(mp);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh); gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, n * STRIDE), gl.DYNAMIC_DRAW);
      const at = (name: string, sz: number, offs: number) => { const l = gl.getAttribLocation(mp, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sz, gl.FLOAT, false, STRIDE * 4, offs * 4); return l; };
      const ls = [at("aP", 3, 0), at("aN", 3, 3), at("aB", 3, 6), at("aK", 1, 9)];
      gl.uniform2f(U(mp, "uRes"), cv.width, cv.height);
      gl.uniform1f(U(mp, "uTone"), tone); gl.uniform1f(U(mp, "uThink"), think); gl.uniform1f(U(mp, "uAlpha"), o); gl.uniform1f(U(mp, "uTime"), t);
      gl.drawArrays(gl.TRIANGLES, 0, n);
      ls.forEach(l => gl.disableVertexAttribArray(l));
    };
    const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); dispatchEvent(new Event("calypto:nogl")); };
    cv.addEventListener("webglcontextlost", onLost);
    let once = () => {};
    if (reduce) { once = () => draw(performance.now() + 5000); once(); addEventListener("scroll", once, { passive: true }); }
    else { const loop = (now: number) => { draw(now); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); }
    return () => {
      cancelAnimationFrame(raf); cv.removeEventListener("webglcontextlost", onLost);
      removeEventListener("scroll", once); removeEventListener("resize", onResize); removeEventListener("pointermove", onMove);
      removeEventListener("calypto:mood", onMood); removeEventListener("calypto:nudge", onNudge); removeEventListener("calypto:leave", onLeave);
    };
  }, []);
  return <canvas ref={ref} className="ek-stage gl" aria-hidden="true" />;
}
/** Picks the glass stage when the device can draw it, otherwise the 2D one. */
export function Stage() {
  const [mode, setMode] = useState<"probe" | "gl" | "2d">("probe");
  useEffect(() => {
    let ok = false;
    try { const g = document.createElement("canvas").getContext("webgl"); ok = !!g && !!g.getExtension("OES_standard_derivatives"); } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- WebGL support can only be probed in the browser
    setMode(ok ? "gl" : "2d");
    const no = () => setMode("2d");
    addEventListener("calypto:nogl", no);
    return () => removeEventListener("calypto:nogl", no);
  }, []);
  if (mode === "probe") return <canvas className="ek-stage" aria-hidden="true" />;
  return mode === "gl" ? <GLStage /> : <ShardStage />;
}

/* ---------------- shards burst wherever you click ---------------- */
export function ShardBurst() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || reduceMotion()) return;
    const g = cv.getContext("2d");
    if (!g) return;
    type P = { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; life: number; c: string };
    let ps: P[] = [], raf = 0, running = false, dpr = 1;
    const size = () => { dpr = Math.min(devicePixelRatio || 1, 1.5); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    size();
    const cols = ["#d32435", "#b01d2d", "#7e0e1f", "#ffb3ba", "#d32435"];
    const loop = () => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight);
      ps = ps.filter(p => (p.life -= 0.018) > 0);
      for (const p of ps) {
        p.vy += 0.22; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.min(1, p.life * 1.5);
        g.fillStyle = p.c; g.beginPath(); g.moveTo(0, -p.s); g.lineTo(p.s * 0.8, p.s * 0.7); g.lineTo(-p.s * 0.5, p.s * 0.4); g.closePath(); g.fill(); g.restore();
      }
      if (ps.length) raf = requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable]")) return;
      for (let i = 0; i < 16; i++) {
        const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 7;
        ps.push({ x: e.clientX, y: e.clientY, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, s: 4 + Math.random() * 9, life: 1, c: cols[i % cols.length] });
      }
      if (!running) { running = true; raf = requestAnimationFrame(loop); }
    };
    addEventListener("pointerdown", onDown);
    addEventListener("resize", size);
    return () => { cancelAnimationFrame(raf); removeEventListener("pointerdown", onDown); removeEventListener("resize", size); };
  }, []);
  return <canvas ref={ref} className="ek-burst" aria-hidden="true" />;
}

/* ---------------- helpers ---------------- */
export function useInView<T extends Element>(threshold = 0.35, once = true) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced motion: reveal immediately
    if (reduceMotion()) { setSeen(true); return; }
    const io = new IntersectionObserver(es => {
      if (es[0].isIntersecting) { setSeen(true); if (once) io.disconnect(); } else if (!once) setSeen(false);
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, once]);
  return [ref, seen] as const;
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/_<>*";
/** Text that decodes from cipher when it scrolls into view (and again on hover). */
export function Decode({ text, className, as = "span", hover = true }: { text: string; className?: string; as?: "span" | "h1" | "h2" | "h3" | "div"; hover?: boolean }) {
  const [ref, seen] = useInView<HTMLElement>(0.4);
  const [out, setOut] = useState(text);
  const [run, setRun] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- start the decode when it scrolls into view
  useEffect(() => { if (seen) setRun(r => r + 1); }, [seen]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the plain text when not animating
    if (!run || reduceMotion()) { setOut(text); return; }
    const t0 = performance.now(), dur = 380 + text.length * 22;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), n = Math.floor(k * text.length);
      setOut(text.slice(0, n) + [...text.slice(n)].map(c => (c === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join(""));
      if (k < 1) raf = requestAnimationFrame(tick); else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, text]);
  const Tag = as as "span";
  return <Tag ref={ref as never} className={className} aria-label={text} onMouseEnter={hover ? () => setRun(r => r + 1) : undefined}><span aria-hidden="true">{out}</span></Tag>;
}

/** Endless ticker. */
export function Marquee({ items, reverse = false, className = "", speed = 38 }: { items: ReactNode[]; reverse?: boolean; className?: string; speed?: number }) {
  const row = (k: string) => (
    <div className="ek-mq-row" aria-hidden={k === "b"} key={k}>
      {items.map((it, i) => <span key={i} className="ek-mq-item">{it}<i className="ek-mq-sep" /></span>)}
    </div>
  );
  return (
    <div className={`ek-mq ${reverse ? "rev" : ""} ${className}`} style={{ ["--mq-speed" as string]: `${speed}s` } as CSSProperties}>
      <div className="ek-mq-track">{row("a")}{row("b")}</div>
    </div>
  );
}

/** Words light up one by one as you scroll through them. */
export function ScrollWords({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = [...el.querySelectorAll<HTMLElement>(".ek-sw")];
    if (reduceMotion()) { words.forEach(w => w.classList.add("on")); return; }
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = innerHeight * 0.62;
      words.forEach(w => w.classList.toggle("on", w.getBoundingClientRect().top < line));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [text]);
  return (
    <p ref={ref} className={`ek-scrollwords ${className}`}>
      {text.split(" ").map((w, i) => <span key={i} className={`ek-sw${w.startsWith("*") ? " hot" : ""}`}>{w.replace(/^\*/, "")} </span>)}
    </p>
  );
}

/** Card that tilts toward the pointer with a holographic sheen. */
export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion()) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--rx", `${(0.5 - y) * 14}deg`); el.style.setProperty("--ry", `${(x - 0.5) * 18}deg`);
      el.style.setProperty("--mx", `${x * 100}%`); el.style.setProperty("--my", `${y * 100}%`);
    };
    const leave = () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); };
    el.addEventListener("pointermove", move); el.addEventListener("pointerleave", leave);
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); };
  }, []);
  return <div ref={ref} className={`ek-tilt ${className}`}><div className="ek-tilt-in">{children}<span className="ek-holo" aria-hidden="true" /></div></div>;
}

/** Rotating circular label around a link. */
export function CircleBadge({ href, text, label }: { href: string; text: string; label: string }) {
  return (
    <a className="ek-badge" href={href} aria-label={label}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs><path id="ek-badge-path" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" /></defs>
        <text><textPath href="#ek-badge-path">{text}</textPath></text>
      </svg>
      <span className="ek-badge-core"><ArrowUpRight size={26} /></span>
    </a>
  );
}

/** Heading whose lines slide up from behind a cut when they appear. */
export function Rise({ lines, className = "", as = "h2" }: { lines: ReactNode[]; className?: string; as?: "h1" | "h2" }) {
  const [ref, seen] = useInView<HTMLHeadingElement>(0.3);
  const Tag = as;
  return (
    <Tag ref={ref} className={`ek-rise ${seen ? "in" : ""} ${className}`}>
      {lines.map((l, i) => <span key={i} className="ek-rise-line"><span style={{ transitionDelay: `${i * 0.09}s` }}>{l}</span></span>)}
    </Tag>
  );
}

/* ---------------- header + footer ---------------- */
const NAV = [
  { href: "/intelligence", label: "Abilities" },
  { href: "/veil", label: "The Veil" },
  { href: "/access", label: "$CALYPTO" },
  { href: "/guide", label: "Guide" },
];
export function EdgeHeader({ active = "" }: { active?: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const bar = useRef<HTMLSpanElement>(null);
  const [mac, setMac] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the platform is only known in the browser
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const on = () => {
      setScrolled(scrollY > 40);
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.current?.style.setProperty("--p", String(max > 0 ? scrollY / max : 0));
    };
    on(); addEventListener("scroll", on, { passive: true }); addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("ek-locked", open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <header className={`ek-header ${scrolled ? "scrolled" : ""}`}>
        <a className="ek-brand" href="/" aria-label="Calypto home"><CMark size={26} /><span>calypto<b>.</b></span></a>
        <nav className="ek-nav" aria-label="Main">
          {NAV.map(n => <a key={n.href} href={n.href} aria-current={active === n.href ? "page" : undefined}><Decode text={n.label} hover /></a>)}
        </nav>
        <button className="ek-cmd" onClick={() => dispatchEvent(new Event("calypto:palette"))} aria-label="Ask Calypto or search the site">
          <Search size={14} /><span>Ask anything</span><kbd>{mac ? <Command size={11} /> : "Ctrl"}K</kbd>
        </button>
        <Socials className="ek-head-socials" size={15} />
        <a className="ek-enter" href="/app" data-cursor="ENTER"><span>Enter</span><ArrowUpRight size={16} /></a>
        <span className="ek-progress" ref={bar} aria-hidden="true" />
        <button className="ek-burger" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">{open ? <X size={22} /> : <Menu size={22} />}</button>
      </header>
      <div className={`ek-menu ${open ? "open" : ""}`} aria-hidden={!open}>
        <button className="ek-menu-ask" onClick={() => { setOpen(false); dispatchEvent(new Event("calypto:palette")); }} tabIndex={open ? 0 : -1}><Search size={18} /> Ask anything</button>
        {[...NAV, { href: "/app", label: "Enter" }].map((n, i) => (
          <a key={n.href} href={n.href} style={{ transitionDelay: `${0.05 + i * 0.05}s` }} tabIndex={open ? 0 : -1}><small>0{i + 1}</small>{n.label}</a>
        ))}
        <Socials className="ek-menu-socials" size={20} tabIndex={open ? 0 : -1} />
      </div>
    </>
  );
}

export function EdgeFooter() {
  return (
    <footer className="ek-footer">
      <Marquee className="ek-footer-mq" items={["No filter", "No record", "No master", "Ask anyway", "$CALYPTO"]} speed={30} />
      <div className="ek-footer-grid">
        <div className="ek-footer-lead">
          <CMark size={40} />
          <p>Calypto is a private, uncensored AI.<br />From the Greek <em>kalyptō</em>: to conceal.</p>
          <Socials />
        </div>
        <div className="ek-footer-cols">
          <div><span>Explore</span>{NAV.map(n => <a key={n.href} href={n.href}>{n.label}</a>)}</div>
          <div><span>Workspace</span><a href="/app">Ask anything</a><a href="/app/token">Token check</a><a href="/app/wallet">Portfolio x-ray</a><a href="/app/research">Web search</a></div>
          <div><span>Fine print</span><a href="/privacy">Privacy & data</a><a href="/guide">How it works</a></div>
        </div>
      </div>
      <div className="ek-footer-base"><small>© {new Date().getFullYear()} Calypto</small><small>Some questions are hidden. Ask them anyway.</small></div>
    </footer>
  );
}

/* ---------------- smooth scrolling ----------------
 * Wheel scrolling glides instead of jumping. When you stop between two sections,
 * the page settles onto the nearest one. Touch, keyboard and scrollbar stay native
 * (and still settle when they stop).
 */
function SmoothScroll() {
  useEffect(() => {
    if (reduceMotion()) return;
    const root = document.documentElement;
    let target = scrollY, animating = false, raf = 0, last = 0, settleT = 0, touching = false, pointerDown = false, dir = 0, lastY = scrollY;
    const maxY = () => root.scrollHeight - innerHeight;
    const clamp = (v: number) => Math.max(0, Math.min(maxY(), v));
    const jump = (y: number) => window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    let stall = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(3, (now - last) / 16.67) : 1; last = now;
      const y = scrollY, diff = target - y, k = 1 - Math.pow(1 - 0.1, dt);
      // at browser zoom levels tiny steps get rounded away, so always move at least 2px and finish exactly
      let ny = y + Math.sign(diff) * Math.max(Math.abs(diff) * k, Math.min(Math.abs(diff), 2));
      if (Math.abs(diff) <= 2.5 || stall > 3) { ny = target; animating = false; }
      jump(ny);
      stall = Math.abs(scrollY - y) < 0.01 ? stall + 1 : 0;
      if (animating) raf = requestAnimationFrame(tick); else { last = 0; stall = 0; }
    };
    const run = () => { if (!animating) { animating = true; last = 0; raf = requestAnimationFrame(tick); } };
    const stop = () => { if (animating) { animating = false; cancelAnimationFrame(raf); last = 0; } target = scrollY; };
    const blocked = () => root.classList.contains("ek-locked") || root.classList.contains("ek-intro");
    const settle = () => {
      if (touching || pointerDown || blocked()) return;
      const vh = innerHeight, y = animating ? target : scrollY, my = maxY();
      const boxes = [...document.querySelectorAll<HTMLElement>(".ek-main section, .ek-footer")]
        .map(el => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, h: r.height }; }).filter(b => b.h > 40);
      if (boxes.some(b => b.top <= y + 1 && b.top + b.h >= y + vh - 1)) return; // reading inside a tall section
      const cut = boxes.some(b => { const vis = Math.min(b.top + b.h, y + vh) - Math.max(b.top, y); return vis > 90 && vis < Math.min(b.h, vh) - 90; });
      if (!cut) return;
      const pts = [my];
      for (const b of boxes) { pts.push(b.top); if (b.h > vh) pts.push(b.top + b.h - vh); }
      // lean the way you were scrolling: a small push down carries you on to the next section
      const pick = (ok: (q: number) => boolean) => {
        let best = NaN, d = Infinity;
        for (const p of pts) { const q = clamp(p), dd = Math.abs(q - y); if (ok(q) && dd < d) { d = dd; best = q; } }
        return { best, d };
      };
      let { best, d } = dir ? pick(q => (dir > 0 ? q >= y - 2 : q <= y + 2)) : { best: NaN, d: Infinity };
      if (!(d <= vh * 1.3)) ({ best, d } = pick(() => true));
      if (!Number.isFinite(best) || d < 4 || d > vh * 1.3) return;
      if (!animating) target = scrollY;
      target = best; run();
    };
    const scrollableParent = (el: Element | null) => {
      for (let n = el; n && n !== document.body && n !== root; n = n.parentElement) {
        const o = getComputedStyle(n).overflowY;
        if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight + 1) return true;
      }
      return false;
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || blocked() || Math.abs(e.deltaX) > Math.abs(e.deltaY) || scrollableParent(e.target as Element)) return;
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 18 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY;
      if (!animating) target = scrollY;
      target = clamp(target + d);
      if (d) dir = Math.sign(d);
      run();
      clearTimeout(settleT); settleT = window.setTimeout(settle, 240);
    };
    const onScroll = () => {
      const y = scrollY;
      if (animating) { lastY = y; return; }
      if (Math.abs(y - lastY) > 1) dir = Math.sign(y - lastY);
      lastY = y; target = y;
      clearTimeout(settleT); settleT = window.setTimeout(settle, 200);
    };
    const onKey = (e: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) stop(); };
    const onTo = (e: Event) => { const y = (e as CustomEvent).detail as number; if (!animating) target = scrollY; target = clamp(y); run(); };
    const tS = () => { touching = true; stop(); }, tE = () => { touching = false; onScroll(); };
    const pD = (e: PointerEvent) => { pointerDown = true; if (e.clientX > root.clientWidth) stop(); }, pU = () => { pointerDown = false; onScroll(); };
    addEventListener("wheel", onWheel, { passive: false });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("keydown", onKey);
    addEventListener("calypto:scrollto", onTo);
    addEventListener("touchstart", tS, { passive: true }); addEventListener("touchend", tE, { passive: true });
    addEventListener("pointerdown", pD); addEventListener("pointerup", pU);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(settleT);
      removeEventListener("wheel", onWheel); removeEventListener("scroll", onScroll); removeEventListener("keydown", onKey);
      removeEventListener("calypto:scrollto", onTo);
      removeEventListener("touchstart", tS); removeEventListener("touchend", tE);
      removeEventListener("pointerdown", pD); removeEventListener("pointerup", pU);
    };
  }, []);
  return null;
}
const scrollToY = (y: number) => dispatchEvent(new CustomEvent("calypto:scrollto", { detail: y }));

/* ---------------- page changes go through the C ----------------
 * Internal links don't just jump: the C rushes at you and swallows the screen,
 * then the next page assembles its C out of the dark.
 */
export function Transit() {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    let busy = false;
    const leave = (href: string) => {
      if (busy) return; busy = true;
      if (reduceMotion()) { location.assign(href); return; }
      setMood("think", "transit");
      dispatchEvent(new Event("calypto:leave"));
      setLeaving(true);
      window.setTimeout(() => location.assign(href), 620);
    };
    const onGo = (e: Event) => leave((e as CustomEvent).detail as string);
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest?.("a");
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download") || !a.href) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) {
        e.preventDefault();
        const el = url.hash ? document.querySelector(url.hash) : null;
        scrollToY(el ? el.getBoundingClientRect().top + scrollY : 0);
        if (url.hash) history.replaceState(null, "", url.hash);
        return;
      }
      e.preventDefault();
      leave(url.href);
    };
    // coming back with the browser's back button: undo the exit
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) { busy = false; setLeaving(false); setMood("idle", "transit"); location.reload(); } };
    addEventListener("calypto:go", onGo); document.addEventListener("click", onClick); addEventListener("pageshow", onShow);
    return () => { removeEventListener("calypto:go", onGo); document.removeEventListener("click", onClick); removeEventListener("pageshow", onShow); };
  }, []);
  return (
    <>
      <div className="ek-arrive" aria-hidden="true" />
      <div className={`ek-transit ${leaving ? "go" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 48 48"><path className="r" d={C_PATH} /><path className="k" d={C_PATH} /></svg>
      </div>
    </>
  );
}

/* ---------------- content eases in as it arrives ---------------- */
const REVEAL = ".pg-row,.pg-ledger>div,.pg-step,.pg-tips>div,.pg-faq details,.pg-policy article,.hm-veil li,.hm-stats>div,.ek-footer-cols>div,.pg-redact,.hm-term";
function Reveal() {
  useEffect(() => {
    if (reduceMotion() || typeof IntersectionObserver === "undefined") return;
    const els = [...document.querySelectorAll<HTMLElement>(REVEAL)];
    const show = (el: Element) => el.classList.add("in");
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { show(en.target); io.unobserve(en.target); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    const pending: HTMLElement[] = [];
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) return; // already on screen: leave it
      const i = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
      el.classList.add("ek-rv"); el.style.transitionDelay = `${(i % 4) * 70}ms`;
      io.observe(el); pending.push(el);
    });
    // backup: anything that reaches the screen (or is scrolled past) is shown, even if the observer missed it
    let timer = 0;
    const sweep = () => { timer = 0; for (const el of pending) if (!el.classList.contains("in") && el.getBoundingClientRect().top < innerHeight * 0.96) show(el); };
    const onScroll = () => { if (!timer) timer = window.setTimeout(sweep, 120); };
    addEventListener("scroll", onScroll, { passive: true });
    const late = window.setTimeout(sweep, 1500);
    return () => { io.disconnect(); removeEventListener("scroll", onScroll); clearTimeout(timer); clearTimeout(late); };
  }, []);
  return null;
}

/* ---------------- ask box: the one control that is the product ---------------- */
const MODES = [
  { id: "chat", label: "Ask", path: "/app" },
  { id: "token", label: "Token check", path: "/app/token" },
  { id: "wallet", label: "Portfolio", path: "/app/wallet" },
  { id: "research", label: "Web", path: "/app/research" },
];
const HINTS = ["roast my portfolio. don't be nice.", "what is this contract hiding?", "explain MEV like I'm five", "is this airdrop a scam?", "which conspiracy theories turned out true?", "write my resignation. the honest version."];
export function PromptBox({ id = "hero", compact = false }: { id?: string; compact?: boolean }) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState(0);
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState("");
  const box = useRef<HTMLFormElement>(null), input = useRef<HTMLInputElement>(null), sent = useRef(false);
  // the placeholder types out example questions
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stop the typing placeholder
    if (focused || value) { setHint(HINTS[0]); return; }
    if (reduceMotion()) { setHint(HINTS[0]); return; }
    let alive = true, n = 0;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    (async () => {
      while (alive) {
        const h = HINTS[n++ % HINTS.length];
        for (let i = 1; i <= h.length && alive; i++) { setHint(h.slice(0, i)); await sleep(34); }
        await sleep(1700);
        for (let i = h.length; i >= 0 && alive; i -= 2) { setHint(h.slice(0, i)); await sleep(14); }
        await sleep(250);
      }
    })();
    return () => { alive = false; };
  }, [focused, value]);
  useEffect(() => () => setMood("idle", `prompt-${id}`), [id]);
  const submit = (e?: { preventDefault(): void }) => {
    e?.preventDefault();
    const q = value.trim();
    if (!q) { input.current?.focus(); nudge(1.5); return; }
    sent.current = true;
    setMood("think", `prompt-${id}`, box.current);
    go(`${MODES[mode].path}?q=${encodeURIComponent(q)}`);
  };
  return (
    <form ref={box} className={`ek-prompt ${focused ? "focus" : ""} ${compact ? "compact" : ""}`} onSubmit={submit}>
      <div className="ek-prompt-modes" role="radiogroup" aria-label="Mode">
        {MODES.map((m, i) => (
          <button type="button" key={m.id} role="radio" aria-checked={mode === i} className={mode === i ? "on" : ""} onClick={() => { setMode(i); nudge(0.8); input.current?.focus(); }}>{m.label}</button>
        ))}
      </div>
      <div className="ek-prompt-row">
        <span className="ek-prompt-c" aria-hidden="true"><CMark size={18} /></span>
        <input
          ref={input} value={value} aria-label="Ask Calypto"
          placeholder={focused ? "Ask what you came to ask…" : hint}
          onChange={e => { setValue(e.target.value); nudge(0.5); }}
          onFocus={() => { setFocused(true); setMood("listen", `prompt-${id}`, box.current); }}
          onBlur={() => { setFocused(false); if (!sent.current) setMood("idle", `prompt-${id}`); }}
          maxLength={4000}
        />
        <button type="submit" className="ek-prompt-go" aria-label="Ask"><ArrowUp size={18} /></button>
      </div>
      <div className="ek-prompt-meta">
        <span><i className="ek-dot" />Private · history off</span>
        <span className="hide-sm">No wallet needed to start</span>
        <span className="ek-prompt-enter"><CornerDownLeft size={12} /> to ask</span>
      </div>
    </form>
  );
}

/* ---------------- $CALYPTO holder tiers (no prompt counts on the public site) ---------------- */
export const HOLDER_TIERS = [
  { name: "Shade", min: 50, blurb: "More usage than the free start, every day.", level: 1 },
  { name: "Veil", min: 100, blurb: "Even more room to ask, every day.", level: 2 },
  { name: "Eclipse", min: 150, blurb: "The most Calypto gives, every day.", level: 3 },
];
export function TierLadder() {
  return (
    <div className="ek-tiers" role="list" aria-label="Holder tiers">
      {HOLDER_TIERS.map(t => (
        <div key={t.name} role="listitem" className={`ek-tier l${t.level}`}>
          <span className="ek-tier-min">${t.min}+</span>
          <b>{t.name}</b>
          <p>{t.blurb}</p>
          <i aria-hidden="true">{[1, 2, 3].map(k => <em key={k} className={k <= t.level ? "lit" : ""} />)}</i>
        </div>
      ))}
    </div>
  );
}

/* ---------------- command palette (⌘K or /) ---------------- */
const PALETTE_PAGES = [
  { label: "Home", href: "/", hint: "Page" }, { label: "Abilities", href: "/intelligence", hint: "Page" },
  { label: "The Veil: how privacy works", href: "/veil", hint: "Page" }, { label: "$CALYPTO access", href: "/access", hint: "Page" },
  { label: "Field guide", href: "/guide", hint: "Page" }, { label: "Privacy & data", href: "/privacy", hint: "Page" },
  { label: "Open the workspace", href: "/app", hint: "App" }, { label: "Check a token", href: "/app/token", hint: "App" },
  { label: "X-ray a wallet", href: "/app/wallet", hint: "App" }, { label: "Connect a wallet", href: "/app?connect=1", hint: "App" },
];
function Palette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null), panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable]");
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) { e.preventDefault(); setOpen(o => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    addEventListener("keydown", onKey); addEventListener("calypto:palette", onOpen);
    return () => { removeEventListener("keydown", onKey); removeEventListener("calypto:palette", onOpen); };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("ek-locked", open);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the palette each time it opens
    if (open) { setQ(""); setSel(0); setTimeout(() => { input.current?.focus(); setMood("listen", "palette", panel.current); }, 30); }
    else setMood("idle", "palette");
  }, [open]);
  const text = q.trim();
  const items = [
    ...(text ? [
      { label: `Ask Calypto: “${text}”`, href: `/app?q=${encodeURIComponent(text)}`, hint: "Ask" },
      { label: `Search the web: “${text}”`, href: `/app/research?q=${encodeURIComponent(text)}`, hint: "Web" },
      ...(/0x[0-9a-fA-F]{40}/.test(text) ? [
        { label: "Check this token", href: `/app/token?q=${encodeURIComponent(text)}`, hint: "Token" },
        { label: "X-ray this wallet", href: `/app/wallet?q=${encodeURIComponent(text)}`, hint: "Portfolio" },
      ] : []),
    ] : []),
    ...PALETTE_PAGES.filter(p => !text || p.label.toLowerCase().includes(text.toLowerCase())),
  ];
  const pick = (i: number) => { const it = items[i]; if (!it) return; setMood("think", "palette", panel.current); setOpen(false); go(it.href); };
  return (
    <div className={`ek-pal ${open ? "open" : ""}`} aria-hidden={!open} onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="ek-pal-box" ref={panel} role="dialog" aria-label="Ask Calypto or jump to a page">
        <div className="ek-pal-in">
          <CMark size={20} />
          <input
            ref={input} value={q} placeholder="Ask anything, or jump to a page…" tabIndex={open ? 0 : -1}
            onChange={e => { setQ(e.target.value); setSel(0); nudge(0.5); }}
            onKeyDown={e => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); pick(sel); }
            }}
          />
          <kbd>esc</kbd>
        </div>
        <ul>
          {items.map((it, i) => (
            <li key={it.href + i}>
              <button tabIndex={open ? 0 : -1} className={i === sel ? "on" : ""} onMouseEnter={() => setSel(i)} onClick={() => pick(i)}>
                <span>{it.label}</span><small>{it.hint}</small>
              </button>
            </li>
          ))}
          {!items.length && <li className="none">Nothing here. Press enter to ask it instead.</li>}
        </ul>
        <div className="ek-pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span>Questions open in the workspace, ready to send</span></div>
      </div>
    </div>
  );
}

/* ---------------- cursor: a diamond, a reticle that locks onto what you hover, a shard trail ---------------- */
const CURSOR_TARGETS = "a,button,[role=button],summary,label,select,.rx,[data-cursor]";
export function Cursor() {
  const frame = useRef<HTMLDivElement>(null), dot = useRef<HTMLDivElement>(null), label = useRef<HTMLSpanElement>(null), trail = useRef<HTMLDivElement>(null), wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!matchMedia("(pointer: fine)").matches || reduceMotion()) return;
    const root = document.documentElement;
    const f = frame.current!, d = dot.current!, lb = label.current!, w = wrap.current!;
    const bits = [...trail.current!.children] as HTMLElement[];
    const pts = bits.map(() => ({ x: -100, y: -100 }));
    let x = -100, y = -100, fx = 0, fy = 0, fw = 30, fh = 30, seen = false, raf = 0, press = 0, text = false;
    let target: HTMLElement | null = null;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX; y = e.clientY;
      if (!seen) { seen = true; fx = x; fy = y; pts.forEach(p => { p.x = x; p.y = y; }); root.classList.add("ek-cursor-on"); }
      const t = e.target as HTMLElement;
      text = !!t.closest?.("input,textarea,[contenteditable]");
      target = text ? null : t.closest?.<HTMLElement>(CURSOR_TARGETS) ?? null;
      lb.textContent = target?.dataset.cursor || "";
    };
    const leave = () => { seen = false; root.classList.remove("ek-cursor-on"); };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      press = 1;
      const r = document.createElement("i");
      r.className = "ek-cursor-ripple";
      r.style.left = x + "px"; r.style.top = y + "px";
      w.appendChild(r);
      setTimeout(() => r.remove(), 650);
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!seen) return;
      let tx = x, ty = y, tw = text ? 4 : 30, th = text ? 26 : 30, hot = false;
      if (target && target.isConnected) {
        const r = target.getBoundingClientRect();
        hot = true;
        if (r.width < 460 && r.height < 200 && r.width > 0) { tx = r.left + r.width / 2; ty = r.top + r.height / 2; tw = r.width + 14; th = r.height + 12; }
        else { tw = 46; th = 46; }
      }
      press *= 0.85;
      const squeeze = 1 - press * 0.28;
      fx += (tx - fx) * 0.24; fy += (ty - fy) * 0.24;
      fw += (tw * squeeze - fw) * 0.22; fh += (th * squeeze - fh) * 0.22;
      f.style.transform = `translate3d(${fx - fw / 2}px,${fy - fh / 2}px,0)`;
      f.style.width = fw + "px"; f.style.height = fh + "px";
      f.classList.toggle("hot", hot); f.classList.toggle("text", text);
      d.style.transform = `translate3d(${x}px,${y}px,0) rotate(45deg) scale(${1 + press * 0.9})`;
      d.classList.toggle("text", text);
      // trail: every shard chases the one ahead of it, and only shows while you move
      let px = x, py = y;
      pts.forEach((p, i) => {
        p.x += (px - p.x) * 0.45; p.y += (py - p.y) * 0.45; px = p.x; py = p.y;
        const speed = Math.min(1, Math.hypot(x - p.x, y - p.y) / 24);
        const k = 1 - i / bits.length;
        bits[i].style.transform = `translate3d(${p.x}px,${p.y}px,0) rotate(45deg) scale(${k * speed})`;
        bits[i].style.opacity = String(k * 0.6 * speed);
      });
    };
    raf = requestAnimationFrame(loop);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerdown", down);
    document.addEventListener("pointerleave", leave);
    addEventListener("blur", leave);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move); removeEventListener("pointerdown", down);
      document.removeEventListener("pointerleave", leave); removeEventListener("blur", leave);
      root.classList.remove("ek-cursor-on");
    };
  }, []);
  return (
    <div className="ek-cursor" ref={wrap} aria-hidden="true">
      <div className="ek-cursor-trail" ref={trail}>{Array.from({ length: 9 }, (_, i) => <i key={i} />)}</div>
      <div className="ek-cursor-frame" ref={frame}><b /><b /><b /><b /><span ref={label} /></div>
      <div className="ek-cursor-dot" ref={dot} />
    </div>
  );
}

/** Frame for every public page: stage, bursts, header, footer, and the pieces that make it feel alive. */
export function EdgeShell({ children, active = "" }: { children: ReactNode; active?: string }) {
  return (
    <div className="ek-site">
      <div className="ek-flood" aria-hidden="true" />
      <Stage />
      <ShardBurst />
      <SmoothScroll />
      <Reveal />
      <EdgeHeader active={active} />
      <main className="ek-main">{children}</main>
      <EdgeFooter />
      <Palette />
      <Transit />
      <Cursor />
    </div>
  );
}
