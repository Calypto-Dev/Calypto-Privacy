"use client";
import { useId } from "react";

/**
 * HolderSeal: the $CALYPTO holder pass. When a verified wallet qualifies, a red
 * wax seal stamped with the Calypto mark slams onto the card and names the
 * holder's tier. Unqualified wallets see the empty seal outline.
 *
 *   <HolderSeal wallet={status.wallet} valueUsd={holdings.value} eligible={holdings.eligible} />
 *
 * Tiers must match lib/server.ts TIERS (Shade $50, Veil $100, Eclipse $150).
 */
export const TIERS = [
  { min: 150, name: "Eclipse", note: "The deepest tier. The most room to ask, every day.", daily: 30 },
  { min: 100, name: "Veil", note: "Twice the room of Shade, every day.", daily: 20 },
  { min: 50, name: "Shade", note: "More than the free start, every day.", daily: 10 },
];

const CSS = `
.cx-pass{position:relative;width:100%;max-width:360px;padding:22px 22px 20px;border:1px solid #33272c;border-radius:0;
  background:radial-gradient(120% 90% at 85% 10%,#2a0d18 0%,#120a0e 55%,#0b080a 100%);color:#ede9e8;font-family:inherit;overflow:hidden}
.cx-pass::after{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
  background:repeating-linear-gradient(115deg,transparent 0 22px,rgba(229,185,203,.025) 22px 23px)}
.cx-pass-eyebrow{font-size:9px;letter-spacing:2.5px;color:#a37a8b;text-transform:uppercase}
.cx-pass-tier{margin-top:10px;font-family:'Chakra Petch','Manrope',sans-serif;font-size:26px;font-weight:700;letter-spacing:-.2px;text-transform:uppercase}
.cx-pass-note{margin-top:4px;font-size:12px;color:#b3a5ab;font-style:italic}
.cx-pass-meta{display:flex;gap:18px;margin-top:22px;font-size:11px;color:#88868b}
.cx-pass-meta b{display:block;margin-top:3px;font-weight:500;color:#e5b9cb;font-variant-numeric:tabular-nums}
.cx-pass-seal{position:absolute;right:16px;top:16px;width:92px;height:92px}
.cx-pass.cx-sealed{animation:cxPassShake .5s .62s both}
.cx-pass.cx-sealed .cx-pass-seal svg{animation:cxStamp .7s cubic-bezier(.3,1.4,.5,1) .15s both}
.cx-pass.cx-sealed .cx-pass-ring{animation:cxRing .9s ease-out .6s both}
.cx-pass.cx-sealed .cx-pass-tier,.cx-pass.cx-sealed .cx-pass-note{animation:cxRise .6s ease-out .8s both}
@keyframes cxStamp{0%{transform:scale(2.3) rotate(-24deg);opacity:0;filter:blur(3px)}55%{transform:scale(.9) rotate(4deg);opacity:1;filter:none}75%{transform:scale(1.04) rotate(-2deg)}100%{transform:scale(1) rotate(-8deg)}}
@keyframes cxRing{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.9);opacity:0}}
@keyframes cxPassShake{0%,100%{transform:none}20%{transform:translate(1.5px,1px)}40%{transform:translate(-1.5px,-.5px)}60%{transform:translate(1px,0)}}
@keyframes cxRise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.cx-pass-ring{position:absolute;inset:6px;border-radius:50%;border:2px solid rgba(243,67,82,.7);opacity:0;pointer-events:none}
@media (prefers-reduced-motion: reduce){.cx-pass *,.cx-pass{animation:none!important}}
`;

function Seal({ filled }: { filled: boolean }) {
  const uid = useId().replace(/:/g, "");
  const id = (n: string) => `${uid}-${n}`;
  // irregular wax edge
  const pts = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    const r = 43 + (i % 2 ? 2.6 : -1.4) + Math.sin(i * 2.7) * 1.8;
    return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
  if (!filled)
    return (
      <svg viewBox="0 0 100 100" width="92" height="92" aria-hidden="true">
        <circle cx="50" cy="50" r="40" stroke="#5a3a48" strokeDasharray="3 5" fill="none" />
        <g transform="translate(26 26)" opacity=".35">
          <path d="M35 7 13 14 6 32 28 41 40 28 25 32 17 27 21 18Z" fill="#5a3a48" />
        </g>
      </svg>
    );
  return (
    <svg viewBox="0 0 100 100" width="92" height="92" aria-hidden="true">
      <defs>
        <radialGradient id={id("wax")} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#f34352" />
          <stop offset=".45" stopColor="#b51d33" />
          <stop offset=".85" stopColor="#6e1430" />
          <stop offset="1" stopColor="#3a0a18" />
        </radialGradient>
        <radialGradient id={id("well")} cx="50%" cy="50%" r="50%">
          <stop offset=".7" stopColor="#8a1530" />
          <stop offset="1" stopColor="#5e0f26" />
        </radialGradient>
        <filter id={id("shadow")} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity=".6" />
        </filter>
      </defs>
      <polygon points={pts} fill={`url(#${id("wax")})`} filter={`url(#${id("shadow")})`} />
      <circle cx="50" cy="50" r="31" fill={`url(#${id("well")})`} />
      <circle cx="50" cy="50" r="31" stroke="#f34352" strokeOpacity=".5" strokeWidth="1.2" fill="none" />
      <circle cx="50" cy="50" r="27" stroke="#3a0a18" strokeOpacity=".6" strokeDasharray="1 3" fill="none" />
      <g transform="translate(26 25)">
        <path d="M35 7 13 14 6 32 28 41 40 28 25 32 17 27 21 18Z" fill="#3a0a18" transform="translate(.8 1.2)" />
        <path d="M35 7 13 14 6 32 28 41 40 28 25 32 17 27 21 18Z" fill="#e0475a" />
        <path d="m35 7-10 25 15-4-12 13 9-20Z" fill="#ff8a96" opacity=".45" />
      </g>
      <ellipse cx="36" cy="30" rx="10" ry="5" fill="#fff" opacity=".18" transform="rotate(-30 36 30)" />
    </svg>
  );
}

export default function HolderSeal({
  wallet,
  valueUsd,
  eligible,
}: {
  wallet: string | null;
  valueUsd: number | null;
  eligible: boolean;
}) {
  const tier = eligible && valueUsd != null ? TIERS.find((t) => valueUsd >= t.min) : undefined;
  const sealed = !!tier;
  const short = wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Not connected";
  const usd =
    valueUsd == null
      ? "—"
      : valueUsd.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  return (
    <div className={`cx-pass${sealed ? " cx-sealed" : ""}`} role="group" aria-label="Calypto holder pass">
      <style>{CSS}</style>
      <div className="cx-pass-seal">
        <span className="cx-pass-ring" />
        <Seal filled={sealed} />
      </div>
      <div className="cx-pass-eyebrow">$CALYPTO · holder tier</div>
      <div className="cx-pass-tier">{sealed ? tier!.name : "Unsealed"}</div>
      <div className="cx-pass-note">
        {sealed ? tier!.note : `Hold $${TIERS[TIERS.length - 1].min} or more of $CALYPTO to unlock a tier.`}
      </div>
      <div className="cx-pass-meta">
        <span>
          Wallet<b>{short}</b>
        </span>
        <span>
          Holding<b>{usd}</b>
        </span>
        <span>
          Daily prompts<b>{sealed ? String(tier!.daily) : "—"}</b>
        </span>
      </div>
    </div>
  );
}
