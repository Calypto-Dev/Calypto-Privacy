import { AppError, database, runtime } from "./server";
import { createVisitor, hmac, networkAddress, readVisitor, visitorCookie } from "./security";
export const RATE_SQL = `INSERT INTO rate_limits (key,used,expires) VALUES (?,1,?)
  ON CONFLICT(key) DO UPDATE SET used=CASE WHEN expires<=? THEN 1 ELSE used+1 END,
  expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END
  WHERE expires<=? OR used<? RETURNING used`;
export const LEASE_SQL = `INSERT INTO request_leases (key,token,expires) VALUES (?,?,?)
  ON CONFLICT(key) DO UPDATE SET token=excluded.token,expires=excluded.expires
  WHERE expires<=? RETURNING token`;
export async function rate(key: string, limit: number, seconds: number, message = "Too many requests. Please wait and try again.") {
  const now = Date.now();
  const row = await database().prepare(RATE_SQL).bind(key, now + seconds * 1000, now, now, now, limit).first();
  if (!row) throw new AppError(message, 429);
}
export async function lease(key: string) {
  const token = crypto.randomUUID();
  const now = Date.now();
  const row = await database().prepare(LEASE_SQL).bind(key, token, now + 300000, now).first();
  if (!row) throw new AppError("A request is already running. Wait for it to finish.", 429);
  return () => database().prepare("DELETE FROM request_leases WHERE key=? AND token=?").bind(key, token).run();
}
export type Visitor = { id: string; network: string; cookie: string | null; networkKnown: boolean };
export async function visitor(req: Request, create: boolean): Promise<Visitor> {
  const secret = runtime().SESSION_SECRET;
  if (!secret || secret.length < 32) throw new AppError("Visitor access is not configured yet.", 503);
  const address = networkAddress(req);
  const network = await hmac(secret, "network\n" + (address || "unknown"));
  // A site-wide ceiling also bounds DB work from rotating IPs. Guard attempts are never refunded.
  await rate("api:global", 1000, 60);
  await rate("api:ip:" + network, 90, 60);
  let id = await readVisitor(req, secret);
  let cookie: string | null = null;
  if (!id && create) {
    await rate("session:ip:" + network, 12, 86400, "Too many new visitor sessions from this network. Please return later.");
    const minted = await createVisitor(secret, new URL(req.url).origin);
    id = minted.id;
    cookie = visitorCookie(minted.token);
  }
  if (!id) throw new AppError("Refresh the page to start your visitor session. Cookies must be enabled.", 401);
  await rate("api:visitor:" + id, 45, 60);
  return { id, network, cookie, networkKnown: !!address };
}
export async function cleanup() {
  const db = database();
  const now = Date.now();
  await db.batch([
    db.prepare("DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires<=? LIMIT 100)").bind(now),
    db.prepare("DELETE FROM request_leases WHERE key IN (SELECT key FROM request_leases WHERE expires<=? LIMIT 100)").bind(now),
    db.prepare("DELETE FROM challenges WHERE user_id IN (SELECT user_id FROM challenges WHERE expires<=? LIMIT 100)").bind(now),
    db.prepare("DELETE FROM wallet_links WHERE user_id IN (SELECT user_id FROM wallet_links WHERE expires<=? LIMIT 100)").bind(now),
  ]);
}
