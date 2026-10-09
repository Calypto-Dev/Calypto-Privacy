import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const js = ts.transpileModule(readFileSync(new URL('../lib/security.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { createVisitor, readVisitor, visitorCookie, VISITOR_COOKIE, VISITOR_TTL, networkAddress, validMutation, limitedJson, hmac } =
  await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const secret = 'test-only-secret-with-at-least-32-characters';
const now = Date.now(), origin = 'https://calypto.example';
const session = await createVisitor(secret, origin, now);
const request = (token, site = origin) => new Request(site + '/api/chat', { headers: { cookie: VISITOR_COOKIE + '=' + token } });
assert.equal(await readVisitor(request(session.token), secret, now), session.id);
assert.equal(await readVisitor(request(session.token.slice(0, -1) + (session.token.endsWith('a') ? 'b' : 'a')), secret, now), null);
assert.equal(await readVisitor(request(session.token), 'different-secret', now), null);
assert.equal(await readVisitor(request(session.token, 'https://attacker.example'), secret, now), null);
assert.equal(await readVisitor(request(session.token), secret, now + VISITOR_TTL * 1000), null);
assert.equal(await readVisitor(new Request(origin, { headers: { 'oai-authenticated-user-id': session.id, 'x-visitor-id': session.id } }), secret, now), null);
for (const attr of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']) assert.ok(visitorCookie(session.token).includes(attr));
assert.ok(!visitorCookie(session.token).includes('Domain='));
assert.notEqual(await hmac(secret, 'network\n1.2.3.4'), await hmac(secret, 'session\n1.2.3.4'));
const ip = headers => networkAddress(new Request(origin, { headers }));
assert.equal(ip({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '1.2.3.4' }), null);
assert.equal(ip({ 'cf-connecting-ip': '999.2.3.4' }), null);
assert.equal(ip({ 'cf-connecting-ip': '2a06:98c0:3600::103' }), null);
assert.equal(ip({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }), '1.2.3.4');
assert.equal(ip({ 'cf-connecting-ip': '2001:db8:0:1::1' }), ip({ 'cf-connecting-ip': '2001:0db8:0000:0001:ffff::99' }));
assert.notEqual(ip({ 'cf-connecting-ip': '2001:db8:0:1::1' }), ip({ 'cf-connecting-ip': '2001:db8:0:2::1' }));
const post = headers => new Request(origin + '/api/chat', { method: 'POST', headers });
assert.equal(validMutation(post({ origin, 'x-calypto-request': '1' })), true);
assert.equal(validMutation(post({ origin })), false);
assert.equal(validMutation(post({ 'x-calypto-request': '1' })), false);
assert.equal(validMutation(post({ origin: 'https://attacker.example', 'x-calypto-request': '1' })), false);
assert.equal(validMutation(post({ origin, 'x-calypto-request': '1', 'sec-fetch-site': 'cross-site' })), false);
const json = (body, headers = {}) => new Request(origin, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body, duplex: "half" });
assert.deepEqual(await limitedJson(json('{"ok":true}'), 100), { ok: true });
await assert.rejects(limitedJson(json('not-json'), 100), e => e.status === 400);
await assert.rejects(limitedJson(json('{}', { 'content-type': 'text/plain' }), 100), e => e.status === 415);
await assert.rejects(limitedJson(json('{}', { 'content-length': '1000' }), 100), e => e.status === 413);
let cancelled = false;
const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(80)); }, cancel() { cancelled = true; } });
await assert.rejects(limitedJson(json(stream), 100), e => e.status === 413);
assert.equal(cancelled, true);
// Limits count bytes, including multibyte Unicode, even without Content-Length.
await assert.rejects(limitedJson(json('"' + '🙂'.repeat(30) + '"'), 100), e => e.status === 413);
console.log('PASS: signed visitor identity, tampering, expiry, origin isolation, cookie flags, IP buckets, CSRF and bounded JSON streaming.');
