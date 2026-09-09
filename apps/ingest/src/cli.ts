import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { settings } from "./config.ts";
import { processFile } from "./process.ts";
import { idFromFilename, queueFileExists } from "./queue.ts";

async function filesIn(target: string): Promise<string[]> {
  const info = await stat(target);
  if (info.isFile()) return [target];
  const names = await readdir(target);
  return names
    .filter((n) => /\.(pdf|jpg|jpeg|png)$/i.test(n))
    .sort()
    .map((n) => path.join(target, n));
}

async function main(): Promise<void> {
  if (!settings.geminiApiKey) {
    console.error(
      "GEMINI_API_KEY is not set. Copy .env.example to .env and add your key, then re-run:\n  cd apps/ingest && npm run ingest -- ../../static/take-home/invoices",
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const skipExisting = args.includes("--skip-existing");
  const positional = args.filter((a) => !a.startsWith("-"));
  const target = path.resolve(positional[0] ?? settings.invoicesDir);
  const files = await filesIn(target);
  if (files.length === 0) {
    console.error(`No invoice files in ${target}`);
    process.exit(1);
  }

  console.log(`Extracting ${files.length} file(s) with ${settings.geminiModel}`);
  for (const file of files) {
    try {
      if (skipExisting && (await queueFileExists(idFromFilename(file)))) {
        console.log(`${path.basename(file)}\tskipped\texists`);
        continue;
      }
      const item = await processFile(file);
      const failed = item.checks.filter((c) => !c.ok).map((c) => c.id);
      console.log(
        `${item.sourceName}\t${item.status}\t${failed.length ? failed.join(",") : "ok"}`,
      );
    } catch (error) {
      console.error(`${path.basename(file)}\tERROR\t${error instanceof Error ? error.message : error}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
