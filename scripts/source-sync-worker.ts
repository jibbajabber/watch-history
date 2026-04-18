import { Client } from "pg";
import { readHomeAssistantConfig } from "@/lib/home-assistant-config";
import { readPlexConfig } from "@/lib/plex-config";
import { runSourceRetentionCleanup } from "@/lib/source-retention";

const internalAppUrl = process.env.APP_INTERNAL_URL?.trim() || "http://web:3000";
const databaseUrl = process.env.DATABASE_URL;
const syncRequestTimeoutMs = 60_000;
let tickInProgress = false;

type SyncTarget = {
  slug: "home-assistant" | "plex";
  label: string;
  path: string;
};

const syncTargets: SyncTarget[] = [
  {
    slug: "home-assistant",
    label: "home-assistant",
    path: "/api/sources/home-assistant/import"
  },
  {
    slug: "plex",
    label: "plex",
    path: "/api/sources/plex/import"
  }
];

async function readSyncConfig(slug: SyncTarget["slug"]) {
  if (slug === "home-assistant") {
    const result = await readHomeAssistantConfig();

    return result.ok
      ? {
          ok: true as const,
          enabled: result.config.sync.enabled,
          intervalMinutes: result.config.sync.intervalMinutes,
          retention: result.config.retention
        }
      : {
          ok: false as const,
          enabled: false,
          intervalMinutes: 30,
          message: result.message
        };
  }

  const result = await readPlexConfig();

  return result.ok
    ? {
        ok: true as const,
        enabled: result.config.sync.enabled,
        intervalMinutes: result.config.sync.intervalMinutes,
        retention: result.config.retention
      }
    : {
        ok: false as const,
        enabled: false,
        intervalMinutes: 30,
        message: result.message
      };
}

function log(label: string, message: string) {
  console.log(`[source-sync-worker:${label}] ${message}`);
}

async function getLatestImport(slug: SyncTarget["slug"]) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured for the sync worker.");
  }

  const client = new Client({
    connectionString: databaseUrl
  });

  await client.connect();

  try {
    const result = await client.query<{
      status: string;
      started_at: string;
      completed_at: string | null;
    }>(
      `
        SELECT
          ij.status,
          ij.started_at::text,
          ij.completed_at::text
        FROM import_jobs ij
        INNER JOIN sources s ON s.id = ij.source_id
        WHERE s.slug = $1
        ORDER BY ij.started_at DESC
        LIMIT 1
      `,
      [slug]
    );

    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

async function shouldTriggerSync(target: SyncTarget) {
  const sync = await readSyncConfig(target.slug);

  if (!sync.ok) {
    return {
      shouldRun: false,
      reason: sync.message,
      intervalMinutes: sync.intervalMinutes
    };
  }

  if (!sync.enabled) {
    return {
      shouldRun: false,
      reason: "sync disabled",
      intervalMinutes: sync.intervalMinutes
    };
  }

  const latestImport = await getLatestImport(target.slug);

  if (!latestImport) {
    return {
      shouldRun: true,
      reason: "no previous import found",
      intervalMinutes: sync.intervalMinutes
    };
  }

  if (latestImport.status === "running") {
    return {
      shouldRun: false,
      reason: "an import is already running",
      intervalMinutes: sync.intervalMinutes
    };
  }

  const comparisonTime = latestImport.completed_at ?? latestImport.started_at;
  const elapsedMs = Date.now() - new Date(comparisonTime).getTime();

  if (elapsedMs >= sync.intervalMinutes * 60 * 1000) {
    return {
      shouldRun: true,
      reason: `interval met after ${Math.floor(elapsedMs / 60000)} minute(s)`,
      intervalMinutes: sync.intervalMinutes
    };
  }

  const remainingMinutes = Math.max(
    1,
    Math.ceil((sync.intervalMinutes * 60 * 1000 - elapsedMs) / 60000)
  );

  return {
    shouldRun: false,
    reason: `next run due in about ${remainingMinutes} minute(s)`,
    intervalMinutes: sync.intervalMinutes
  };
}

async function triggerSync(target: SyncTarget) {
  const response = await fetch(`${internalAppUrl}${target.path}`, {
    method: "POST",
    signal: AbortSignal.timeout(syncRequestTimeoutMs)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Scheduled sync failed with status ${response.status}: ${body}`);
  }
}

async function tickTarget(target: SyncTarget) {
  try {
    const sync = await readSyncConfig(target.slug);

    if (sync.ok) {
      const cleanup = await runSourceRetentionCleanup(target.slug, sync.retention);

      if (cleanup.status === "completed") {
        const deletedRows =
          cleanup.deletedProvisionalWatchEvents +
          cleanup.deletedProvisionalRawRecords +
          cleanup.deletedDurableWatchEvents +
          cleanup.deletedDurableRawRecords +
          cleanup.deletedImportJobs;

        if (deletedRows > 0) {
          log(
            target.label,
            `retention cleanup removed ${deletedRows} row(s) (${cleanup.deletedDurableWatchEvents} durable events, ${cleanup.deletedDurableRawRecords} durable raw rows, ${cleanup.deletedImportJobs} import jobs, ${cleanup.deletedProvisionalWatchEvents + cleanup.deletedProvisionalRawRecords} provisional rows)`
          );
        }
      }
    }

    const decision = await shouldTriggerSync(target);

    if (decision.shouldRun) {
      log(target.label, `triggering scheduled sync (${decision.reason})`);
      await triggerSync(target);
      log(target.label, "scheduled sync completed");
    } else {
      log(target.label, `skipping tick (${decision.reason}, interval ${decision.intervalMinutes} min)`);
    }
  } catch (error) {
    console.error(
      `[source-sync-worker:${target.label}] ${
        error instanceof Error ? error.message : "Unknown sync failure"
      }`
    );
  }
}

async function tick() {
  if (tickInProgress) {
    console.log("[source-sync-worker] skipping tick because the previous cycle is still running");
    return;
  }

  tickInProgress = true;
  try {
    for (const target of syncTargets) {
      await tickTarget(target);
    }
  } finally {
    tickInProgress = false;
  }
}

async function main() {
  console.log(`[source-sync-worker] worker started, app endpoint ${internalAppUrl}`);
  await tick();
  setInterval(() => {
    void tick();
  }, 60_000);
}

void main();
