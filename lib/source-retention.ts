import { getPool, query } from "@/lib/db";
import { getSourceImportLockKey, type SourceSlug } from "@/lib/source-locks";

type SourceRow = {
  id: string;
};

export type SourceRetentionConfig = {
  mode: "indefinite" | "windowed";
  historyDays: number | null;
  importJobDays: number | null;
  provisionalHours: number | null;
};

type ParseRetentionOptions = {
  supportsProvisional: boolean;
};

type ParsedRetentionShape = {
  mode?: unknown;
  history_days?: unknown;
  import_job_days?: unknown;
  provisional_hours?: unknown;
};

export type SourceRetentionSummary = {
  modeLabel: string;
  summaryLabel: string;
  detail: string;
};

export type SourceRetentionCleanupResult = {
  slug: SourceSlug;
  status: "skipped" | "completed";
  reason?: string;
  deletedProvisionalWatchEvents: number;
  deletedProvisionalRawRecords: number;
  deletedDurableWatchEvents: number;
  deletedDurableRawRecords: number;
  deletedImportJobs: number;
};

export function getDefaultSourceRetentionConfig(): SourceRetentionConfig {
  return {
    mode: "indefinite",
    historyDays: null,
    importJobDays: null,
    provisionalHours: null
  };
}

function parsePositiveInteger(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive number.`);
  }

  return Math.floor(value);
}

export function parseSourceRetentionConfig(
  value: unknown,
  options: ParseRetentionOptions
): SourceRetentionConfig {
  if (value == null) {
    return getDefaultSourceRetentionConfig();
  }

  if (typeof value !== "object") {
    throw new Error("Retention config must be a YAML object.");
  }

  const parsed = value as ParsedRetentionShape;

  if (parsed.mode === undefined || parsed.mode === "indefinite") {
    return getDefaultSourceRetentionConfig();
  }

  if (parsed.mode !== "windowed") {
    throw new Error("Retention mode must be either 'indefinite' or 'windowed'.");
  }

  const historyDays = parsePositiveInteger(parsed.history_days, "Retention history_days");
  const importJobDays = parsePositiveInteger(parsed.import_job_days, "Retention import_job_days");
  const provisionalHours = options.supportsProvisional
    ? parsed.provisional_hours === undefined
      ? 24
      : parsePositiveInteger(parsed.provisional_hours, "Retention provisional_hours")
    : null;

  return {
    mode: "windowed",
    historyDays,
    importJobDays,
    provisionalHours
  };
}

export function serializeSourceRetentionConfig(
  config: SourceRetentionConfig,
  options: ParseRetentionOptions
) {
  if (config.mode === "indefinite") {
    return {
      mode: "indefinite"
    };
  }

  return {
    mode: "windowed",
    history_days: config.historyDays,
    import_job_days: config.importJobDays,
    ...(options.supportsProvisional ? { provisional_hours: config.provisionalHours ?? 24 } : {})
  };
}

export function summarizeSourceRetention(
  config: SourceRetentionConfig,
  options: ParseRetentionOptions
): SourceRetentionSummary {
  if (config.mode === "indefinite") {
    return {
      modeLabel: "Indefinite",
      summaryLabel: "Keeping source history",
      detail:
        "Durable raw records, normalized watch history, and import-job audit rows stay until normal source updates replace them."
    };
  }

  const detailParts = [
    `Deletes durable raw and normalized history older than ${config.historyDays} day${config.historyDays === 1 ? "" : "s"}.`,
    `Deletes import-job audit rows older than ${config.importJobDays} day${config.importJobDays === 1 ? "" : "s"}.`
  ];

  if (options.supportsProvisional && config.provisionalHours) {
    detailParts.push(
      `Deletes provisional session data older than ${config.provisionalHours} hour${config.provisionalHours === 1 ? "" : "s"}.`
    );
  }

  return {
    modeLabel: "Windowed",
    summaryLabel: `${config.historyDays} day history window`,
    detail: detailParts.join(" ")
  };
}

async function getSourceId(slug: SourceSlug) {
  const result = await query<SourceRow>(
    `
      SELECT id
      FROM sources
      WHERE slug = $1
      LIMIT 1
    `,
    [slug]
  );

  return result.rows[0]?.id ?? null;
}

async function deleteProvisionalWatchEvents(sourceId: string, cutoffIso: string) {
  const result = await query(
    `
      DELETE FROM watch_events
      WHERE source_id = $1
        AND metadata->>'is_provisional' = 'true'
        AND watched_at < $2::timestamptz
    `,
    [sourceId, cutoffIso]
  );

  return result.rowCount ?? 0;
}

async function deletePlexProvisionalRawRecords(sourceId: string, cutoffIso: string) {
  const result = await query(
    `
      DELETE FROM raw_import_records
      WHERE source_id = $1
        AND source_record_id LIKE 'session::%'
        AND imported_at < $2::timestamptz
    `,
    [sourceId, cutoffIso]
  );

  return result.rowCount ?? 0;
}

async function deleteDurableWatchEvents(sourceId: string, cutoffIso: string) {
  const result = await query(
    `
      DELETE FROM watch_events
      WHERE source_id = $1
        AND COALESCE(metadata->>'is_provisional', 'false') <> 'true'
        AND watched_at < $2::timestamptz
    `,
    [sourceId, cutoffIso]
  );

  return result.rowCount ?? 0;
}

async function deleteHomeAssistantDurableRawRecords(sourceId: string, cutoffIso: string) {
  const result = await query(
    `
      DELETE FROM raw_import_records
      WHERE source_id = $1
        AND COALESCE(
          NULLIF(payload->>'last_reported', '')::timestamptz,
          NULLIF(payload->>'last_updated', '')::timestamptz,
          NULLIF(payload->>'last_changed', '')::timestamptz,
          imported_at
        ) < $2::timestamptz
    `,
    [sourceId, cutoffIso]
  );

  return result.rowCount ?? 0;
}

async function deletePlexDurableRawRecords(sourceId: string, cutoffIso: string) {
  const result = await query(
    `
      DELETE FROM raw_import_records
      WHERE source_id = $1
        AND source_record_id NOT LIKE 'session::%'
        AND (
          CASE
            WHEN payload->>'viewedAt' ~ '^[0-9]+$'
              THEN to_timestamp((payload->>'viewedAt')::bigint)
            ELSE imported_at
          END
        ) < $2::timestamptz
    `,
    [sourceId, cutoffIso]
  );

  return result.rowCount ?? 0;
}

async function deleteExpiredImportJobs(sourceId: string, cutoffIso: string) {
  const result = await query(
    `
      DELETE FROM import_jobs ij
      WHERE ij.source_id = $1
        AND ij.status <> 'running'
        AND COALESCE(ij.completed_at, ij.started_at) < $2::timestamptz
        AND NOT EXISTS (
          SELECT 1
          FROM raw_import_records rir
          WHERE rir.import_job_id = ij.id
        )
    `,
    [sourceId, cutoffIso]
  );

  return result.rowCount ?? 0;
}

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function runSourceRetentionCleanup(
  slug: SourceSlug,
  retention: SourceRetentionConfig
): Promise<SourceRetentionCleanupResult> {
  if (retention.mode !== "windowed") {
    return {
      slug,
      status: "skipped",
      reason: "retention mode is indefinite",
      deletedProvisionalWatchEvents: 0,
      deletedProvisionalRawRecords: 0,
      deletedDurableWatchEvents: 0,
      deletedDurableRawRecords: 0,
      deletedImportJobs: 0
    };
  }

  const sourceId = await getSourceId(slug);

  if (!sourceId) {
    return {
      slug,
      status: "skipped",
      reason: "source is not registered",
      deletedProvisionalWatchEvents: 0,
      deletedProvisionalRawRecords: 0,
      deletedDurableWatchEvents: 0,
      deletedDurableRawRecords: 0,
      deletedImportJobs: 0
    };
  }

  const lockClient = await getPool().connect();
  let lockAcquired = false;

  try {
    const lockResult = await lockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [getSourceImportLockKey(slug)]
    );

    if (!lockResult.rows[0]?.acquired) {
      return {
        slug,
        status: "skipped",
        reason: "source import or cleanup is already running",
        deletedProvisionalWatchEvents: 0,
        deletedProvisionalRawRecords: 0,
        deletedDurableWatchEvents: 0,
        deletedDurableRawRecords: 0,
        deletedImportJobs: 0
      };
    }

    lockAcquired = true;

    let deletedProvisionalWatchEvents = 0;
    let deletedProvisionalRawRecords = 0;

    if (slug === "plex" && retention.provisionalHours) {
      const provisionalCutoffIso = isoHoursAgo(retention.provisionalHours);
      deletedProvisionalWatchEvents = await deleteProvisionalWatchEvents(sourceId, provisionalCutoffIso);
      deletedProvisionalRawRecords = await deletePlexProvisionalRawRecords(sourceId, provisionalCutoffIso);
    }

    const historyCutoffIso = isoDaysAgo(retention.historyDays ?? 365);
    const deletedDurableWatchEvents = await deleteDurableWatchEvents(sourceId, historyCutoffIso);
    const deletedDurableRawRecords =
      slug === "home-assistant"
        ? await deleteHomeAssistantDurableRawRecords(sourceId, historyCutoffIso)
        : await deletePlexDurableRawRecords(sourceId, historyCutoffIso);
    const importJobCutoffIso = isoDaysAgo(retention.importJobDays ?? 90);
    const deletedImportJobs = await deleteExpiredImportJobs(sourceId, importJobCutoffIso);

    return {
      slug,
      status: "completed",
      deletedProvisionalWatchEvents,
      deletedProvisionalRawRecords,
      deletedDurableWatchEvents,
      deletedDurableRawRecords,
      deletedImportJobs
    };
  } finally {
    if (lockAcquired) {
      await lockClient.query("SELECT pg_advisory_unlock($1)", [getSourceImportLockKey(slug)]);
    }

    lockClient.release();
  }
}
