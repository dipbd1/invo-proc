import assert from "node:assert/strict";
import { test } from "node:test";
import { matchPartner, normalizeRegistrationNo } from "./partner.ts";
import type { Partner } from "./types.ts";

const partners: Partner[] = [
  {
    partner_code: "P-1001",
    name: "株式会社山田製作所",
    aliases: ["ヤマダ製作所", "山田製作所"],
    registration_no: "T1010001000101",
  },
  {
    partner_code: "P-1003",
    name: "東京フーズ株式会社",
    aliases: ["東京フーズ"],
    registration_no: "T3030003000303",
  },
];

test("registration number wins over a messy printed name", () => {
  const result = matchPartner(partners, {
    supplierNameRaw: "山田",
    registrationNoRaw: "登録番号 T1010001000101",
  });
  assert.equal(result.status, "matched");
  if (result.status === "matched") {
    assert.equal(result.partner.partner_code, "P-1001");
    assert.equal(result.via, "registration_no");
  }
});

test("alias match without 株式会社", () => {
  const result = matchPartner(partners, {
    supplierNameRaw: "東京フーズ",
    registrationNoRaw: null,
  });
  assert.equal(result.status, "matched");
  if (result.status === "matched") {
    assert.equal(result.partner.partner_code, "P-1003");
  }
});

test("unknown supplier does not guess a partner code", () => {
  const result = matchPartner(partners, {
    supplierNameRaw: "架空商事",
    registrationNoRaw: null,
  });
  assert.equal(result.status, "none");
});

test("normalizeRegistrationNo pulls T + 13 digits out of a label", () => {
  assert.equal(normalizeRegistrationNo("T1010001000101"), "T1010001000101");
  assert.equal(normalizeRegistrationNo("登録番号：T1010001000101"), "T1010001000101");
});
