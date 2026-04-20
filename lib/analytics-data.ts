import { getAppTimezone } from "@/lib/app-config";
import type {
  AnalyticsImportSource,
  AnalyticsRankedItem,
  AnalyticsResponse,
  AnalyticsSeriesPoint,
  AnalyticsSourceContribution
} from "@/lib/types";

export type OverviewRow = {
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

export type MonthlyActivityRow = {
  label: string;
  event_count: number;
  active_days: number;
};

export type TopTitleRow = {
  title: string;
  total_events: number;
  total_duration_minutes: number | null;
};

export type TopSourceRow = {
  source_name: string;
  total_events: number;
  total_duration_minutes: number | null;
};

export type MonthlyCreatedRow = {
  label: string;
  raw_records: number;
  watch_events: number;
};

export type SourceContributionRow = {
  source_name: string;
  watch_events: number;
  raw_records: number;
  successful_imports: number;
  failed_imports: number;
  latest_success_at: string | null;
};

export type ImportActivityRow = {
  source_name: string;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  average_records_imported: number | null;
  latest_success_at: string | null;
};

export type RangeRow = {
  earliest_at: string | null;
  latest_at: string | null;
};

export function escapeTimezone() {
  return getAppTimezone().replace(/'/g, "''");
}

export function formatMonthlyLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: getAppTimezone()
  }).format(new Date(`${value}-01T00:00:00Z`));
}

export function buildRankedItems<T extends { label: string; totalEvents: number; detail: string }>(
  rows: T[]
): AnalyticsRankedItem[] {
  return rows.map((row) => ({
    label: row.label,
    value: row.totalEvents,
    detail: row.detail
  }));
}

export function getDefaultOverviewRow(): OverviewRow {
  return {
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
}

export function buildAnalyticsResponse(params: {
  overviewRow?: OverviewRow;
  monthlyActivityRows: MonthlyActivityRow[];
  topTitleRows: TopTitleRow[];
  topSourceRows: TopSourceRow[];
  monthlyCreatedRows: MonthlyCreatedRow[];
  sourceContributionRows: SourceContributionRow[];
  importActivityRows: ImportActivityRow[];
  watchRangeRow?: RangeRow;
  importRangeRow?: RangeRow;
}): AnalyticsResponse {
  const overview = params.overviewRow ?? getDefaultOverviewRow();
  const watchRange = params.watchRangeRow ?? { earliest_at: null, latest_at: null };
  const importRange = params.importRangeRow ?? { earliest_at: null, latest_at: null };

  const monthlyActivity: AnalyticsSeriesPoint[] = params.monthlyActivityRows.map((row) => ({
    label: formatMonthlyLabel(row.label),
    value: row.event_count,
    secondaryValue: row.active_days
  }));

  const topTitles = buildRankedItems(
    params.topTitleRows.map((row) => ({
      label: row.title,
      totalEvents: row.total_events,
      detail:
        row.total_duration_minutes && row.total_duration_minutes > 0
          ? `${row.total_duration_minutes} minutes logged`
          : "Duration not consistently available"
    }))
  );

  const topSources = buildRankedItems(
    params.topSourceRows.map((row) => ({
      label: row.source_name,
      totalEvents: row.total_events,
      detail:
        row.total_duration_minutes && row.total_duration_minutes > 0
          ? `${row.total_duration_minutes} minutes logged`
          : "Duration not consistently available"
    }))
  );

  const monthlyCreated = params.monthlyCreatedRows.map((row) => ({
    label: formatMonthlyLabel(row.label),
    value: Math.max(row.raw_records, row.watch_events),
    rawRecords: row.raw_records,
    watchEvents: row.watch_events
  }));

  const sourceContribution: AnalyticsSourceContribution[] = params.sourceContributionRows.map((row) => ({
    sourceName: row.source_name,
    watchEvents: row.watch_events,
    rawRecords: row.raw_records,
    successfulImports: row.successful_imports,
    failedImports: row.failed_imports,
    latestSuccessAt: row.latest_success_at
  }));

  const importActivity: AnalyticsImportSource[] = params.importActivityRows.map((row) => ({
    sourceName: row.source_name,
    totalRuns: row.total_runs,
    successfulRuns: row.successful_runs,
    failedRuns: row.failed_runs,
    averageRecordsImported:
      row.average_records_imported === null ? null : Number(row.average_records_imported),
    latestSuccessAt: row.latest_success_at
  }));

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
