import { access, copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { queueItemSchema, type QueueItem } from "@invo/shared";
import { settings } from "./config.ts";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

export async function ensureQueueDir(): Promise<string> {
  await mkdir(settings.queueDir, { recursive: true });
  await seedFixtures();
  return settings.queueDir;
}

async function seedFixtures(): Promise<void> {
  let names: string[] = [];
  try {
    names = (await readdir(fixturesDir)).filter((n) => n.endsWith(".json"));
  } catch {
    return;
  }
  for (const name of names) {
    const dest = path.join(settings.queueDir, name);
    try {
      await access(dest);
    } catch {
      await copyFile(path.join(fixturesDir, name), dest);
    }
  }
}

export function itemPath(id: string): string {
  return path.join(settings.queueDir, `${id}.json`);
}

export async function saveItem(item: QueueItem): Promise<void> {
  await ensureQueueDir();
  await writeFile(itemPath(item.id), JSON.stringify(item, null, 2), "utf8");
}

export async function loadItem(id: string): Promise<QueueItem> {
  await ensureQueueDir();
  const raw = await readFile(itemPath(id), "utf8");
  return queueItemSchema.parse(JSON.parse(raw));
}

export async function listItems(): Promise<QueueItem[]> {
  await ensureQueueDir();
  const names = (await readdir(settings.queueDir)).filter((n) => n.endsWith(".json"));
  const items: QueueItem[] = [];
  for (const name of names) {
    const raw = await readFile(path.join(settings.queueDir, name), "utf8");
    items.push(queueItemSchema.parse(JSON.parse(raw)));
  }
  return items.sort((a, b) => a.sourceName.localeCompare(b.sourceName));
}

export function idFromFilename(filename: string): string {
  return path.parse(filename).name;
}
