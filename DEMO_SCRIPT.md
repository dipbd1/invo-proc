# Demo script (~3 minutes)

Read the **Say** lines. Bracketed lines are camera directions — do not speak them.

Backup screenshots (if the video is late or fails):

- [docs/screenshots/01-start.png](docs/screenshots/01-start.png) — `./start.sh` with the three URLs
- [docs/screenshots/02-review-ready.png](docs/screenshots/02-review-ready.png) — `invoice_01.pdf` ready: original page, fields, green checks, Approve enabled
- [docs/screenshots/03-posted.png](docs/screenshots/03-posted.png) — `invoice_02.pdf` registered as `ACC-0001`
- [docs/screenshots/04-duplicate.png](docs/screenshots/04-duplicate.png) — second post blocked: red `Already registered for P-1001 / YM-2026-0107`

Speak at a normal pace. Target **2:45–3:00**. If you run long, cut the last paragraph, not the duplicate beat.

## Before you record

Capturing the duplicate screenshot posted `invoice_01`. Reset it or Approve will stay disabled:

```bash
curl -X DELETE http://localhost:8080/invoices -H 'X-API-Key: demo-key-1234'
python3 -c "import json,pathlib; p=pathlib.Path('data/queue/invoice_01.json'); i=json.loads(p.read_text()); i['status']='ready'; i['accountingId']=None; p.write_text(json.dumps(i,indent=2,ensure_ascii=False)+'\n')"
```

Then in the UI, open `invoice_01.pdf` and click **Save & recheck**. Status should be `ready`. Other invoices in the sidebar can stay as they are.

## Shot list

| Time | Screen | What they should see |
| --- | --- | --- |
| 0:00 | You, or README | Problem in one sentence |
| 0:20 | Terminal: `./start.sh` | Three URLs: 8080 / 3001 / 3000 |
| 0:45 | Browser: Review UI | Queue, original PDF, editable fields, checks |
| 1:50 | Same UI | Green checks + payload `P-1001` |
| 2:10 | Click **Approve & post** | Banner `Posted as ACC-0001` |
| 2:25 | Optional: `curl` GET `/invoices` | Record in the mock |
| 2:30 | Approve disabled / red duplicate | Blocked second post |
| 2:45 | Close | Cost + what you refuse to automate |

## Spoken script

**0:00 — the request**

*[Do not show code yet.]*

The client is Sample Trading. Staff type Japanese supplier invoices into their accounting system by hand. Month-end is overtime, and last month a typo almost paid the same invoice twice. They asked if AI can just read the invoices and enter them. I treated that as a trust problem, not an OCR demo. A wrong amount, or a second post, is worse than typing.

**0:20 — what I built**

*[Terminal: `./start.sh`. Point at the three URLs.]*

So I built a four-step pipeline: read the page with Gemini, verify the numbers in TypeScript, let a person confirm, then POST to their existing API. The model never posts. Approve is the only path in.

One command starts the stack: the frozen Python mock on 8080, ingest on 3001, review on 3000. I did not change the accounting API. It wants `YYYY-MM-DD`, integer yen, tax codes not rates, and a `partner_code` that already exists.

**0:50 — the review screen**

*[Browser: http://localhost:3000. Click `invoice_01.pdf`. Pan left, then right.]*

This is the review screen. Left is the original invoice — Japanese layout, as the samples are. Right is what we extracted and what we would send.

Gemini reads the page: supplier, dates, lines, printed totals. Code owns everything that can lose money.

Partner is not whatever the model typed. We match `GET /partners`. This registration number maps to `P-1001`. Tax is recalculated the same way the mock does: floor per tax code on that code’s subtotal. Line one: quantity times unit price matches the amount. Printed subtotal, tax, and total agree with that math.

*[Point at the green “ok” list, then the payload line.]*

If printed tax disagreed, we would hold. We do not rewrite totals to dodge `AMOUNT_MISMATCH`. The API is the last judge; we refuse to fudge numbers so a 422 goes away.

**2:05 — approve**

*[Click **Approve & post**. Wait for `Posted as ACC-0001`.]*

Approve. Posted as `ACC-0001`. That click is the only way this system writes to accounting.

*[Optional: terminal `curl -H 'X-API-Key: demo-key-1234' http://localhost:8080/invoices` — one second on the JSON.]*

**2:25 — the double-pay case**

*[Point at disabled **Approve & post**, or the red duplicate check.]*

Last month’s incident. Same supplier, same invoice number — refused. Approve is disabled once status is posted. That is the check that would have caught the near double-pay.

**2:40 — close**

Gemini is under a cent per page. Review time is the real cost. With another eight hours I would add an audit of who approved. I would not auto-post “high confidence” invoices. That would recreate the risk the CEO wrote about.

## Delivery notes

- If you stumble, skip the optional curl. The UI banner is enough.
- Pronounce `P-1001` and `ACC-0001` slowly. Point at Japanese supplier names; do not read them aloud.
- Stay under 3:00.
