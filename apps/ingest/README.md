# Ingest

Reads invoices from `static/take-home/invoices`, calls Gemini, verifies with `@invo/shared`, writes `data/queue/*.json`. Does not POST until you approve (HTTP/CLI in a later slice).

```bash
cd packages/shared && npm install
cd ../../apps/ingest && npm install
cp ../../.env.example ../../.env   # then set GEMINI_API_KEY
npm run ingest -- ../../static/take-home/invoices
```

Without a key the CLI exits with an explanation. The accounting API should be running so partner matching can work; if it is down, items are still written and marked `needs_review`.
