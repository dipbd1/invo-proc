import { readFile } from "node:fs/promises";
import path from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { extractionSchema } from "@invo/shared";
import { repoRoot, settings } from "./config.ts";
import { loadItem, listItems, saveItem } from "./queue.ts";
import { PostBlockedError, postItem } from "./post.ts";
import { processFile } from "./process.ts";
import { loadPartners, refreshItem } from "./refresh.ts";

function resolveSource(sourcePath: string): string {
  if (path.isAbsolute(sourcePath)) return sourcePath;
  return path.join(repoRoot, sourcePath);
}

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.get("/partners", async (c) => {
  const partners = await loadPartners();
  return c.json({ partners });
});

app.get("/items", async (c) => {
  const items = await listItems();
  return c.json({ items });
});

app.get("/items/:id", async (c) => {
  try {
    const item = await loadItem(c.req.param("id"));
    return c.json({ item });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

app.get("/items/:id/file", async (c) => {
  try {
    const item = await loadItem(c.req.param("id"));
    const filePath = resolveSource(item.sourcePath);
    const bytes = await readFile(filePath);
    const mime = item.sourceName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg";
    return new Response(Uint8Array.from(bytes), { headers: { "Content-Type": mime } });
  } catch {
    return c.json({ error: "File not found" }, 404);
  }
});

app.patch("/items/:id", async (c) => {
  try {
    const item = await loadItem(c.req.param("id"));
    const body = (await c.req.json()) as { extraction?: unknown };
    const extraction = extractionSchema.parse(body.extraction ?? item.extraction);
    const next = await refreshItem(item, extraction);
    await saveItem(next);
    return c.json({ item: next });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid patch" }, 400);
  }
});

app.post("/items/:id/post", async (c) => {
  try {
    const item = await loadItem(c.req.param("id"));
    const posted = await postItem(item.id, item);
    return c.json({ item: posted });
  } catch (error) {
    if (error instanceof PostBlockedError) {
      return c.json({ error: error.message, item: error.item ?? null }, 409);
    }
    return c.json({ error: error instanceof Error ? error.message : "Post failed" }, 500);
  }
});

app.post("/extract", async (c) => {
  if (!settings.geminiApiKey) {
    return c.json({ error: "GEMINI_API_KEY is not set" }, 400);
  }
  const body = (await c.req.json().catch(() => ({}))) as { file?: string };
  const target = body.file
    ? path.resolve(repoRoot, body.file)
    : path.join(settings.invoicesDir, "invoice_01.pdf");
  try {
    const item = await processFile(target);
    return c.json({ item });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Extract failed" }, 500);
  }
});

serve({ fetch: app.fetch, port: settings.ingestPort }, () => {
  console.log(`Ingest API http://localhost:${settings.ingestPort}`);
});
