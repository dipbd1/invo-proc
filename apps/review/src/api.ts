import type { Extraction, QueueItem } from "@invo/shared";

const base = "/api";

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T);
  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? response.statusText);
  }
  return data;
}

export function listItems(): Promise<{ items: QueueItem[] }> {
  return fetch(`${base}/items`).then((r) => parse(r));
}

export function getItem(id: string): Promise<{ item: QueueItem }> {
  return fetch(`${base}/items/${id}`).then((r) => parse(r));
}

export function saveItem(id: string, extraction: Extraction): Promise<{ item: QueueItem }> {
  return fetch(`${base}/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extraction }),
  }).then((r) => parse(r));
}

export function postItem(id: string): Promise<{ item: QueueItem }> {
  return fetch(`${base}/items/${id}/post`, { method: "POST" }).then((r) => parse(r));
}

export function fileUrl(id: string): string {
  return `${base}/items/${id}/file`;
}
