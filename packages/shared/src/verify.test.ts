import assert from "node:assert/strict";
import { test } from "node:test";
import type { Extraction, Partner } from "./types.ts";
import { invoiceKey, verifyExtraction } from "./verify.ts";

const partners: Partner[] = [
  {
    partner_code: "P-1001",
    name: "株式会社山田製作所",
    aliases: ["ヤマダ製作所", "山田製作所"],
    registration_no: "T1010001000101",
  },
];

const clean: Extraction = {
  supplier_name_raw: "株式会社山田製作所",
  registration_no_raw: "T1010001000101",
  invoice_number: "YM-2026-0107",
  issue_date: "2026-01-07",
  due_date: "2026-02-28",
  currency: "JPY",
  lines: [
    {
      description: "Precision part A-100",
      quantity: 120,
      unit: "pcs",
      unit_price: 1250,
      amount: 150000,
      tax_rate_percent: 10,
    },
    {
      description: "Packing and freight",
      quantity: null,
      unit: "lot",
      unit_price: null,
      amount: 18000,
      tax_rate_percent: 10,
    },
  ],
  printed_subtotal: 168000,
  printed_tax_amount: 16800,
  printed_total: 184800,
  has_handwriting: false,
  uncertain_fields: [],
};

test("clean invoice is ready and uses API totals, not a guessed partner", () => {
  const result = verifyExtraction({
    extraction: clean,
    partners,
    registeredKeys: new Set(),
  });
  assert.equal(result.status, "ready");
  assert.ok(result.payload);
  assert.equal(result.payload?.partner_code, "P-1001");
  assert.equal(result.payload?.subtotal, 168000);
  assert.equal(result.payload?.tax_amount, 16800);
  assert.equal(result.payload?.total_amount, 184800);
  assert.ok(result.checks.every((c) => c.ok));
});

test("printed total mismatch is held, totals are not rewritten to please the API", () => {
  const result = verifyExtraction({
    extraction: { ...clean, printed_total: 1 },
    partners,
    registeredKeys: new Set(),
  });
  assert.equal(result.status, "needs_review");
  const printed = result.checks.find((c) => c.id === "printed_total");
  assert.equal(printed?.ok, false);
  assert.equal(result.payload?.total_amount, 184800);
});

test("duplicate partner + invoice number is blocked before POST", () => {
  const result = verifyExtraction({
    extraction: clean,
    partners,
    registeredKeys: new Set([invoiceKey("P-1001", "YM-2026-0107")]),
  });
  assert.equal(result.status, "needs_review");
  assert.equal(result.checks.find((c) => c.id === "duplicate")?.ok, false);
});
