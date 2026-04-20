import { getKnownChannelKey } from "@/lib/channels";
import { getPool, query } from "@/lib/db";
import { readHomeAssistantConfig } from "@/lib/home-assistant-config";
import { checkHomeAssistantConnectivity, fetchHomeAssistant } from "@/lib/home-assistant";
import { getSourceImportLockKey } from "@/lib/source-locks";

type HomeAssistantHistoryState = {
  entity_id: string;
  state: string;
  last_changed?: string;
  last_reported?: string;
  last_updated?: string;
  attributes?: Record<string, unknown>;
};

type SourceRow = {
  id: string;
};

type ImportJobRow = {
  id: string;
};

type RawRecordRow = {
  id: string;
};

type PersistedHistoryRow = {
  payload: HomeAssistantHistoryState;
};

type ImportStatus = "pending" | "running" | "completed" | "failed";
type NormalizedSession = {
  entityId: string;
  title: string;
  mediaType: string | null;
  channel: string | null;
  watchedAt: string;
  durationMinutes: number | null;
  metadata: Record<string, unknown>;
};

const ignoredStates = new Set([
  "off",
  "idle",
  "standby",
  "unavailable",
  "unknown",
  "None",
  "none"
]);
const resumableStates = new Set(["playing", "paused", "buffering"]);
const sessionGapMs = 30 * 60 * 1000;
function getAccessToken() {
  const token = process.env.HOME_ASSISTANT_ACCESS_TOKEN;

  if (!token) {
    throw new Error("HOME_ASSISTANT_ACCESS_TOKEN is not configured.");
  }

  return token.trim();
}

function isoDateDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function fetchCurrentHomeAssistantState(baseUrl: string, entityId: string) {
  const response = await fetchHomeAssistant(
    `${baseUrl}/api/states/${encodeURIComponent(entityId)}`,
    getAccessToken(),
    5000
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Home Assistant current-state request failed with status ${response.status}.`);
  }

  return (await response.json()) as HomeAssistantHistoryState;
}

async function fetchHomeAssistantHistory(baseUrl: string, entityIds: string[]) {
  const start = isoDateDaysAgo(365);
  const end = new Date().toISOString();
  const url = new URL(`${baseUrl}/api/history/period/${encodeURIComponent(start)}`);

  url.searchParams.set("end_time", end);
  url.searchParams.set("filter_entity_id", entityIds.join(","));

  const response = await fetchHomeAssistant(url.toString(), getAccessToken(), 15000);

  if (!response.ok) {
    throw new Error(`Home Assistant history request failed with status ${response.status}.`);
  }

  return (await response.json()) as HomeAssistantHistoryState[][];
}

function coerceText(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function pickFirstText(attributes: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = coerceText(attributes[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function buildTitle(state: HomeAssistantHistoryState) {
  const attributes = state.attributes ?? {};
  const primary =
    pickFirstText(attributes, [
      "media_series_title",
      "series_title",
      "programme_title",
      "program_title",
      "title",
      "episode_title",
      "media_title",
      "friendly_name"
    ]) ?? state.entity_id;
  const secondary = pickFirstText(attributes, [
    "episode",
    "episode_title"
  ]);

  return secondary && secondary !== primary ? `${primary} · ${secondary}` : primary;
}

function hasMeaningfulProgrammeMetadata(state: HomeAssistantHistoryState) {
  const attributes = state.attributes ?? {};

  return Boolean(
    pickFirstText(attributes, [
      "media_series_title",
      "series_title",
      "programme_title",
      "program_title",
      "title",
      "episode",
      "episode_title",
      "media_title"
    ])
  );
}

function getMediaType(state: HomeAssistantHistoryState) {
  const attributes = state.attributes ?? {};
  return pickFirstText(attributes, ["media_content_type", "content_type"]);
}

function getChannel(state: HomeAssistantHistoryState) {
  const attributes = state.attributes ?? {};
  return pickFirstText(attributes, ["media_channel", "channel", "channel_name", "media_title"]);
}

function isMeaningfulWatchState(state: HomeAssistantHistoryState) {
  const stateValue = state.state;

  if (ignoredStates.has(stateValue)) {
    return false;
  }

  if (!getStateTimestamp(state)) {
    return false;
  }

  return hasMeaningfulProgrammeMetadata(state) && (stateValue === "playing" || stateValue === "paused" || stateValue === "buffering");
}

function makeSourceRecordId(state: HomeAssistantHistoryState) {
  const timestamp = getStateTimestamp(state);

  return [
    state.entity_id,
    timestamp ?? "no-timestamp",
    state.state
  ].join("::");
}

async function getHomeAssistantSourceId() {
  const result = await query<SourceRow>(
    `
      SELECT id
      FROM sources
      WHERE slug = 'home-assistant'
      LIMIT 1
    `
  );

  const source = result.rows[0];

  if (!source) {
    throw new Error("Home Assistant source is not registered.");
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

async function upsertRawImportRecord(
  importJobId: string,
  sourceId: string,
  state: HomeAssistantHistoryState
) {
  const sourceRecordId = makeSourceRecordId(state);
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
    [importJobId, sourceId, sourceRecordId, JSON.stringify(state)]
  );

  return result.rows[0].id;
}

async function loadPersistedHistoryGroups(sourceId: string, entityIds: string[]) {
  const result = await query<PersistedHistoryRow>(
    `
      SELECT payload
      FROM raw_import_records
      WHERE source_id = $1
        AND payload->>'entity_id' = ANY($2::text[])
      ORDER BY COALESCE(
        payload->>'last_reported',
        payload->>'last_updated',
        payload->>'last_changed',
        ''
      ) ASC
    `,
    [sourceId, entityIds]
  );

  const groupedHistory = new Map<string, HomeAssistantHistoryState[]>();

  for (const entityId of entityIds) {
    groupedHistory.set(entityId, []);
  }

  for (const row of result.rows) {
    const state = row.payload;

    if (!state?.entity_id) {
      continue;
    }

    const history = groupedHistory.get(state.entity_id);

    if (!history) {
      continue;
    }

    history.push(state);
  }

  return entityIds.map((entityId) => groupedHistory.get(entityId) ?? []);
}

function getStateTimestamp(state: HomeAssistantHistoryState) {
  return state.last_reported ?? state.last_updated ?? state.last_changed ?? null;
}

function sortStatesChronologically(states: HomeAssistantHistoryState[]) {
  return [...states].sort((left, right) => {
    const leftTime = getStateTimestamp(left) ?? "";
    const rightTime = getStateTimestamp(right) ?? "";
    return leftTime.localeCompare(rightTime);
  });
}

async function enrichHistoryWithCurrentStates(
  baseUrl: string,
  historyGroups: HomeAssistantHistoryState[][],
  entityIds: string[]
) {
  const currentStates = await Promise.all(
    entityIds.map((entityId) => fetchCurrentHomeAssistantState(baseUrl, entityId))
  );

  return historyGroups.map((history, index) => {
    const currentState = currentStates[index];

    if (!currentState) {
      return history;
    }

    const currentTimestamp = getStateTimestamp(currentState);

    if (!currentTimestamp) {
      return history;
    }

    const existing = history.some((state) => {
      const timestamp = getStateTimestamp(state);

      return (
        state.entity_id === currentState.entity_id &&
        timestamp === currentTimestamp &&
        state.state === currentState.state
      );
    });

    if (existing) {
      return history;
    }

    return [...history, currentState];
  });
}

function finalizeSession(
  sessions: NormalizedSession[],
  session: {
    entityId: string;
    title: string;
    mediaType: string | null;
    channel: string | null;
    startedAt: string;
    endedAt: string;
    states: string[];
    attributes: Record<string, unknown>;
  } | null
) {
  if (!session) {
    return;
  }

  const durationMs =
    new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
  const durationMinutes =
    durationMs > 0 ? Math.max(1, Math.ceil(durationMs / 60000)) : null;

  sessions.push({
    entityId: session.entityId,
    title: session.title,
    mediaType: session.mediaType,
    channel: session.channel,
    watchedAt: session.startedAt,
    durationMinutes,
    metadata: {
      entity_id: session.entityId,
      channel: session.channel,
      channel_key: getKnownChannelKey(session.channel),
      normalized_from: "home_assistant_session",
      states: session.states,
      attributes: session.attributes
    }
  });
}

function normalizeHistoryToSessions(historyGroups: HomeAssistantHistoryState[][]) {
  const sessions: NormalizedSession[] = [];

  for (const entityHistory of historyGroups) {
    const states = sortStatesChronologically(entityHistory);
    let currentSession:
      | {
          entityId: string;
          title: string;
          mediaType: string | null;
          channel: string | null;
          startedAt: string;
          endedAt: string;
          states: string[];
          attributes: Record<string, unknown>;
        }
      | null = null;

    for (const state of states) {
      const timestamp = getStateTimestamp(state);

      if (!timestamp) {
        continue;
      }

      if (!isMeaningfulWatchState(state)) {
        finalizeSession(sessions, currentSession);
        currentSession = null;
        continue;
      }

      const title = buildTitle(state);
      const mediaType = getMediaType(state);
      const channel = getChannel(state);
      const stateTime = new Date(timestamp).getTime();
      const isResumable = resumableStates.has(state.state);

      if (!currentSession) {
        currentSession = {
          entityId: state.entity_id,
          title,
          mediaType,
          channel,
          startedAt: timestamp,
          endedAt: timestamp,
          states: [state.state],
          attributes: state.attributes ?? {}
        };
        continue;
      }

      const currentEnd = new Date(currentSession.endedAt).getTime();
      const sameProgram =
        currentSession.entityId === state.entity_id &&
        currentSession.title === title &&
        currentSession.mediaType === mediaType;
      const withinGap = stateTime - currentEnd <= sessionGapMs;

      if (sameProgram && withinGap && isResumable) {
        currentSession.endedAt = timestamp;
        currentSession.states = Array.from(new Set([...currentSession.states, state.state]));
        currentSession.attributes = state.attributes ?? currentSession.attributes;
        continue;
      }

      finalizeSession(sessions, currentSession);
      currentSession = {
        entityId: state.entity_id,
        title,
        mediaType,
        channel,
        startedAt: timestamp,
        endedAt: timestamp,
        states: [state.state],
        attributes: state.attributes ?? {}
      };
    }

    finalizeSession(sessions, currentSession);
  }

  return sessions;
}

async function replaceNormalizedWatchEvents(sourceId: string, sessions: NormalizedSession[]) {
  await query(
    `
      DELETE FROM watch_events
      WHERE source_id = $1
    `,
    [sourceId]
  );

  let insertedCount = 0;

  for (const session of sessions) {
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
        session.title,
        session.mediaType,
        session.channel ?? session.entityId,
        session.watchedAt,
        session.durationMinutes,
        JSON.stringify(session.metadata)
      ]
    );

    insertedCount += result.rowCount ?? 0;
  }

  return insertedCount;
}

export async function runHomeAssistantImport() {
  const lockClient = await getPool().connect();
  let lockAcquired = false;

  try {
    const lockResult = await lockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [getSourceImportLockKey("home-assistant")]
    );

    if (!lockResult.rows[0]?.acquired) {
      throw new Error("A Home Assistant import is already running.");
    }

    lockAcquired = true;

    const connectivity = await checkHomeAssistantConnectivity();

    if (!connectivity.ok) {
      throw new Error(`Home Assistant is not ready for import: ${connectivity.message}`);
    }

    const configResult = await readHomeAssistantConfig();

    if (!configResult.ok) {
      throw new Error(configResult.message);
    }

    const sourceId = await getHomeAssistantSourceId();
    const importJobId = await createImportJob(sourceId);

    try {
      const historyGroups = await fetchHomeAssistantHistory(
        configResult.config.baseUrl,
        configResult.config.entities
      );
      const enrichedHistoryGroups = await enrichHistoryWithCurrentStates(
        configResult.config.baseUrl,
        historyGroups,
        configResult.config.entities
      );

      const historyStates = enrichedHistoryGroups.flat();

      for (const state of historyStates) {
        await upsertRawImportRecord(importJobId, sourceId, state);
      }

      const persistedHistoryGroups = await loadPersistedHistoryGroups(
        sourceId,
        configResult.config.entities
      );
      const normalizedSessions = normalizeHistoryToSessions(persistedHistoryGroups);
      const importedCount = await replaceNormalizedWatchEvents(sourceId, normalizedSessions);

      await completeImportJob(importJobId, "completed", historyStates.length, importedCount);

      return {
        ok: true,
        importJobId,
        recordsSeen: historyStates.length,
        recordsImported: importedCount
      };
    } catch (error) {
      await completeImportJob(
        importJobId,
        "failed",
        0,
        0,
        "Home Assistant import failed."
      );
      throw error;
    }
  } finally {
    if (lockAcquired) {
      await lockClient.query("SELECT pg_advisory_unlock($1)", [getSourceImportLockKey("home-assistant")]);
    }
    lockClient.release();
  }
}
