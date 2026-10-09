# Getting started

Calypto uses Node.js 22.13 or newer and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open http://localhost:5173. Configure `VENICE_API_KEY` and a random `SESSION_SECRET` of at least 32 characters in the ignored `.env.local` file. The provider's model setting is described in `.env.example`. Configure `ALCHEMY_API_KEY` and `BLOCKSCOUT_API_KEY` for the corresponding public-chain adapters. Set `CALYPTO_TOKEN_ADDRESS` for holder access checks.

Production requires a Cloudflare Worker and D1 database. Apply the SQL files in `drizzle/` in order to your database and provide runtime secrets through your hosting platform. The placeholder binding in `vite.config.ts` is for local development; production must use your own binding and database. This repository does not include the hosted service's credentials or data.

## Verification

```sh
node node_modules/typescript/bin/tsc --noEmit
node tests/security.mjs
node tests/identity.mjs
node tests/venice-adapter.mjs
node tests/chain-data.mjs
python3 tests/access-rules.py
python3 tests/abuse-rules.py
pnpm build
```

Provider tests use fixtures; no production API key or funded wallet is needed. SQL checks use Python's SQLite module to exercise concurrent requests. A passing CI run verifies these checks, not provider uptime or the correctness of an AI answer.
