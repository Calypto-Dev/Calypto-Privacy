import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = name => ts.transpileModule(readFileSync(new URL('../lib/' + name + '.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const moduleUrl = js => 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
const chainUrl = moduleUrl(compile('chain-data'));
const adapter = await import(chainUrl);
assert.equal(adapter.finiteNumber(null), null);
assert.equal(adapter.finiteNumber(undefined), null);
assert.equal(adapter.finiteNumber(''), null);
assert.equal(adapter.finiteNumber('0'), 0);
assert.equal(adapter.indexedItems({items:[]}).length, 0);
assert.equal(adapter.indexedItems({error:'unavailable'}), null);
assert.throws(() => adapter.alchemyEndpoint('https://attacker.example/v2/test-key'));
assert.equal(adapter.alchemyEndpoint('test-key'), 'https://robinhood-mainnet.g.alchemy.com/v2/test-key');
const wallet = '0x1111111111111111111111111111111111111111';
const token = '0x2222222222222222222222222222222222222222';
const unpriced = '0x3333333333333333333333333333333333333333';
const tx = (block, id) => ({ hash: '0x' + id.repeat(64), uniqueId:id, blockNum:block, from:wallet, to:token, value:1, asset:'TEST', metadata:{blockTimestamp:'2026-10-01T00:00:00Z'} });
assert.deepEqual(adapter.latestTransfers({transfers:[tx('0x10','a')]}, {transfers:[tx('0x20','b'),tx('0x10','a')]}, wallet).map(t => t.hash), ['0x'+'b'.repeat(64),'0x'+'a'.repeat(64)]);
globalThis.__chainTestEnv = { ALCHEMY_API_KEY:'test-key', BLOCKSCOUT_API_KEY:'test-blockscout-key' };
let scenario = 'normal';
const calls = [];
const ok = value => Response.json(value);
globalThis.fetch = async (url, init={}) => {
  if (url instanceof Request) { init = { ...init, body: await url.text(), redirect: url.redirect }; url = url.url; }
  url = String(url); calls.push({url,init});
  if (url.includes('alchemy.com')) {
    const q = JSON.parse(init.body);
    if (scenario === 'fallback' && !Array.isArray(q) && q.method.startsWith('alchemy_')) return ok({error:{code:-32601}});
    if (scenario === 'unavailable' && !Array.isArray(q) && q.method.startsWith('alchemy_')) return new Response('',{status:503});
    if (Array.isArray(q)) return ok(q.map(i => ({id:i.id,result:{name:'Token',symbol:i.params[0]===token?'TEST':'NOPRICE',decimals:18}})));
    if (q.method !== 'eth_getBalance') assert.equal(init.redirect, 'manual');
    if (q.method === 'eth_getBalance') return ok({jsonrpc:'2.0',id:q.id,result:'0xde0b6b3a7640000'});
    if (q.method === 'alchemy_getTokenBalances') return ok({result:{tokenBalances:[{contractAddress:token,tokenBalance:'0x8ac7230489e80000'},{contractAddress:unpriced,tokenBalance:'0xde0b6b3a7640000'}]}});
    if (q.method === 'alchemy_getAssetTransfers') return ok({result:{transfers:[tx('0x10','a')]}});
    throw new Error('Unexpected RPC method');
  }
  if (url.includes('blockscout')) {
    assert.ok(url.startsWith('https://api.blockscout.com/4663/api/v2/'));
    assert.equal(init.headers.Authorization, 'Bearer test-blockscout-key');
    assert.equal(init.redirect,'manual');
    if (scenario === 'unavailable') return new Response('',{status:503});
    if (url.endsWith('/stats')) return ok({coin_price:'2500'});
    if (url.endsWith('/token-balances')) return ok({items:[{value:'10000000000000000000',token:{address_hash:token,type:'ERC-20',name:'Token',symbol:'TEST',decimals:'18',exchange_rate:null}}]});
    if (url.endsWith('/transactions')) return ok({items:[]});
    if (url.endsWith('/holders')) return ok({items:[]});
    if (url.includes('/smart-contracts/')) return new Response('',{status:503});
    if (url.includes('/addresses/')) return new Response('',{status:503});
    if (url.includes('/tokens/')) return ok({type:'ERC-20',name:'Token',symbol:'TEST',decimals:'18',total_supply:'100000000000000000000',exchange_rate:null,holders_count:null});
  }
  if (url.includes('dexscreener')) {
    if (scenario === 'token-missing') return new Response('',{status:503});
    return ok([{chainId:'robinhood',baseToken:{address:token},quoteToken:{address:unpriced},priceUsd:'2',liquidity:{usd:60000}}]);
  }
  throw new Error('Unexpected provider');
};
const serverJs = compile('server')
  .replace('from "./security"', 'from ' + JSON.stringify(moduleUrl(compile('security'))))
  .replace('import { env } from "cloudflare:workers";', 'const env = globalThis.__chainTestEnv;')
  .replace('from "./chain-data"', 'from ' + JSON.stringify(chainUrl))
  .replace('from "viem"', 'from ' + JSON.stringify(import.meta.resolve('viem')));
const server = await import(moduleUrl(serverJs));
const snap = await server.walletSnapshot(wallet);
assert.equal(snap.nativeBalance,'1');
assert.equal(snap.tokens[0].amount,10);
assert.equal(snap.tokens[0].valueUsd,20);
assert.equal(snap.tokens[1].priceUsd,null,'Do not apply a base-token price to its quote token');
assert.equal(snap.estimatedTotalUsd,2520);
assert.equal(snap.valuationComplete,false);
assert.equal(snap.recentTransactions.length,1,'Deduplicate incoming/outgoing transfers');
assert.equal(snap.facts.find(f=>f.label==='Positions').value,'3');
assert.ok(!JSON.stringify(snap).includes('test-key'));
assert.ok(!JSON.stringify(snap).includes('test-blockscout-key'));
scenario = 'fallback';
assert.equal((await server.walletSnapshot(wallet)).tokens[0].amount,10,'Explorer fallback handles paginated v12 token balances');
scenario = 'unavailable';
await assert.rejects(server.walletSnapshot(wallet), e => e.status===503 && /holdings and activity/.test(e.message));
scenario = 'token-missing';
const risk = await server.tokenSnapshot(token);
assert.equal(risk.contract.verified,null);
assert.equal(risk.token.holders,null);
assert.equal(risk.market.priceUsd,null);
assert.equal(risk.market.pools,null);
assert.equal(risk.market.sells24h,null);
assert.equal(risk.facts.find(f=>f.label==='Contract').value,'Unknown');
assert.equal(risk.facts.find(f=>f.label==='Liquidity').value,'Unavailable');
console.log('PASS: authenticated providers, redirect protection, token units, transfer ordering/deduplication, wallet fallback, partial valuation and unknown-data handling.');
