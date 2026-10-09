"use client";
import { useEffect, useRef } from "react";
export default function Atmosphere() {
  const cursor = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(pointer: fine)");
    root.classList.add("motion-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-revealed");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );
    const observe = () => {
      document
        .querySelectorAll<HTMLElement>('a,img,svg,button,[draggable="true"]')
        .forEach((el) => el.setAttribute("draggable", "false"));
      document
        .querySelectorAll<HTMLElement>("[data-reveal]:not(.is-revealed)")
        .forEach((el) => observer.observe(el));
    };
    observe();
    const mutation = new MutationObserver(observe);
    mutation.observe(document.body, { childList: true, subtree: true });
    let x = 0,
      y = 0,
      cx = 0,
      cy = 0,
      frame = 0,
      seen = false;
    const ring = cursor.current,
      point = dot.current;
    const move = (e: PointerEvent) => {
      if (!fine.matches || motion.matches) return;
      x = e.clientX;
      y = e.clientY;
      if (!seen) {
        cx = x;
        cy = y;
        seen = true;
      }
      root.classList.add("cursor-ready");
      ring?.classList.add("visible");
      point?.classList.add("visible");
      const target = e.target as HTMLElement;
      const action = target.closest<HTMLElement>('a,button,[role="button"]');
      const editing = !!target.closest("input,textarea,[contenteditable]");
      ring?.classList.toggle("over-action", !!action);
      ring?.classList.toggle("editing", editing);
      point?.classList.toggle("editing", editing);
      if (ring) {
        ring.dataset.label = action?.dataset.cursor || "";
      }
      const surface = target.closest<HTMLElement>(
        ".suggestion-grid button,.mode-row,.lens-tile,.composer,.knowledge-card",
      );
      if (surface) {
        const r = surface.getBoundingClientRect();
        surface.style.setProperty("--pointer-x", `${e.clientX - r.left}px`);
        surface.style.setProperty("--pointer-y", `${e.clientY - r.top}px`);
      }
    };
    const hide = () => {
      ring?.classList.remove("visible");
      point?.classList.remove("visible");
      root.classList.remove("cursor-ready");
      seen = false;
    };
    const down = () => ring?.classList.add("pressed");
    const up = () => ring?.classList.remove("pressed");
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (!seen || motion.matches) return;
      cx += (x - cx) * 0.13;
      cy += (y - cy) * 0.13;
      if (ring) ring.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      if (point) point.style.transform = `translate3d(${x}px,${y}px,0)`;
    };
    animate();
    const preventDrag = (event: DragEvent) => event.preventDefault();
    document.addEventListener("dragstart", preventDrag, true);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", hide);
    window.addEventListener("blur", hide);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    const pref = () => {
      if (motion.matches || !fine.matches) hide();
    };
    motion.addEventListener("change", pref);
    fine.addEventListener("change", pref);
    return () => {
      document.removeEventListener("dragstart", preventDrag, true);
      root.classList.remove("cursor-ready", "motion-ready");
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutation.disconnect();
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", hide);
      window.removeEventListener("blur", hide);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      motion.removeEventListener("change", pref);
      fine.removeEventListener("change", pref);
    };
  }, []);
  return (
    <>
      <div className="ambient-grain" aria-hidden="true" />
      <div className="custom-cursor" ref={cursor} aria-hidden="true">
        <i />
        <span />
      </div>
      <div className="cursor-dot" ref={dot} aria-hidden="true" />
    </>
  );
}
