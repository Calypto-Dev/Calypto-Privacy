/** Server-only provider adapters. Never return endpoint URLs or credentials to visitors. */
export function alchemyEndpoint(key: string | undefined) {
  if (!key) return null;
  // Accept a bare API key or the complete mainnet URL supplied in runtime settings.
  if (key.startsWith("https://")) {
    const url = new URL(key);
    if (url.origin !== "https://robinhood-mainnet.g.alchemy.com" || !/^\/v2\/[\w-]+$/.test(url.pathname) || url.search || url.hash)
      throw new Error("Invalid chain provider configuration");
    return url.href;
  }
  if (!/^[\w-]+$/.test(key)) throw new Error("Invalid chain provider configuration");
  return `https://robinhood-mainnet.g.alchemy.com/v2/${key}`;
}

async function providerJson(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw Object.assign(new Error("Chain data request failed"), { status: r.status });
  return r.json() as Promise<any>;
}

export async function alchemyRpc(key: string | undefined, method: string, params: unknown[]) {
  const url = alchemyEndpoint(key);
  if (!url) throw new Error("Chain provider is not configured");
  const data = await providerJson(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (data?.error || !("result" in (data || {}))) throw new Error("Chain data method unavailable");
  return data.result;
}

export async function alchemyMetadata(key: string | undefined, addresses: string[]) {
  if (!addresses.length) return new Map<string, any>();
  const url = alchemyEndpoint(key);
  if (!url) throw new Error("Chain provider is not configured");
  const data = await providerJson(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(addresses.map((address, id) => ({ jsonrpc: "2.0", id, method: "alchemy_getTokenMetadata", params: [address] }))),
  });
  if (!Array.isArray(data)) throw new Error("Token metadata unavailable");
  const out = new Map<string, any>();
  for (const item of data) {
    if (!item.error && item.result && Number.isInteger(item.id) && addresses[item.id])
      out.set(addresses[item.id].toLowerCase(), item.result);
  }
  return out;
}

export function blockscoutJson(path: string, key: string | undefined, explorerUrl: string) {
  if (!/^\/(addresses|tokens|smart-contracts|stats)(\/|$)/.test(path) || path.includes("..") || /[?#]/.test(path))
    throw new Error("Invalid chain data path");
  // A key is sent only to the fixed authenticated gateway, never a configurable host.
  const url = key ? `https://api.blockscout.com/4663/api/v2${path}` : `${explorerUrl}/api/v2${path}`;
  return providerJson(url, key ? { headers: { Authorization: `Bearer ${key}` } } : {});
}

export const indexedItems = (data: any): any[] | null =>
  Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : null;

export function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function latestTransfers(incoming: any, outgoing: any, address: string) {
  if (!Array.isArray(incoming?.transfers) || !Array.isArray(outgoing?.transfers)) throw new Error("Transfer history unavailable");
  const unique = new Map<string, any>();
  for (const t of [...incoming.transfers, ...outgoing.transfers]) {
    if (!/^0x[0-9a-f]{64}$/i.test(t.hash || "")) continue;
    const id = t.uniqueId || `${t.hash}:${t.category}:${t.rawContract?.address || ""}:${t.from}:${t.to}:${t.value}`;
    unique.set(id, t);
  }
  return [...unique.values()].sort((a, b) => {
    const aa = BigInt(a.blockNum || "0"), bb = BigInt(b.blockNum || "0");
    return aa === bb ? String(b.uniqueId || "").localeCompare(String(a.uniqueId || "")) : aa > bb ? -1 : 1;
  }).slice(0, 12).map(t => ({
    hash: t.hash, time: t.metadata?.blockTimestamp || null, from: t.from, to: t.to,
    value: finiteNumber(t.value), asset: String(t.asset || "Unknown").slice(0, 30), category: t.category,
    direction: String(t.from).toLowerCase() === address.toLowerCase() ? "out" : "in",
  }));
}
