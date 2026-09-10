import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");

config({ path: path.join(repoRoot, ".env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env`);
  }
  return value;
}

export const settings = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
  accountingApiUrl: process.env.ACCOUNTING_API_URL ?? "http://localhost:8080",
  accountingApiKey: process.env.ACCOUNTING_API_KEY ?? "demo-key-1234",
  ingestPort: Number(process.env.INGEST_PORT ?? 3001),
  invoicesDir: path.resolve(repoRoot, process.env.INVOICES_DIR ?? "static/take-home/invoices"),
  queueDir: path.resolve(repoRoot, process.env.QUEUE_DIR ?? "data/queue"),
};

export function requireGeminiKey(): string {
  return required("GEMINI_API_KEY");
}
