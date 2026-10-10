import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const js = ts.transpileModule(readFileSync(new URL('../lib/ai.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { aiEndpoint, aiReady, aiRequest, aiAnswer, aiError } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const settings = {
  AI_API_KEY: 'test-only-key',
  AI_MODEL: 'test-model',
  AI_BASE_URL: 'https://ai.example.com/v1/',
  AI_ALLOWED_ORIGIN: 'https://ai.example.com',
  AI_CHAT_OPTIONS_JSON: JSON.stringify({ search: { enabled: false } }),
  AI_RESEARCH_OPTIONS_JSON: JSON.stringify({ search: { enabled: true, citations: true } }),
};
assert.equal(aiEndpoint(settings), 'https://ai.example.com/v1/chat/completions');
assert.equal(aiReady(settings), true);
for (const patch of [
  { AI_API_KEY: '' }, { AI_MODEL: '' }, { AI_BASE_URL: '' }, { AI_ALLOWED_ORIGIN: '' },
  { AI_BASE_URL: 'http://ai.example.com/v1' },
  { AI_BASE_URL: 'https://attacker.example/v1' },
  { AI_BASE_URL: 'https://ai.example.com.attacker.example/v1' },
  { AI_BASE_URL: 'https://user:password@ai.example.com/v1' },
  { AI_BASE_URL: 'https://ai.example.com/v1?key=secret' },
  { AI_BASE_URL: 'https://ai.example.com/v1#fragment' },
  { AI_ALLOWED_ORIGIN: 'https://ai.example.com/extra' },
  { AI_ALLOWED_ORIGIN: 'http://ai.example.com' },
  { AI_ALLOWED_ORIGIN: 'https://user:password@ai.example.com' },
]) assert.equal(aiReady({ ...settings, ...patch }), false);
const file = { type: 'file', file: { filename: 'sample.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' } };
const request = aiRequest(settings, 'System instructions', [
  { role: 'user', content: 'Earlier question' },
  { role: 'assistant', content: 'Signed earlier answer' },
  { role: 'user', content: [file, { type: 'text', text: 'Summarize' }] },
], false);
assert.equal(request.messages[0].role, 'system');
assert.equal(request.messages[3].content[0].file.filename, 'sample.pdf');
assert.equal(request.store, false);
assert.equal(request.max_tokens, 2400);
assert.equal(request.search.enabled, false);
assert.equal(aiRequest(settings, '', [], true).search.enabled, true);
assert.throws(() => aiRequest({ ...settings, AI_RESEARCH_OPTIONS_JSON: undefined }, '', [], true));
for (const invalid of ['[]', 'null', 'invalid'])
  assert.throws(() => aiRequest({ ...settings, AI_CHAT_OPTIONS_JSON: invalid }, '', [], false));
const locked = aiRequest({ ...settings, AI_CHAT_OPTIONS_JSON: JSON.stringify({
  model: 'wrong', messages: [], store: true, max_tokens: 999999,
}) }, 'System instructions', [{ role: 'user', content: 'Question' }], false);
assert.equal(locked.model, 'test-model');
assert.equal(locked.messages[0].content, 'System instructions');
assert.equal(locked.messages[1].content, 'Question');
assert.equal(locked.store, false);
assert.equal(locked.max_tokens, 2400);
const answer = aiAnswer({ choices: [{ message: { content: 'Answer', annotations: [
  { type: 'url_citation', url_citation: { url: 'https://example.com/source', title: 'Source' } },
] } }], metadata: { citations: [
  { url: 'javascript:alert(1)', title: 'Reject' },
  { url: 'not-a-url', title: 'Reject' },
  { url: 'https://example.com/source', title: 'Duplicate' },
  { url: 'https://example.com/other', title: 'Other' },
] } }, 'metadata.citations');
assert.equal(answer.text, 'Answer');
assert.deepEqual(answer.sources.map(s => s.url), ['https://example.com/source', 'https://example.com/other']);
assert.equal(aiAnswer({ choices: [{ message: { content: 'Answer', annotations: [
  { url_citation: { url: 'https://example.com/standard', title: 'Standard' } },
] } }] }).sources[0].url, 'https://example.com/standard');
assert.deepEqual(aiAnswer({ choices: [{ message: { content: 'Answer' } }], metadata: {
  citations: [{ url: 'https://example.com/extra' }],
} }, 'missing.path').sources, []);
assert.deepEqual(aiAnswer({ error: 'Failed' }), { text: '', sources: [] });
assert.equal(aiAnswer({ choices: [{ message: { content: 'x'.repeat(20000) } }] }).text.length, 18000);
assert.match(aiError(402), /usage limit/);
assert.match(aiError(429), /not been counted/);
assert.match(aiError(401), /connection needs attention/);
console.log('PASS: generic AI payloads, trusted HTTPS endpoint, private research configuration, citation validation, bounded output and provider-limit errors.');
