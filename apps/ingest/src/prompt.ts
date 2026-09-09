/** JSON Schema Gemini can constrain. Keep it boring: no $ref, no extra keywords. */
export const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "supplier_name_raw",
    "registration_no_raw",
    "invoice_number",
    "issue_date",
    "due_date",
    "currency",
    "lines",
    "printed_subtotal",
    "printed_tax_amount",
    "printed_total",
    "has_handwriting",
    "uncertain_fields",
  ],
  properties: {
    supplier_name_raw: {
      type: "string",
      description: "Supplier / issuer name as printed, not the bill-to company.",
    },
    registration_no_raw: {
      type: ["string", "null"],
      description: "Qualified invoice issuer number (T + 13 digits) if printed.",
    },
    invoice_number: { type: "string" },
    issue_date: {
      type: "string",
      description: "Issue date as YYYY-MM-DD. Convert 令和 or YYYY年M月D日.",
    },
    due_date: {
      type: ["string", "null"],
      description: "Payment due date as YYYY-MM-DD, or null if absent.",
    },
    currency: { type: "string", description: "JPY unless another currency is printed." },
    lines: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description", "quantity", "unit", "unit_price", "amount", "tax_rate_percent"],
        properties: {
          description: { type: "string" },
          quantity: { type: ["integer", "null"] },
          unit: { type: "string", description: "pcs, lot, 式, 個, etc. Never empty." },
          unit_price: { type: ["integer", "null"] },
          amount: { type: "integer", description: "Line amount in JPY, no commas or decimals." },
          tax_rate_percent: {
            type: "number",
            description: "10 or 8 as printed. Not a tax code.",
          },
        },
      },
    },
    printed_subtotal: { type: ["integer", "null"] },
    printed_tax_amount: { type: ["integer", "null"] },
    printed_total: { type: ["integer", "null"] },
    has_handwriting: { type: "boolean" },
    uncertain_fields: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export const EXTRACT_PROMPT = `You are reading a Japanese supplier invoice for Sample Trading Co.

Extract the document into the JSON schema. Rules:
- The supplier is the issuer (請求元), not the addressee (御中).
- Amounts are integers in JPY. Strip yen signs and commas. No decimals.
- Dates must be YYYY-MM-DD. Convert 令和 eras and YYYY年M月D日.
- tax_rate_percent is 10 or 8 from 税率 / 消費税, not a tax code.
- If quantity or unit price is missing, use null. amount is still required.
- If a unit is missing, use "式".
- Do not invent an invoice number; copy it. If truly absent, use the filename-like best effort and add "invoice_number" to uncertain_fields.
- Handwritten notes: set has_handwriting true. Do not turn notes into extra lines unless they clearly change amounts.
- Do not output partner_code.`;
