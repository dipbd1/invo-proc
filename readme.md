# Invoice intake

Read Japanese supplier invoices with Gemini, **check the numbers in code**, let a person confirm, then register them in the existing accounting API.

The client problem is overtime **and** a near double-pay from a typo. This repo automates reading. It does not auto-post.

## One command

```bash
cp .env.example .env   # then set GEMINI_API_KEY when you have it
./start.sh
```

| What | URL |
| --- | --- |
| Accounting mock | http://localhost:8080/health |
| Ingest API | http://localhost:3001/health |
| Review UI | http://localhost:3000 |

Extract the sample pack (needs a Gemini key):

```bash
cd apps/ingest
npm run ingest -- ../../static/take-home/invoices
npm run ingest -- --skip-existing ../../static/take-home/invoices
```

`--skip-existing` skips invoices that already have a `data/queue/<name>.json`. Without a key the UI still loads a seeded `invoice_01` fixture so you can walk the review and post path.

## Folders (npm per app, no workspaces)

| Path | Role |
| --- | --- |
| `static/take-home/` | Original brief and 12 invoices. Do not rewrite them. |
| `apps/accounting-api/` | Frozen Python mock from the brief. |
| `packages/shared/` | Zod schemas, partner match, floor-per-tax-code math, HTTP client. |
| `apps/ingest/` | Gemini extract CLI + Hono queue. POST only on explicit approve. |
| `apps/review/` | Vite + React review screen. |

Each Node folder has its own `package.json` and lockfile:

```bash
cd packages/shared && npm install && npm test
cd apps/ingest && npm install
cd apps/review && npm install
```

Shared is `"@invo/shared": "file:../../packages/shared"`.

## What is trusted vs not

Gemini returns supplier name, dates, lines, printed totals. It does **not** choose `partner_code` or invent tax codes.

TypeScript then:

1. Matches `GET /partners` (registration number, then name/alias).
2. Maps 10%/8% to `T10`/`T08`.
3. Recalculates tax the same way the mock does: `floor(subtotal × rate)` **per tax code**.
4. Asks `GET /invoices` whether `(partner, invoice_number)` already exists.

If printed totals disagree with that math, the item is held. Totals are not rewritten to dodge `AMOUNT_MISMATCH`.

## Docs

- [AGENTS.md](AGENTS.md) — constraints for people and agents
- [SUBMISSION.md](SUBMISSION.md) — take-home write-up
- [docs/screenshots/review-ui.png](docs/screenshots/review-ui.png)
