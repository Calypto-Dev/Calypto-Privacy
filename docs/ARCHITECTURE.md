# Architecture

## Request path

The workspace in `components/workspace.tsx` submits requests to `app/api/[...path]/route.ts`. Server handlers validate the request origin, signed visitor session, request size and quota before using a provider. `lib/server.ts` handles public token and wallet context; `lib/chain-data.ts` adapts provider results. `lib/venice.ts` constructs AI and document requests and validates returned citations.

## Identity and access

`lib/security.ts` signs visitor cookies and checks request origin. Wallet ownership requires a challenge signature; challenges are consumed to prevent replay. Holder access is evaluated on the server. `lib/guards.ts` uses atomic database statements for rate limits and request leases so parallel requests cannot independently spend the same budget.

## History and storage

History is off by default. Saving text is an explicit choice in the workspace. Saved conversations are scoped to the visitor and wallet; reads, updates and deletion check ownership. The database also stores access and usage metadata needed to operate the service. Its schema is in `db/schema.ts`, with migrations under `drizzle/`.

## Privacy boundary

Questions pass through the application server and an external AI provider. Optional web research involves external services. Public wallet balances and activity stay public onchain. Session-only history is a storage choice, not end-to-end encryption or a guarantee of anonymity.

## Automated checks

Eight GitHub Actions workflows verify production build, types, session security, identity behavior, AI adapter payloads, chain-data adapters, access rules and abuse controls. Tests use deterministic provider fixtures and actual SQLite concurrency where appropriate.
