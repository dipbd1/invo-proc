# Ingest

Reads invoices from `static/take-home/invoices`, calls Gemini, verifies with `@invo/shared`, writes `data/queue/*.json`. Does not POST until you approve (HTTP/CLI in a later slice).

```bash
cd packages/shared && npm install
cd ../../apps/ingest && npm install
cp ../../.env.example ../../.env   # then set GEMINI_API_KEY
npm run ingest -- ../../static/take-home/invoices
npm run ingest -- --skip-existing ../../static/take-home/invoices
```

`--skip-existing` skips invoices that already have a `data/queue/<name>.json`. Without a key the CLI exits with an explanation. The accounting API should be running so partner matching can work; if it is down, items are still written and marked `needs_review`.

Review API (does not POST unless you call post):

```bash
python3 ../../apps/accounting-api/accounting_api.py   # other terminal
npm start   # http://localhost:3001
npm run post -- invoice_01
```

`GET /items` seeds a fixture `invoice_01` so the UI can be checked before a Gemini key exists.
