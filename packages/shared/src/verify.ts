import { matchPartner } from "./partner.ts";
import { mapTaxRatePercent, totalsFromLines } from "./tax.ts";
import type {
  Check,
  Extraction,
  InvoiceLine,
  Partner,
  QueueStatus,
  RegisterInvoice,
} from "./types.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export type VerifyInput = {
  extraction: Extraction;
  partners: Partner[];
  registeredKeys: Set<string>;
};

export type VerifyResult = {
  checks: Check[];
  payload: RegisterInvoice | null;
  status: QueueStatus;
};

export function invoiceKey(partnerCode: string, invoiceNumber: string): string {
  return `${partnerCode}::${invoiceNumber}`;
}

const HARD_FAIL_IDS = new Set([
  "partner",
  "issue_date",
  "due_date",
  "date_order",
  "currency",
  "tax_codes",
  "duplicate",
  "printed_subtotal",
  "printed_tax",
  "printed_total",
]);

export function isHardFailCheck(id: string): boolean {
  return HARD_FAIL_IDS.has(id) || /^line_\d+_tax$/.test(id);
}

export function hardFailures(checks: Check[]): string[] {
  return checks.filter((c) => !c.ok && isHardFailCheck(c.id)).map((c) => c.id);
}

export function canApprove(item: {
  status: QueueStatus;
  payload: RegisterInvoice | null;
  checks: Check[];
}): boolean {
  if (item.status === "posted") return false;
  if (!item.payload) return false;
  return hardFailures(item.checks).length === 0;
}

/** Other queue files with the same partner+number. Earlier id (or already posted) wins. */
export function siblingInvoiceKeys(
  items: Array<{
    id: string;
    status: string;
    payload: { partner_code: string; invoice_number: string } | null;
  }>,
  currentId: string,
): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.id === currentId || !item.payload) continue;
    const earlier = item.id.localeCompare(currentId) < 0;
    if (earlier || item.status === "posted") {
      keys.add(invoiceKey(item.payload.partner_code, item.payload.invoice_number));
    }
  }
  return keys;
}

export function verifyExtraction(input: VerifyInput): VerifyResult {
  const checks: Check[] = [];
  const { extraction, partners, registeredKeys } = input;

  const partnerMatch = matchPartner(partners, {
    supplierNameRaw: extraction.supplier_name_raw,
    registrationNoRaw: extraction.registration_no_raw,
  });

  if (partnerMatch.status === "matched") {
    checks.push({
      id: "partner",
      ok: true,
      message: `Matched ${partnerMatch.partner.partner_code} via ${partnerMatch.via}`,
    });
  } else if (partnerMatch.status === "ambiguous") {
    checks.push({
      id: "partner",
      ok: false,
      message: `Ambiguous supplier: ${partnerMatch.partners.map((p) => p.partner_code).join(", ")}`,
    });
  } else {
    checks.push({
      id: "partner",
      ok: false,
      message: `No partner master match for “${extraction.supplier_name_raw}”`,
    });
  }

  checks.push({
    id: "currency",
    ok: extraction.currency === "JPY",
    message:
      extraction.currency === "JPY"
        ? "Currency is JPY"
        : `Only JPY is accepted, got ${extraction.currency}`,
  });

  const issueOk = isIsoDate(extraction.issue_date);
  checks.push({
    id: "issue_date",
    ok: issueOk,
    message: issueOk
      ? `Issue date ${extraction.issue_date}`
      : `Issue date must be YYYY-MM-DD (got ${extraction.issue_date})`,
  });

  const due = extraction.due_date;
  const dueOk = Boolean(due && isIsoDate(due));
  checks.push({
    id: "due_date",
    ok: dueOk,
    message: dueOk ? `Due date ${due}` : `Due date missing or not YYYY-MM-DD (got ${due})`,
  });

  if (issueOk && dueOk && due) {
    const orderOk = due >= extraction.issue_date;
    checks.push({
      id: "date_order",
      ok: orderOk,
      message: orderOk
        ? "Due date is on or after issue date"
        : "Due date is before issue date",
    });
  }

  const mappedLines: InvoiceLine[] = [];
  let taxOk = true;
  extraction.lines.forEach((line, index) => {
    const taxCode = mapTaxRatePercent(line.tax_rate_percent);
    if (!taxCode) {
      taxOk = false;
      checks.push({
        id: `line_${index}_tax`,
        ok: false,
        message: `Line ${index + 1}: unknown tax rate ${line.tax_rate_percent}`,
      });
    } else {
      mappedLines.push({
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price: line.unit_price,
        amount: line.amount,
        tax_code: taxCode,
      });
    }

    if (line.quantity != null && line.unit_price != null) {
      const expected = line.quantity * line.unit_price;
      const lineOk = expected === line.amount;
      checks.push({
        id: `line_${index}_qty`,
        ok: lineOk,
        message: lineOk
          ? `Line ${index + 1}: quantity × unit price matches amount`
          : `Line ${index + 1}: ${line.quantity} × ${line.unit_price} = ${expected}, amount is ${line.amount}`,
      });
    }
  });

  if (taxOk && mappedLines.length === extraction.lines.length) {
    checks.push({
      id: "tax_codes",
      ok: true,
      message: "Every line maps to T10 or T08",
    });
  }

  const computed =
    mappedLines.length > 0
      ? totalsFromLines(mappedLines)
      : { subtotal: 0, taxAmount: 0, total: 0, taxByCode: {} };

  if (extraction.printed_subtotal != null) {
    const ok = extraction.printed_subtotal === computed.subtotal;
    checks.push({
      id: "printed_subtotal",
      ok,
      message: ok
        ? "Printed subtotal matches sum of lines"
        : `Printed subtotal ${extraction.printed_subtotal} ≠ computed ${computed.subtotal}. Holding — will not rewrite the total.`,
    });
  }

  if (extraction.printed_tax_amount != null && mappedLines.length > 0) {
    const ok = extraction.printed_tax_amount === computed.taxAmount;
    checks.push({
      id: "printed_tax",
      ok,
      message: ok
        ? "Printed tax matches floor-per-code recalculation"
        : `Printed tax ${extraction.printed_tax_amount} ≠ API rule ${computed.taxAmount}. Holding — will not fudge tax to pass 422.`,
    });
  }

  if (extraction.printed_total != null && mappedLines.length > 0) {
    const ok = extraction.printed_total === computed.total;
    checks.push({
      id: "printed_total",
      ok,
      message: ok
        ? "Printed total matches subtotal + tax"
        : `Printed total ${extraction.printed_total} ≠ computed ${computed.total}. Holding — will not fudge the total.`,
    });
  }

  if (extraction.has_handwriting) {
    checks.push({
      id: "handwriting",
      ok: false,
      message: "Handwriting flagged — needs a human look",
    });
  }

  if (extraction.uncertain_fields.length > 0) {
    checks.push({
      id: "uncertain",
      ok: false,
      message: `Model marked uncertain: ${extraction.uncertain_fields.join(", ")}`,
    });
  }

  let payload: RegisterInvoice | null = null;
  if (partnerMatch.status === "matched" && taxOk && issueOk && dueOk && due) {
    const partnerCode = partnerMatch.partner.partner_code;
    const key = invoiceKey(partnerCode, extraction.invoice_number);
    const dup = registeredKeys.has(key);
    checks.push({
      id: "duplicate",
      ok: !dup,
      message: dup
        ? `Same invoice number already exists for ${partnerCode} / ${extraction.invoice_number}`
        : "Invoice number is not already registered for this partner",
    });

    payload = {
      partner_code: partnerCode,
      invoice_number: extraction.invoice_number,
      issue_date: extraction.issue_date,
      due_date: due,
      currency: "JPY",
      lines: mappedLines,
      subtotal: computed.subtotal,
      tax_amount: computed.taxAmount,
      total_amount: computed.total,
    };
  }

  const blocking = checks.filter((c) => !c.ok);
  const status: QueueStatus = blocking.length === 0 ? "ready" : "needs_review";

  return { checks, payload, status };
}
