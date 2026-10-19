<img src="brand/hushfund-logo.svg" alt="Hushfund" width="64" />

# hushfund-app

**Hushfund — Your money, hushed.**

Hushfund web app for private USDC notes, yield, withdrawals, borrowing and repayment.

## Development

Requires Node.js 22.18+ and npm. From this repository root:

```sh
npm ci
cp .env.example .env
npm run typecheck
npm test
npm run build
npm run dev -- --port 5173
```

The application opens its dashboard at `/`; feature routes are `/app/deposit`,
`/app/withdraw`, `/app/borrow`, `/app/notes`, `/app/activity` and `/docs`.
This repository is not the marketing homepage.

### Runtime configuration and API

The current application reads allowlisted runtime configuration from
`GET /api/public-env` through `public/env.js`, not directly from Vite's
build-time environment. Therefore copying `.env` into this repo alone does
not configure authentication. Run the backend alongside the app and configure
your development reverse proxy to send `/api/*` to backend port 3007 and other
requests to Vite port 5173. In production, serve `dist/` on the same origin as
`/api/*`; use SPA fallback for application routes while preserving API routes.
The backend example includes the public settings it must provide.

Only publishable Openfort settings and browser-scoped RPC credentials belong
in public runtime configuration. Use origin-restricted RPC access; every browser
can inspect it. Server Openfort keys and wallet private keys never belong here.

### Protocol artifacts

`public/circuits.json` and `public/borrow_circuits.json` are public compiled
circuits, not private witnesses. Their SHA-256 hashes are recorded in
`ARTIFACTS.json`; matching circuit sources and verifiers are in
`hushfund-contracts`. Rebuild artifacts as a coordinated protocol change.


## Scope and safety

Ethereum Mainnet (chain ID 1) only. Supported fixed deposits: 10, 50, 100 and
1,000 USDC; arbitrary/custom amounts are not supported. Yield is variable.
Gas sponsorship depends on service availability and limits. Zero-knowledge
proofs do not eliminate public timing, amount, network or recipient metadata.
No claim of guaranteed anonymity, guaranteed returns or independent security
certification is made.

This is a source distribution, not a production environment or permission to
spend funds. Local tests may use mocks; those are fixtures, not deployed
protocols. Never use production keys or real user notes in tests.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md),
[OPERATIONS.md](OPERATIONS.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Hushfund-authored code is MIT licensed unless a file states otherwise.
Existing third-party copyright and license notices remain authoritative.
Hushfund names, logos and domains identify the original project; the code
license does not grant endorsement or trademark rights. Forks must identify
themselves and must not impersonate the official service.


## Official links

- Website: https://hushfund.eth.limo
- Application: https://hushfund.app
- App documentation: https://hushfund.app/docs
- Mechanism: https://hushfund.eth.limo/mechanism.html
- Privacy limits: https://hushfund.eth.limo/privacy.html
- Risks: https://hushfund.eth.limo/risks.html
- X: https://x.com/Hushfund_
- GitHub: https://github.com/hushfund
- Contact: hello@husfund.app

## Repository family

- [hushfund-contracts](https://github.com/hushfund/hushfund-contracts) — Ethereum Mainnet USDC vault contracts, Noir circuits, verifiers and protocol tests.
- [hushfund-app](https://github.com/hushfund/hushfund-app) — Hushfund web app for private USDC notes, yield, withdrawals, borrowing and repayment.
- [hushfund-backend](https://github.com/hushfund/hushfund-backend) — Hushfund API and gas-sponsoring relayer with persistent transaction state and Openfort integration.
- [hushfund-landing](https://github.com/hushfund/hushfund-landing) — Hushfund marketing website and mechanism, privacy and risk pages for ENS/IPFS hosting.

