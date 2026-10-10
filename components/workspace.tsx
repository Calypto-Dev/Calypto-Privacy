"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- plain links on purpose: leaving the app is a full navigation through the page transition */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  ArrowLeft,
  Check,
  Copy,
  Download,
  EyeOff,
  FileText,
  Globe,
  Loader2,
  LockKeyhole,
  Menu,
  MessageSquare,
  ChartPie,
  ScanSearch,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Wallet,
  X,
  LogOut,
} from "lucide-react";
import { Brand, Mark } from "./brand";
import { Modal } from "./modal";
import { Stage, Transit, Rise, Cursor, setMood, nudge } from "./edge-kit";
import Unveil from "./unveil-text";
import HolderSeal from "./holder-seal";
type Mode = "chat" | "research" | "documents" | "wallet" | "token";
type UiMode = "chat" | "token" | "wallet";
type Fact = { label: string; value: string; tone?: "good" | "warn" | "bad" };
type Source = { title: string; url: string };
type Message = { role: "user" | "assistant"; content: string; sources?: Source[]; sig?: string; facts?: Fact[] | null };
type Status = {
  aiReady: boolean;
  tokenConfigured: boolean;
  sessionReady: boolean;
  wallet: string | null;
  trialLimitDisabled?: boolean;
  trialRemaining: number | null;
  dailyRemaining: number;
  tier?: string | null;
  dailyLimit?: number;
  rpcUrl?: string;
  explorerUrl?: string;
  holdHours?: number;
};
type Conversation = { id: string; title: string; mode: Mode; messages: Message[]; updated: number };
type Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, listener: (v: any) => void) => void;
  removeListener?: (event: string, listener: (v: any) => void) => void;
};
type WalletOption = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Provider;
};
const modes = [
  {
    id: "chat" as UiMode,
    label: "Ask anything",
    icon: MessageSquare,
    tag: "ASK ANYTHING",
    title: "What’s beneath",
    italic: "your next question?",
    desc: "Any subject, straight answers. Switch on web search when it needs today’s facts.",
    prompts: [
      "Be brutally honest about my idea",
      "Explain this like I’m smart but new to it",
      "Argue the other side of my opinion",
      "What happened in crypto this week?",
    ],
  },
  {
    id: "token" as UiMode,
    label: "Token check",
    icon: ScanSearch,
    tag: "BEFORE YOU BUY",
    title: "Look under",
    italic: "the hood first.",
    desc: "Paste a token contract. Calypto reads the contract, the holders, the liquidity and the trading, then tells you plainly what worries it.",
    prompts: [
      "Is this token a rug risk?",
      "Who controls the supply?",
      "Can I actually sell this if it pumps?",
      "What can the owner still change?",
    ],
  },
  {
    id: "wallet" as UiMode,
    label: "Portfolio x-ray",
    icon: ChartPie,
    tag: "PORTFOLIO X-RAY",
    title: "Your wallet.",
    italic: "No sugarcoating.",
    desc: "Paste any Robinhood Chain address. See what it holds, where the risk sits and what would be hard to sell.",
    prompts: [
      "Break down my holdings and allocation",
      "Where is my biggest risk?",
      "Which positions would be hard to exit?",
      "Roast this portfolio. Don’t be nice.",
    ],
  },
];
async function api<T = Record<string, any>>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch("/api/" + path, {
    ...options,
    headers: { "Content-Type": "application/json", "X-Calypto-Request": "1", ...options?.headers },
  });
  const d = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(d.error || "Request failed. Please retry.");
  return d;
}
function shorten(s: string) {
  return s.slice(0, 6) + "…" + s.slice(-4);
}
function safeUrl(s: string) {
  return /^https?:\/\//i.test(s) ? s : undefined;
}
function RichText({ text }: { text: string }) {
  // Render text as React nodes. Raw HTML is never interpreted.
  return (
    <div className="answer-content">
      {text.split("\n").map((line, i) => {
        const heading = /^(#{1,4})\s+(.+)$/.exec(line);
        const list = /^[-*]\s+(.+)$/.exec(line);
        const numbered = /^\d+[.)]\s+/.test(line);
        const content = heading ? heading[2] : list ? list[1] : line;
        const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|(?<![\w*])\*(?=\S)[^*\n]+?(?<=\S)\*(?![\w*])|(?<!\w)_(?=\S)[^_\n]+?(?<=\S)_(?!\w))/g);
        const nodes = parts.map((part, j) => {
          if (part.startsWith("**")) return <strong key={j}>{part.slice(2, -2)}</strong>;
          if (part.length > 2 && ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))))
            return <em key={j}>{part.slice(1, -1)}</em>;
          if (part.startsWith("`")) return <code key={j}>{part.slice(1, -1)}</code>;
          const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
          if (link)
            return (
              <a key={j} href={safeUrl(link[2])} target="_blank" rel="noopener noreferrer">
                {link[1]}
              </a>
            );
          return part;
        });
        if (heading) return <h4 key={i}>{nodes}</h4>;
        if (list)
          return (
            <p className="answer-list" key={i}>
              <span>•</span>
              {nodes}
            </p>
          );
        return (
          <p key={i} className={numbered ? "answer-numbered" : ""}>
            {nodes.length && content ? nodes : <br />}
          </p>
        );
      })}
    </div>
  );
}
export default function Workspace({ initialMode = "chat", initialWeb = false }: { initialMode?: Mode; initialWeb?: boolean }) {
  // research and documents are no longer separate modes: research is Ask with web search on
  const [mode, setMode] = useState<UiMode>(initialMode === "token" || initialMode === "wallet" ? initialMode : "chat");
  const [web, setWeb] = useState(initialWeb || initialMode === "research");
  const [status, setStatus] = useState<Status | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unveilMessage, setUnveilMessage] = useState<Message | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sidebar, setSidebar] = useState(false);
  const [modal, setModal] = useState<"wallet" | "settings" | "delete" | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Conversation[]>([]);
  const [thread, setThread] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<any>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const scrollEnd = useRef<HTMLDivElement>(null);
  const provider = useRef<Provider | null>(null);
  const sending = useRef(false);
  const sessionEpoch = useRef(0);
  const accountListener = useRef<((v: any) => void) | null>(null);
  const active = modes.find((m) => m.id === mode) ?? modes[0];
  const refresh = useCallback(async () => {
    try {
      const s = await api<Status>("status");
      setStatus(s);
      return s;
    } catch {
      setError("Your access status could not be loaded. Please refresh the page.");
    }
  }, []);
  const loadHistory = useCallback(async () => {
    const epoch = sessionEpoch.current;
    try {
      const d = await api<{ conversations: Conversation[] }>("history");
      if (epoch === sessionEpoch.current) setHistory(d.conversations);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const requested = q.get("mode");
    if (modes.some((x) => x.id === requested)) setMode(requested as UiMode);
    if (requested === "research") setWeb(true);
    if (location.pathname === "/app/documents") window.history.replaceState(null, "", "/app");
    if (q.get("connect")) setModal("wallet");
    const pre = q.get("q");
    if (pre) {
      // question typed on the public site: place it in the box, ready to send
      setDraft(pre.slice(0, 4000));
      // a pasted 0x address goes straight into the address field
      const found = /0x[0-9a-fA-F]{40}/.exec(pre);
      if (found) setAddress(found[0]);
      setTimeout(() => textarea.current?.focus(), 60);
    }
    void refresh();
    const discover = (e: Event) => {
      const detail = (e as CustomEvent<WalletOption>).detail;
      if (detail?.provider && detail?.info)
        setWallets((old) =>
          old.some((x) => x.info.uuid === detail.info.uuid) ? old : [...old, detail],
        );
    };
    window.addEventListener("eip6963:announceProvider", discover);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const fallback = (window as any).ethereum;
    if (fallback)
      setWallets((old) =>
        old.length
          ? old
          : [
              {
                info: {
                  uuid: "injected",
                  name: fallback.isMetaMask
                    ? "MetaMask"
                    : fallback.isCoinbaseWallet
                      ? "Coinbase Wallet"
                      : "Browser wallet",
                  icon: "",
                  rdns: "injected",
                },
                provider: fallback,
              },
            ],
      );
    return () => {
      window.removeEventListener("eip6963:announceProvider", discover);
      if (provider.current && accountListener.current)
        provider.current.removeListener?.("accountsChanged", accountListener.current);
    };
  }, [refresh]);
  useEffect(() => {
    if (!sidebar) return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebar(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [sidebar]);
  useEffect(() => {
    if (status?.wallet) void loadHistory();
  }, [status?.wallet, loadHistory]);
  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  function newThread(nextMode: UiMode = mode) {
    if (sending.current) return;
    setUnveilMessage(null);
    setMessages([]);
    setThread(null);
    setDraft("");
    if (nextMode !== mode) setAddress("");
    setError("");
    setMode(nextMode);
    setSidebar(false);
    window.history.replaceState(null, "", nextMode === "chat" ? "/app" : `/app/${nextMode}`);
  }
  async function saveThread(updated: Message[], id: string) {
    await api("history", {
      method: "POST",
      body: JSON.stringify({
        id,
        title: (updated.find((m) => m.role === "user")?.content || "Conversation").slice(0, 80),
        mode,
        messages: updated.slice(-30),
      }),
    });
    await loadHistory();
  }
  async function send() {
    if (sending.current || !draft.trim()) return;
    setError("");
    if (mode === "wallet" && !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setError("Enter a valid wallet address before analyzing it.");
      return;
    }
    if (mode === "token" && !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setError("Paste a valid token contract address before checking it.");
      return;
    }
    if (!status?.sessionReady) {
      setError("Your visitor session is still loading. Refresh if cookies are blocked.");
      return;
    }
    const epoch = sessionEpoch.current;
    sending.current = true;
    setUnveilMessage(null);
    setBusy(true);
    const prompt = draft.trim();
    const next = [...messages, { role: "user" as const, content: prompt }];
    setMessages(next);
    setDraft("");
    try {
      const data = await api("chat", {
        method: "POST",
        body: JSON.stringify({
          mode: mode === "chat" && web ? "research" : mode,
          messages: next.slice(-15),
          address: mode === "wallet" || mode === "token" ? address : undefined,
        }),
      });
      if (epoch !== sessionEpoch.current) {
        setNotice("Wallet changed. The answer was not added to saved history.");
        return;
      }
      const answer: Message = { role: "assistant", content: data.text, sources: data.sources, sig: data.sig, facts: Array.isArray(data.facts) ? data.facts : null };
      const updated = [...next, answer];
      setMessages(updated);
      setUnveilMessage(answer);
      const id = thread || crypto.randomUUID();
      setThread(id);
      if (saving) {
        try {
          await saveThread(updated, id);
        } catch (e) {
          setError("Answer received, but it could not be saved: " + (e as Error).message);
        }
      }
      void refresh();
    } catch (e) {
      if (epoch === sessionEpoch.current) {
        setMessages(messages);
        setDraft(prompt);
        setError((e as Error).message);
      }
    } finally {
      sending.current = false;
      setBusy(false);
      textarea.current?.focus();
    }
  }
  async function connect(option: WalletOption) {
    if (connecting || sending.current) return;
    setConnecting(true);
    setError("");
    try {
      const p = option.provider;
      const accounts = await p.request({ method: "eth_requestAccounts" });
      if (!accounts?.[0]) throw new Error("No wallet account was selected.");
      if (provider.current && accountListener.current)
        provider.current.removeListener?.("accountsChanged", accountListener.current);
      provider.current = p;
      setConnected(accounts[0]);
      const listener = () => {
        sessionEpoch.current++;
        setConnected(null);
        setSaving(false);
        setHistory([]);
        setMessages([]);
        setUnveilMessage(null);
        setThread(null);
        setHoldings(null);
        void api("wallet", { method: "DELETE" })
          .then(refresh)
          .catch(() => setError("Reconnect to verify the new account."));
      };
      accountListener.current = listener;
      p.on?.("accountsChanged", listener);
      if (!status?.sessionReady) {
        setNotice("Your visitor session is still loading. Refresh and connect again.");
        return;
      }
      const chainId = await p.request({ method: "eth_chainId" });
      if (Number(chainId) !== 4663) {
        try {
          await p.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x1237" }],
          });
        } catch (e) {
          if ((e as any).code !== 4902) throw e;
          await p.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x1237",
                chainName: "Robinhood Chain",
                rpcUrls: [status?.rpcUrl || "https://rpc.mainnet.chain.robinhood.com"],
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                blockExplorerUrls: [status?.explorerUrl || "https://robinhoodchain.blockscout.com"],
              },
            ],
          });
        }
      }
      const challenge = await api("wallet/challenge", {
        method: "POST",
        body: JSON.stringify({ address: accounts[0] }),
      });
      const hex =
        "0x" +
        Array.from(new TextEncoder().encode(challenge.message))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      const signature = await p.request({ method: "personal_sign", params: [hex, accounts[0]] });
      const d = await api("wallet/verify", {
        method: "POST",
        body: JSON.stringify({ address: accounts[0], signature }),
      });
      sessionEpoch.current++;
      setHoldings(d.holdings);
      setHistory([]);
      setSaving(false);
      setMessages([]);
      setUnveilMessage(null);
      setThread(null);
      setNotice("Wallet ownership verified.");
      await refresh();
    } catch (e) {
      const code = (e as any).code;
      setError(
        code === 4001
          ? "The wallet request was declined. You can try again whenever you’re ready."
          : (e as Error).message || "Your wallet could not connect.",
      );
    } finally {
      setConnecting(false);
    }
  }
  async function disconnect() {
    if (sending.current) return;
    try {
      sessionEpoch.current++;
      await api("wallet", { method: "DELETE" });
      setConnected(null);
      setHoldings(null);
      setSaving(false);
      setHistory([]);
      setMessages([]);
      setUnveilMessage(null);
      setThread(null);
      await refresh();
      setNotice("Wallet disconnected.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function checkAccess() {
    setConnecting(true);
    try {
      setHoldings(await api("access"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }
  async function toggleSaving() {
    if (saving) {
      setSaving(false);
      setNotice("History is off. Existing saved chats remain until deleted.");
      return;
    }
    if (!status?.wallet) {
      setModal("wallet");
      setError("Verify wallet ownership before enabling saved history.");
      return;
    }
    setSaving(true);
    if (messages.length) {
      try {
        const id = thread || crypto.randomUUID();
        await saveThread(messages, id);
        setThread(id);
      } catch (e) {
        setSaving(false);
        setError((e as Error).message);
      }
    }
  }
  function exportChat() {
    if (!messages.length) {
      setNotice("Start a conversation before exporting.");
      return;
    }
    const content = `# Calypto — ${active.label}\n\n${messages.map((m) => `## ${m.role === "user" ? "You" : "Calypto"}\n\n${m.content}\n${m.sources?.length ? "\nSources:\n" + m.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n") : ""}`).join("\n\n")}`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calypto-conversation.md";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Conversation exported.");
  }
  async function deleteOne(id: string) {
    try {
      await api("history?id=" + encodeURIComponent(id), { method: "DELETE" });
      if (id === thread) newThread();
      await loadHistory();
      setNotice("Saved conversation deleted.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function deleteAll() {
    try {
      await api("history", { method: "DELETE" });
      setHistory([]);
      newThread();
      setModal("settings");
      setNotice("All saved conversations deleted.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const wallet = status?.wallet || connected;
  // ---- the C as Calypto's presence in the chamber ----
  const presence = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const [shard, setShard] = useState("0.92 0.14 0.08 0 0.9 0.3 0");
  useEffect(() => {
    const place = () => {
      const el = presence.current;
      if (!el || messages.length) {
        // in a conversation it steps back to the corner and watches
        // wide screens have a free margin beside the thread; otherwise it hangs faint behind the conversation
        setShard(innerWidth >= 1240 ? "0.92 0.2 0.09 0 0.95 0.3 0" : `0.5 0.42 0.42 0.45 ${busy ? 0.42 : 0.16} 0.25 0`);
        return;
      }
      const r = el.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      const size = Math.max(0.1, Math.min(0.36, (r.height * 0.72) / (0.85 * Math.min(W, H))));
      setShard(`${((r.left + r.width / 2) / W).toFixed(3)} ${((r.top + r.height * 0.44) / H).toFixed(3)} ${size.toFixed(3)} 0.16 1 0.5 0`);
    };
    place();
    const ro = new ResizeObserver(place);
    if (presence.current) ro.observe(presence.current);
    addEventListener("resize", place);
    return () => { ro.disconnect(); removeEventListener("resize", place); };
  }, [messages.length, mode, error, busy]);
  // busy → it thinks; a fresh answer → it speaks for a moment
  useEffect(() => { setMood(busy ? "think" : "idle", "chamber-busy", busy ? composerRef.current : null); }, [busy]);
  useEffect(() => {
    if (!unveilMessage) return;
    setMood("speak", "chamber-speak", presence.current);
    const t = setTimeout(() => setMood("idle", "chamber-speak"), 2600);
    return () => { clearTimeout(t); setMood("idle", "chamber-speak"); };
  }, [unveilMessage]);
  useEffect(() => () => { setMood("idle", "chamber-busy"); setMood("idle", "chamber-listen"); }, []);
  useEffect(() => {
    document.title = `${mode === "chat" && web ? "Ask with web search" : active.label} — Calypto`;
  }, [mode, web, active.label]);
  const modeNo = ["I", "II", "III"][Math.max(0, modes.findIndex((m) => m.id === mode))];
  return (
    <div className={`ws ws-mode-${mode}`}>
      <Stage />
      <div className="ws-shard" data-shard={shard} aria-hidden="true" />
      <Transit />
      <Cursor />
      <div className="ws-rail">
        <a className="ws-rail-brand" href="/" aria-label="Calypto home">
          <Mark size={30} />
        </a>
        <nav aria-label="Workspace modes">
          {modes.map((m) => (
            <button
              key={m.id}
              className={mode === m.id ? "on" : ""}
              aria-label={m.label}
              aria-current={mode === m.id ? "page" : undefined}
              data-tip={m.label}
              onClick={() => newThread(m.id)}
              disabled={busy}
            >
              <m.icon size={19} />
            </button>
          ))}
        </nav>
        <button className="ws-rail-archive" aria-label="Open conversation archive" data-tip="Archive" onClick={() => setSidebar(true)}>
          <FileText size={18} />
        </button>
        <div className="ws-rail-bottom">
          <button aria-label="Privacy & settings" data-tip="Privacy & settings" onClick={() => setModal("settings")}>
            <Settings size={18} />
          </button>
          <a href="/guide" aria-label="Field guide" data-tip="Field guide">
            <Search size={18} />
          </a>
          <a href="/" aria-label="Back to Calypto" data-tip="Back to Calypto">
            <ArrowLeft size={18} />
          </a>
        </div>
      </div>
      <aside
        inert={!sidebar}
        aria-hidden={!sidebar}
        aria-label="Conversation archive"
        className={`ws-drawer ${sidebar ? "open" : ""}`}
      >
        <div className="ws-drawer-top">
          <Brand />
          <button className="ws-icon" onClick={() => setSidebar(false)} aria-label="Close archive">
            <X size={18} />
          </button>
        </div>
        <button className="ws-new" onClick={() => newThread()} disabled={busy}>
          <Plus size={16} />
          New conversation
        </button>
        <span className="ws-label">Modes</span>
        <nav className="ws-drawer-modes">
          {modes.map((m) => (
            <button key={m.id} className={mode === m.id ? "on" : ""} onClick={() => newThread(m.id)} disabled={busy}>
              <m.icon size={16} />
              {m.label}
            </button>
          ))}
        </nav>
        <div className="ws-label ws-label-row">
          <span>Saved conversations</span>
          <LockKeyhole size={12} />
        </div>
        {history.length > 0 && (
          <div className="ws-find">
            <Search size={13} />
            <input
              aria-label="Search saved conversations"
              placeholder="Find a conversation"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </div>
        )}
        <div className="ws-saved">
          {history
            .filter((h) => h.title.toLowerCase().includes(historySearch.toLowerCase()))
            .map((h) => (
              <div className={thread === h.id ? "ws-saved-item on" : "ws-saved-item"} key={h.id}>
                <button
                  disabled={busy}
                  onClick={() => {
                    setThread(h.id);
                    setUnveilMessage(null);
                    setMode(h.mode === "token" || h.mode === "wallet" ? h.mode : "chat");
                    if (h.mode === "research") setWeb(true);
                    setMessages(h.messages);
                    setAddress("");
                    setDraft("");
                    setError("");
                    setSidebar(false);
                  }}
                >
                  {h.title}
                </button>
                <button className="ws-icon" aria-label={`Delete ${h.title}`} disabled={busy} onClick={() => void deleteOne(h.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          {!history.length && (
            <div className="ws-empty">
              <EyeOff size={18} />
              <p>Nothing saved. History is off by default, so this stays empty unless you choose otherwise.</p>
              <button onClick={() => setModal("settings")}>
                Manage privacy <ArrowUpRight size={12} />
              </button>
            </div>
          )}
        </div>
        <div className="ws-drawer-bottom">
          <div className="ws-access">
            {status?.trialLimitDisabled ? (
              <>
                <span>Your access</span>
                <strong>Free access for now</strong>
                <p>The three-prompt limit is temporarily paused. Daily capacity and abuse protections still apply.</p>
              </>
            ) : status?.trialRemaining === 0 && status?.tier ? (
              <>
                <span>Holder tier</span>
                <strong>{status.tier}</strong>
                <p>{status.dailyRemaining} {status.dailyRemaining === 1 ? "prompt" : "prompts"} left today. Hold more $CALYPTO to move up.</p>
              </>
            ) : status?.trialRemaining === 0 ? (
              <>
                <span>Free access used</span>
                <strong>{status.tokenConfigured ? "Hold to continue" : "$CALYPTO coming soon"}</strong>
                <p>{status.tokenConfigured ? "Tiers start at $50 of $CALYPTO. The more you hold, the more you can ask." : "Your three free prompts are used. Holder access will be available after launch."}</p>
              </>
            ) : (
              <>
                <span>Your access</span>
                <strong>Free to start</strong>
                <p>{status?.tokenConfigured === false ? "$CALYPTO coming soon. Try your three free prompts now; holder tiers will open after launch." : "Hold $CALYPTO for more usage. Tiers from $50."}</p>
              </>
            )}
            <button onClick={() => setModal("wallet")}>
              {status?.tokenConfigured === false ? status.wallet ? "View wallet" : "Connect wallet" : status?.tier ? "View your tier" : "Check your tier"} <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="ws-drawer-link" onClick={() => setModal("settings")}>
            <Settings size={15} /> Privacy & settings
          </button>
          <a className="ws-drawer-link" href="/">
            <ArrowLeft size={15} /> Back to Calypto
          </a>
        </div>
      </aside>
      {sidebar && <button className="ws-scrim" aria-label="Close archive" onClick={() => setSidebar(false)} />}
      <div className="ws-main">
        <header className="ws-head">
          <div className="ws-head-l">
            <button className="ws-icon ws-menu" aria-label="Open navigation" onClick={() => setSidebar(true)}>
              <Menu size={19} />
            </button>
            <a className="ws-word" href="/">
              calypto<span>.</span>
            </a>
            <span className="ws-crumb">
              <span>Chamber {modeNo}</span>
              <b>{active.label}</b>
            </span>
          </div>
          <div className="ws-head-r">
            <button className={`ws-pill ${saving ? "on" : ""}`} onClick={() => setModal("settings")}>
              {saving ? <ShieldCheck size={13} /> : <EyeOff size={13} />}
              <span>{saving ? "History on" : "Session only"}</span>
            </button>
            <button
              className="ws-wallet"
              onClick={() => {
                setError("");
                setModal("wallet");
              }}
            >
              <Wallet size={15} />
              {wallet ? <span>{shorten(wallet)}</span> : <span><span className="ws-hide-xs">Connect </span>wallet</span>}
            </button>
          </div>
        </header>
        <div className="ws-scroll">
          {!messages.length && (
            <div className="ws-welcome" key={mode}>
              <div className="ws-presence" ref={presence} aria-hidden="true">
                <span className="ws-presence-tag">{modeNo} / {active.label}</span>
              </div>
              <div className="ws-welcome-copy">
                <span className="ws-eyebrow">{active.tag}</span>
                <Rise as="h1" className="ws-title" lines={[active.title, <em key="i">{active.italic}</em>]} />
                <p>{active.desc}</p>
              </div>
              {(mode === "wallet" || mode === "token") && (
                <div className="ws-addr">
                  <label htmlFor="analysis-address">{mode === "token" ? "Token contract address" : "Wallet address"}</label>
                  <div>
                    {mode === "token" ? <ScanSearch size={17} /> : <Wallet size={17} />}
                    <input
                      id="analysis-address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value.trim())}
                      placeholder="0x…"
                      spellCheck={false}
                      autoComplete="off"
                    />
                    {mode === "wallet" && wallet && <button onClick={() => setAddress(wallet)}>Use mine</button>}
                  </div>
                  <span>
                    {mode === "token"
                      ? "Robinhood Chain · reads the contract, holders and DEX pools · nothing is bought or sold"
                      : "Robinhood Chain · read-only · no transaction permissions"}
                  </span>
                </div>
              )}
              <div className="ws-doors">
                <span className="ws-label">Start with</span>
                <div className="ws-doors-grid">
                  {active.prompts.map((p, i) => (
                    <button
                      key={p}
                      data-cursor="ASK"
                      onClick={() => {
                        setDraft(p);
                        textarea.current?.focus();
                      }}
                    >
                      <span className="ws-door-n">0{i + 1}</span>
                      <span>{p}</span>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {messages.length > 0 && (
            <div className="ws-thread" aria-live="polite">
              {messages.map((m, i) => (
                <div className={`ws-msg ${m.role}`} key={i}>
                  <div className="ws-msg-who">
                    {m.role === "assistant" ? <Mark size={16} /> : null}
                    <span>
                      {m.role === "assistant" ? "Calypto" : "You"}
                      <i>{String(Math.floor(i / 2) + 1).padStart(2, "0")}</i>
                    </span>
                  </div>
                  <div className="ws-msg-body">
                    {m.role === "assistant" && !!m.facts?.length && (
                      <div className="ws-facts" aria-label="Key facts">
                        {m.facts.map((f) => (
                          <div key={f.label} className={`ws-fact ${f.tone || ""}`}>
                            <span>{f.label}</span>
                            <b>{f.value}</b>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.role === "assistant" && m === unveilMessage && i === messages.length - 1 ? (
                      <Unveil>
                        <RichText text={m.content} />
                      </Unveil>
                    ) : (
                      <RichText text={m.content} />
                    )}
                    {!!m.sources?.length && (
                      <div className="ws-sources">
                        <span>
                          <Globe size={12} /> Sources
                        </span>
                        {m.sources.map((s, j) => (
                          <a href={safeUrl(s.url)} target="_blank" rel="noopener noreferrer" key={s.url + j}>
                            <b>{j + 1}</b>
                            {s.title}
                            <ArrowUpRight size={12} />
                          </a>
                        ))}
                      </div>
                    )}
                    {m.role === "assistant" && (
                      <button
                        className="ws-copy"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(m.content);
                            setCopied(i);
                            setTimeout(() => setCopied(null), 2000);
                          } catch {
                            setNotice("Clipboard unavailable. Use export to save the conversation.");
                          }
                        }}
                      >
                        {copied === i ? <Check size={12} /> : <Copy size={12} />} {copied === i ? "Copied" : "Copy answer"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="ws-msg assistant ws-busy">
                  <div className="ws-msg-who">
                    <Mark size={16} />
                    <span>Calypto</span>
                  </div>
                  <div className="ws-msg-body ws-thinking">
                    <span className="ws-dots" aria-hidden="true"><i /><i /><i /></span>
                    {mode === "token"
                      ? "Checking the contract, holders and liquidity…"
                      : mode === "wallet"
                        ? "Reading the wallet on-chain…"
                        : web
                          ? "Searching the web…"
                          : "Bringing it into focus…"}
                  </div>
                </div>
              )}
              <div ref={scrollEnd} />
            </div>
          )}
        </div>
        <div className="ws-dock">
          {error && (
            <div className="ws-error" role="alert">
              <span>{error}</span>
              <button className="ws-icon" onClick={() => setError("")} aria-label="Dismiss error">
                <X size={14} />
              </button>
            </div>
          )}
          {messages.length > 0 && (mode === "wallet" || mode === "token") && (
            <div className="ws-attach">
              {mode === "token" ? <ScanSearch size={13} /> : <Wallet size={13} />}
              <input
                aria-label={mode === "token" ? "Token to check" : "Wallet to analyze"}
                placeholder="0x…"
                value={address}
                onChange={(e) => setAddress(e.target.value.trim())}
                spellCheck={false}
              />
            </div>
          )}
          <form
            ref={composerRef}
            className={`ws-composer ${busy ? "busy" : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <div className="ws-composer-cap">
              <i className="ws-dot" /> Your question, behind the veil
            </div>
            <textarea
              ref={textarea}
              aria-label="Your question"
              placeholder={
                mode === "token"
                  ? "What do you want to know about this token?"
                  : mode === "wallet"
                    ? "What would you like to know about this portfolio?"
                    : web
                      ? "Ask anything. Web search is on…"
                      : "Ask what’s on your mind…"
              }
              value={draft}
              maxLength={12000}
              onChange={(e) => {
                setDraft(e.target.value);
                nudge(0.4);
              }}
              onFocus={() => setMood("listen", "chamber-listen", composerRef.current)}
              onBlur={() => setMood("idle", "chamber-listen")}
              disabled={busy}
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="ws-tools">
              <div>
                {mode === "chat" ? (
                  <button
                    type="button"
                    className={`ws-chip ${web ? "on" : ""}`}
                    disabled={busy}
                    aria-pressed={web}
                    onClick={() => setWeb((v) => !v)}
                  >
                    <Globe size={13} />
                    Web search {web ? "on" : "off"}
                  </button>
                ) : (
                  <span className="ws-chip static">
                    {mode === "token" ? <ScanSearch size={13} /> : <ChartPie size={13} />}
                    {active.label}
                  </span>
                )}
                {messages.length > 0 && (
                  <button type="button" className="ws-icon" aria-label="Export conversation" data-tip="Export" onClick={exportChat}>
                    <Download size={15} />
                  </button>
                )}
              </div>
              <div>
                <span className="ws-hint">↵ to send · ⇧↵ new line</span>
                <button className="ws-send" data-cursor="SEND" aria-label="Send question" type="submit" disabled={busy || !draft.trim()}>
                  {busy ? <Loader2 className="ws-spin" size={18} /> : <ArrowUp size={19} />}
                </button>
              </div>
            </div>
          </form>
          <div className="ws-fine">
            <span>
              <LockKeyhole size={11} />
              {saving ? "History saved by choice" : "History off by default"}
            </span>
            <span>AI can make mistakes. Check sources before deciding.</span>
            <a href="/privacy">
              Privacy & data <ArrowUpRight size={11} />
            </a>
          </div>
        </div>
      </div>
      {notice && (
        <div className="ws-toast" role="status">
          <Check size={14} />
          {notice}
        </div>
      )}
      {modal === "wallet" && (
        <Modal title="Your key to Calypto." subtitle="Connect. Verify. Uncover." onClose={() => setModal(null)}>
          <div className="wm-safe">
            <ShieldCheck size={17} />
            <p>
              Ownership signature only.
              <br />
              No transfers. No approvals. No seed phrases.
            </p>
          </div>
          {wallet && (
            <div className="wm-connected">
              <span>Connected address</span>
              <strong>{shorten(wallet)}</strong>
              {status?.wallet && (
                <small>
                  <Check size={12} /> Ownership verified
                </small>
              )}
              <button className="ws-icon wm-out" onClick={() => void disconnect()} disabled={connecting || busy}>
                <LogOut size={14} />
                Disconnect
              </button>
            </div>
          )}
          {wallets.length > 0 ? (
            <div className="wm-options">
              {wallets.map((w) => (
                <button key={w.info.uuid} onClick={() => void connect(w)} disabled={connecting || busy}>
                  {w.info.icon && /^(data:image\/|https:\/\/)/.test(w.info.icon) ? <img src={w.info.icon} alt="" /> : <Wallet size={22} />}
                  <span>{w.info.name}</span>
                  {connecting ? <Loader2 size={15} className="ws-spin" /> : <ArrowUpRight size={16} />}
                </button>
              ))}
            </div>
          ) : (
            <div className="wm-none">
              <Wallet size={24} />
              <h4>No browser wallet detected.</h4>
              <p>Open Calypto in a wallet-enabled browser or install an EVM wallet extension, then refresh.</p>
              <div>
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">
                  MetaMask <ArrowUpRight size={12} />
                </a>
                <a href="https://www.coinbase.com/wallet" target="_blank" rel="noopener noreferrer">
                  Coinbase Wallet <ArrowUpRight size={12} />
                </a>
              </div>
            </div>
          )}
          {status?.wallet && (
            <button className="wm-btn" onClick={() => void checkAccess()} disabled={connecting}>
              Refresh holder access <ArrowUpRight size={15} />
            </button>
          )}
          {holdings && (
            <div className="wm-hold">
              <span>Holder access</span>
              <strong>
                {holdings.configured === false
                  ? "$CALYPTO coming soon"
                  : holdings.value === null
                  ? "Balance not verified"
                  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(holdings.value)}
              </strong>
              <p>{holdings.reason}</p>
              {holdings.value !== null && <small>Market estimate · checked {new Date(holdings.checkedAt).toLocaleTimeString()}</small>}
            </div>
          )}
          {holdings?.configured && status?.wallet && <HolderSeal wallet={status.wallet} valueUsd={holdings?.value ?? null} eligible={!!holdings?.eligible} />}
          {error && (
            <p className="wm-error" role="alert">
              {error}
            </p>
          )}
          <div className="wm-tiers" aria-label="Holder tiers">
            {[
              { name: "Shade", min: 50, level: 1 },
              { name: "Veil", min: 100, level: 2 },
              { name: "Eclipse", min: 150, level: 3 },
            ].map((t) => (
              <div key={t.name} className={`wm-tier ${holdings?.tier === t.name || status?.tier === t.name ? "on" : ""}`}>
                <b>{t.name}</b>
                <span>${t.min}+</span>
                <i aria-hidden="true">{[1, 2, 3].map((k) => <em key={k} className={k <= t.level ? "lit" : ""} />)}</i>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="Privacy, by choice." subtitle="You decide what stays behind the veil." onClose={() => setModal(null)}>
          <div className="wm-row">
            <div>
              <h4>Save chat history</h4>
              <p>Off by default. Enable saving only when you choose. Calypto keeps your conversations private, encrypted, and accessible only through your verified wallet.</p>
            </div>
            <button
              className={`wm-switch ${saving ? "on" : ""}`}
              role="switch"
              aria-checked={saving}
              aria-label="Save chat history"
              onClick={() => void toggleSaving()}
              disabled={busy}
            >
              <span />
            </button>
          </div>
          <div className="wm-row">
            <div>
              <h4>Export this conversation</h4>
              <p>Download the messages and sources as a Markdown file.</p>
            </div>
            <button className="ws-icon" onClick={exportChat} aria-label="Export current conversation">
              <Download size={18} />
            </button>
          </div>
          <div className="wm-row">
            <div>
              <h4>Clear this session</h4>
              <p>Remove the current messages from this browser session. Saved copies remain until deleted.</p>
            </div>
            <button
              className="ws-icon"
              disabled={busy}
              onClick={() => {
                newThread();
                setNotice("Session cleared.");
              }}
              aria-label="Clear current session"
            >
              <Trash2 size={18} />
            </button>
          </div>
          <div className="wm-row danger">
            <div>
              <h4>Delete all saved conversations</h4>
              <p>Permanently remove your saved chats for this verified wallet.</p>
            </div>
            <button
              className="ws-icon"
              disabled={!history.length || busy}
              onClick={() => setModal("delete")}
              aria-label="Delete all saved conversations"
            >
              <Trash2 size={18} />
            </button>
          </div>
          <a className="wm-note" href="/privacy">
            Prompts are securely processed through Calypto AI to deliver private, uncensored responses. Calypto protects conversation confidentiality, minimizes data retention, and gives you full control over your conversation history. Your interactions remain private, while infrastructure metadata is handled according to applicable security and retention policies.
            <span>
              Read the full data policy <ArrowUpRight size={13} />
            </span>
          </a>
        </Modal>
      )}
      {modal === "delete" && (
        <Modal
          title="Delete saved history?"
          subtitle="This permanently removes saved conversations for your current verified wallet."
          onClose={() => setModal("settings")}
        >
          <div className="wm-actions">
            <button className="wm-btn" onClick={() => setModal("settings")}>
              Keep history
            </button>
            <button className="wm-btn p" onClick={() => void deleteAll()}>
              Delete all <Trash2 size={15} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
