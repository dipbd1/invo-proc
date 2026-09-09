import {
  AccountingClient,
  invoiceKey,
  verifyExtraction,
  type Extraction,
  type QueueItem,
} from "@invo/shared";
import { settings } from "./config.ts";

export async function registeredKeys(): Promise<Set<string>> {
  const client = new AccountingClient(settings.accountingApiUrl, settings.accountingApiKey);
  try {
    const invoices = await client.listInvoices();
    return new Set(invoices.map((i) => invoiceKey(i.partner_code, i.invoice_number)));
  } catch {
    return new Set();
  }
}

export async function loadPartners() {
  const client = new AccountingClient(settings.accountingApiUrl, settings.accountingApiKey);
  try {
    return await client.partners();
  } catch {
    return [];
  }
}

export async function refreshItem(item: QueueItem, extraction: Extraction): Promise<QueueItem> {
  const [partners, keys] = await Promise.all([loadPartners(), registeredKeys()]);
  const verified = verifyExtraction({ extraction, partners, registeredKeys: keys });
  return {
    ...item,
    extraction,
    payload: verified.payload,
    checks: verified.checks,
    status: item.status === "posted" ? "posted" : verified.status,
    updatedAt: new Date().toISOString(),
  };
}
