import { findChannelBrand } from "@/lib/channels";
import { query } from "@/lib/db";
import { formatEventDateTime } from "@/lib/format";
import type { CuratedFilter, FavouritesResponse, TimelineEvent } from "@/lib/types";

type CurationStateRow = {
  is_favourite: boolean;
  is_hidden: boolean;
};

type CuratedEventRow = {
  id: string;
  source_id: string;
  event_key: string;
  title: string;
  media_type: string | null;
  source_name: string;
  channel_name: string | null;
  channel_key: string | null;
  device_label: string | null;
  watched_at: string;
  duration_minutes: number | null;
  progress_label: string | null;
  status_label: string | null;
  is_provisional: boolean;
  is_favourite: boolean;
  is_hidden: boolean;
};

type CuratedSummaryRow = {
  curated_items: number;
  favourites: number;
  hidden: number;
};

let curationSchemaPromise: Promise<void> | null = null;

export type CurationAction = "favourite" | "unfavourite" | "hide" | "unhide";

export function buildWatchEventCurationKeySql(tableAlias: string) {
  return `
    CASE
      WHEN ${tableAlias}.raw_import_record_id IS NOT NULL
        THEN CONCAT('raw::', ${tableAlias}.raw_import_record_id::text)
      ELSE CONCAT_WS(
        '::',
        'event',
        COALESCE(${tableAlias}.metadata->>'entity_id', ${tableAlias}.source_name),
        ${tableAlias}.watched_at::text,
        ${tableAlias}.title,
        COALESCE(${tableAlias}.media_type, '')
      )
    END
  `;
}

export function buildVisibleWatchEventsCte() {
  const eventKeySql = buildWatchEventCurationKeySql("w");

  return `
    visible_watch_events AS (
      SELECT
        w.*,
        ${eventKeySql} AS event_key,
        COALESCE(c.is_favourite, false) AS is_favourite,
        COALESCE(c.is_hidden, false) AS is_hidden
      FROM watch_events w
      LEFT JOIN watch_event_curation c
        ON c.source_id = w.source_id
       AND c.event_key = ${eventKeySql}
      WHERE COALESCE(c.is_hidden, false) = FALSE
    )
  `;
}

export async function ensureWatchEventCurationSchema() {
  if (!curationSchemaPromise) {
    curationSchemaPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS watch_event_curation (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
          event_key TEXT NOT NULL,
          is_favourite BOOLEAN NOT NULL DEFAULT FALSE,
          is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS watch_event_curation_source_event_key_idx
        ON watch_event_curation (source_id, event_key)
      `);
    })().catch((error) => {
      curationSchemaPromise = null;
      throw error;
    });
  }

  return curationSchemaPromise;
}

function mapCuratedEventRow(row: CuratedEventRow): TimelineEvent {
  const brand = findChannelBrand({
    channelKey: row.channel_key,
    channelName: row.channel_name ?? row.source_name
  });

  return {
    id: row.id,
    sourceId: row.source_id,
    eventKey: row.event_key,
    title: row.title,
    mediaType: row.media_type,
    sourceName: row.source_name,
    channelName: brand?.label ?? row.channel_name,
    channelKey: brand?.key ?? row.channel_key,
    channelLogoPath: brand?.logoPath ?? null,
    deviceLabel: row.device_label,
    watchedAt: row.watched_at,
    watchedAtLabel: formatEventDateTime(row.watched_at),
    durationMinutes: row.duration_minutes,
    progressLabel: row.progress_label,
    statusLabel: row.status_label,
    isProvisional: row.is_provisional,
    isFavourite: row.is_favourite,
    isHidden: row.is_hidden
  };
}

export async function updateWatchEventCuration(params: {
  sourceId: string;
  eventKey: string;
  action: CurationAction;
}) {
  await ensureWatchEventCurationSchema();

  const existingResult = await query<CurationStateRow>(
    `
      SELECT is_favourite, is_hidden
      FROM watch_event_curation
      WHERE source_id = $1
        AND event_key = $2
      LIMIT 1
    `,
    [params.sourceId, params.eventKey]
  );

  const existing = existingResult.rows[0] ?? {
    is_favourite: false,
    is_hidden: false
  };

  const nextState = {
    isFavourite:
      params.action === "favourite"
        ? true
        : params.action === "unfavourite"
          ? false
          : existing.is_favourite,
    isHidden:
      params.action === "hide"
        ? true
        : params.action === "unhide"
          ? false
          : existing.is_hidden
  };

  if (!nextState.isFavourite && !nextState.isHidden) {
    await query(
      `
        DELETE FROM watch_event_curation
        WHERE source_id = $1
          AND event_key = $2
      `,
      [params.sourceId, params.eventKey]
    );
  } else {
    await query(
      `
        INSERT INTO watch_event_curation (
          source_id,
          event_key,
          is_favourite,
          is_hidden
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (source_id, event_key) DO UPDATE
        SET is_favourite = EXCLUDED.is_favourite,
            is_hidden = EXCLUDED.is_hidden,
            updated_at = NOW()
      `,
      [params.sourceId, params.eventKey, nextState.isFavourite, nextState.isHidden]
    );
  }

  return nextState;
}

export async function getFavouritesData(filter: CuratedFilter): Promise<FavouritesResponse> {
  await ensureWatchEventCurationSchema();

  let filterWhere = "c.is_favourite = TRUE OR c.is_hidden = TRUE";

  if (filter === "favourites") {
    filterWhere = "c.is_favourite = TRUE";
  } else if (filter === "hidden") {
    filterWhere = "c.is_hidden = TRUE";
  }

  const eventKeySql = buildWatchEventCurationKeySql("w");

  const [itemsResult, summaryResult] = await Promise.all([
    query<CuratedEventRow>(
      `
        SELECT
          w.id,
          w.source_id,
          ${eventKeySql} AS event_key,
          w.title,
          w.media_type,
          w.source_name,
          w.metadata->>'channel' AS channel_name,
          w.metadata->>'channel_key' AS channel_key,
          COALESCE(w.metadata->>'device_label', w.metadata->>'entity_id') AS device_label,
          w.watched_at::text,
          w.duration_minutes,
          w.metadata->>'progress_label' AS progress_label,
          w.metadata->>'status_label' AS status_label,
          COALESCE((w.metadata->>'is_provisional')::boolean, false) AS is_provisional,
          c.is_favourite,
          c.is_hidden
        FROM watch_events w
        INNER JOIN watch_event_curation c
          ON c.source_id = w.source_id
         AND c.event_key = ${eventKeySql}
        WHERE ${filterWhere}
        ORDER BY c.updated_at DESC, w.watched_at DESC
        LIMIT 200
      `
    ),
    query<CuratedSummaryRow>(
      `
        SELECT
          COUNT(*) FILTER (WHERE c.is_favourite = TRUE OR c.is_hidden = TRUE)::int AS curated_items,
          COUNT(*) FILTER (WHERE c.is_favourite = TRUE)::int AS favourites,
          COUNT(*) FILTER (WHERE c.is_hidden = TRUE)::int AS hidden
        FROM watch_events w
        INNER JOIN watch_event_curation c
          ON c.source_id = w.source_id
         AND c.event_key = ${eventKeySql}
      `
    )
  ]);

  return {
    filter,
    items: itemsResult.rows.map(mapCuratedEventRow),
    summary: {
      curatedItems: summaryResult.rows[0]?.curated_items ?? 0,
      favourites: summaryResult.rows[0]?.favourites ?? 0,
      hidden: summaryResult.rows[0]?.hidden ?? 0
    }
  };
}
