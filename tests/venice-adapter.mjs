import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const js = ts.transpileModule(readFileSync(new URL('../lib/venice.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { veniceRequest, veniceAnswer, veniceError } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const file = { type: 'file', file: { filename: 'sample.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' } };
const request = veniceRequest('gemma-4-uncensored', 'System instructions', [
  { role: 'user', content: 'Earlier question' },
  { role: 'assistant', content: 'Signed earlier answer' },
  { role: 'user', content: [file, { type: 'text', text: 'Summarize' }] },
], false);
assert.equal(request.messages[0].role, 'system');
assert.equal(request.messages[3].content[0].file.filename, 'sample.pdf');
assert.equal(request.store, false);
assert.equal(request.max_tokens, 2400);
assert.equal(request.venice_parameters.enable_web_search, 'off');
assert.equal(veniceRequest('gemma-4-uncensored', '', [], true).venice_parameters.enable_web_search, 'on');
const answer = veniceAnswer({ choices: [{ message: { content: 'Answer', annotations: [
  { type: 'url_citation', url_citation: { url: 'https://example.com/source', title: 'Source' } },
] } }], venice_parameters: { web_search_citations: [
  { url: 'javascript:alert(1)', title: 'Reject' },
  { url: 'not-a-url', title: 'Reject' },
  { url: 'https://example.com/source', title: 'Duplicate' },
  { url: 'https://example.com/other', title: 'Other' },
] } });
assert.equal(answer.text, 'Answer');
assert.deepEqual(answer.sources.map(s => s.url), ['https://example.com/source', 'https://example.com/other']);
assert.deepEqual(veniceAnswer({ error: 'Failed' }), { text: '', sources: [] });
assert.equal(veniceAnswer({ choices: [{ message: { content: 'x'.repeat(20000) } }] }).text.length, 18000);
assert.match(veniceError(402), /usage limit/);
assert.match(veniceError(429), /not been counted/);
assert.match(veniceError(401), /connection needs attention/);
console.log('PASS: Venice chat/PDF payloads, research configuration, citation validation, bounded output and provider-limit errors.');
