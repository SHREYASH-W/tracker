import { randomBytes } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sqlite } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `contact-crm-backup-${stamp}.db`;
  const tempPath = join(tmpdir(), `contact-crm-backup-${randomBytes(6).toString("hex")}.db`);

  try {
    // VACUUM INTO produces a clean, consistent snapshot including WAL contents.
    sqlite.exec(`VACUUM INTO '${tempPath.replace(/'/g, "''")}'`);
    const buffer = await readFile(tempPath);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/x-sqlite3",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await unlink(tempPath).catch(() => {});
  }
}
