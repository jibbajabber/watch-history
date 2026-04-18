const queryMock = vi.fn();
const ensureWatchEventCurationSchemaMock = vi.fn();
const buildVisibleWatchEventsCteMock = vi.fn();

vi.mock("@/lib/db", () => ({
  query: queryMock
}));

vi.mock("@/lib/curation", () => ({
  ensureWatchEventCurationSchema: ensureWatchEventCurationSchemaMock,
  buildVisibleWatchEventsCte: buildVisibleWatchEventsCteMock
}));

describe("analytics orchestration", () => {
  const originalTimezone = process.env.APP_TIMEZONE;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.APP_TIMEZONE = "UTC";
    ensureWatchEventCurationSchemaMock.mockResolvedValue(undefined);
    buildVisibleWatchEventsCteMock.mockReturnValue("visible_watch_events AS (SELECT 1)");
  });

  afterEach(() => {
    if (originalTimezone === undefined) {
      delete process.env.APP_TIMEZONE;
    } else {
      process.env.APP_TIMEZONE = originalTimezone;
    }
  });

  it("queries all analytics datasets and maps them into the public response", async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
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
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [{ label: "2026-04", event_count: 5, active_days: 3 }]
      })
      .mockResolvedValueOnce({
        rows: [{ title: "Film Night", total_events: 2, total_duration_minutes: 250 }]
      })
      .mockResolvedValueOnce({
        rows: [{ source_name: "Plex", total_events: 7, total_duration_minutes: 500 }]
      })
      .mockResolvedValueOnce({
        rows: [{ label: "2026-04", raw_records: 8, watch_events: 5 }]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            source_name: "Plex",
            watch_events: 7,
            raw_records: 10,
            successful_imports: 3,
            failed_imports: 1,
            latest_success_at: "2026-04-18T10:00:00.000Z"
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [
          {
            source_name: "Plex",
            total_runs: 4,
            successful_runs: 3,
            failed_runs: 1,
            average_records_imported: 12.5,
            latest_success_at: "2026-04-18T10:00:00.000Z"
          }
        ]
      })
      .mockResolvedValueOnce({
        rows: [{ earliest_at: "2026-01-01T00:00:00.000Z", latest_at: "2026-04-18T20:00:00.000Z" }]
      })
      .mockResolvedValueOnce({
        rows: [{ earliest_at: "2026-01-02T00:00:00.000Z", latest_at: "2026-04-18T10:00:00.000Z" }]
      });

    const { getAnalyticsData } = await import("@/lib/analytics");
    const result = await getAnalyticsData();

    expect(ensureWatchEventCurationSchemaMock).toHaveBeenCalledTimes(1);
    expect(buildVisibleWatchEventsCteMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledTimes(9);
    expect(queryMock.mock.calls[0]?.[0]).toContain("WITH visible_watch_events AS (SELECT 1)");
    expect(queryMock.mock.calls[0]?.[0]).toContain("AT TIME ZONE 'UTC'");

    expect(result).toEqual({
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

  it("falls back to empty analytics values when queries return no rows", async () => {
    process.env.APP_TIMEZONE = "Europe/London";

    for (let index = 0; index < 9; index += 1) {
      queryMock.mockResolvedValueOnce({ rows: [] });
    }

    const { getAnalyticsData } = await import("@/lib/analytics");
    const result = await getAnalyticsData();

    expect(queryMock).toHaveBeenCalledTimes(9);
    expect(queryMock.mock.calls[0]?.[0]).toContain("AT TIME ZONE 'Europe/London'");
    expect(result).toEqual({
      overview: {
        totalWatchEvents: 0,
        totalRawRecords: 0,
        totalImportJobs: 0,
        sourcesWithHistory: 0,
        activeDaysLast30: 0,
        eventGrowthLast7: 0,
        eventGrowthLast30: 0,
        rawGrowthLast7: 0,
        rawGrowthLast30: 0,
        importRunsLast30: 0,
        importFailuresLast30: 0
      },
      watchPatterns: {
        monthlyActivity: [],
        topTitles: [],
        topSources: [],
        earliestWatchAt: null,
        latestWatchAt: null
      },
      datasetGrowth: {
        monthlyCreated: [],
        sourceContribution: [],
        earliestImportedAt: null,
        latestImportedAt: null
      },
      importActivity: {
        bySourceLast30Days: [],
        totalRunsLast30: 0,
        successCountLast30: 0,
        failureCountLast30: 0
      }
    });
  });
});
