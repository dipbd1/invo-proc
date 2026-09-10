import { readFile } from "node:fs/promises";
import path from "node:path";
import { verifyExtraction, type QueueItem } from "@invo/shared";
import { extractWithGemini } from "./gemini.ts";
import { idFromFilename, saveItem } from "./queue.ts";
import { refreshSiblings, verificationContext } from "./refresh.ts";

const REPAIRABLE = new Set([
  "issue_date",
  "due_date",
  "date_order",
  "currency",
  "tax_codes",
]);

function shouldRepair(item: QueueItem): boolean {
  return item.checks.some((c) => !c.ok && (REPAIRABLE.has(c.id) || c.id.startsWith("line_")));
}

export async function processFile(filePath: string): Promise<QueueItem> {
  const abs = path.resolve(filePath);
  const bytes = await readFile(abs);
  const id = idFromFilename(abs);
  const { partners, registeredKeys } = await verificationContext(id);

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
  await refreshSiblings(item);
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
