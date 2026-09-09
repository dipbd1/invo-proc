import { loadItem } from "./queue.ts";
import { PostBlockedError, postItem } from "./post.ts";

async function main(): Promise<void> {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: npm run post -- <invoice_id>");
    process.exit(1);
  }
  const item = await loadItem(id);
  const posted = await postItem(id, item);
  console.log(`${posted.sourceName}\tposted\t${posted.accountingId}`);
}

main().catch((error: unknown) => {
  if (error instanceof PostBlockedError) {
    console.error(error.message);
    process.exit(2);
  }
  console.error(error);
  process.exit(1);
});
