import { buildVisibleWatchEventsCte, ensureWatchEventCurationSchema } from "@/lib/curation";
import {
  buildAnalyticsResponse,
  escapeTimezone,
  type ImportActivityRow,
  type MonthlyActivityRow,
  type MonthlyCreatedRow,
  type OverviewRow,
  type RangeRow,
  type SourceContributionRow,
  type TopSourceRow,
  type TopTitleRow
} from "@/lib/analytics-data";
import { query } from "@/lib/db";
import type { AnalyticsResponse } from "@/lib/types";

export async function getAnalyticsData(): Promise<AnalyticsResponse> {
  await ensureWatchEventCurationSchema();

  const timezone = escapeTimezone();
  const visibleWatchEventsCte = buildVisibleWatchEventsCte();

  const [
    overviewResult,
    monthlyActivityResult,
    topTitlesResult,
    topSourcesResult,
    monthlyCreatedResult,
    sourceContributionResult,
    importActivityResult,
    watchRangeResult,
    importRangeResult
  ] = await Promise.all([
    query<OverviewRow>(
      `
        WITH ${visibleWatchEventsCte}
        SELECT
          (SELECT COUNT(*)::int FROM visible_watch_events) AS total_watch_events,
          (SELECT COUNT(*)::int FROM raw_import_records) AS total_raw_records,
          (SELECT COUNT(*)::int FROM import_jobs) AS total_import_jobs,
          (SELECT COUNT(DISTINCT source_id)::int FROM visible_watch_events) AS sources_with_history,
          (
            SELECT COUNT(DISTINCT DATE(watched_at AT TIME ZONE '${timezone}'))::int
            FROM visible_watch_events
            WHERE watched_at >= NOW() - INTERVAL '30 days'
          ) AS active_days_last_30,
          (
            SELECT COUNT(*)::int
            FROM visible_watch_events
            WHERE created_at >= NOW() - INTERVAL '7 days'
          ) AS event_growth_last_7,
          (
            SELECT COUNT(*)::int
            FROM visible_watch_events
            WHERE created_at >= NOW() - INTERVAL '30 days'
          ) AS event_growth_last_30,
          (
            SELECT COUNT(*)::int
            FROM raw_import_records
            WHERE imported_at >= NOW() - INTERVAL '7 days'
          ) AS raw_growth_last_7,
          (
            SELECT COUNT(*)::int
            FROM raw_import_records
            WHERE imported_at >= NOW() - INTERVAL '30 days'
          ) AS raw_growth_last_30,
          (
            SELECT COUNT(*)::int
            FROM import_jobs
            WHERE started_at >= NOW() - INTERVAL '30 days'
          ) AS import_runs_last_30,
          (
            SELECT COUNT(*)::int
            FROM import_jobs
            WHERE started_at >= NOW() - INTERVAL '30 days'
              AND status = 'failed'
          ) AS import_failures_last_30
      `
    ),
    query<MonthlyActivityRow>(
      `
        WITH ${visibleWatchEventsCte},
        months AS (
          SELECT GENERATE_SERIES(
            DATE_TRUNC('month', NOW() AT TIME ZONE '${timezone}') - INTERVAL '11 months',
            DATE_TRUNC('month', NOW() AT TIME ZONE '${timezone}'),
            INTERVAL '1 month'
          ) AS month_start
        )
        SELECT
          TO_CHAR(month_start, 'YYYY-MM') AS label,
          COUNT(w.id)::int AS event_count,
          COUNT(DISTINCT DATE(w.watched_at AT TIME ZONE '${timezone}'))::int AS active_days
        FROM months
        LEFT JOIN visible_watch_events w
          ON DATE_TRUNC('month', w.watched_at AT TIME ZONE '${timezone}') = month_start
        GROUP BY month_start
        ORDER BY month_start
      `
    ),
    query<TopTitleRow>(
      `
        WITH ${visibleWatchEventsCte}
        SELECT
          title,
          COUNT(*)::int AS total_events,
          COALESCE(SUM(duration_minutes), 0)::int AS total_duration_minutes
        FROM visible_watch_events
        GROUP BY title
        ORDER BY total_events DESC, total_duration_minutes DESC, title ASC
        LIMIT 5
      `
    ),
    query<TopSourceRow>(
      `
        WITH ${visibleWatchEventsCte}
        SELECT
          source_name,
          COUNT(*)::int AS total_events,
          COALESCE(SUM(duration_minutes), 0)::int AS total_duration_minutes
        FROM visible_watch_events
        GROUP BY source_name
        ORDER BY total_events DESC, total_duration_minutes DESC, source_name ASC
        LIMIT 5
      `
    ),
    query<MonthlyCreatedRow>(
      `
        WITH ${visibleWatchEventsCte},
        months AS (
          SELECT GENERATE_SERIES(
            DATE_TRUNC('month', NOW() AT TIME ZONE '${timezone}') - INTERVAL '11 months',
            DATE_TRUNC('month', NOW() AT TIME ZONE '${timezone}'),
            INTERVAL '1 month'
          ) AS month_start
        ),
        raw_counts AS (
          SELECT
            DATE_TRUNC('month', imported_at AT TIME ZONE '${timezone}') AS month_start,
            COUNT(*)::int AS raw_records
          FROM raw_import_records
          GROUP BY 1
        ),
        watch_counts AS (
          SELECT
            DATE_TRUNC('month', created_at AT TIME ZONE '${timezone}') AS month_start,
            COUNT(*)::int AS watch_events
          FROM visible_watch_events
          GROUP BY 1
        )
        SELECT
          TO_CHAR(months.month_start, 'YYYY-MM') AS label,
          COALESCE(raw_counts.raw_records, 0)::int AS raw_records,
          COALESCE(watch_counts.watch_events, 0)::int AS watch_events
        FROM months
        LEFT JOIN raw_counts ON raw_counts.month_start = months.month_start
        LEFT JOIN watch_counts ON watch_counts.month_start = months.month_start
        ORDER BY months.month_start
      `
    ),
    query<SourceContributionRow>(
      `
        WITH ${visibleWatchEventsCte},
        watch_counts AS (
          SELECT
            source_id,
            COUNT(*)::int AS watch_events
          FROM visible_watch_events
          GROUP BY source_id
        ),
        raw_counts AS (
          SELECT
            source_id,
            COUNT(*)::int AS raw_records
          FROM raw_import_records
          GROUP BY source_id
        ),
        import_counts AS (
          SELECT
            source_id,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS successful_imports,
            COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_imports,
            MAX(completed_at) FILTER (WHERE status = 'completed')::text AS latest_success_at
          FROM import_jobs
          GROUP BY source_id
        )
        SELECT
          sources.display_name AS source_name,
          COALESCE(watch_counts.watch_events, 0)::int AS watch_events,
          COALESCE(raw_counts.raw_records, 0)::int AS raw_records,
          COALESCE(import_counts.successful_imports, 0)::int AS successful_imports,
          COALESCE(import_counts.failed_imports, 0)::int AS failed_imports,
          import_counts.latest_success_at
        FROM sources
        LEFT JOIN watch_counts ON watch_counts.source_id = sources.id
        LEFT JOIN raw_counts ON raw_counts.source_id = sources.id
        LEFT JOIN import_counts ON import_counts.source_id = sources.id
        ORDER BY watch_events DESC, raw_records DESC, source_name ASC
      `
    ),
    query<ImportActivityRow>(
      `
        SELECT
          sources.display_name AS source_name,
          COUNT(import_jobs.id)::int AS total_runs,
          COUNT(import_jobs.id) FILTER (WHERE import_jobs.status = 'completed')::int AS successful_runs,
          COUNT(import_jobs.id) FILTER (WHERE import_jobs.status = 'failed')::int AS failed_runs,
          AVG(import_jobs.records_imported) FILTER (WHERE import_jobs.status = 'completed')::numeric(10, 1) AS average_records_imported,
          MAX(import_jobs.completed_at) FILTER (WHERE import_jobs.status = 'completed')::text AS latest_success_at
        FROM sources
        LEFT JOIN import_jobs
          ON import_jobs.source_id = sources.id
          AND import_jobs.started_at >= NOW() - INTERVAL '30 days'
        GROUP BY sources.id, sources.display_name
        ORDER BY total_runs DESC, source_name ASC
      `
    ),
    query<RangeRow>(
      `
        WITH ${visibleWatchEventsCte}
        SELECT
          MIN(watched_at)::text AS earliest_at,
          MAX(watched_at)::text AS latest_at
        FROM visible_watch_events
      `
    ),
    query<RangeRow>(
      `
        SELECT
          MIN(imported_at)::text AS earliest_at,
          MAX(imported_at)::text AS latest_at
        FROM raw_import_records
      `
    )
  ]);

  return buildAnalyticsResponse({
    overviewRow: overviewResult.rows[0],
    monthlyActivityRows: monthlyActivityResult.rows,
    topTitleRows: topTitlesResult.rows,
    topSourceRows: topSourcesResult.rows,
    monthlyCreatedRows: monthlyCreatedResult.rows,
    sourceContributionRows: sourceContributionResult.rows,
    importActivityRows: importActivityResult.rows,
    watchRangeRow: watchRangeResult.rows[0],
    importRangeRow: importRangeResult.rows[0]
  });
}
