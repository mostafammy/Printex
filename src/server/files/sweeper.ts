// Temp object sweeper — 050-files
// Cron job: removes temp objects older than 1 hour, logs cleanup
// Run every hour via cron or scheduler

import { unlink, readdir, stat } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { db as prisma } from "@/server/db.js";

const TEMP_DIR = tmpdir();
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export interface SweepResult {
  scanned: number;
  deleted: number;
  errors: number;
  freedBytes: number;
}

export async function sweepTempObjects(tempDir = TEMP_DIR): Promise<SweepResult> {
  const result: SweepResult = {
    scanned: 0,
    deleted: 0,
    errors: 0,
    freedBytes: 0,
  };

  try {
    const entries = await readdir(tempDir);

    for (const entry of entries) {
      // Only process our temp files (upload-*, attach-*, etc.)
      if (!entry.startsWith("upload-") && !entry.startsWith("attach-")) {
        continue;
      }

      result.scanned++;

      const filePath = join(tempDir, entry);

      try {
        const stats = await stat(filePath);
        const age = Date.now() - stats.mtimeMs;

        if (age > MAX_AGE_MS) {
          await unlink(filePath);
          result.deleted++;
          result.freedBytes += stats.size;
        }
      } catch (error) {
        result.errors++;
        console.error(`Sweeper error for ${entry}:`, error);
      }
    }
  } catch (error) {
    console.error("Sweeper directory error:", error);
    result.errors++;
  }

  // Log cleanup
  if (result.deleted > 0 || result.errors > 0) {
    console.log(`Temp sweep: scanned=${result.scanned}, deleted=${result.deleted}, freed=${result.freedBytes} bytes, errors=${result.errors}`);
  }

  return result;
}

/**
 * Clean up temp files associated with a failed upload/attachment.
 * Called from upload/attachment routes on error.
 */
export async function cleanupTempFile(fileName: string, tempDir = TEMP_DIR): Promise<void> {
  const filePath = join(tempDir, fileName);
  try {
    await unlink(filePath);
  } catch {
    // Ignore - file may not exist
  }
}

/**
 * Scheduled sweeper - call this from a cron job or scheduler.
 * Runs every hour.
 * Uses a valid system actor ID (first admin user) for audit trail.
 */
export async function runScheduledSweep(): Promise<void> {
  const result = await sweepTempObjects();

  // Log to database for audit trail using a valid system actor
  try {
    const systemUser = await prisma.user.findFirst({
      where: { roles: { some: { role: { key: "ADMIN_OWNER" } } } },
      select: { id: true },
    });

    if (systemUser) {
      await prisma.fileAuditEvent.create({
        data: {
          actorId: systemUser.id,
          action: "UPDATE",
          entity: "FILE_OBJECT",
          entityId: "temp-sweep",
          afterValues: {
            scanned: result.scanned,
            deleted: result.deleted,
            freedBytes: result.freedBytes,
            errors: result.errors,
          },
          reason: "Hourly temp object cleanup",
        },
      });
    }
  } catch {
    // Ignore audit errors — sweeper should not fail
  }
}

// Export for manual invocation
export { sweepTempObjects as default };