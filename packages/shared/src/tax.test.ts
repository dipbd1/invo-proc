import assert from "node:assert/strict";
import { test } from "node:test";
import { taxForCode, totalsFromLines } from "./tax.ts";

test("floor tax matches the accounting API example (10% of 168000)", () => {
  assert.equal(taxForCode(168000, "T10"), 16800);
});

test("8% tax floors the fraction", () => {
  assert.equal(taxForCode(1000, "T08"), 80);
  assert.equal(taxForCode(125, "T08"), 10);
});

test("mixed rates sum floor-per-code, not floor of the combined total", () => {
  const totals = totalsFromLines([
    { amount: 1000, tax_code: "T10" },
    { amount: 125, tax_code: "T08" },
  ]);
  assert.equal(totals.subtotal, 1125);
  assert.equal(totals.taxAmount, 100 + 10);
  assert.equal(totals.total, 1235);
});
