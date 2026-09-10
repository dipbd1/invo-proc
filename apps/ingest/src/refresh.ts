import {
  AccountingClient,
  invoiceKey,
  siblingInvoiceKeys,
  verifyExtraction,
  type Extraction,
  type Partner,
  type QueueItem,
} from "@invo/shared";
import { settings } from "./config.ts";
import { listItems, saveItem } from "./queue.ts";

export async function registeredKeys(): Promise<Set<string>> {
  const client = new AccountingClient(settings.accountingApiUrl, settings.accountingApiKey);
  try {
    const invoices = await client.listInvoices();
    return new Set(invoices.map((i) => invoiceKey(i.partner_code, i.invoice_number)));
  } catch {
    return new Set();
  }
}

export async function loadPartners(): Promise<Partner[]> {
  const client = new AccountingClient(settings.accountingApiUrl, settings.accountingApiKey);
  try {
    return await client.partners();
  } catch {
    return [];
  }
}

export async function verificationContext(currentId: string): Promise<{
  partners: Partner[];
  registeredKeys: Set<string>;
}> {
  const [partners, apiKeys, items] = await Promise.all([
    loadPartners(),
    registeredKeys(),
    listItems(),
  ]);
  const keys = new Set(apiKeys);
  for (const key of siblingInvoiceKeys(items, currentId)) {
    keys.add(key);
  }
  return { partners, registeredKeys: keys };
}

export async function refreshItem(item: QueueItem, extraction: Extraction): Promise<QueueItem> {
  const { partners, registeredKeys } = await verificationContext(item.id);
  const verified = verifyExtraction({ extraction, partners, registeredKeys });
  return {
    ...item,
    extraction,
    payload: verified.payload,
    checks: verified.checks,
    status: item.status === "posted" ? "posted" : verified.status,
    updatedAt: new Date().toISOString(),
  };
}

export async function refreshSiblings(item: QueueItem): Promise<void> {
  if (!item.payload) return;
  const key = invoiceKey(item.payload.partner_code, item.payload.invoice_number);
  const items = await listItems();
  for (const other of items) {
    if (other.id === item.id || !other.payload || other.status === "posted") continue;
    const otherKey = invoiceKey(other.payload.partner_code, other.payload.invoice_number);
    if (otherKey !== key) continue;
    const next = await refreshItem(other, other.extraction);
    await saveItem(next);
  }
}
