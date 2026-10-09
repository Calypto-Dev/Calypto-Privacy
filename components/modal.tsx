"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const node = ref.current;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const elements = Array.from(
          node?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input, textarea, [tabindex="0"]',
          ) || [],
        );
        if (!elements.length) {
          e.preventDefault();
          return;
        }
        const first = elements[0],
          last = elements.at(-1)!;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || document.activeElement === node)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", listener);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="wm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="wm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
        tabIndex={-1}
        ref={ref}
      >
        <button className="wm-close" onClick={onClose} aria-label="Close dialog">
          <X size={18} />
        </button>
        <span className="wm-eyebrow">Calypto / your workspace</span>
        <h2 id="modal-heading">{title}</h2>
        <p className="wm-sub">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
