import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { Client } from "pg";

const configPath = path.join(process.cwd(), "configs", "home-assistant.yaml");
const internalAppUrl = process.env.APP_INTERNAL_URL?.trim() || "http://web:3000";
const databaseUrl = process.env.DATABASE_URL;

type WorkerConfig = {
  sync?: {
    enabled?: unknown;
    interval_minutes?: unknown;
  };
};

async function readSyncConfig() {
  const raw = await readFile(configPath, "utf8");
  const parsed = YAML.parse(raw) as WorkerConfig | null;
  const enabled = parsed?.sync?.enabled === true;
  const intervalValue = parsed?.sync?.interval_minutes;
  const intervalMinutes =
    typeof intervalValue === "number" && Number.isFinite(intervalValue) && intervalValue > 0
      ? Math.floor(intervalValue)
      : 30;

  return {
    enabled,
    intervalMinutes
  };
}

function log(message: string) {
  console.log(`[home-assistant-sync-worker] ${message}`);
}

async function getLatestImport() {
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
        WHERE s.slug = 'home-assistant'
        ORDER BY ij.started_at DESC
        LIMIT 1
      `
    );

    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

async function shouldTriggerSync() {
  const sync = await readSyncConfig();

  if (!sync.enabled) {
    return {
      shouldRun: false,
      reason: "sync disabled",
      intervalMinutes: sync.intervalMinutes
    };
  }

  const latestImport = await getLatestImport();

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

async function triggerSync() {
  const response = await fetch(`${internalAppUrl}/api/sources/home-assistant/import`, {
    method: "POST"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Scheduled sync failed with status ${response.status}: ${body}`);
  }
}

async function tick() {
  try {
    const decision = await shouldTriggerSync();

    if (decision.shouldRun) {
      log(`triggering scheduled sync (${decision.reason})`);
      await triggerSync();
      log("scheduled sync completed");
    } else {
      log(`skipping tick (${decision.reason}, interval ${decision.intervalMinutes} min)`);
    }
  } catch (error) {
    console.error(
      `[home-assistant-sync-worker] ${
        error instanceof Error ? error.message : "Unknown sync failure"
      }`
    );
  }
}

async function main() {
  log(`worker started, app endpoint ${internalAppUrl}`);
  await tick();
  setInterval(() => {
    void tick();
  }, 60_000);
}

void main();
