import { TAX_CODES, type TaxCode } from "./types.ts";

/** Same integer tax as the mock: floor(subtotal * rate) per tax code. */
export function taxForCode(subtotal: number, taxCode: TaxCode): number {
  const percent = taxCode === "T10" ? 10 : 8;
  return Math.floor((subtotal * percent) / 100);
}

export function taxByCode(amounts: Record<TaxCode, number>): Record<TaxCode, number> {
  return {
    T10: taxForCode(amounts.T10, "T10"),
    T08: taxForCode(amounts.T08, "T08"),
  };
}

export function mapTaxRatePercent(percent: number): TaxCode | null {
  if (percent === 10 || percent === 0.1) return "T10";
  if (percent === 8 || percent === 0.08) return "T08";
  return null;
}

export function isTaxCode(value: string): value is TaxCode {
  return (TAX_CODES as readonly string[]).includes(value);
}

export function totalsFromLines(
  lines: Array<{ amount: number; tax_code: TaxCode }>,
): { subtotal: number; taxAmount: number; total: number; taxByCode: Record<string, number> } {
  const subtotalByCode: Record<TaxCode, number> = { T10: 0, T08: 0 };
  for (const line of lines) {
    subtotalByCode[line.tax_code] += line.amount;
  }
  const taxes = taxByCode(subtotalByCode);
  const subtotal = subtotalByCode.T10 + subtotalByCode.T08;
  const taxAmount = taxes.T10 + taxes.T08;
  return {
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
    taxByCode: taxes,
  };
}
