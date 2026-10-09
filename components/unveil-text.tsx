"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Unveil: content appears as if a red silk veil is drawn off it.
 * A blurred, masked layer sharpens left to right while a thin crimson
 * shimmer line sweeps across. Wrap any AI answer with it:
 *
 *   <Unveil><RichText text={m.content} /></Unveil>
 *
 * Plays once on mount. Honors prefers-reduced-motion (simple fade).
 */
const CSS = `
.cx-unveil{position:relative;isolation:isolate}
.cx-unveil>.cx-unveil-body{
  -webkit-mask-image:linear-gradient(100deg,#000 0%,#000 var(--cx-p),transparent calc(var(--cx-p) + 18%));
  mask-image:linear-gradient(100deg,#000 0%,#000 var(--cx-p),transparent calc(var(--cx-p) + 18%));
  filter:blur(calc((1 - var(--cx-k)) * 6px));
}
.cx-unveil>.cx-unveil-sheen{
  position:absolute;inset:-4px 0;pointer-events:none;z-index:1;
  background:linear-gradient(100deg,transparent calc(var(--cx-p) - 6%),rgba(243,67,82,.0) calc(var(--cx-p) - 4%),
    rgba(243,67,82,.38) var(--cx-p),rgba(255,214,222,.55) calc(var(--cx-p) + 1%),rgba(211,36,53,.0) calc(var(--cx-p) + 9%),transparent);
  mix-blend-mode:screen;opacity:calc(1 - var(--cx-k) * var(--cx-k));
}
.cx-unveil.cx-done>.cx-unveil-body{-webkit-mask-image:none;mask-image:none;filter:none}
.cx-unveil.cx-done>.cx-unveil-sheen{display:none}
@media (prefers-reduced-motion: reduce){
  .cx-unveil>.cx-unveil-body{-webkit-mask-image:none;mask-image:none;filter:none;animation:cxFade .4s both}
  .cx-unveil>.cx-unveil-sheen{display:none}
}
@keyframes cxFade{from{opacity:0}to{opacity:1}}
`;

let injected = false;
function useStyles() {
  useEffect(() => {
    if (injected || typeof document === "undefined") return;
    const el = document.createElement("style");
    el.dataset.calypto = "unveil";
    el.textContent = CSS;
    document.head.appendChild(el);
    injected = true;
  }, []);
}

export default function Unveil({
  children,
  duration = 1400,
  delay = 0,
}: {
  children: ReactNode;
  duration?: number;
  delay?: number;
}) {
  useStyles();
  const ref = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDone(true);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / duration));
      const e = 1 - Math.pow(1 - k, 3);
      el.style.setProperty("--cx-p", `${(-20 + e * 140).toFixed(2)}%`);
      el.style.setProperty("--cx-k", e.toFixed(3));
      if (k < 1) raf = requestAnimationFrame(tick);
      else setDone(true);
    };
    el.style.setProperty("--cx-p", "-20%");
    el.style.setProperty("--cx-k", "0");
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, delay]);

  return (
    <div ref={ref} className={`cx-unveil${done ? " cx-done" : ""}`}>
      <div className="cx-unveil-body">{children}</div>
      <span className="cx-unveil-sheen" aria-hidden="true" />
    </div>
  );
}
