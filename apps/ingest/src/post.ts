import { AccountingClient, hardFailures, type QueueItem } from "@invo/shared";
import { settings } from "./config.ts";
import { saveItem } from "./queue.ts";
import { refreshItem } from "./refresh.ts";

export async function postItem(id: string, item: QueueItem): Promise<QueueItem> {
  if (!item.payload) {
    throw new PostBlockedError("No registerable payload. Fix partner, dates, and tax codes first.");
  }

  const refreshed = await refreshItem(item, item.extraction);
  const blocked = hardFailures(refreshed.checks);
  if (blocked.length > 0) {
    await saveItem(refreshed);
    throw new PostBlockedError(`Refusing to POST: ${blocked.join(", ")}`, refreshed);
  }

  const client = new AccountingClient(settings.accountingApiUrl, settings.accountingApiKey);
  const result = await client.createInvoice(refreshed.payload!);
  if (result.status >= 400 || !result.body.success) {
    const failed: QueueItem = {
      ...refreshed,
      status: "api_error",
      apiError: result.body.error,
      updatedAt: new Date().toISOString(),
    };
    await saveItem(failed);
    throw new PostBlockedError(
      result.body.error?.message ?? `Accounting API ${result.status}`,
      failed,
    );
  }

  const posted: QueueItem = {
    ...refreshed,
    status: "posted",
    accountingId: result.body.data?.accounting_id ?? null,
    apiError: null,
    updatedAt: new Date().toISOString(),
  };
  await saveItem(posted);
  return posted;
}

export class PostBlockedError extends Error {
  constructor(
    message: string,
    readonly item?: QueueItem,
  ) {
    super(message);
    this.name = "PostBlockedError";
  }
}
