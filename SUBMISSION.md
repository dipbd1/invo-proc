# Submission

- Name: Dip Chowdhury
- Submission date (YYYY-MM-DD): 2026-09-09
- Hours actually spent: ~8 (code, testing, giving a run with gemini api)
- Repository / how to run it: [https://github.com/dipbd1/invo-proc](https://github.com/dipbd1/invo-proc) — `cp .env.example .env` (add `GEMINI_API_KEY` when extracting), then `./start.sh`. Review UI: [http://localhost:3000](http://localhost:3000)

## 1. Understanding the request

The client described staff typing invoices one by one and month-end overtime. The sentence that changes the design is the "double payment from a typo", and mis calculation of entry, or even tax.

To solve the issue, I tried to make a pipeline, where we process the invoices into something solid machine readable. What I actually built is a "read → verify → human confirm → register" pipeline against the frozen mock at `localhost:8080`.

## 2. What you would have asked the client


| What you wanted to ask                                        | The assumption you made                                                                                                                    | Why                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| May anything post without a person looking?                   | No. Approve in the UI or `npm run post -- <id>` is required.                                                                               | Last month’s incident was a typo, reviewing is mandatory for financial topic                                                                  |
| What if the supplier is not in the partner master?            | Hold. Do not create partners and do not guess a nearby code.                                                                               | The API only accepts listed `partner_code`s.                                                                                                  |
| 税込 vs 税抜, some have these, and which amounts are on the page? | Line `amount` is the figure the API will re-sum. Tax is recomputed with the API’s floor-per-code rule. If the printed tax disagrees, hold. | Matching the mock is the only way POST survives 422 (Unprocessable Content).                                                                  |
| Are handwritten notes extra lines or comments?                | Flag `has_handwriting` and hold. Do not invent extra lines unless the note clearly changes an amount.                                      | Safer than silently booking graffiti.                                                                                                         |
| Which date if both 発行日 and a stamp exist?                     | `issue_date` = 発行日, `due_date` = お支払期日, both `YYYY-MM-DD`.                                                                                 | That is what the API accepts. Reading the API caused me to understand what shall be the end result I shall provide to align with the process. |
| Duplicate means same number globally or per supplier?         | Per supplier, as `DUPLICATE_INVOICE` is defined.                                                                                           | Matches the mock.                                                                                                                             |
| Who is the bill-to vs the issuer?                             | Issuer is the supplier we match; 御中 is Sample Trading.                                                                                     | Partner master is suppliers, not customers.                                                                                                   |




## 3. Scoping decisions

**What you built**

- Gemini 2.5 Flash structured extraction (PDF + JPEG) behind `GEMINI_API_KEY` (N.B: had to use gemini-3.6-flash as 2.5-flash was not available in the free tier, or discontinued)
- Deterministic partner match, tax mapping, amount/date/duplicate checks in `@invo/shared` . this is the shared code that is used to verify the extracted data against the mock.
- Review queue + Hono API (Backend API so I can propagate request to the accounting system)
- Review UI (original + editable fields + checks)
- Frozen accounting mock
- One-command to start all 3 apps, `./start.sh`
- A seeded `invoice_01` fixture so the post path can be demonstrated before a key exists (test purposes)

**What you left out, and why**

- Live extract of all 12 files until the Gemini key is in `.env` (called out in section 6)
- Email inbox, users, SSO, Postgres, queues — 12 files and an in-memory API
- Agent frameworks (LangGraph, Mastra) — one vision call plus code is the product
- Separate OCR (Tesseract, Document AI) — Gemini already sees the page
- Auto-post of “high confidence” items as the default — contradicts the double-pay risk



## 4. Design and technology choices

Flow: file → Gemini JSON → verify against `GET /partners` and the same tax floor as the mock → `data/queue/*.json` → human approve → `POST /invoices`.

Chose:

- **TypeScript**, because that is the stack I can defend in review
- **Gemini 2.5 Flash** + `@google/genai` structured output — Japanese, PDF, JPEG, JSON schema, free tier. Not Pro: slower and dearer for one-page invoices
- **Zod** at the model and HTTP boundary
- **npm per folder**, no workspaces — each app owns its lockfile; shared via `file:`
- **Hono + Vite/React** — local tool, no SSR
- **Python stdlib mock** — unchanged

Decided against: pnpm/Nx, Next.js, a ReAct agent loop, a vector store for five partners, rewriting totals to satisfy 422.

Default model: `gemini-2.5-flash`. Override with `GEMINI_MODEL`.

## 5. How you used AI, and how you checked it

**What you delegated to AI**

- Reading the page (layout, handwriting, Japanese labels)
- Producing the extraction JSON (names, dates, lines, printed totals)
- One bounded repair pass if date/line/tax checks fail

**How you verified the output**

- Zod parse (types)
- `quantity × unit_price === amount` when both sides exist
- Subtotal / tax / total recomputed with `floor(subtotal × rate)` per `T10`/`T08`
- Partner via registration number, then name/alias — never from the model’s imagination
- Duplicate key `(partner_code, invoice_number)` against `GET /invoices`
- The accounting API itself as the last judge (it recalculates on POST)

**A case where the AI got it wrong** (one example is enough, if you have one)

Not yet from a live Gemini run. The fixture path did catch the **duplicate** case: posting `YM-2026-0107` for `P-1001` a second time is refused (`Refusing to POST: duplicate`) and Approve stays disabled once status is `posted`. That is the check that would have caught last month’s near double-pay.

When the 12-file run is done, this subsection should name a real extraction miss.

## 6. Integrating with the accounting system

Constraints handled in shared code before POST: `YYYY-MM-DD`, integer JPY, tax codes not rates, partner must exist, tax = floor per code, duplicate = 409.


| Invoice                                               | Result                                | How you handled it                                                                                      |
| ----------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| invoice_01 (fixture, assignment example YM-2026-0107) | Posted `ACC-0001` on explicit approve | Partner `T1010001000101` → `P-1001`. Second post blocked as duplicate.                                  |
| invoice_02–invoice_12                                 | Not extracted in this submission yet  | Waiting on `GEMINI_API_KEY`. CLI: `cd apps/ingest && npm run ingest -- ../../static/take-home/invoices` |


If POST still 422s, the queue item becomes `api_error` and keeps the API error body. Numbers are not silently adjusted.

N.B: i was having issue to use certain model, as I am a new API class user for Gemini, and they are not giving me the model  which will be best for cost. So the integration happened in 2 phase, where I used my local LLM to do things, and later I took the API, converted ingestion code.

## 7. Cost, limits, and risk in production

- **Cost per invoice** (and what makes it up): one `gemini-3.5-flash-lite` call — short prompt + ~1 page PDF/JPEG + short JSON. Paid Standard is **$0.30 / 1M input** (text/image/PDF) and **$2.50 / 1M output** (incl. thinking). A one-page invoice is typically a few thousand input tokens and a few hundred output tokens, so **well under $0.01** (about **$0.001–$0.01**). Free tier covers this sample pack. A repair pass is a second call and roughly doubles that. Cheaper on paper: `gemini-3.1-flash-lite` at **$0.25 / $1.50**, or 2.5 Flash-Lite at **$0.10 / $0.40** (this key cannot use 2.5). Dearer: 3.6 Flash at **$0.75 / $3.75**. Lite is the right default because the verifier, not the model, owns the numbers.
- **Monthly cost at 1,000 invoices per month**: about **$1–$10** of Gemini on Standard (a few dollars if most invoices are one page and skip repair). Review time still dominates money.
- **Processing time per invoice**: typically **1–5s** for Flash-Lite on a one-page invoice; verifier is milliseconds. Repair pass adds another call.
- **Where this breaks first**: Gemini rate limits / free-tier daily caps; then suppliers missing from the master; then 税込 vs 税抜 disagreements that look like `AMOUNT_MISMATCH`.
- **How you would find out if something was registered incorrectly**: the queue JSON is the audit (source file, checks, payload, `accounting_id`, reviewer click). Re-GET `/invoices` and diff against the source file. Production would add who approved and when — not built here.



## 8. What you would do with another 8 hours

The current code of the Repo cover the PoC completely for now. The furnishing, or making it production grade is not something that can be done in 8 hours. But for production, where I can work on feedback and with stakeholders, I will do

- Add a audit log (who approved, payload hash) so a wrong POST is reconstructable without reading `data/queue` by hand.
- Add a email inbox, users, SSO, Postgres, queues — 12 files and an in-memory API
- Add a Agent frameworks (LangGraph, Mastra) — one vision call plus code is the product
- Add a Auto-post of “high confidence” items as the default — contradicts the double-pay risk

