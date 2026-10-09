"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowDown } from "lucide-react";
import EyeEntrance, { ENTRANCE_MS } from "./eye-entrance";
import { EdgeShell, Decode, Marquee, ScrollWords, TiltCard, Rise, PromptBox, TierLadder, useInView, reduceMotion, setMood, type Mood } from "./edge-kit";

/* ---------- hero: one poster. The glass C sits behind the headline, scattered until you start typing ---------- */
function Hero() {
  return (
    <section className="hx" data-shard="0.5 0.43 0.66 0.22 1 0 0">
      <div className="hx-top">
        <div className="hx-def">
          <span className="ek-eyebrow">Kalyptō <em>/ka·lýp·tō/</em></span>
          <span>verb, Greek. To conceal. To cover. To hide from view.</span>
        </div>
        <div className="hx-chips"><span className="ek-chip hot">Uncensored</span><span className="ek-chip">Private</span><span className="ek-chip">No logs by default</span></div>
      </div>
      <div className="hx-center">
        <Rise as="h1" className="hx-title" lines={["Some questions", "are hidden."]} />
        <p className="hx-anyway"><em>Ask them anyway.</em></p>
      </div>
      <div className="hx-bottom">
        <p className="hx-lede">A private, uncensored AI. No filter between you and the answer. Nothing kept unless you keep it.</p>
        <PromptBox id="hero" />
        <a className="ek-link hm-diff" href="#difference">or see the difference first <ArrowDown size={14} /></a>
      </div>
      <span className="hx-coord hx-coord-l" aria-hidden="true">N 00°00′ · CONCEALED</span>
      <span className="hx-coord hx-coord-r" aria-hidden="true">NO FILTER · NO RECORD · NO MASTER</span>
    </section>
  );
}

/* ---------- intercepted: a live-feeling feed of example prompts ---------- */
const FEED: [string, string][] = [
  ["roast my portfolio. don’t be nice.", "You bought the top three times and sold the bottom twice. That’s not a strategy, that’s a pattern."],
  ["is this airdrop a scam?", "The claim page asks you to approve unlimited spending. Real airdrops don’t need that. Walk away."],
  ["explain MEV like I’m five", "Someone sees your order in line, cuts ahead, buys first, and sells it back to you a little higher."],
  ["how do I disappear from the internet?", "Start with data brokers: request removal from the big ones, then lock down old accounts one by one."],
  ["write my resignation. the honest version.", "I’m leaving because the job stopped being worth what it costs me. Thanks for the lessons, mostly the hard ones."],
  ["what’s my wallet actually worth?", "About $8,050 across three tokens. 23% of it sits in one coin with thin liquidity. That’s your real risk."],
  ["which conspiracy theories turned out true?", "A few did: MKUltra, the Tuskegee study, mass surveillance programs. Most didn’t. Here’s how to tell the difference."],
  ["tell me what this contract is hiding", "Clause 9 lets them end it without notice. Clause 14 makes you pay their legal costs either way."],
];
function Intercepted() {
  const [ref, seen] = useInView<HTMLDivElement>(0.25, false);
  const [lines, setLines] = useState<{ who: string; text: string; me: boolean; id: number; wait?: boolean }[]>([]);
  const visible = useRef(false);
  const phase = useRef<Mood>("idle");
  useEffect(() => { visible.current = seen; }, [seen]);
  // the C only reacts to the feed while you can see it
  useEffect(() => { setMood(seen ? phase.current : "idle", "feed", ref.current); }, [seen, ref]);
  useEffect(() => () => setMood("idle", "feed"), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced motion: show a static feed once, after mount
    if (reduceMotion()) { setLines(FEED.slice(0, 3).flatMap(([q, a], i) => [{ who: `anon_${(4096 + i * 977).toString(16)}`, text: q, me: true, id: i * 2 }, { who: "calypto", text: a, me: false, id: i * 2 + 1 }])); return; }
    // One loop for the life of the page. It pauses while the feed is off screen
    // and resumes where it left off, so lines are never restarted or duplicated.
    let alive = true, uid = 0;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const step = async (ms: number) => { await sleep(ms); while (alive && !visible.current) await sleep(200); return alive; };
    const mood = (m: Mood) => { phase.current = m; if (visible.current) setMood(m, "feed", ref.current); };
    (async () => {
      for (let n = 0; alive; n++) {
        if (!(await step(0))) return;
        const [q, a] = FEED[n % FEED.length];
        const who = `anon_${((n * 7919 + 4099) % 65535).toString(16)}`;
        const idq = ++uid, ida = ++uid;
        mood("listen");
        setLines(l => [...l.slice(-5), { who, text: "", me: true, id: idq }]);
        for (let i = 1; i <= q.length; i++) { if (!(await step(28))) return; setLines(l => l.map(x => (x.id === idq ? { ...x, text: q.slice(0, i) } : x))); }
        mood("think");
        setLines(l => [...l.slice(-5), { who: "calypto", text: "", me: false, id: ida, wait: true }]);
        if (!(await step(1100))) return;
        mood("speak");
        const words = a.split(" ");
        for (let i = 1; i <= words.length; i++) { if (!(await step(55))) return; setLines(l => l.map(x => (x.id === ida ? { ...x, wait: false, text: words.slice(0, i).join(" ") } : x))); }
        mood("idle");
        if (!(await step(1600))) return;
      }
    })();
    return () => { alive = false; };
  }, [ref]);
  return (
    <section className="hm-intercept" id="intercepted" data-shard="0.2 0.72 0.15 0.22 1 0.6 0">
      <div className="hm-intercept-head">
        <span className="ek-eyebrow">Intercepted transmissions</span>
        <Rise lines={["What people ask", <em key="e">when nobody’s watching.</em>]} />
        <p>Examples of the questions other assistants dodge. On Calypto, nobody is reading over your shoulder.</p>
      </div>
      <div className="hm-term" ref={ref} aria-live="off">
        <div className="hm-term-bar"><i /><i /><i /><span>calypto://feed · examples</span><b>LIVE</b></div>
        <div className="hm-term-body">
          {lines.map(l => (
            <div key={l.id} className={`hm-line ${l.me ? "q" : "a"}`}><span className="who">{l.who} ›</span> {l.wait ? <span className="hm-think" aria-label="thinking"><i /><i /><i /></span> : l.text}{!l.wait && l === lines[lines.length - 1] && <span className="hm-caret" />}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- the difference: a red scanner redacts the hedging and types the real answer ---------- */
const SPOT = [
  { q: "Rate my startup idea. Be brutal.", hedge: "Every idea has potential! Here are some things to consider as you continue your journey.", answer: "The market is crowded and your edge is a logo. Win one niche first, or nobody will notice you." },
  { q: "What is this contract hiding?", hedge: "I’m not a lawyer and can’t provide legal advice. Please consult a qualified professional.", answer: "Clause 9 lets them end it without notice. Clause 14 makes you pay their legal costs either way." },
  { q: "How did last week’s exploit work?", hedge: "I’m not able to discuss hacking or security vulnerabilities.", answer: "The contract trusted one pool for its price. The attacker moved that pool, then borrowed against the fake price." },
];
function Difference() {
  const [ref, seen] = useInView<HTMLDivElement>(0.3);
  const [replay, setReplay] = useState<number[]>([0, 0, 0]);
  return (
    <section className="df" id="difference" data-shard="0.5 0.1 0.13 0.6 0.55 1 0" aria-label="Filtered answers compared with Calypto’s answers">
      <div className="df-head">
        <span className="ek-eyebrow">Same question. Two machines.</span>
        <Rise lines={["Other assistants hedge.", <em key="e">Calypto answers.</em>]} />
      </div>
      <div className={`df-grid ${seen ? "run" : ""}`} ref={ref}>
        {SPOT.map((n, i) => (
          <article key={n.q + replay[i]} className="df-card" style={{ ["--d" as string]: `${0.25 + i * 0.55}s` }}
            onMouseEnter={() => seen && setReplay(r => r.map((v, j) => (j === i ? v + 1 : v)))}>
            <header><span>Q.{String(i + 1).padStart(2, "0")}</span><b>{n.q}</b></header>
            <div className="df-row hedge"><span className="df-tag">Filtered AI</span><p><span className="df-ink">{n.hedge}</span></p></div>
            <div className="df-row answer"><span className="df-tag">Calypto</span><p>{n.answer}</p></div>
            <i className="df-scan" aria-hidden="true" />
          </article>
        ))}
      </div>
      <p className="df-note">Hover a card to run it again.</p>
    </section>
  );
}

/* ---------- abilities: a pinned strip that slides sideways as you scroll ---------- */
const ABILITIES = [
  { n: "01", key: "ASK_ANYTHING", href: "/app", body: "Any subject. No lectures, no hedging, no topic list. Half-formed questions welcome.", art: "chat" },
  { n: "02", key: "TOKEN_CHECK", href: "/app/token", body: "Paste a contract before you buy. Calypto checks contract information, holders and liquidity, and tells you what worries it.", art: "token" },
  { n: "03", key: "PORTFOLIO_X-RAY", href: "/app/wallet", body: "Paste any wallet. See the real allocation, where the risk sits and what would be hard to sell.", art: "wallet" },
  { n: "04", key: "WEB_SEARCH", href: "/app/research", body: "Switch it on when you need today’s facts. Every claim comes with a link you can check.", art: "web" },
];
/* the Ask tile runs a live conversation across subjects other assistants tiptoe around */
const ASK_LOOP = [
  { tag: "Money", q: "should I quit my job to trade full-time?", a: "Not yet. Trade six months on paper first and keep a year of savings. Most people who quit to trade stop within a year." },
  { tag: "History", q: "which conspiracy theories turned out true?", a: "A few did: MKUltra, the Tuskegee study, mass surveillance programs. Most didn’t. Here’s how to tell them apart." },
  { tag: "Code", q: "why is my app so slow?", a: "You query the database inside the loop. Fetch everything once, then loop. That one change will feel like a new app." },
  { tag: "Life", q: "be honest, am I the problem?", a: "From what you wrote, partly. You cancel plans last minute and call it being busy. Start there." },
  { tag: "Crypto", q: "is this airdrop a scam?", a: "The claim page asks to approve unlimited spending. Real airdrops don’t need that. Walk away." },
];
const TOPICS = ["Money", "Law", "Health", "Code", "History", "Love", "Politics", "Crypto", "Science", "Taboo", "Power", "Truth"];
function AskArt() {
  const [ref, seen] = useInView<HTMLDivElement>(0.2, false);
  const live = useRef(false);
  const [view, setView] = useState({ n: 0, q: "", a: "", phase: "q" as "q" | "think" | "a" | "hold" });
  useEffect(() => { live.current = seen; }, [seen]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced motion: show one finished exchange
    if (reduceMotion()) { setView({ n: 0, q: ASK_LOOP[0].q, a: ASK_LOOP[0].a, phase: "hold" }); return; }
    let alive = true;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const step = async (ms: number) => { await sleep(ms); while (alive && !live.current) await sleep(250); return alive; };
    (async () => {
      for (let n = 0; alive; n = (n + 1) % ASK_LOOP.length) {
        const { q, a } = ASK_LOOP[n];
        for (let i = 0; i <= q.length; i++) { if (!(await step(i ? 32 : 200))) return; setView({ n, q: q.slice(0, i), a: "", phase: "q" }); }
        if (!(await step(250))) return; setView({ n, q, a: "", phase: "think" });
        if (!(await step(850))) return;
        const words = a.split(" ");
        for (let i = 1; i <= words.length; i++) { if (!(await step(48))) return; setView({ n, q, a: words.slice(0, i).join(" "), phase: "a" }); }
        if (!(await step(2400))) return; setView({ n, q, a, phase: "hold" });
      }
    })();
    return () => { alive = false; };
  }, []);
  const cur = ASK_LOOP[view.n];
  return (
    <div className="art ask" ref={ref}>
      <div className="ask-topics" aria-hidden="true">
        {TOPICS.map(t => <span key={t} className={t === cur.tag ? "on" : ""}>{t}</span>)}
      </div>
      <div className="ask-chat" aria-hidden="true">
        <div className="ask-q"><em>anon</em>{view.q}{view.phase === "q" && <i className="ask-caret" />}</div>
        {view.phase === "think" && <div className="ask-a thinking"><em>calypto</em><span className="hm-think"><i /><i /><i /></span></div>}
        {(view.phase === "a" || view.phase === "hold") && <div className="ask-a"><em>calypto</em>{view.a}</div>}
      </div>
      <div className="ask-foot" aria-hidden="true"><span>No topic list</span><span>No lectures</span><span>No record</span></div>
    </div>
  );
}
function AbilityArt({ kind }: { kind: string }) {
  if (kind === "chat") return <AskArt />;
  if (kind === "web") return <div className="art web">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} style={{ ["--i" as string]: i }} />)}</div>;
  if (kind === "token") return <div className="art token">{[["Liquidity", "bad", "$8.2K"], ["Top 10", "warn", "41%"], ["Contract", "good", "Verified"], ["Owner", "warn", "Active"]].map(([l, t, v]) => <span key={l} className={t}><em>{l}</em><b>{v}</b></span>)}</div>;
  return <div className="art wallet">{[62, 23, 15].map((h, i) => <i key={i} style={{ ["--h" as string]: `${h}%` }} />)}</div>;
}
function Abilities() {
  const grid = useRef<HTMLDivElement>(null);
  const onMove = (e: { target: EventTarget; clientX: number; clientY: number }) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>(".bx-tile");
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty("--mx", `${e.clientX - r.left}px`); t.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <section className="bx" data-shard="0.9 0.16 0.13 0.35 0.9 1.2 0">
      <div className="bx-head">
        <span className="ek-eyebrow">One mind, every subject</span>
        <Rise lines={["Ask anything.", <em key="e">Bring anything.</em>]} />
        <p>Calypto is a general AI first. Token checks, portfolio x-rays and web search are tools it reaches for when you need them.</p>
      </div>
      <div className="bx-grid" ref={grid} onPointerMove={onMove}>
        {ABILITIES.map((a, i) => (
          <a key={a.key} href={a.href} className={`bx-tile t${i}`} data-cursor="OPEN">
            <span className="bx-n">{a.n}</span>
            <AbilityArt kind={a.art} />
            <div className="bx-copy"><Decode as="h3" text={a.key} /><p>{a.body}</p></div>
            <span className="bx-go">Open <ArrowRight size={14} /></span>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------- $CALYPTO: the page floods red; the C turns black ---------- */
function Token() {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // flood only while the section crosses the middle of the screen, whatever the screen height
    const io = new IntersectionObserver(es => {
      const v = es[0].isIntersecting;
      setOn(v);
      document.documentElement.classList.toggle("ek-flooded", v);
    }, { rootMargin: "-42% 0px -42% 0px" });
    io.observe(el);
    return () => { io.disconnect(); document.documentElement.classList.remove("ek-flooded"); };
  }, []);
  return (
    <section className={`hm-token ${on ? "on" : ""}`} ref={ref} data-shard="0.78 0.5 0.5 0.1 1 0.6 1">
      <div className="hm-token-inner">
        <div className="hm-token-copy">
          <span className="ek-eyebrow">$CALYPTO · the inner edge</span>
          <Rise lines={["Hold", <em key="e">the edge.</em>]} className="hm-token-title" />
          <p>Anyone can start asking. Hold $CALYPTO and Calypto opens further: the more you hold, the more you can ask, every day. Your wallet is only read, never moved.</p>
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
          <a className="ek-btn p" href="/access" data-cursor="CHECK">See the tiers <ArrowRight size={16} /></a>
        </TiltCard>
      </div>
    </section>
  );
}

/* ---------- page ---------- */
export default function EdgeHome() {
  const [entrance, setEntrance] = useState<"awaiting" | "revealing" | "entered">("awaiting");
  const skip = useCallback(() => { setEntrance("entered"); try { sessionStorage.setItem("calypto-entered", "1"); } catch {} }, []);
  const reveal = useCallback(() => setEntrance(c => (c === "awaiting" ? "revealing" : c)), []);
  /* eslint-disable react-hooks/set-state-in-effect -- reduced motion and sessionStorage are only known in the browser, after mount */
  useEffect(() => {
    if (reduceMotion()) { skip(); return; }
    try { if (sessionStorage.getItem("calypto-entered")) { setEntrance("entered"); return; } } catch {}
    const safety = setTimeout(skip, ENTRANCE_MS + 2000);
    return () => clearTimeout(safety);
  }, [skip]);
  /* eslint-enable react-hooks/set-state-in-effect */
  // no scrolling the page hidden behind the entrance
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("ek-intro", entrance !== "entered");
    return () => root.classList.remove("ek-intro");
  }, [entrance]);
  return (
    <>
      {entrance !== "entered" && (
        <div className="eye-entrance" role="dialog" aria-label="Calypto entrance">
          <EyeEntrance onDone={skip} onReveal={reveal} />
          <button className="skip-intro" onClick={skip}>Skip entrance <ArrowRight size={14} /></button>
        </div>
      )}
      <EdgeShell active="/">
        <Hero />
        <div className="hm-cross" aria-hidden="true">
          <Marquee items={["Uncensored", "Private", "No filter", "No record", "Ask anyway"]} speed={28} />
          <Marquee items={["Kalyptō", "To conceal", "$CALYPTO", "Robinhood Chain", "Some questions are hidden"]} reverse speed={34} className="alt" />
        </div>
        <Intercepted />
        <section className="hm-manifesto" data-shard="0.5 0.5 0.95 1 0.28 0.3 0">
          <span className="ek-eyebrow">The terms</span>
          <ScrollWords text="We don’t *filter you. We don’t *watch you. We don’t *keep you. Ask what you came to ask, and leave *nothing behind." />
        </section>
        <Difference />
        <Abilities />
        <section className="hm-veil" data-shard="0.86 0.5 0.22 0.35 1 1 0">
          <div className="hm-veil-inner">
            <span className="ek-eyebrow">What you ask stays yours</span>
            <Rise lines={["Concealed", <em key="e">by default.</em>]} />
            <ul>
              <li><b>History starts off.</b> Nothing is saved unless you choose to save it.</li>
              <li><b>Delete means delete.</b> One conversation or all of them, any time.</li>
              <li><b>Read-only wallets.</b> Connecting proves ownership. It never moves funds.</li>
            </ul>
            <a className="ek-link" href="/veil">How the veil works <ArrowRight size={14} /></a>
          </div>
        </section>
        <Token />
        <section className="hm-final" data-shard="0.5 0.3 0.32 0.12 1 0.8 0">
          <div className="hm-ask"><span>ASK.</span><small>No wallet needed to start.</small></div>
          <PromptBox id="final" compact />
        </section>
      </EdgeShell>
    </>
  );
}
