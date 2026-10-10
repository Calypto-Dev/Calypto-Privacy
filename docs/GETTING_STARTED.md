# Getting started

Calypto uses Node.js 22.13 or newer and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open http://localhost:5173. Configure `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `AI_ALLOWED_ORIGIN` and a random `SESSION_SECRET` of at least 32 characters in the ignored `.env.local` file. Configure `ALCHEMY_API_KEY` and `BLOCKSCOUT_API_KEY` for the corresponding public-chain adapters. Set `CALYPTO_TOKEN_ADDRESS` for holder access checks.

## Private AI configuration

Use a provider with a compatible `/chat/completions` endpoint. Set `AI_BASE_URL` to its HTTPS API base, including the version path, and `AI_ALLOWED_ORIGIN` to the independently trusted HTTPS origin without a path. Requests fail closed if the origins differ or the URL contains credentials, a query or a fragment; redirects are never followed with the API key.

`AI_CHAT_OPTIONS_JSON` accepts a JSON object of provider-specific request options. `AI_RESEARCH_OPTIONS_JSON` accepts options to enable that provider's web search and citations; it is required for research requests. The research options override the chat options at the top level, so include complete nested objects where needed. The model, messages, storage flag and output-token cap remain controlled by the application. `AI_CITATIONS_PATH` optionally identifies a dotted path to the provider's citation array; standard message annotations are parsed as well. Actual provider names, URLs, model IDs and option values belong in private server settings, never committed files.

Deploying this public version over an existing installation requires migrating its AI settings to these generic names and configuring the provider-specific options before deployment. The live service's runtime settings are managed separately from this repository.

Holder access also needs a working Robinhood Chain RPC and a matching DEX Screener market with at least $1,000 liquidity. The homepage and access-page copy update from the contract configuration; an unset or invalid address keeps the "$CALYPTO coming soon" message.

Keep `DISABLE_TRIAL_LIMIT=false` for the normal three-prompt trial. For temporary open-access testing, set it to `true` in the server runtime settings and redeploy. This bypasses the trial cutoff and holder requirement while preserving global capacity and IP/rate protections. Restore `false` and redeploy to enable the original trial again. Temporary usage does not consume the original trial allowance.

Production requires a Cloudflare Worker and D1 database. Apply the SQL files in `drizzle/` in order to your database and provide runtime secrets through your hosting platform. The placeholder binding in `vite.config.ts` is for local development; production must use your own binding and database. This repository does not include the hosted service's credentials or data.

## Verification

```sh
node node_modules/typescript/bin/tsc --noEmit
node tests/security.mjs
node tests/identity.mjs
node tests/ai-adapter.mjs
node tests/chain-data.mjs
python3 tests/access-rules.py
python3 tests/abuse-rules.py
pnpm build
```

Provider tests use fixtures; no production API key or funded wallet is needed. SQL checks use Python's SQLite module to exercise concurrent requests. A passing CI run verifies these checks, not provider uptime or the correctness of an AI answer.
