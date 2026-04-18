import { getAppTimezone } from "@/lib/app-config";
import { query } from "@/lib/db";
import type {
  AnalyticsImportSource,
  AnalyticsRankedItem,
  AnalyticsResponse,
  AnalyticsSeriesPoint,
  AnalyticsSourceContribution
} from "@/lib/types";

type OverviewRow = {
  total_watch_events: number;
  total_raw_records: number;
  total_import_jobs: number;
  sources_with_history: number;
  active_days_last_30: number;
  event_growth_last_7: number;
  event_growth_last_30: number;
  raw_growth_last_7: number;
  raw_growth_last_30: number;
  import_runs_last_30: number;
  import_failures_last_30: number;
};

type MonthlyActivityRow = {
  label: string;
  event_count: number;
  active_days: number;
};

type TopTitleRow = {
  title: string;
  total_events: number;
  total_duration_minutes: number | null;
};

type TopSourceRow = {
  source_name: string;
  total_events: number;
  total_duration_minutes: number | null;
};

type MonthlyCreatedRow = {
  label: string;
  raw_records: number;
  watch_events: number;
};

type SourceContributionRow = {
  source_name: string;
  watch_events: number;
  raw_records: number;
  successful_imports: number;
  failed_imports: number;
  latest_success_at: string | null;
};

type ImportActivityRow = {
  source_name: string;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  average_records_imported: number | null;
  latest_success_at: string | null;
};

type RangeRow = {
  earliest_at: string | null;
  latest_at: string | null;
};

function escapeTimezone() {
  return getAppTimezone().replace(/'/g, "''");
}

function formatMonthlyLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: getAppTimezone()
  }).format(new Date(`${value}-01T00:00:00Z`));
}

function buildRankedItems<T extends { label: string; totalEvents: number; detail: string }>(
  rows: T[]
): AnalyticsRankedItem[] {
  return rows.map((row) => ({
    label: row.label,
    value: row.totalEvents,
    detail: row.detail
  }));
}

export async function getAnalyticsData(): Promise<AnalyticsResponse> {
  const timezone = escapeTimezone();

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
        SELECT
          (SELECT COUNT(*)::int FROM watch_events) AS total_watch_events,
          (SELECT COUNT(*)::int FROM raw_import_records) AS total_raw_records,
          (SELECT COUNT(*)::int FROM import_jobs) AS total_import_jobs,
          (SELECT COUNT(DISTINCT source_id)::int FROM watch_events) AS sources_with_history,
          (
            SELECT COUNT(DISTINCT DATE(watched_at AT TIME ZONE '${timezone}'))::int
            FROM watch_events
            WHERE watched_at >= NOW() - INTERVAL '30 days'
          ) AS active_days_last_30,
          (
            SELECT COUNT(*)::int
            FROM watch_events
            WHERE created_at >= NOW() - INTERVAL '7 days'
          ) AS event_growth_last_7,
          (
            SELECT COUNT(*)::int
            FROM watch_events
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
        WITH months AS (
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
        LEFT JOIN watch_events w
          ON DATE_TRUNC('month', w.watched_at AT TIME ZONE '${timezone}') = month_start
        GROUP BY month_start
        ORDER BY month_start
      `
    ),
    query<TopTitleRow>(
      `
        SELECT
          title,
          COUNT(*)::int AS total_events,
          COALESCE(SUM(duration_minutes), 0)::int AS total_duration_minutes
        FROM watch_events
        GROUP BY title
        ORDER BY total_events DESC, total_duration_minutes DESC, title ASC
        LIMIT 5
      `
    ),
    query<TopSourceRow>(
      `
        SELECT
          source_name,
          COUNT(*)::int AS total_events,
          COALESCE(SUM(duration_minutes), 0)::int AS total_duration_minutes
        FROM watch_events
        GROUP BY source_name
        ORDER BY total_events DESC, total_duration_minutes DESC, source_name ASC
        LIMIT 5
      `
    ),
    query<MonthlyCreatedRow>(
      `
        WITH months AS (
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
          FROM watch_events
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
        WITH watch_counts AS (
          SELECT
            source_id,
            COUNT(*)::int AS watch_events
          FROM watch_events
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
        SELECT
          MIN(watched_at)::text AS earliest_at,
          MAX(watched_at)::text AS latest_at
        FROM watch_events
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

  const overview = overviewResult.rows[0] ?? {
    total_watch_events: 0,
    total_raw_records: 0,
    total_import_jobs: 0,
    sources_with_history: 0,
    active_days_last_30: 0,
    event_growth_last_7: 0,
    event_growth_last_30: 0,
    raw_growth_last_7: 0,
    raw_growth_last_30: 0,
    import_runs_last_30: 0,
    import_failures_last_30: 0
  };

  const monthlyActivity: AnalyticsSeriesPoint[] = monthlyActivityResult.rows.map((row) => ({
    label: formatMonthlyLabel(row.label),
    value: row.event_count,
    secondaryValue: row.active_days
  }));

  const topTitles = buildRankedItems(
    topTitlesResult.rows.map((row) => ({
      label: row.title,
      totalEvents: row.total_events,
      detail:
        row.total_duration_minutes && row.total_duration_minutes > 0
          ? `${row.total_duration_minutes} minutes logged`
          : "Duration not consistently available"
    }))
  );

  const topSources = buildRankedItems(
    topSourcesResult.rows.map((row) => ({
      label: row.source_name,
      totalEvents: row.total_events,
      detail:
        row.total_duration_minutes && row.total_duration_minutes > 0
          ? `${row.total_duration_minutes} minutes logged`
          : "Duration not consistently available"
    }))
  );

  const monthlyCreated = monthlyCreatedResult.rows.map((row) => ({
    label: formatMonthlyLabel(row.label),
    value: Math.max(row.raw_records, row.watch_events),
    rawRecords: row.raw_records,
    watchEvents: row.watch_events
  }));

  const sourceContribution: AnalyticsSourceContribution[] = sourceContributionResult.rows.map((row) => ({
    sourceName: row.source_name,
    watchEvents: row.watch_events,
    rawRecords: row.raw_records,
    successfulImports: row.successful_imports,
    failedImports: row.failed_imports,
    latestSuccessAt: row.latest_success_at
  }));

  const importActivity: AnalyticsImportSource[] = importActivityResult.rows.map((row) => ({
    sourceName: row.source_name,
    totalRuns: row.total_runs,
    successfulRuns: row.successful_runs,
    failedRuns: row.failed_runs,
    averageRecordsImported:
      row.average_records_imported === null ? null : Number(row.average_records_imported),
    latestSuccessAt: row.latest_success_at
  }));

  const watchRange = watchRangeResult.rows[0] ?? { earliest_at: null, latest_at: null };
  const importRange = importRangeResult.rows[0] ?? { earliest_at: null, latest_at: null };

  return {
    overview: {
      totalWatchEvents: overview.total_watch_events,
      totalRawRecords: overview.total_raw_records,
      totalImportJobs: overview.total_import_jobs,
      sourcesWithHistory: overview.sources_with_history,
      activeDaysLast30: overview.active_days_last_30,
      eventGrowthLast7: overview.event_growth_last_7,
      eventGrowthLast30: overview.event_growth_last_30,
      rawGrowthLast7: overview.raw_growth_last_7,
      rawGrowthLast30: overview.raw_growth_last_30,
      importRunsLast30: overview.import_runs_last_30,
      importFailuresLast30: overview.import_failures_last_30
    },
    watchPatterns: {
      monthlyActivity,
      topTitles,
      topSources,
      earliestWatchAt: watchRange.earliest_at,
      latestWatchAt: watchRange.latest_at
    },
    datasetGrowth: {
      monthlyCreated,
      sourceContribution,
      earliestImportedAt: importRange.earliest_at,
      latestImportedAt: importRange.latest_at
    },
    importActivity: {
      bySourceLast30Days: importActivity,
      totalRunsLast30: overview.import_runs_last_30,
      successCountLast30: Math.max(
        overview.import_runs_last_30 - overview.import_failures_last_30,
        0
      ),
      failureCountLast30: overview.import_failures_last_30
    }
  };
}
