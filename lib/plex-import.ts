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
  source_record_id: string;
};

type PersistedPlexRawRow = {
  id: string;
  source_record_id: string;
  imported_at: string;
  payload: PlexHistoryItem | PlexSessionItem;
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
  rawImportRecordId: string | null;
  title: string;
  mediaType: string | null;
  watchedAt: string;
  durationMinutes: number | null;
  metadata: Record<string, unknown>;
};

const plexImportLockKey = 7_405_002;
const recentHistoryMatchWindowMs = 12 * 60 * 60 * 1000;

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

function formatProgressLabel(viewOffsetMs: number | null, durationMs: number | null) {
  if (
    typeof viewOffsetMs !== "number" ||
    typeof durationMs !== "number" ||
    viewOffsetMs <= 0 ||
    durationMs <= 0
  ) {
    return null;
  }

  const watchedMinutes = Math.max(1, Math.round(viewOffsetMs / 60000));
  const totalMinutes = Math.max(1, Math.round(durationMs / 60000));
  const percent = Math.max(1, Math.min(99, Math.round((viewOffsetMs / durationMs) * 100)));

  return `${watchedMinutes} of ${totalMinutes} min (${percent}%)`;
}

function buildSessionContentKey(item: PlexSessionItem) {
  return [
    item.ratingKey ?? "no-rating-key",
    item.key ?? "no-key",
    item.grandparentKey ?? "no-grandparent-key",
    item.parentKey ?? "no-parent-key",
    item.type ?? "no-type",
    buildNormalizedTitle(item)
  ].join("::");
}

function makeSessionSourceRecordId(item: PlexSessionItem, importedAt: string) {
  return `session::${buildSessionContentKey(item)}::${importedAt}`;
}

function normalizeHistoryItem(
  item: PlexHistoryItem,
  rawImportRecordId: string | null = null
): NormalizedPlexWatch | null {
  if (!item.historyKey || typeof item.viewedAt !== "number") {
    return null;
  }

  return {
    rawImportRecordId,
    title: buildNormalizedTitle(item),
    mediaType: typeof item.type === "string" ? item.type : null,
    watchedAt: new Date(item.viewedAt * 1000).toISOString(),
    durationMinutes: null,
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
      is_provisional: false,
      normalized_from: "plex_history",
      attributes: item
    }
  };
}

function normalizeSessionItem(
  item: PlexSessionItem,
  observedAt: string,
  statusLabel: string,
  progressLabel: string | null,
  rawImportRecordId: string | null = null
): NormalizedPlexWatch | null {
  const sessionId = item.Session?.id;

  if (!sessionId) {
    return null;
  }

  return {
    rawImportRecordId,
    title: buildNormalizedTitle(item),
    mediaType: typeof item.type === "string" ? item.type : null,
    watchedAt: observedAt,
    durationMinutes: null,
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
      progress_label: progressLabel,
      status_label: statusLabel,
      is_provisional: true,
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
      RETURNING id, source_record_id
    `,
    [importJobId, sourceId, `session::${sessionId}`, JSON.stringify(item)]
  );

  return result.rows[0].id;
}

async function upsertProvisionalSessionRecord(
  importJobId: string,
  sourceId: string,
  sourceRecordId: string,
  item: PlexSessionItem
) {
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
      RETURNING id, source_record_id
    `,
    [importJobId, sourceId, sourceRecordId, JSON.stringify(item)]
  );

  return result.rows[0];
}

async function loadPersistedHistoryRows(sourceId: string) {
  const result = await query<PersistedPlexRawRow>(
    `
      SELECT id, source_record_id, imported_at::text, payload
      FROM raw_import_records
      WHERE source_id = $1
        AND source_record_id NOT LIKE 'session::%'
      ORDER BY COALESCE(
        (payload->>'viewedAt')::bigint,
        0
      ) ASC, source_record_id ASC
    `,
    [sourceId]
  );

  return result.rows;
}

async function loadPersistedSessionRows(sourceId: string) {
  const result = await query<PersistedPlexRawRow>(
    `
      SELECT id, source_record_id, imported_at::text, payload
      FROM raw_import_records
      WHERE source_id = $1
        AND source_record_id LIKE 'session::%'
      ORDER BY imported_at DESC, source_record_id ASC
    `,
    [sourceId]
  );

  return result.rows;
}

function findReusableSessionRecordId(
  session: PlexSessionItem,
  sessionRows: PersistedPlexRawRow[],
  history: PlexHistoryItem[]
) {
  const contentKey = buildSessionContentKey(session);

  const match = sessionRows.find((row) => {
    const payload = row.payload as PlexSessionItem;

    return (
      buildSessionContentKey(payload) === contentKey &&
      !sessionMatchesRecentHistory(payload, row.imported_at, history)
    );
  });

  return match?.source_record_id ?? null;
}

function sessionMatchesRecentHistory(
  session: PlexSessionItem,
  observedAt: string,
  history: PlexHistoryItem[]
) {
  const observedAtMs = new Date(observedAt).getTime();

  return history.some((item) => {
    if (typeof item.viewedAt !== "number") {
      return false;
    }

    const sameRatingKey =
      Boolean(session.ratingKey) &&
      Boolean(item.ratingKey) &&
      session.ratingKey === item.ratingKey;
    const sameKey =
      Boolean(session.key) &&
      Boolean(item.key) &&
      session.key === item.key;

    if (!sameRatingKey && !sameKey) {
      return false;
    }

    const viewedAtMs = item.viewedAt * 1000;

    return Math.abs(observedAtMs - viewedAtMs) <= recentHistoryMatchWindowMs;
  });
}

async function pruneExpiredSessionRecords(
  sourceId: string,
  sessionRows: PersistedPlexRawRow[],
  history: PlexHistoryItem[]
) {
  const removableIds = sessionRows
    .filter((row) => {
      const payload = row.payload as PlexSessionItem;

      return sessionMatchesRecentHistory(payload, row.imported_at, history);
    })
    .map((row) => row.id);

  if (removableIds.length === 0) {
    return;
  }

  await query(
    `
      DELETE FROM raw_import_records
      WHERE source_id = $1
        AND id = ANY($2::uuid[])
    `,
    [sourceId, removableIds]
  );
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
          raw_import_record_id,
          title,
          media_type,
          source_name,
          watched_at,
          duration_minutes,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        sourceId,
        item.rawImportRecordId,
        item.title,
        item.mediaType,
        "Plex",
        item.watchedAt,
        item.durationMinutes,
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
      await Promise.all(history.map((item) => upsertRawImportRecord(importJobId, sourceId, item)));

      const persistedHistoryRows = await loadPersistedHistoryRows(sourceId);
      const persistedHistory = persistedHistoryRows.map((row) => row.payload as PlexHistoryItem);
      const activeSessions = sessions.filter((session) =>
        shouldIncludeActiveSession(session, persistedHistory, importedAt)
      );

      const persistedSessionRows = await loadPersistedSessionRows(sourceId);
      const provisionalSessionRows = await Promise.all(
        activeSessions.map(async (item) => {
          const reusableSourceRecordId = findReusableSessionRecordId(
            item,
            persistedSessionRows,
            persistedHistory
          );
          const sourceRecordId =
            reusableSourceRecordId ?? makeSessionSourceRecordId(item, importedAt);

          return upsertProvisionalSessionRecord(importJobId, sourceId, sourceRecordId, item);
        })
      );

      await pruneExpiredSessionRecords(sourceId, persistedSessionRows, persistedHistory);
      const remainingSessionRows = await loadPersistedSessionRows(sourceId);
      const activeSessionRecordIds = new Set(
        provisionalSessionRows.map((row) => row.source_record_id)
      );
      const normalized = [
        ...persistedHistoryRows.map((row) => normalizeHistoryItem(row.payload as PlexHistoryItem, row.id)),
        ...remainingSessionRows.map((row) => {
          const session = row.payload as PlexSessionItem;
          const isActive = activeSessionRecordIds.has(row.source_record_id);

          return normalizeSessionItem(
            session,
            row.imported_at,
            isActive ? "In progress" : "Pending history",
            isActive ? formatProgressLabel(session.viewOffset ?? null, session.duration ?? null) : null,
            row.id
          );
        }
        )
      ].filter((item) => item !== null);
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
