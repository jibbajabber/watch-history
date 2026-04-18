import { buildVisibleWatchEventsCte, ensureWatchEventCurationSchema } from "@/lib/curation";
import { query } from "@/lib/db";
import {
  buildTimelineHighlights,
  buildTimelineInsights,
  buildTimelineSummary,
  getEscapedTimelineTimezone,
  getTimelineViewWindow,
  type EventRow,
  type GroupRow,
  type HighlightRow,
  isTimelineView,
  mapTimelineEventRow,
  mapTimelineGroupRow,
  type SourceMixRow,
  type SummaryRow
} from "@/lib/timeline-data";
import type { TimelineResponse, TimelineView } from "@/lib/types";

export { getTimelineViewMeta, isTimelineView } from "@/lib/timeline-data";

export async function getTimelineViewData(view: TimelineView): Promise<TimelineResponse> {
  await ensureWatchEventCurationSchema();

  const window = getTimelineViewWindow(view);
  const visibleWatchEventsCte = buildVisibleWatchEventsCte();
  const timezone = getEscapedTimelineTimezone();

  const [eventsResult, groupsResult, summaryResult, titleHighlightResult, sourceMixResult] =
    await Promise.all([
    query<EventRow>(
      `
        WITH ${visibleWatchEventsCte}
        SELECT
          id,
          source_id,
          event_key,
          title,
          media_type,
          source_name,
          metadata->>'channel' AS channel_name,
          metadata->>'channel_key' AS channel_key,
          COALESCE(metadata->>'device_label', metadata->>'entity_id') AS device_label,
          watched_at::text,
          duration_minutes,
          metadata->>'progress_label' AS progress_label,
          metadata->>'status_label' AS status_label,
          COALESCE((metadata->>'is_provisional')::boolean, false) AS is_provisional,
          is_favourite,
          is_hidden
        FROM visible_watch_events
        WHERE watched_at >= ${window.intervalSql}
        ORDER BY watched_at DESC
        LIMIT 200
      `
    ),
    query<GroupRow>(
      `
        WITH ${visibleWatchEventsCte}
        SELECT
          ${window.groupByExpression} AS label,
          COUNT(*)::int AS total_events,
          COALESCE(SUM(duration_minutes), 0)::int AS total_duration_minutes,
          MAX(watched_at)::text AS latest_watched_at
        FROM visible_watch_events
        WHERE watched_at >= ${window.intervalSql}
        GROUP BY ${window.groupByExpression}, ${window.groupSortExpression}
        ORDER BY ${window.groupSortExpression} DESC
      `
    ),
    query<SummaryRow>(
      `
        WITH ${visibleWatchEventsCte}
        SELECT
          COUNT(*)::int AS total_events,
          COUNT(DISTINCT title)::int AS unique_titles,
          COUNT(DISTINCT source_id)::int AS sources,
          COALESCE(SUM(duration_minutes), 0)::int AS total_duration_minutes,
          COUNT(DISTINCT DATE(watched_at AT TIME ZONE '${timezone}'))::int AS active_days
        FROM visible_watch_events
        WHERE watched_at >= ${window.intervalSql}
      `
    ),
    query<HighlightRow>(
      `
        WITH ${visibleWatchEventsCte}
        SELECT
          title,
          COUNT(*)::int AS total_events,
          COALESCE(SUM(duration_minutes), 0)::int AS total_duration_minutes
        FROM visible_watch_events
        WHERE watched_at >= ${window.intervalSql}
        GROUP BY title
        ORDER BY total_events DESC, total_duration_minutes DESC, title ASC
        LIMIT 1
      `
    ),
    query<SourceMixRow>(
      `
        WITH ${visibleWatchEventsCte}
        SELECT
          source_name,
          COUNT(*)::int AS total_events
        FROM visible_watch_events
        WHERE watched_at >= ${window.intervalSql}
        GROUP BY source_name
        ORDER BY total_events DESC, source_name ASC
        LIMIT 3
      `
    )
  ]);

  const events = eventsResult.rows.map(mapTimelineEventRow);
  const groups = groupsResult.rows.map(mapTimelineGroupRow);
  const summary = buildTimelineSummary(summaryResult.rows[0]);
  const insights = buildTimelineInsights({
    summary,
    groups,
    sourceMixRows: sourceMixResult.rows,
    events
  });
  const highlights = buildTimelineHighlights({
    titleHighlight: titleHighlightResult.rows[0] ?? null,
    sourceMixRows: sourceMixResult.rows,
    events
  });

  return {
    view,
    rangeLabel: window.rangeLabel,
    events,
    groups,
    summary,
    insights,
    highlights,
    meta: {
      groupLabel: window.groupLabel
    }
  };
}
