import type { SourceRetentionConfig } from "@/lib/source-retention";

const queryMock = vi.fn();
const connectMock = vi.fn();
const lockClientQueryMock = vi.fn();
const releaseMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getPool: () => ({
    connect: connectMock
  }),
  query: queryMock
}));

describe("source retention cleanup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    connectMock.mockResolvedValue({
      query: lockClientQueryMock,
      release: releaseMock
    });
    lockClientQueryMock
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [] });
  });

  it("skips cleanup when the retention mode is indefinite", async () => {
    const { runSourceRetentionCleanup } = await import("@/lib/source-retention");
    const result = await runSourceRetentionCleanup("plex", {
      mode: "indefinite",
      historyDays: null,
      importJobDays: null,
      provisionalHours: null
    });

    expect(result).toEqual({
      slug: "plex",
      status: "skipped",
      reason: "retention mode is indefinite",
      deletedProvisionalWatchEvents: 0,
      deletedProvisionalRawRecords: 0,
      deletedDurableWatchEvents: 0,
      deletedDurableRawRecords: 0,
      deletedImportJobs: 0
    });
    expect(queryMock).not.toHaveBeenCalled();
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("removes expired Plex rows and reports the deleted counts", async () => {
    queryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM sources") && sql.includes("WHERE slug = $1")) {
        expect(params).toEqual(["plex"]);
        return { rows: [{ id: "source-plex" }] };
      }

      if (sql.includes("DELETE FROM watch_events") && sql.includes("metadata->>'is_provisional' = 'true'")) {
        return { rowCount: 2 };
      }

      if (sql.includes("DELETE FROM raw_import_records") && sql.includes("source_record_id LIKE 'session::%'")) {
        return { rowCount: 1 };
      }

      if (sql.includes("DELETE FROM watch_events") && sql.includes("COALESCE(metadata->>'is_provisional', 'false') <> 'true'")) {
        return { rowCount: 3 };
      }

      if (sql.includes("DELETE FROM raw_import_records") && sql.includes("source_record_id NOT LIKE 'session::%'")) {
        return { rowCount: 4 };
      }

      if (sql.includes("DELETE FROM import_jobs")) {
        return { rowCount: 5 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const { runSourceRetentionCleanup } = await import("@/lib/source-retention");
    const result = await runSourceRetentionCleanup("plex", {
      mode: "windowed",
      historyDays: 30,
      importJobDays: 14,
      provisionalHours: 12
    } satisfies SourceRetentionConfig);

    expect(result).toEqual({
      slug: "plex",
      status: "completed",
      deletedProvisionalWatchEvents: 2,
      deletedProvisionalRawRecords: 1,
      deletedDurableWatchEvents: 3,
      deletedDurableRawRecords: 4,
      deletedImportJobs: 5
    });
    expect(queryMock).toHaveBeenCalledTimes(6);
    expect(lockClientQueryMock).toHaveBeenNthCalledWith(
      1,
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [expect.any(Number)]
    );
    expect(lockClientQueryMock).toHaveBeenNthCalledWith(
      2,
      "SELECT pg_advisory_unlock($1)",
      [expect.any(Number)]
    );
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });
});
