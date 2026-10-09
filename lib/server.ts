import { limitedJson, timingSafeEqual, validMutation } from "./security";
import { env } from "cloudflare:workers";
import { createPublicClient, defineChain, erc20Abi, formatUnits, http, isAddress } from "viem";
import { alchemyEndpoint, alchemyRpc, alchemyMetadata, blockscoutJson, indexedItems, finiteNumber, latestTransfers } from "./chain-data";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const runtime = () => env as Cloudflare.Env;

function numberSetting(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (value === undefined || value === "" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const settings = () => {
  const r = runtime();
  return {
    rpcUrl: r.RH_RPC_URL || alchemyEndpoint(r.ALCHEMY_API_KEY) || "https://rpc.mainnet.chain.robinhood.com",
    explorerUrl: (r.EXPLORER_URL || "https://robinhoodchain.blockscout.com").replace(/\/+$/, ""),
    dexChain: r.DEXSCREENER_CHAIN_ID || "robinhood",
    minLiquidityUsd: numberSetting(r.MIN_LIQUIDITY_USD, 1000, 1000, 1e12),
    maxMoveH1Pct: numberSetting(r.MAX_PRICE_MOVE_H1_PCT, 1000, 1, 1000),
    holdLookbackSeconds: numberSetting(r.HOLD_LOOKBACK_SECONDS, 0, 0, 7 * 86400),
    maxInputChars: numberSetting(r.MAX_INPUT_CHARS, 24000, 2000, 200000),
  };
};

/**
 * $CALYPTO holder tiers. The lowest tier is the minimum to hold.
 * Daily limits are prompts per wallet per UTC day.
 */
export const TIERS = [
  { min: 150, name: "Eclipse", daily: 30 },
  { min: 100, name: "Veil", daily: 20 },
  { min: 50, name: "Shade", daily: 10 },
] as const;
export const HOLDER_MIN_USD = TIERS[TIERS.length - 1].min;
export function tierFor(valueUsd: number | null | undefined) {
  if (valueUsd === null || valueUsd === undefined || !Number.isFinite(valueUsd)) return null;
  return TIERS.find((t) => valueUsd >= t.min) ?? null;
}

export function database() {
  const db = runtime().DB;
  if (!db) throw new AppError("Storage is unavailable. Please try again later.", 503);
  return db;
}

export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export function sameOrigin(req: Request) {
  if (!validMutation(req)) throw new AppError("Request origin is not allowed.", 403);
}
export async function body(req: Request, maxBytes = 6500000) {
  try { return await limitedJson(req, maxBytes); }
  catch (e) {
    if (e instanceof Error && "status" in e) throw new AppError(e.message, Number(e.status));
    throw e;
  }
}

export async function verifiedWallet(id: string) {
  const row = await database()
    .prepare("SELECT address FROM wallet_links WHERE user_id=? AND expires>?")
    .bind(id, Date.now())
    .first<{ address: string }>();
  return row?.address || null;
}

export const CHAIN_ID = 4663;

export function client() {
  const s = settings();
  const chain = defineChain({
    id: CHAIN_ID,
    name: "Robinhood Chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [s.rpcUrl] } },
    blockExplorers: { default: { name: "Robinhood Chain Explorer", url: s.explorerUrl } },
  });
  return createPublicClient({
    chain,
    transport: http(s.rpcUrl, { timeout: 12000, retryCount: 1, fetchOptions: { redirect: "manual" } }),
  });
}

/** Finds the block closest to `seconds` ago by sampling the recent block rate. */
async function blockSecondsAgo(rpc: ReturnType<typeof client>, seconds: number) {
  const latest = await rpc.getBlock();
  const span = latest.number > 1000n ? 1000n : latest.number;
  if (span === 0n) return latest.number;
  const sample = await rpc.getBlock({ blockNumber: latest.number - span });
  const elapsed = Number(latest.timestamp - sample.timestamp);
  const perSecond = elapsed > 0 ? Number(span) / elapsed : 1;
  const back = BigInt(Math.ceil(seconds * perSecond));
  return latest.number > back ? latest.number - back : 0n;
}

type Holdings = {
  configured: boolean;
  eligible: boolean;
  tier?: string | null;
  dailyLimit?: number;
  value: number | null;
  balance: string | null;
  price?: number;
  checkedAt?: string;
  reason: string;
};

export async function holdings(address: string): Promise<Holdings> {
  const token = runtime().CALYPTO_TOKEN_ADDRESS;
  if (!token || !isAddress(token))
    return {
      configured: false,
      eligible: false,
      value: null,
      balance: null,
      reason: "The $CALYPTO contract address has not been connected yet.",
    };
  const s = settings();
  const rpc = client();
  const holder = address as `0x${string}`;

  let pairs: any[];
  try {
    const r = await fetch(
      `https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(s.dexChain)}/${token}`,
      { signal: AbortSignal.timeout(12000), cache: "no-store" },
    );
    if (!r.ok) throw new Error();
    const data = await r.json();
    pairs = Array.isArray(data) ? data : [];
  } catch {
    return {
      configured: true,
      eligible: false,
      value: null,
      balance: null,
      reason: "The price provider is unavailable. Please retry.",
    };
  }
  const usable = pairs
    .filter(
      (p) =>
        p.chainId === s.dexChain &&
        p.baseToken?.address?.toLowerCase() === token.toLowerCase() &&
        Number(p.priceUsd) > 0 &&
        Number(p.liquidity?.usd) >= s.minLiquidityUsd,
    )
    .sort((a, b) => Number(b.liquidity.usd) - Number(a.liquidity.usd));
  if (!usable.length)
    return {
      configured: true,
      eligible: false,
      value: null,
      balance: null,
      reason: "No sufficiently liquid market price is available. Holder access cannot be verified.",
    };
  const top = usable[0];
  const moveH1 = Math.abs(Number(top.priceChange?.h1 ?? 0));
  if (!Number.isFinite(moveH1) || moveH1 > s.maxMoveH1Pct)
    return {
      configured: true,
      eligible: false,
      value: null,
      balance: null,
      reason: "The $CALYPTO price is moving too fast to verify holdings. Please retry later.",
    };
  const price = Number(top.priceUsd);

  try {
    const decimals = await rpc.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
    });
    const now = await rpc.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [holder],
    });
    let held = now;
    if (s.holdLookbackSeconds > 0) {
      let earlier: bigint;
      try {
        const blockNumber = await blockSecondsAgo(rpc, s.holdLookbackSeconds);
        earlier = await rpc.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [holder],
          blockNumber,
        });
      } catch {
        return {
          configured: true,
          eligible: false,
          value: null,
          balance: formatUnits(now, decimals),
          reason:
            "Historical balances are unavailable from the RPC provider. Holder access cannot be verified.",
        };
      }
      held = earlier < now ? earlier : now;
    }
    const amount = formatUnits(held, decimals);
    const value = Number(amount) * price;
    if (!Number.isFinite(value)) throw new Error();
    const tier = tierFor(value);
    const eligible = !!tier;
    const window =
      s.holdLookbackSeconds > 0
        ? ` for at least ${Math.round(s.holdLookbackSeconds / 60)} minutes`
        : "";
    return {
      configured: true,
      eligible,
      tier: tier?.name ?? null,
      dailyLimit: tier?.daily ?? 0,
      value,
      balance: amount,
      price,
      checkedAt: new Date().toISOString(),
      reason: eligible
        ? `${tier!.name} tier unlocked.`
        : `Hold at least $${HOLDER_MIN_USD} of $CALYPTO${window} to unlock more usage.`,
    };
  } catch {
    return {
      configured: true,
      eligible: false,
      value: null,
      balance: null,
      reason: "The balance provider is unavailable. Please retry.",
    };
  }
}

export async function used(key: string) {
  return (
    (
      await database()
        .prepare("SELECT used FROM usage WHERE key=?")
        .bind(key)
        .first<{ used: number }>()
    )?.used || 0
  );
}

export async function reserve(key: string, limit: number) {
  return !!(await database()
    .prepare(
      "INSERT INTO usage (key,used) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET used=used+1 WHERE used<? RETURNING used",
    )
    .bind(key, limit)
    .first());
}

export async function refund(key: string) {
  await database().prepare("UPDATE usage SET used=MAX(0,used-1) WHERE key=?").bind(key).run();
}

/** Supports EOAs plus smart-contract wallets (ERC-1271 and ERC-6492) via the chain. */
export async function verifyOwnership(address: string, message: string, signature: string) {
  try {
    return await client().verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}

async function replyKey() {
  const r = runtime();
  const base = r.REPLY_SIGNING_SECRET || "calypto-reply-v1:" + (r.VENICE_API_KEY || "");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(base),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Signs an assistant reply for this visitor so it can be sent back as context later. */
export async function signReply(userId: string, content: string) {
  const sig = await crypto.subtle.sign(
    "HMAC",
    await replyKey(),
    new TextEncoder().encode(userId + "\n" + content),
  );
  return hex(sig);
}

export async function replyIsAuthentic(userId: string, content: string, sig: string | undefined) {
  if (!sig || !/^[0-9a-f]{64}$/.test(sig)) return false;
  return timingSafeEqual(await signReply(userId, content), sig);
}

/* ============================================================================
 * Public-data snapshots for Portfolio and Token check.
 * Everything here is read-only public data from the chain indexer and DEX Screener.
 * The "facts" are computed here (not by the AI) and shown above the answer.
 * ========================================================================== */
export type Fact = { label: string; value: string; tone?: "good" | "warn" | "bad" };

const getJson = (url: string, ms = 10000) =>
  fetch(url, { signal: AbortSignal.timeout(ms), cache: "no-store", redirect: "manual" }).then(async (r) => {
    if (!r.ok) throw Object.assign(new Error("http " + r.status), { status: r.status });
    return r.json() as Promise<any>;
  });
const clean = (v: unknown, n: number) =>
  String(v ?? "Unknown")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, n);
const num = finiteNumber;
const explorerJson = (path: string) => blockscoutJson(path, runtime().BLOCKSCOUT_API_KEY, settings().explorerUrl);
const usd = (n: number | null | undefined) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "Unknown";
  const a = Math.abs(n);
  if (a >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  if (a >= 1) return "$" + n.toFixed(2);
  if (a === 0) return "$0";
  return "$" + n.toPrecision(3);
};
const pct = (n: number | null) => (n === null ? "Unknown" : (n >= 10 ? n.toFixed(0) : n.toFixed(1)) + "%");
const short = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
const ago = (iso: string | number | null | undefined) => {
  if (!iso) return null;
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = (Date.now() - t) / 86400000;
  return d < 1 ? Math.max(1, Math.round(d * 24)) + "h" : Math.round(d) + "d";
};
/** amount = raw / 10^decimals, as a float (good enough for valuation). */
function units(raw: unknown, decimals: unknown) {
  try {
    const d = num(decimals);
    if (raw === null || raw === undefined || d === null || !Number.isInteger(d) || d < 0 || d > 255) return null;
    return num(formatUnits(BigInt(String(raw).split(".")[0]), d));
  } catch {
    return null;
  }
}
/** share of supply as a percentage, from raw integer strings. */
function shareOf(raw: unknown, supply: unknown) {
  try {
    const v = BigInt(String(raw).split(".")[0]);
    const t = BigInt(String(supply).split(".")[0]);
    if (t <= 0n) return null;
    return Number((v * 1000000n) / t) / 10000;
  } catch {
    return null;
  }
}
/** Market prices are used only for the base token; quote-token prices must not be reused. */
async function marketsFor(addresses: string[]) {
  const s = settings();
  const out = new Map<string, { liquidity: number | null; price: number | null }>();
  const list = [...new Set(addresses.filter(a => isAddress(a)).map(a => a.toLowerCase()))].slice(0, 40);
  for (let i = 0; i < list.length; i += 30) {
    try {
      const data = await getJson(`https://api.dexscreener.com/tokens/v1/${encodeURIComponent(s.dexChain)}/${list.slice(i, i + 30).join(",")}`);
      for (const p of Array.isArray(data) ? data : []) {
        const addr = String(p.baseToken?.address || "").toLowerCase();
        if (p.chainId !== s.dexChain || !list.includes(addr)) continue;
        const liquidity = num(p.liquidity?.usd), price = num(p.priceUsd);
        const previous = out.get(addr);
        if (!previous || (liquidity ?? -1) > (previous.liquidity ?? -1))
          out.set(addr, { liquidity, price: liquidity !== null && liquidity >= s.minLiquidityUsd && price !== null && price > 0 ? price : null });
      }
    } catch { /* Missing markets remain unknown. */ }
  }
  return out;
}

async function walletTokens(address: string) {
  const key = runtime().ALCHEMY_API_KEY;
  if (key) {
    try {
      const data = await alchemyRpc(key, "alchemy_getTokenBalances", [address, "erc20", { maxCount: 40 }]);
      if (!Array.isArray(data?.tokenBalances)) throw new Error("Balances unavailable");
      const balances = data.tokenBalances.filter((t: any) => {
        try { return isAddress(t.contractAddress) && !t.error && BigInt(t.tokenBalance) > 0n; } catch { return false; }
      }).slice(0, 40);
      let metadata = new Map<string, any>();
      try { metadata = await alchemyMetadata(key, balances.map((t: any) => t.contractAddress)); } catch { /* Try indexed metadata below. */ }
      let indexed = new Map<string, any>();
      if (metadata.size < balances.length) {
        try {
          const items = indexedItems(await explorerJson(`/addresses/${address}/token-balances`));
          indexed = new Map((items || []).map(t => [String(t.token?.address_hash || "").toLowerCase(), t.token]));
        } catch { /* The raw balance is still useful; units remain unknown. */ }
      }
      return { items: balances.map((t: any) => {
        const m = metadata.get(t.contractAddress.toLowerCase()) || indexed.get(t.contractAddress.toLowerCase());
        return { value: t.tokenBalance, token: { ...m, address_hash: t.contractAddress, type: "ERC-20" } };
      }), coverage: "First page of up to 40 ERC-20 balances; zero balances omitted; not exhaustive" };
    } catch { /* Authenticated explorer fallback if this Alchemy method is unavailable. */ }
  }
  const data = await explorerJson(`/addresses/${address}/token-balances`);
  const items = indexedItems(data);
  if (!items) throw new Error("Balances unavailable");
  return { items: items.filter(t => t.token?.type === "ERC-20").slice(0, 40), coverage: "First 40 indexed ERC-20 balances; not exhaustive" };
}

async function walletActivity(address: string) {
  const key = runtime().ALCHEMY_API_KEY;
  if (key) {
    try {
      const base = { fromBlock: "0x0", toBlock: "latest", category: ["external", "erc20"], order: "desc", maxCount: "0xc", excludeZeroValue: true, withMetadata: true };
      const [incoming, outgoing] = await Promise.all([
        alchemyRpc(key, "alchemy_getAssetTransfers", [{ ...base, toAddress: address }]),
        alchemyRpc(key, "alchemy_getAssetTransfers", [{ ...base, fromAddress: address }]),
      ]);
      return { items: latestTransfers(incoming, outgoing, address), coverage: "Most recent 12 incoming/outgoing ETH and ERC-20 transfers; excludes failed transactions, internal calls and other activity" };
    } catch { /* Authenticated explorer fallback. */ }
  }
  const data = await explorerJson(`/addresses/${address}/transactions`);
  const items = indexedItems(data);
  if (!items) throw new Error("Activity unavailable");
  return { items: items.slice(0, 12).map((x: any) => ({ hash: x.hash, time: x.timestamp, from: x.from?.hash, to: x.to?.hash, rawNativeValue: x.value, status: x.status, method: x.method ? clean(x.method, 60) : null })), coverage: "Most recent 12 indexed transactions; not exhaustive" };
}

export async function walletSnapshot(address: string) {
  if (!isAddress(address)) throw new AppError("Enter a valid EVM wallet address.");
  const s = settings();
  const rpc = client();
  let balance;
  try {
    balance = await rpc.getBalance({ address });
  } catch {
    throw new AppError("Robinhood Chain is temporarily unavailable. Please retry.", 503);
  }
  const [tokenRes, txRes, statsRes] = await Promise.allSettled([
    walletTokens(address), walletActivity(address), explorerJson("/stats"),
  ]);
  if (tokenRes.status === "rejected" && txRes.status === "rejected")
    throw new AppError("Wallet holdings and activity are temporarily unavailable. Please retry; no complete wallet analysis could be performed.", 503);
  const ethPrice = statsRes.status === "fulfilled" ? num(statsRes.value?.coin_price) : null;
  const nativeAmount = Number(formatUnits(balance, 18));
  const raw = tokenRes.status === "fulfilled" ? tokenRes.value.items : null;
  const markets = raw ? await marketsFor(raw.map((x: any) => x.token?.address_hash || "")) : new Map<string, { liquidity: number | null; price: number | null }>();
  const tokens = raw ? raw.map((x: any) => {
    const amount = units(x.value, x.token?.decimals);
    const addr = String(x.token?.address_hash || "");
    const market = markets.get(addr.toLowerCase());
    const price = market?.price ?? num(x.token?.exchange_rate);
    return {
      symbol: clean(x.token?.symbol, 30), name: clean(x.token?.name, 100), address: addr,
      amount, rawBalance: String(x.value), priceUsd: price,
      valueUsd: amount !== null && price !== null && price > 0 ? num(amount * price) : null,
      liquidityUsd: market?.liquidity ?? null, holders: num(x.token?.holders_count),
    };
  }) : null;
  const nativeValue = ethPrice !== null ? nativeAmount * ethPrice : null;
  const priced = (tokens || []).filter((t: any) => t.valueUsd !== null && t.valueUsd > 0.01);
  const total = priced.reduce((a: number, t: any) => a + t.valueUsd, 0) + (nativeValue || 0);
  const positions = [
    ...(nativeValue ? [{ symbol: "ETH", valueUsd: nativeValue, liquidityUsd: Infinity }] : []),
    ...priced,
  ].sort((a: any, b: any) => b.valueUsd - a.valueUsd);
  const allocation = total > 0 ? positions.slice(0, 12).map((p: any) => ({ symbol: p.symbol, valueUsd: p.valueUsd, sharePct: (p.valueUsd / total) * 100 })) : [];
  const illiquid = positions.filter((p: any) => p.liquidityUsd !== Infinity && (p.liquidityUsd === null || p.liquidityUsd < 50000));
  const illiquidShare = total > 0 ? (illiquid.reduce((a: number, p: any) => a + p.valueUsd, 0) / total) * 100 : null;
  const unpriced = (tokens || []).filter((t: any) => t.valueUsd === null).length;
  const tx = txRes.status === "fulfilled" ? txRes.value.items : null;
  const positionCount = tokens === null ? null : tokens.length + (nativeAmount > 0 ? 1 : 0);
  const fullyPriced = tokens !== null && unpriced === 0 && (nativeAmount === 0 || nativeValue !== null);
  const totalValue = fullyPriced ? total : total > 0 ? total : null;
  const top = allocation[0];
  const facts: Fact[] = [
    { label: fullyPriced ? "Est. value" : "Known value", value: usd(totalValue) },
    { label: "Positions", value: positionCount !== null ? String(positionCount) : "Unknown" },
    ...(top ? [{ label: "Largest", value: `${top.symbol} ${pct(top.sharePct)}`, tone: (top.sharePct > 60 ? "bad" : top.sharePct > 35 ? "warn" : "good") as Fact["tone"] }] : []),
    ...(illiquidShare !== null ? [{ label: "Hard to sell", value: pct(illiquidShare), tone: (illiquidShare > 30 ? "bad" : illiquidShare > 10 ? "warn" : "good") as Fact["tone"] }] : []),
    ...(unpriced ? [{ label: "Unpriced tokens", value: String(unpriced), tone: "warn" as const }] : []),
    { label: "Last activity", value: tx === null ? "Unavailable" : tx?.[0]?.time ? ago(tx[0].time) + " ago" : tx.length ? "Time unknown" : "None found" },
  ];
  return {
    address,
    chain: "Robinhood Chain",
    chainId: CHAIN_ID,
    nativeBalance: String(nativeAmount),
    nativeSymbol: "ETH",
    nativeValueUsd: nativeValue,
    estimatedTotalUsd: totalValue,
    valuationComplete: fullyPriced,
    allocation,
    hardToSellSharePct: illiquidShare,
    hardToSellRule: "Positions with under $50K of DEX liquidity, or none found",
    tokens,
    recentTransactions: tx,
    coverage: {
      tokens: tokenRes.status === "fulfilled" ? tokenRes.value.coverage : "Holdings unavailable",
      transactions: txRes.status === "fulfilled" ? txRes.value.coverage : "Activity unavailable",
      values: "Estimates from market/indexer prices; unknown amounts and unpriced tokens excluded; allocation covers only priced positions, not necessarily the whole wallet",
    },
    facts,
    checkedAt: new Date().toISOString(),
    explorer: `${s.explorerUrl}/address/${address}`,
  };
}

/* ---------- Token check ---------- */
const RISKY: [RegExp, string][] = [
  [/^mint/, "Can mint new tokens"],
  [/blacklist|blocklist|blockaddress|denylist|setbots?|addbots?|isbot|antibot/, "Can block wallets from trading"],
  [/^(pause|unpause)$|^setpaused|^togglepause/, "Can pause transfers"],
  [/^(set|update|change)\w*(fee|tax)|^(set|update)\w*(buy|sell)\w*$/, "Can change buy/sell fees"],
  [/^(set|update)\w*(maxtx|maxwallet|maxtransaction|maxbuy|maxsell|limit)/, "Can cap trade or wallet size"],
  [/enabletrading|opentrading|settrading|starttrading|tradingopen|launch$/, "Owner controls when trading is on"],
  [/^(withdraw|rescue|recover|sweep|claimstuck)/, "Can pull tokens or ETH out of the contract"],
  [/^upgradeto/, "Code can be replaced (upgradeable)"],
];
const OWNER_ABI = [{ type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address", name: "" }] }] as const;

export async function tokenSnapshot(address: string) {
  if (!isAddress(address)) throw new AppError("Enter a valid token contract address.");
  const s = settings();
  let token: any;
  try {
    token = await explorerJson(`/tokens/${address}`);
  } catch (e: any) {
    if (e?.status === 404) throw new AppError("That address is not a token on Robinhood Chain. Paste the token’s contract address.", 404);
    throw new AppError("The chain indexer is temporarily unavailable. Please retry.", 503);
  }
  if (!token || (token.type && token.type !== "ERC-20"))
    throw new AppError("Token check works with ERC-20 tokens. Paste an ERC-20 contract address.");
  const [scRes, addrRes, holdersRes, pairsRes] = await Promise.allSettled([
    explorerJson(`/smart-contracts/${address}`),
    explorerJson(`/addresses/${address}`),
    explorerJson(`/tokens/${address}/holders`),
    getJson(`https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(s.dexChain)}/${address}`),
  ]);
  const sc = scRes.status === "fulfilled" ? scRes.value : null;
  const info = addrRes.status === "fulfilled" ? addrRes.value : null;
  const verified = typeof sc?.is_verified === "boolean" ? sc.is_verified : typeof info?.is_verified === "boolean" ? info.is_verified : null;
  const abiKnown = Array.isArray(sc?.abi);
  const marketKnown = pairsRes.status === "fulfilled" && Array.isArray(pairsRes.value);
  // contract: verification, proxy, risky admin functions
  const fnNames: string[] = Array.isArray(sc?.abi)
    ? sc.abi.filter((f: any) => f?.type === "function" && f.stateMutability !== "view" && f.stateMutability !== "pure").map((f: any) => String(f.name || ""))
    : [];
  const flags = new Map<string, string[]>();
  for (const n of fnNames) {
    const k = n.toLowerCase();
    for (const [re, label] of RISKY) if (re.test(k)) flags.set(label, [...(flags.get(label) || []), clean(n, 40)].slice(0, 4));
  }
  const proxy = sc?.proxy_type || info?.proxy_type || null;
  if (proxy && !flags.has("Code can be replaced (upgradeable)")) flags.set("Code can be replaced (upgradeable)", [String(proxy)]);
  // ownership
  let owner: string | null = null;
  let ownerStatus: "renounced" | "active" | "none" | "unknown" = "unknown";
  if (Array.isArray(sc?.abi) && sc.abi.some((f: any) => f?.name === "owner" && f?.type === "function")) {
    try {
      owner = await client().readContract({ address: address as `0x${string}`, abi: OWNER_ABI, functionName: "owner" });
      ownerStatus = /^0x0{40}$/i.test(owner) || /^0x0{36}dead$/i.test(owner) ? "renounced" : "active";
    } catch {
      ownerStatus = "unknown";
    }
  } else if (verified && abiKnown) ownerStatus = "none";
  // holders
  const supply = token.total_supply;
  const items: any[] = holdersRes.status === "fulfilled" && Array.isArray(holdersRes.value?.items) ? holdersRes.value.items : [];
  const top = items.slice(0, 10).map((h: any) => ({
    address: String(h.address?.hash || ""),
    label: h.address?.name ? clean(h.address.name, 40) : null,
    isContract: !!h.address?.is_contract,
    sharePct: shareOf(h.value, supply),
  }));
  const sum = (xs: any[]) => xs.every(h => h.sharePct !== null) ? xs.reduce((a, h) => a + h.sharePct, 0) : null;
  const top10 = items.length ? sum(top) : null;
  const top10People = items.length ? sum(top.filter((h) => !h.isContract)) : null;
  // market
  const pairs: any[] = pairsRes.status === "fulfilled" && Array.isArray(pairsRes.value) ? pairsRes.value.filter((p: any) => p.chainId === s.dexChain) : [];
  pairs.sort((a, b) => (num(b.liquidity?.usd) || 0) - (num(a.liquidity?.usd) || 0));
  const main = pairs[0];
  const sumMetric = (read: (p: any) => unknown) => {
    const values = pairs.map(p => num(read(p)));
    return values.length && values.every(v => v !== null) ? values.reduce<number>((a, v) => a + v!, 0) : null;
  };
  const liquidity = sumMetric(p => p.liquidity?.usd);
  const vol24 = sumMetric(p => p.volume?.h24);
  const buys = sumMetric(p => p.txns?.h24?.buys);
  const sells = sumMetric(p => p.txns?.h24?.sells);
  const oldest = pairs.reduce((m: number | null, p) => (num(p.pairCreatedAt) && (m === null || p.pairCreatedAt < m) ? p.pairCreatedAt : m), null);
  const ageDays = oldest ? (Date.now() - oldest) / 86400000 : null;
  const price = main?.baseToken?.address?.toLowerCase() === address.toLowerCase() ? num(main.priceUsd) ?? num(token.exchange_rate) : num(token.exchange_rate);
  const mcap = num(main?.marketCap) ?? num(token.circulating_market_cap);
  const fdv = num(main?.fdv);
  const holders = num(token.holders_count);
  // facts
  const t = <T extends Fact["tone"]>(x: T) => x;
  const facts: Fact[] = [
    { label: "Price", value: price !== null ? usd(price) : "No market" },
    { label: "Liquidity", value: !marketKnown ? "Unavailable" : pairs.length ? usd(liquidity) : "No pool found", tone: t(!marketKnown || (pairs.length && liquidity === null) ? undefined : !pairs.length || liquidity! < 10000 ? "bad" : liquidity! < 50000 ? "warn" : "good") },
    { label: mcap !== null ? "Market cap" : "FDV", value: usd(mcap ?? fdv) },
    { label: "24h volume", value: pairs.length ? `${usd(vol24)} · ${buys ?? "?"}B / ${sells ?? "?"}S` : "Unknown", tone: t(pairs.length && sells === 0 && buys !== null && buys > 5 ? "bad" : undefined) },
    { label: "Holders", value: holders !== null ? holders.toLocaleString("en-US") : "Unknown", tone: t(holders !== null && holders < 100 ? "warn" : undefined) },
    { label: "Top 10 · non-contracts", value: top10People !== null ? pct(top10People) : "Unknown", tone: t(top10People === null ? undefined : top10People > 50 ? "bad" : top10People > 25 ? "warn" : "good") },
    { label: "Contract", value: verified === null ? "Unknown" : verified ? "Verified source" : "Not verified", tone: t(verified === null ? undefined : verified ? "good" : "bad") },
    { label: "Owner", value: ownerStatus === "renounced" ? "Renounced" : ownerStatus === "active" ? "Active · " + short(owner!) : ownerStatus === "none" ? "No owner() found" : "Unknown", tone: t(ownerStatus === "active" ? "warn" : ownerStatus === "renounced" || ownerStatus === "none" ? "good" : undefined) },
    { label: "Admin powers", value: flags.size ? String(flags.size) + " found" : verified && abiKnown ? "None matched" : "Unknown", tone: t(flags.size >= 3 ? "bad" : flags.size ? "warn" : verified && abiKnown ? "good" : undefined) },
    { label: "Pool age", value: ageDays !== null ? (ageDays < 1 ? Math.max(1, Math.round(ageDays * 24)) + " hours" : Math.round(ageDays) + " days") : "Unknown", tone: t(ageDays === null ? undefined : ageDays < 3 ? "bad" : ageDays < 30 ? "warn" : "good") },
    ...(info?.is_scam ? [{ label: "Explorer flag", value: "Marked as scam", tone: "bad" as const }] : []),
  ];
  return {
    token: {
      address,
      name: clean(token.name, 100),
      symbol: clean(token.symbol, 30),
      decimals: num(token.decimals),
      totalSupply: units(supply, token.decimals),
      holders,
    },
    contract: {
      verified,
      contractName: sc?.name ? clean(sc.name, 80) : null,
      compiler: sc?.compiler_version ? clean(sc.compiler_version, 60) : null,
      proxyType: proxy,
      creator: info?.creator_address_hash || null,
      explorerScamFlag: typeof info?.is_scam === "boolean" ? info.is_scam : null,
      owner,
      ownerStatus,
      adminPowers: [...flags.entries()].map(([power, functions]) => ({ power, functions })),
      note: sc ? "Admin powers are matched from function names in the verified ABI; names can hide intent and unverified code cannot be read." : "Contract source is not available from the indexer.",
    },
    holders: {
      top10SharePct: top10,
      top10ExcludingContractsPct: top10People,
      top: top,
      note: "Contracts in the top list are often pools, lockers or bridges; they are excluded from the wallet concentration figure.",
    },
    market: {
      pools: marketKnown ? pairs.length : null,
      priceUsd: price,
      liquidityUsd: pairs.length ? liquidity : null,
      marketCapUsd: mcap,
      fdvUsd: fdv,
      volume24hUsd: pairs.length ? vol24 : null,
      buys24h: marketKnown && pairs.length ? buys : null,
      sells24h: marketKnown && pairs.length ? sells : null,
      priceChangePct: main?.priceChange || null,
      oldestPoolAgeDays: ageDays,
      mainPool: main ? { dex: clean(main.dexId, 30), url: main.url, pair: main.pairAddress } : null,
    },
    limits: "No buy or sell was simulated, so a sell block (honeypot) or hidden tax cannot be ruled out from this data.",
    facts,
    checkedAt: new Date().toISOString(),
    explorer: `${s.explorerUrl}/token/${address}`,
  };
}
