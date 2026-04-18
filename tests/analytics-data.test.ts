import {
  buildAnalyticsResponse,
  buildRankedItems,
  escapeTimezone,
  formatMonthlyLabel,
  getDefaultOverviewRow
} from "@/lib/analytics-data";

describe("analytics data helpers", () => {
  const originalTimezone = process.env.APP_TIMEZONE;

  beforeEach(() => {
    process.env.APP_TIMEZONE = "UTC";
  });

  afterEach(() => {
    if (originalTimezone === undefined) {
      delete process.env.APP_TIMEZONE;
    } else {
      process.env.APP_TIMEZONE = originalTimezone;
    }
  });

  it("formats month labels and escapes the configured timezone", () => {
    process.env.APP_TIMEZONE = "Europe/London";

    expect(escapeTimezone()).toBe("Europe/London");
    expect(formatMonthlyLabel("2026-04")).toBe("Apr 26");
  });

  it("builds ranked item responses and falls back to a default overview", () => {
    expect(
      buildRankedItems([
        { label: "Plex", totalEvents: 3, detail: "300 minutes logged" },
        { label: "Home Assistant", totalEvents: 2, detail: "Duration not consistently available" }
      ])
    ).toEqual([
      { label: "Plex", value: 3, detail: "300 minutes logged" },
      { label: "Home Assistant", value: 2, detail: "Duration not consistently available" }
    ]);

    expect(getDefaultOverviewRow()).toMatchObject({
      total_watch_events: 0,
      import_failures_last_30: 0
    });
  });

  it("maps analytics rows into the public analytics response shape", () => {
    expect(
      buildAnalyticsResponse({
        overviewRow: {
          total_watch_events: 12,
          total_raw_records: 25,
          total_import_jobs: 7,
          sources_with_history: 2,
          active_days_last_30: 8,
          event_growth_last_7: 3,
          event_growth_last_30: 11,
          raw_growth_last_7: 5,
          raw_growth_last_30: 19,
          import_runs_last_30: 4,
          import_failures_last_30: 1
        },
        monthlyActivityRows: [{ label: "2026-04", event_count: 5, active_days: 3 }],
        topTitleRows: [{ title: "Film Night", total_events: 2, total_duration_minutes: 250 }],
        topSourceRows: [{ source_name: "Plex", total_events: 7, total_duration_minutes: 500 }],
        monthlyCreatedRows: [{ label: "2026-04", raw_records: 8, watch_events: 5 }],
        sourceContributionRows: [
          {
            source_name: "Plex",
            watch_events: 7,
            raw_records: 10,
            successful_imports: 3,
            failed_imports: 1,
            latest_success_at: "2026-04-18T10:00:00.000Z"
          }
        ],
        importActivityRows: [
          {
            source_name: "Plex",
            total_runs: 4,
            successful_runs: 3,
            failed_runs: 1,
            average_records_imported: 12.5,
            latest_success_at: "2026-04-18T10:00:00.000Z"
          }
        ],
        watchRangeRow: {
          earliest_at: "2026-01-01T00:00:00.000Z",
          latest_at: "2026-04-18T20:00:00.000Z"
        },
        importRangeRow: {
          earliest_at: "2026-01-02T00:00:00.000Z",
          latest_at: "2026-04-18T10:00:00.000Z"
        }
      })
    ).toEqual({
      overview: {
        totalWatchEvents: 12,
        totalRawRecords: 25,
        totalImportJobs: 7,
        sourcesWithHistory: 2,
        activeDaysLast30: 8,
        eventGrowthLast7: 3,
        eventGrowthLast30: 11,
        rawGrowthLast7: 5,
        rawGrowthLast30: 19,
        importRunsLast30: 4,
        importFailuresLast30: 1
      },
      watchPatterns: {
        monthlyActivity: [{ label: "Apr 26", value: 5, secondaryValue: 3 }],
        topTitles: [{ label: "Film Night", value: 2, detail: "250 minutes logged" }],
        topSources: [{ label: "Plex", value: 7, detail: "500 minutes logged" }],
        earliestWatchAt: "2026-01-01T00:00:00.000Z",
        latestWatchAt: "2026-04-18T20:00:00.000Z"
      },
      datasetGrowth: {
        monthlyCreated: [{ label: "Apr 26", value: 8, rawRecords: 8, watchEvents: 5 }],
        sourceContribution: [
          {
            sourceName: "Plex",
            watchEvents: 7,
            rawRecords: 10,
            successfulImports: 3,
            failedImports: 1,
            latestSuccessAt: "2026-04-18T10:00:00.000Z"
          }
        ],
        earliestImportedAt: "2026-01-02T00:00:00.000Z",
        latestImportedAt: "2026-04-18T10:00:00.000Z"
      },
      importActivity: {
        bySourceLast30Days: [
          {
            sourceName: "Plex",
            totalRuns: 4,
            successfulRuns: 3,
            failedRuns: 1,
            averageRecordsImported: 12.5,
            latestSuccessAt: "2026-04-18T10:00:00.000Z"
          }
        ],
        totalRunsLast30: 4,
        successCountLast30: 3,
        failureCountLast30: 1
      }
    });
  });
});
