# Submission

- Name: Dip Chowdhury
- Submission date (YYYY-MM-DD): 2026-09-09
- Hours actually spent: ~8 (code, testing, running the 12 samples through Gemini)
- Repository / how to run it: [https://github.com/dipbd1/invo-proc](https://github.com/dipbd1/invo-proc) — `cp .env.example .env`, put `GEMINI_API_KEY` in it, `./start.sh`. Review UI is [http://localhost:3000](http://localhost:3000). Extract: `cd apps/ingest && npm run ingest -- ../../static/take-home/invoices`.

## 1. Understanding the request

The client (Sample Trading) still types supplier invoices by hand. Month-end is overtime, layouts are all over the place, PDFs and copier scans, sometimes handwriting. They asked if AI can just read them and enter them.

The part I took seriously is the typo that almost paid the same invoice twice. So I did not build “Gemini POSTs to accounting.” I built: read the page, check amounts / tax / partner / duplicates in TypeScript, show it next to the original, and only POST after someone clicks Approve.

## 2. What you would have asked the client

| What you wanted to ask | The assumption you made | Why |
| --- | --- | --- |
| Can anything go into accounting without a person looking? | No. Approve in the UI, or `npm run post -- <id>`. | Last month was a typo. I am not auto-posting money. |
| Supplier not in the partner master? | Hold. Do not create a partner, do not pick a nearby code. | API only accepts listed `partner_code`s. `invoice_10` is this case. |
| 税込 vs 税抜, and which numbers on the page are the ones they trust? | Line `amount` is what the API re-sums. Tax is `floor` per tax code, same as the mock. If the printed total disagrees, hold. | Guessing a total just to pass 422 is how you book the wrong yen. |
| Handwritten notes: extra lines, or ignore? | Set `has_handwriting` and hold. Don’t invent lines unless the note clearly changes an amount. | `invoice_08` writes on the bank account. The API has no bank field anyway. |
| 発行日 vs a 受領 stamp? | `issue_date` = 発行日, `due_date` = お支払期日, both `YYYY-MM-DD`. | That’s the only date format the API takes. Stamp on `invoice_04` is 1/20, issue date is 1/18. |
| Duplicate = same number globally, or per supplier? | Per supplier. | That’s how `DUPLICATE_INVOICE` is defined. `invoice_01` and `invoice_07` are the same Yamada invoice, PDF vs scan. |
| 御中 vs the issuer? | Issuer is the supplier we match. 御中 is Sample Trading. | Partner master is suppliers. |

## 3. Scoping decisions

**What you built**

- Gemini extract (PDF + JPEG) into JSON, then `@invo/shared` does partner match, tax mapping, and the amount/date/duplicate checks
- Hono queue API + a small Vite/React review screen (original on the left, fields + checks on the right)
- Accounting mock left as-is
- `./start.sh` for 8080 / 3001 / 3000

I ran the 12 files with `gemini-3.5-flash-lite`. N.B. I couldn’t get `gemini-2.5-flash` on this key (new Gemini account). Lite is enough because the numbers are checked in code anyway.

**What you left out, and why**

- Email inbox, users, SSO, Postgres, a real job queue. It’s 12 files and an in-memory mock.
- A second OCR stack (Tesseract / Document AI). Gemini already sees the page.
- Agent frameworks. One vision call plus the verifier is the whole pipeline.
- Auto-post of “high confidence” rows. That is the double-pay story again.

## 4. Design and technology choices

File goes to Gemini, JSON comes back. Then I match `GET /partners`, map 10%/8% to `T10`/`T08`, recompute tax the same way the Python mock does (`floor` per code on that code’s subtotal), and check `(partner_code, invoice_number)` against invoices already in the API *and* other files already in the queue. If that looks ok, a person Approves, then `POST /invoices`.

I used TypeScript because that’s the stack I can actually defend if someone asks “why is this total 147496.” Zod at the model and HTTP boundary. Each app has its own `package.json`; shared is `"@invo/shared": "file:../../packages/shared"`. Hono + Vite because this is a local tool, I don’t need SSR. The mock is stock Python stdlib.

I didn’t use pnpm/Nx, Next.js, or a vector store for five partners. And I don’t rewrite printed totals so a 422 goes away.

Default model is `gemini-3.5-flash-lite` (`GEMINI_MODEL` to override).

## 5. How you used AI, and how you checked it

**What you delegated to AI**

Reading the page (Japanese labels, stamps, two-page PDF, the scanned ones). Producing the JSON: supplier name, registration no, dates, lines, printed totals, `has_handwriting`. One repair pass if dates / line math / tax *codes* fail. I do not send it back to “fix” a printed total. That’s how you would hide `invoice_09`.

**How you verified the output**

- Zod parse
- `quantity × unit_price === amount` when both sides exist
- Subtotal / tax / total with `floor(subtotal × rate)` per `T10` / `T08`
- Partner from `GET /partners` (registration number, then name / alias). Not whatever string the model invented
- Duplicate key against the mock *and* the other queue files
- The accounting API still recalculates on POST. If it 422s, the item becomes `api_error` and I keep the error body.

Approve is off when partner, dates, tax codes, duplicates, or printed totals fail. Handwriting alone does not block POST. Someone still has to click.

**A case where the AI got it wrong** (one example is enough, if you have one)

`invoice_08.jpg`. The page has two tax rows: 8% on 103,200 = 8,256 and 10% on 6,800 = 680. That’s 8,936, and the printed total 118,936 matches that. Gemini wrote `printed_tax_amount` as **9056**. My code said 9056 ≠ 8936 and held it. If I had trusted the model’s tax field, or “fixed” it to 8936 just to POST, I would have been guessing. The original is on the left of the review screen, so you can see the two rows.

Smaller one, same idea: on `invoice_01.pdf` it put **式** on lines that are printed **個**. Amounts were fine so it still went `ready`. I only noticed because the PDF is sitting there. The scan of the same invoice (`invoice_07`) actually got 個.

## 6. Integrating with the accounting system

Dates have to be `YYYY-MM-DD`. Amounts are integer yen. Tax is a code, not a rate. Partner must already exist. Tax is floor-per-code, not round, not per line. Same invoice number for the same partner is 409. I check that before POST. If POST still fails, status is `api_error` and the numbers are not quietly changed.


| Invoice | Result | How you handled it |
| --- | --- | --- |
| invoice_01.pdf | Ready. Posted on Approve (`YM-2026-0107`, P-1001, 334,400) | Registration `T1010001000101`. Three Japanese lines, not the two-line English sample in the API docs. |
| invoice_02.pdf | Ready (26 lines, `OSK-26-0112`, 1,560,988) | Whole PDF, both pages. Totals live on page 2. |
| invoice_03.pdf | Ready (`TF-2026-0115`, mixed 8% / 10%, tax 10,017) | Floor per code, then sum. |
| invoice_04.jpg | Handwriting hold, then posted after I looked. Issue date 2026-01-18 | 受領 stamp is 1/20. Didn’t use the stamp as `issue_date`. Amounts were fine. |
| invoice_05.jpg | Ready | Straight extract. |
| invoice_06.jpg | Ready (`YM-2026-0122`, 102,300) | Printed name is ヤマダ製作所. Matched P-1001 off the registration number. |
| invoice_07.jpg | Held: duplicate of 01 | Same `P-1001` / `YM-2026-0107`. Scan of the same invoice. Approve stays off. |
| invoice_08.jpg | Held: printed tax 9056 ≠ 8936, plus handwriting | Mixed 8/10. Bank account scribbled; API doesn’t have that field. Tax hold blocks Approve until a person checks. |
| invoice_09.pdf | Held: printed total 147,497 vs computed 147,496 | Lines and tax floor are 147,496. I am not POSTing 147496 to make the 422 go away. |
| invoice_10.jpg | Held: no partner. No payload. | 新星ロジスティクス / `T9090009000909` is not in the master. I didn’t guess `P-100x`. |
| invoice_11.jpg | Ready (`SATO-260205`, 125,070) | 令和8年2月5日 → 2026-02-05. |
| invoice_12.jpg | Ready (`MIT-2026-014`, 594,000) | 値引き line kept as **-30000**. |

## 7. Cost, limits, and risk in production

- **Cost per invoice** (and what makes it up): one `gemini-3.5-flash-lite` call (short prompt + one page + JSON). Google’s paid Standard list is **$0.30 / 1M input** and **$2.50 / 1M output**. A one-page invoice is a few thousand tokens in and a few hundred out, so around a tenth of a cent, not a cent. Repair pass is a second call. Free tier covered this pack.
- **Monthly cost at 1,000 invoices per month**: a few dollars of Gemini if they are mostly one page. The person reviewing the queue is the actual cost.
- **Processing time per invoice**: about 1–5s for Lite on one page. Verifier is nothing. Two-page `invoice_02` is slower. Repair adds another call.
- **Where this breaks first**: Gemini rate limits / daily caps on a cheap key. Then suppliers missing from the master (`invoice_10`). Then 税込 vs 税抜 fights that look like `AMOUNT_MISMATCH` (`invoice_09` is the 1 yen version of that).
- **How you would find out if something was registered incorrectly**: `data/queue/*.json` has the source file, checks, payload, `accounting_id`. Re-`GET /invoices` and look at the original. Production needs who clicked Approve and when. Not built here.

## 8. What you would do with another 8 hours

1. Audit log: who approved, when, hash of the payload. Right now the queue JSON is the trail and it doesn’t know who.
2. More tests (and CI) around the cases that actually lose money: mixed 8/10 floor, 01 vs 07 duplicate, unknown partner, printed total off by 1.
3. A hold state for “supplier not in master” that tells accounting “please add this registration number” instead of a dead end. Still no inventing `partner_code`.
