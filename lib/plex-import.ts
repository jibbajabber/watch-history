import { getPool, query } from "@/lib/db";
import { fetchPlexHistory, fetchPlexSessions } from "@/lib/plex";

type SourceRow = {
  id: string;
};

type ImportJobRow = {
  id: string;
};

type RawRecordRow = {
  id: string;
};

type ImportStatus = "pending" | "running" | "completed" | "failed";

type PlexHistoryItem = {
  historyKey?: string;
  key?: string;
  ratingKey?: string;
  librarySectionID?: string;
  parentKey?: string;
  grandparentKey?: string;
  title?: string;
  grandparentTitle?: string;
  type?: string;
  index?: number;
  parentIndex?: number;
  originallyAvailableAt?: string;
  viewedAt?: number;
  accountID?: number;
  deviceID?: number | string;
};

type PlexSessionItem = {
  sessionKey?: string;
  key?: string;
  ratingKey?: string;
  parentKey?: string;
  grandparentKey?: string;
  title?: string;
  grandparentTitle?: string;
  type?: string;
  index?: number;
  parentIndex?: number;
  viewOffset?: number;
  duration?: number;
  Player?: {
    title?: string;
    product?: string;
    platform?: string;
    state?: string;
  };
  User?: {
    id?: number | string;
    title?: string;
  };
  Session?: {
    id?: string;
  };
};

type NormalizedPlexWatch = {
  title: string;
  mediaType: string | null;
  watchedAt: string;
  metadata: Record<string, unknown>;
};

const plexImportLockKey = 7_405_002;

function buildNormalizedTitle(item: PlexHistoryItem) {
  if (item.type === "episode" && item.grandparentTitle && item.title) {
    const season = typeof item.parentIndex === "number" ? `S${String(item.parentIndex).padStart(2, "0")}` : null;
    const episode = typeof item.index === "number" ? `E${String(item.index).padStart(2, "0")}` : null;
    const code = season && episode ? `${season}${episode}` : null;

    return code
      ? `${item.grandparentTitle} · ${code} · ${item.title}`
      : `${item.grandparentTitle} · ${item.title}`;
  }

  return item.title?.trim() || item.grandparentTitle?.trim() || item.ratingKey || "Unknown Plex item";
}

function normalizeHistoryItem(item: PlexHistoryItem): NormalizedPlexWatch | null {
  if (!item.historyKey || typeof item.viewedAt !== "number") {
    return null;
  }

  return {
    title: buildNormalizedTitle(item),
    mediaType: typeof item.type === "string" ? item.type : null,
    watchedAt: new Date(item.viewedAt * 1000).toISOString(),
    metadata: {
      history_key: item.historyKey,
      plex_key: item.key ?? null,
      rating_key: item.ratingKey ?? null,
      library_section_id: item.librarySectionID ?? null,
      account_id: item.accountID ?? null,
      device_id: item.deviceID ?? null,
      parent_key: item.parentKey ?? null,
      grandparent_key: item.grandparentKey ?? null,
      grandparent_title: item.grandparentTitle ?? null,
      originally_available_at: item.originallyAvailableAt ?? null,
      normalized_from: "plex_history",
      attributes: item
    }
  };
}

function normalizeSessionItem(
  item: PlexSessionItem,
  importedAt: string
): NormalizedPlexWatch | null {
  const sessionId = item.Session?.id;

  if (!sessionId) {
    return null;
  }

  return {
    title: buildNormalizedTitle(item),
    mediaType: typeof item.type === "string" ? item.type : null,
    watchedAt: importedAt,
    metadata: {
      session_id: sessionId,
      plex_key: item.key ?? null,
      rating_key: item.ratingKey ?? null,
      account_id: item.User?.id ?? null,
      user_title: item.User?.title ?? null,
      device_label: item.Player?.title ?? item.Player?.product ?? null,
      player_product: item.Player?.product ?? null,
      player_platform: item.Player?.platform ?? null,
      player_state: item.Player?.state ?? null,
      view_offset_ms: item.viewOffset ?? null,
      duration_ms: item.duration ?? null,
      parent_key: item.parentKey ?? null,
      grandparent_key: item.grandparentKey ?? null,
      grandparent_title: item.grandparentTitle ?? null,
      normalized_from: "plex_session",
      attributes: item
    }
  };
}

function shouldIncludeActiveSession(
  session: PlexSessionItem,
  history: PlexHistoryItem[],
  importedAt: string
) {
  const ratingKey = session.ratingKey;

  if (!ratingKey) {
    return true;
  }

  const importedAtMs = new Date(importedAt).getTime();

  return !history.some((item) => {
    if (item.ratingKey !== ratingKey || typeof item.viewedAt !== "number") {
      return false;
    }

    const viewedAtMs = item.viewedAt * 1000;

    return importedAtMs - viewedAtMs < 6 * 60 * 60 * 1000;
  });
}

async function getPlexSourceId() {
  const result = await query<SourceRow>(
    `
      SELECT id
      FROM sources
      WHERE slug = 'plex'
      LIMIT 1
    `
  );

  const source = result.rows[0];

  if (!source) {
    throw new Error("Plex source is not registered.");
  }

  return source.id;
}

async function createImportJob(sourceId: string) {
  const result = await query<ImportJobRow>(
    `
      INSERT INTO import_jobs (source_id, status)
      VALUES ($1, 'running')
      RETURNING id
    `,
    [sourceId]
  );

  return result.rows[0].id;
}

async function completeImportJob(
  importJobId: string,
  status: ImportStatus,
  recordsSeen: number,
  recordsImported: number,
  errorMessage: string | null = null
) {
  await query(
    `
      UPDATE import_jobs
      SET status = $2,
          completed_at = NOW(),
          records_seen = $3,
          records_imported = $4,
          error_message = $5
      WHERE id = $1
    `,
    [importJobId, status, recordsSeen, recordsImported, errorMessage]
  );
}

async function upsertRawImportRecord(importJobId: string, sourceId: string, item: PlexHistoryItem) {
  const sourceRecordId = item.historyKey;

  if (!sourceRecordId) {
    throw new Error("Plex history row is missing historyKey.");
  }

  const result = await query<RawRecordRow>(
    `
      INSERT INTO raw_import_records (
        import_job_id,
        source_id,
        source_record_id,
        payload
      )
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (source_id, source_record_id) DO UPDATE
      SET import_job_id = EXCLUDED.import_job_id,
          payload = EXCLUDED.payload,
          imported_at = NOW()
      RETURNING id
    `,
    [importJobId, sourceId, sourceRecordId, JSON.stringify(item)]
  );

  return result.rows[0].id;
}

async function upsertRawSessionRecord(importJobId: string, sourceId: string, item: PlexSessionItem) {
  const sessionId = item.Session?.id;

  if (!sessionId) {
    throw new Error("Plex session row is missing Session.id.");
  }

  const result = await query<RawRecordRow>(
    `
      INSERT INTO raw_import_records (
        import_job_id,
        source_id,
        source_record_id,
        payload
      )
      VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (source_id, source_record_id) DO UPDATE
      SET import_job_id = EXCLUDED.import_job_id,
          payload = EXCLUDED.payload,
          imported_at = NOW()
      RETURNING id
    `,
    [importJobId, sourceId, `session::${sessionId}`, JSON.stringify(item)]
  );

  return result.rows[0].id;
}

async function replaceNormalizedWatchEvents(sourceId: string, items: NormalizedPlexWatch[]) {
  await query(
    `
      DELETE FROM watch_events
      WHERE source_id = $1
    `,
    [sourceId]
  );

  let insertedCount = 0;

  for (const item of items) {
    const result = await query(
      `
        INSERT INTO watch_events (
          source_id,
          title,
          media_type,
          source_name,
          watched_at,
          duration_minutes,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        sourceId,
        item.title,
        item.mediaType,
        "Plex",
        item.watchedAt,
        null,
        JSON.stringify(item.metadata)
      ]
    );

    insertedCount += result.rowCount ?? 0;
  }

  return insertedCount;
}

export async function runPlexImport() {
  const lockClient = await getPool().connect();
  let lockAcquired = false;

  try {
    const lockResult = await lockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [plexImportLockKey]
    );

    if (!lockResult.rows[0]?.acquired) {
      throw new Error("A Plex import is already running.");
    }

    lockAcquired = true;

    const sourceId = await getPlexSourceId();
    const importJobId = await createImportJob(sourceId);

    try {
      const importedAt = new Date().toISOString();
      const [historyPayload, sessionsPayload] = await Promise.all([
        fetchPlexHistory(),
        fetchPlexSessions()
      ]);
      const history = historyPayload.MediaContainer?.Metadata ?? [];
      const sessions = sessionsPayload.MediaContainer?.Metadata ?? [];
      const activeSessions = sessions.filter((session) =>
        shouldIncludeActiveSession(session, history, importedAt)
      );
      const normalized = [
        ...history.map(normalizeHistoryItem),
        ...activeSessions.map((session) => normalizeSessionItem(session, importedAt))
      ].filter((item) => item !== null);

      await Promise.all([
        ...history.map((item) => upsertRawImportRecord(importJobId, sourceId, item)),
        ...activeSessions.map((item) => upsertRawSessionRecord(importJobId, sourceId, item))
      ]);
      const insertedCount = await replaceNormalizedWatchEvents(sourceId, normalized);

      await completeImportJob(importJobId, "completed", history.length + activeSessions.length, insertedCount);

      return {
        source: "plex",
        importJobId,
        recordsSeen: history.length + activeSessions.length,
        recordsImported: insertedCount
      };
    } catch (error) {
      await completeImportJob(
        importJobId,
        "failed",
        0,
        0,
        error instanceof Error ? error.message : "Unknown Plex import error"
      );
      throw error;
    }
  } finally {
    if (lockAcquired) {
      await lockClient.query("SELECT pg_advisory_unlock($1)", [plexImportLockKey]);
    }

    lockClient.release();
  }
}
