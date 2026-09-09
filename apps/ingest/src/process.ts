import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AccountingClient,
  invoiceKey,
  verifyExtraction,
  type QueueItem,
} from "@invo/shared";
import { settings } from "./config.ts";
import { extractWithGemini } from "./gemini.ts";
import { idFromFilename, saveItem } from "./queue.ts";

const REPAIRABLE = new Set([
  "issue_date",
  "due_date",
  "date_order",
  "currency",
  "tax_codes",
  "printed_subtotal",
  "printed_tax",
  "printed_total",
]);

function shouldRepair(item: QueueItem): boolean {
  return item.checks.some((c) => !c.ok && (REPAIRABLE.has(c.id) || c.id.startsWith("line_")));
}

export async function processFile(filePath: string): Promise<QueueItem> {
  const abs = path.resolve(filePath);
  const bytes = await readFile(abs);
  const client = new AccountingClient(settings.accountingApiUrl, settings.accountingApiKey);

  let partners: Awaited<ReturnType<AccountingClient["partners"]>> = [];
  let registeredKeys = new Set<string>();
  try {
    partners = await client.partners();
    const invoices = await client.listInvoices();
    registeredKeys = new Set(invoices.map((i) => invoiceKey(i.partner_code, i.invoice_number)));
  } catch (error) {
    console.warn(
      `Accounting API not reachable at ${settings.accountingApiUrl}. Partner matching will fail until it is up.`,
      error instanceof Error ? error.message : error,
    );
  }

  let extraction = await extractWithGemini(bytes, abs);
  let verified = verifyExtraction({ extraction, partners, registeredKeys });

  if (verified.status !== "ready" && shouldRepair({ ...asItem(abs, extraction, verified) })) {
    extraction = await extractWithGemini(bytes, abs, {
      previous: extraction,
      checks: verified.checks,
    });
    verified = verifyExtraction({ extraction, partners, registeredKeys });
  }

  const item = asItem(abs, extraction, verified);
  await saveItem(item);
  return item;
}

function asItem(
  abs: string,
  extraction: QueueItem["extraction"],
  verified: ReturnType<typeof verifyExtraction>,
): QueueItem {
  return {
    id: idFromFilename(abs),
    sourcePath: abs,
    sourceName: path.basename(abs),
    status: verified.status,
    extraction,
    payload: verified.payload,
    checks: verified.checks,
    accountingId: null,
    apiError: null,
    updatedAt: new Date().toISOString(),
  };
}
