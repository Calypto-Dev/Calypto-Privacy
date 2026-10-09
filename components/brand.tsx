/** The Calypto "C": the faceted mark exactly as it appears in the browser-tab icon. */
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M35 7 13 14 6 32 28 41 40 28 25 32 17 27 21 18Z" fill="currentColor" />
      <path d="m13 14 8 4-4 9-11 5Z" fill="#080809" opacity=".28" />
      <path d="m6 32 11-5 8 5 3 9Z" fill="#080809" opacity=".16" />
    </svg>
  );
}
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Calypto home">
      <Mark />
      <span>
        calypto<span className="brand-dot">.</span>
      </span>
    </a>
  );
}
