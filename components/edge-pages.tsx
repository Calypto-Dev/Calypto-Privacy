"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- plain links on purpose: the page transition and a fresh stage need full navigations */
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { EdgeShell, Decode, Marquee, Rise, ScrollWords, TiltCard, PromptBox, TierLadder } from "./edge-kit";

const PAGES = ["/intelligence", "/veil", "/access", "/guide", "/privacy"];
function PageHero({ ghost, eyebrow, lines, lede, shard, children, path }: { ghost: string; eyebrow: string; lines: React.ReactNode[]; lede: string; shard: string; children?: React.ReactNode; path: string }) {
  const n = PAGES.indexOf(path) + 1;
  return (
    <section className="pg-hero" data-shard={shard}>
      <div className="pg-ghost" aria-hidden="true"><span>{ghost}</span></div>
      <div className="pg-index" aria-hidden="true">
        <span>{String(n).padStart(2, "0")} / {String(PAGES.length).padStart(2, "0")}</span>
        <span>Calypto · {ghost.toLowerCase()}</span>
      </div>
      <span className="ek-eyebrow">{eyebrow}</span>
      <Rise as="h1" className="pg-title" lines={lines} />
      <p className="pg-lede">{lede}</p>
      {children}
    </section>
  );
}
/** Every page ends where the product begins: a real ask box. */
function PageAsk({ id, shard = "0.5 0.3 0.3 0.12 1 0.8 0" }: { id: string; shard?: string }) {
  return (
    <section className="pg-sec pg-ask" data-shard={shard}>
      <div className="hm-ask"><span>ASK.</span><small>No wallet needed to start.</small></div>
      <PromptBox id={id} compact />
    </section>
  );
}

/* ============================== ABILITIES ============================== */
export function AbilitiesPage() {
  return (
    <EdgeShell active="/intelligence">
      <PageHero
        path="/intelligence" ghost="ABILITIES" eyebrow="What Calypto can do" shard="0.74 0.42 0.42 0.04 1 0.8 0"
        lines={["One mind.", <em key="e">No off-limits subjects.</em>]}
        lede="Calypto is a general AI first. Ask it anything. For crypto, it checks a token before you buy and x-rays any wallet. For today’s facts, it searches the web."
      >
        <div className="ek-btns"><a className="ek-btn p" href="/app">Ask anything <ArrowRight size={16} /></a></div>
      </PageHero>
      <section className="pg-sec" data-shard="0.9 0.5 0.18 0.6 0.9 1.4 0">
        <div className="pg-rows">
          <div className="pg-row">
            <span className="pg-row-n">01</span>
            <div><Decode as="h3" text="ASK_ANYTHING" /><p>Any subject, any tone. Straight opinions, honest critique, the questions other assistants refuse or bury in disclaimers.</p><a className="ek-link" href="/app">Open <ArrowRight size={14} /></a></div>
            <div className="pg-demo"><div className="q">anon › be honest, is my side project worth continuing?</div><div className="a">Not as it is. You have 40 users and no one paying. Pick the 5 who use it daily, ask what they’d pay for, and build only that for a month.</div></div>
          </div>
          <div className="pg-row">
            <span className="pg-row-n">02</span>
            <div><Decode as="h3" text="TOKEN_CHECK" /><p>Paste a token contract before you buy. Calypto checks available contract information, possible admin powers, holders, liquidity and trading activity, then explains the risks and data gaps.</p><a className="ek-link" href="/app/token">Check a token <ArrowRight size={14} /></a></div>
            <div className="pg-demo"><div className="q">anon › 0x7a3f…e91c · is this a rug?</div>
              <div className="facts"><span className="bad"><em>Liquidity</em><b>$8.2K</b></span><span className="bad"><em>Top 10</em><b>41%</b></span><span className="warn"><em>Owner</em><b>Active</b></span><span className="good"><em>Contract</em><b>Verified</b></span></div>
              <div className="a">High risk. The owner can still change fees, two wallets hold 41% outside the pool, and selling $2K would move the price about 25%.</div>
            </div>
          </div>
          <div className="pg-row">
            <span className="pg-row-n">03</span>
            <div><Decode as="h3" text="PORTFOLIO_X-RAY" /><p>Paste any Robinhood Chain wallet. See the real allocation, how concentrated it is, what would be hard to sell and what the last moves say.</p><a className="ek-link" href="/app/wallet">X-ray a wallet <ArrowRight size={14} /></a></div>
            <div className="pg-demo"><div className="q">anon › 0x9a3f…c41e · where’s my risk?</div>
              <div className="bar"><span>ETH</span><i style={{ ["--w" as string]: "52%" }} /><em>52%</em></div>
              <div className="bar"><span>USDC</span><i style={{ ["--w" as string]: "25%" }} /><em>25%</em></div>
              <div className="bar"><span>CALYPTO</span><i style={{ ["--w" as string]: "23%" }} /><em>23%</em></div>
              <div className="a">Most of your risk sits in the 23% with the thinnest market. It would take days to exit without moving the price.</div>
            </div>
          </div>
          <div className="pg-row">
            <span className="pg-row-n">04</span>
            <div><Decode as="h3" text="WEB_SEARCH" /><p>Switch on web search when it needs today’s facts. It reads the open web while it answers and links every claim, so you can check it yourself.</p><a className="ek-link" href="/app/research">Search the web <ArrowRight size={14} /></a></div>
            <div className="pg-demo"><div className="q">anon › what actually changed in the new token rules?</div><div className="a">Three things, summarised from the official text and two analyses. Each point is linked to its source.</div><div className="chips"><span>1 · official text</span><span>2 · analysis</span><span>3 · analysis</span></div></div>
          </div>
        </div>
      </section>
      <section className="pg-sec" data-shard="0.5 0.5 0.9 1 0.25 0.3 0">
        <div className="pg-head"><span className="ek-eyebrow">Examples on this page</span><ScrollWords text="Every answer above is an *example. Yours will be *sharper, because they’ll be about your *questions." /></div>
      </section>
      <PageAsk id="abilities" />
    </EdgeShell>
  );
}

/* ============================== THE VEIL ============================== */
const SECRETS = ["your questions", "the tokens you check", "your wallet’s story", "who you are"];
export function VeilPage() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <EdgeShell active="/veil">
      <PageHero
        path="/veil" ghost="KALYPTŌ" eyebrow="The Veil · how privacy works" shard="0.76 0.45 0.4 0.08 1 1 0"
        lines={["Concealed", <em key="e">by default.</em>]}
        lede="Calypto takes its name from the Greek word for concealment. Here is exactly what it keeps, what it doesn’t, and where your words go."
      />
      <section className="pg-sec" data-shard="0.12 0.5 0.2 0.7 0.8 1 0">
        <div className="pg-redact">
          Calypto doesn’t keep{" "}
          {SECRETS.map((s, i) => (
            <span key={s}><span className={`rx ${open === i ? "open" : ""}`} onClick={() => setOpen(open === i ? null : i)}>{s}</span>{i < SECRETS.length - 2 ? ", " : i === SECRETS.length - 2 ? " or " : ""}</span>
          ))}{" "}unless you choose to save a conversation.
          <small>Hover or tap the bars to uncover</small>
        </div>
      </section>
      <section className="pg-sec" data-shard="0.88 0.3 0.16 0.9 0.7 1.6 0">
        <div className="pg-head"><span className="ek-eyebrow">The ledger</span><Rise lines={["What’s kept.", <em key="e">What isn’t.</em>]} /></div>
        <div className="pg-ledger">
          <div><span className="tag">Not kept</span><h3>Your conversations</h3><ul><li>History is off by default</li><li>Unsaved chats live only in your open page</li><li>Token and wallet checks aren’t stored</li></ul></div>
          <div><span className="tag">Only if you choose</span><h3>Saved chats</h3><ul><li>Turn saving on per conversation</li><li>Delete one or all, any time</li><li>Tied to this browser session and verified wallet</li></ul></div>
          <div><span className="tag">Kept to run access</span><h3>The minimum</h3><ul><li>A random visitor identifier</li><li>Prompt counts for your limits</li><li>Your verified wallet address</li></ul></div>
          <div><span className="tag">Processed to answer</span><h3>Calypto AI</h3><ul><li>Calypto processes your questions to generate intelligent responses</li><li>Web searches retrieve external information when needed</li><li>Token and wallet checks read public blockchain data</li></ul></div>
        </div>
      </section>
      <section className="pg-sec" data-shard="0.5 0.5 0.95 1 0.22 0.2 0">
        <ScrollWords text="Your conversations. Your identity. Your freedom. Calypto delivers a *private, *uncensored AI experience built for unrestricted exploration, confidential interactions, and complete control over your data." />
        <div style={{ marginTop: 36 }}><a className="ek-link" href="/privacy">Read the full privacy details <ArrowRight size={14} /></a></div>
      </section>
      <PageAsk id="veil" />
    </EdgeShell>
  );
}

/* ============================== $CALYPTO ============================== */
export function AccessPage({ tokenConfigured }: { tokenConfigured: boolean }) {
  return (
    <EdgeShell active="/access">
      <PageHero
        path="/access" ghost="$CALYPTO" eyebrow={tokenConfigured ? "$CALYPTO holder access" : "$CALYPTO coming soon"} shard="0.76 0.45 0.46 0 1 0.6 0"
        lines={["Hold", <em key="e">the edge.</em>]}
        lede={tokenConfigured
          ? "Start with three free prompts. Hold $50 or more of $CALYPTO and verify your wallet to access holder tiers. Get more daily prompts as you hold more."
          : "$CALYPTO coming soon. Start with three free prompts now. After launch, holder tiers from $50 will give you more daily prompts as you hold more."}
      >
        <div className="ek-btns"><a className="ek-btn p" href="/app?connect=1">Check your tier <ArrowRight size={16} /></a><a className="ek-btn g" href="/app">Start asking</a></div>
      </PageHero>
      <div className="hm-cross" aria-hidden="true">
        <Marquee items={["$CALYPTO", "Hold more, ask more", "Read-only wallet", "Never moved"]} speed={26} />
        <Marquee items={["Hold the edge", "Shade · Veil · Eclipse", "Robinhood Chain"]} reverse speed={32} className="alt" />
      </div>
      <section className="pg-sec" data-shard="0.88 0.25 0.16 0.6 0.8 1.4 0">
        <div className="pg-head"><span className="ek-eyebrow">Three steps</span><Rise lines={["Prove it.", <em key="e">Never move it.</em>]} /></div>
        <div className="pg-steps">
          <div className="pg-step"><div><h3>Connect a wallet</h3><p>Any browser wallet on Robinhood Chain. Nothing is requested except your address.</p></div></div>
          <div className="pg-step"><div><h3>Sign once</h3><p>A one-time signature proves the wallet is yours. It can’t move funds or approve spending.</p></div></div>
          <div className="pg-step"><div><h3>Hold $50 or more</h3><p>Calypto reads your balance and unlocks your tier: Shade, Veil or Eclipse. Hold more to move up. The check repeats as you use it.</p></div></div>
        </div>
      </section>
      <section className="pg-sec" data-shard="0.5 0.92 0.26 0.35 1 1 1" id="pass">
        <FloodOnView />
        <div className="pg-pass-wrap">
          <div className="pg-head" style={{ margin: 0 }}>
            <span className="ek-eyebrow" style={{ color: "#ffd6db" }}>Your pass</span>
            <Rise lines={["Three tiers.", <em key="e" style={{ color: "#140105" }}>One wallet.</em>]} />
            <p style={{ color: "#fff", opacity: 0.88 }}>Your tier is read from your wallet each time you use Calypto. Read-only: nothing is ever moved or approved.</p>
            <TierLadder />
          </div>
          <TiltCard className="hm-pass">
            <div className="hm-pass-top"><span className="ek-eyebrow">Access pass</span><span className="hm-pass-chip" /></div>
            <div className="hm-pass-name">$CALYPTO</div>
            <dl>
              <div><dt>No wallet</dt><dd>Free to start</dd></div>
              <div><dt>Shade · $50+</dt><dd>More usage</dd></div>
              <div><dt>Veil · $100+</dt><dd>Even more</dd></div>
              <div><dt>Eclipse · $150+</dt><dd>The most</dd></div>
              <div><dt>Wallet access</dt><dd>Read-only proof</dd></div>
            </dl>
            <a className="ek-btn p" href="/app?connect=1">Check your tier <ArrowRight size={16} /></a>
          </TiltCard>
        </div>
      </section>
    </EdgeShell>
  );
}
function FloodOnView() {
  // toggles the red flood while the pass section is on screen
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const sec = ref.current?.parentElement;
    if (!sec) return;
    const root = document.documentElement;
    const io = new IntersectionObserver(es => root.classList.toggle("ek-flooded", es[0].isIntersecting), { rootMargin: "-42% 0px -42% 0px" });
    io.observe(sec);
    return () => { io.disconnect(); root.classList.remove("ek-flooded"); };
  }, []);
  return <span ref={ref} hidden />;
}

/* ============================== GUIDE ============================== */
const FAQ = [
  ["What does Calypto mean?", "It comes from the Greek kalyptō, to conceal. Calypto keeps what you ask concealed, and answers what other assistants keep hidden."],
  ["Is it really uncensored?", "Calypto answers directly, without moralising or refusing ordinary questions. A few hard limits stay in place because the law requires them, such as anything that sexualises minors."],
  ["Do I need a wallet to try it?", "No. Start asking without an account. A wallet only matters when you want more usage as a $CALYPTO holder."],
  ["Is it only for crypto?", "No. Calypto is a general AI first. For crypto it adds a token check and a portfolio x-ray, and web search brings in today’s facts for anything."],
  ["Can Calypto move my funds?", "No. Connecting a wallet only proves you own it with a one-time signature. Calypto never asks for transfers or approvals."],
  ["Where do my questions go?", "Your questions are processed securely through Calypto AI to generate private, uncensored responses. Conversations are not saved by Calypto unless you explicitly enable saving."],
];
export function GuidePage() {
  return (
    <EdgeShell active="/guide">
      <PageHero
        path="/guide" ghost="GUIDE" eyebrow="Field guide" shard="0.78 0.42 0.38 0.04 1 1 0"
        lines={["Ask better.", <em key="e">Get sharper.</em>]}
        lede="Five habits that get you straighter answers, and the questions people ask before they start."
      />
      <section className="pg-sec" data-shard="0.1 0.6 0.18 0.7 0.8 1.2 0">
        <div className="pg-head"><span className="ek-eyebrow">Five habits</span><Rise lines={["How to ask.", <em key="e">How to push back.</em>]} /></div>
        <div className="pg-tips">
          <div><b>01</b><h3>Say what you want</h3><p>“Be brutal”, “give me the short version”, “argue the other side”. Calypto takes instructions literally.</p></div>
          <div><b>02</b><h3>Give it context</h3><p>Who you are, what you’ve tried, what’s at stake. Better context, sharper answer.</p></div>
          <div><b>03</b><h3>Paste the address</h3><p>Checking a token or a wallet? Paste the contract or address, not the name. Names can be copied.</p></div>
          <div><b>04</b><h3>Turn on web search</h3><p>For anything recent, switch on web search so every claim comes with a link.</p></div>
          <div><b>05</b><h3>Push back</h3><p>“Are you sure?” and “what would change your mind?” are the best follow-ups there are.</p></div>
        </div>
      </section>
      <section className="pg-sec" data-shard="0.88 0.5 0.2 0.4 0.9 0.8 0">
        <div className="pg-head"><span className="ek-eyebrow">Before you start</span><Rise lines={["Questions,", <em key="e">answered.</em>]} /></div>
        <div className="pg-faq">
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      </section>
      <PageAsk id="guide" />
    </EdgeShell>
  );
}

/* ============================== PRIVACY ============================== */
const POLICY: [string, React.ReactNode[]][] = [
  ["History is off by default.", [
    "Until you turn on saving, Calypto keeps conversation text in the current page’s memory. It is cleared when the page reloads, closes, or you clear the session. The chat endpoint does not write prompts or answers to the conversation database. You can export a conversation manually.",
    "We store access metadata: a random visitor identifier in a signed, secure cookie, prompt counts, keyed hashes of network IP addresses for abuse limits, wallet verification challenges, and a verified wallet address. Raw IP addresses are not stored in Calypto’s application database. These records enforce access and prevent signature replay. Usage counts are separate from chat history. Wallet verification lasts up to 24 hours; challenges expire after five minutes. Expiry prevents use of a record; it does not promise that all expired metadata has been physically erased.",
  ]],
  ["Optional history is server-stored.", [
    "When you enable saving, Calypto stores conversation text, mode, source links, title, and update time. Saved chats are linked to your browser session and verified wallet. Only that session with the corresponding verified wallet can retrieve them through the app. Connecting a different wallet switches the history you can access. Clearing cookies or using another browser does not restore saved history automatically; export chats you want to keep.",
    "You can delete individual conversations or all saved conversations for the current wallet. Delete operations remove the live database records. Infrastructure backups and provider retention may follow separate schedules. Turning saving off does not delete chats that were already saved. Uploaded PDF files are not included in saved history.",
  ]],
  ["You’re talking to Calypto.", [
    "The assistant and AI experience are presented as Calypto. Your prompts and conversation context are securely processed through Calypto’s infrastructure to generate responses. Calypto prioritizes privacy, confidentiality, and user control. Conversations are not saved by Calypto unless you explicitly enable saving. External processing services may handle requests, and inference is not end-to-end encrypted.",
    "Your privacy and security matter to Calypto. Never share wallet seed phrases, private keys, or highly sensitive credentials. Calypto is designed to minimize data retention and give you control over saved conversations. External processing services may have independent privacy and retention policies.",
  ]],
  ["Private AI research and web searches.", [
    "Calypto provides private, uncensored AI-powered research through its integrated search infrastructure. Your questions are processed to generate relevant responses without saving conversation history unless you explicitly enable it. Web searches may interact with external search services and websites.", 
    "Calypto prioritizes user privacy, minimal data retention, and control over conversation history. External search and processing services may have their own privacy and retention policies."
  ]],
  ["Public wallets stay public.", [
    "Wallet research reads Robinhood Chain through server-side RPC and blockchain data providers. Holder checks read your token balance and obtain market estimates from DEX Screener. Those providers receive the wallet or token addresses needed for the request. Public activity can identify patterns and link an address to other public information.",
    "Verification uses a time-limited, one-time ownership signature. It does not request transfers or token approvals. No wallet transactions are available in Calypto. The displayed holdings snapshot may cover only part of an address’s activity; coverage and lookup times are provided with the data.",
  ]],
  ["Privacy is built into Calypto.", [
    "Calypto delivers private, uncensored AI interactions through a securely integrated private AI model. Conversation history is disabled by default, and saved conversations remain under user control. Calypto does not require an account, and deleting saved history removes the corresponding records from Calypto’s database. External infrastructure may independently retain connection metadata or security logs according to its policies.", 
    "A secure, HTTP-only visitor cookie remembers free-access usage for up to one year. Shared network limits help prevent abuse, and expired usage counters are periodically removed. Session preferences remain in browser memory, while the landing-page entrance flag is stored in session storage. Calypto does not add advertising trackers."
  ]],
  ["Research supports your judgment.", [
    "AI answers and third-party data can be inaccurate or incomplete. Review primary sources and actual onchain evidence. Holding $CALYPTO provides access under the stated usage policy; it does not guarantee returns or outcomes.",
  ]],
];
export function PrivacyPage() {
  return (
    <EdgeShell active="/veil">
      <PageHero
        path="/privacy" ghost="PRIVACY" eyebrow="Behind the veil · privacy & data" shard="0.8 0.4 0.34 0.06 1 1 0"
        lines={["Your control.", <em key="e">The full picture.</em>]}
        lede="Privacy is useful when you know exactly what it means. Here is how Calypto is designed to handle your information."
      />
      <section className="pg-sec" data-shard="0.92 0.55 0.14 0.8 0.5 1 0">
        <div className="pg-policy">
          {POLICY.map(([h, ps], i) => (
            <article key={h}>
              <span className="pg-row-n">{String(i + 1).padStart(2, "0")}</span>
              <div><h2>{h}</h2>{ps.map((p, j) => <p key={j}>{p}</p>)}</div>
            </article>
          ))}
        </div>
        <div className="ek-btns" style={{ marginTop: 48 }}><a className="ek-btn p" href="/app">Enter with clarity <ArrowRight size={16} /></a></div>
      </section>
    </EdgeShell>
  );
}

/* ============================== 404 ============================== */
export function NotFoundPage() {
  return (
    <EdgeShell>
      <section className="pg-hero pg-404" data-shard="0.5 0.36 0.5 0.75 1 1.2 0">
        <div className="pg-ghost" aria-hidden="true"><span>404</span></div>
        <span className="ek-eyebrow">Error 404 · not found</span>
        <Rise as="h1" className="pg-title" lines={["This page", <em key="e">is concealed.</em>]} />
        <p className="pg-lede">Either it never existed, or it’s hidden better than most. Ask what you came for instead.</p>
        <PromptBox id="404" />
        <div className="ek-btns"><a className="ek-btn g" href="/">Back to the surface <ArrowRight size={16} /></a></div>
      </section>
    </EdgeShell>
  );
}
