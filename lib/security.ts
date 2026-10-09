/** Pure security primitives; secrets are supplied only by server-side callers. */
export const VISITOR_COOKIE = "__Host-calypto-visitor";
export const VISITOR_TTL = 365 * 86400;
const encoder = new TextEncoder();
export async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
export function timingSafeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export async function createVisitor(secret: string, origin: string, now = Date.now()) {
  const id = crypto.randomUUID();
  const payload = `v1.${id}.${Math.floor(now / 1000) + VISITOR_TTL}`;
  return { id: "visitor:" + id, token: payload + "." + await hmac(secret, "session\n" + origin + "\n" + payload) };
}
export async function readVisitor(req: Request, secret: string, now = Date.now()) {
  const token = (req.headers.get("cookie") || "").split(";").map(s => s.trim()).find(s => s.startsWith(VISITOR_COOKIE + "="))?.slice(VISITOR_COOKIE.length + 1);
  if (!token || token.length > 160) return null;
  const match = /^v1\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(\d{10})\.([0-9a-f]{64})$/.exec(token);
  if (!match) return null;
  const expiry = Number(match[2]);
  const seconds = Math.floor(now / 1000);
  if (expiry <= seconds || expiry > seconds + VISITOR_TTL) return null;
  const payload = token.slice(0, token.lastIndexOf("."));
  if (!timingSafeEqual(match[3], await hmac(secret, "session\n" + new URL(req.url).origin + "\n" + payload))) return null;
  return "visitor:" + match[1];
}
export function visitorCookie(token: string) {
  return `${VISITOR_COOKIE}=${token}; Path=/; Max-Age=${VISITOR_TTL}; HttpOnly; Secure; SameSite=Strict`;
}
/** Only the Cloudflare edge header is used. Never accept X-Forwarded-For or client IDs.
 * IPv6 addresses share a /64 bucket to prevent cheap address rotation. A missing or
 * cross-zone Worker sentinel address falls into one conservative shared bucket. */
export function networkAddress(req: Request): string | null {
  const ip = req.headers.get("cf-connecting-ip")?.trim().toLowerCase();
  if (!ip || ip === "2a06:98c0:3600::103") return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const octets = ip.split(".").map(Number);
    return octets.every(n => n <= 255) ? octets.join(".") : null;
  }
  if (!/^[0-9a-f:]+$/.test(ip)) return null;
  try {
    const normalized = new URL(`https://[${ip}]/`).hostname.slice(1, -1);
    const [left, right] = normalized.split("::");
    const a = left ? left.split(":") : [];
    const b = right ? right.split(":") : [];
    const parts = right !== undefined ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b] : a;
    if (parts.length !== 8) return null;
    return parts.slice(0, 4).map(s => parseInt(s, 16).toString(16)).join(":") + "::/64";
  } catch { return null; }
}
export function validMutation(req: Request) {
  return req.headers.get("origin") === new URL(req.url).origin &&
    req.headers.get("x-calypto-request") === "1" &&
    req.headers.get("sec-fetch-site") !== "cross-site";
}
export async function limitedJson(req: Request, maxBytes: number) {
  if (req.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw Object.assign(new Error("Send a JSON request."), { status: 415 });
  const declared = Number(req.headers.get("content-length") || 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > maxBytes)
    throw Object.assign(new Error("Request is too large."), { status: 413 });
  const reader = req.body?.getReader();
  if (!reader) throw Object.assign(new Error("Invalid request."), { status: 400 });
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw Object.assign(new Error("Request is too large."), { status: 413 });
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return JSON.parse(chunks.join(""));
  } catch (e) {
    if (e instanceof Error && "status" in e) throw e;
    throw Object.assign(new Error("Invalid request."), { status: 400 });
  } finally { reader.releaseLock(); }
}
