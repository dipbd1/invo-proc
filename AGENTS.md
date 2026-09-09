# invo-proc

Take-home: read Japanese supplier invoices, verify the numbers in code, let a human confirm, then POST to the frozen accounting mock.

## Layout

Each Node folder owns its `package.json` and lockfile. There is no npm workspace.

- `static/take-home/` — original brief and the 12 sample invoices. Do not rewrite them.
- `apps/accounting-api/` — Python mock from the brief. Do not change its behaviour.
- `packages/shared/` — Zod schemas, partner matching, amount/tax verifier, accounting HTTP client.
- `apps/ingest/` — Gemini extract CLI + Hono review API.
- `apps/review/` — Vite + React review screen.

Install in that folder: `cd packages/shared && npm install` (and the same for ingest/review). Shared is consumed as `"@invo/shared": "file:../../packages/shared"`.

## Non-negotiables

- Never auto-POST to the accounting API. Approve is explicit (UI or CLI).
- Never rewrite totals just to satisfy `AMOUNT_MISMATCH`. Hold for review.
- Recalculate tax the same way the mock does: floor per tax code on that code’s subtotal.
- Partner codes come from matching `GET /partners`, not from the model.
- Do not commit `.env` or API keys.

## Run

`./start.sh` from the repo root. Accounting API `:8080`, ingest `:3001`, review `:3000`.

Extract needs `GEMINI_API_KEY` in `.env`. Without it, the rest of the stack still runs.
