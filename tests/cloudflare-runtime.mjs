import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.resolve('wrangler/package.json'));
const { Miniflare } = require('miniflare');
const route = readFileSync(new URL('../app/api/[...path]/route.ts', import.meta.url), 'utf8');
const mode = /redirect: "([^"]+)"/.exec(route)[1];
assert.equal(mode, 'manual', 'Credential-bearing requests must not automatically follow redirects');
const runtime = new Miniflare({ modules:true, compatibilityDate:'2026-05-01', script:
  `export default { async fetch() { const request = new Request('https://api.venice.ai/api/v1/chat/completions', {method:'POST',redirect:${JSON.stringify(mode)}}); return Response.json({redirect:request.redirect}); } }` });
try {
  const response = await runtime.dispatchFetch('https://test.example');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).redirect, 'manual');
  console.log('PASS: production credential redirect policy is supported by the actual Cloudflare runtime.');
} finally { await runtime.dispose(); }
