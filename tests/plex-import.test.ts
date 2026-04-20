import type { PlexHistoryItem, PlexSessionItem } from "@/lib/plex-normalization";

const queryMock = vi.fn();
const connectMock = vi.fn();
const lockClientQueryMock = vi.fn();
const releaseMock = vi.fn();
const fetchPlexHistoryMock = vi.fn();
const fetchPlexSessionsMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getPool: () => ({
    connect: connectMock
  }),
  query: queryMock
}));

vi.mock("@/lib/plex", () => ({
  fetchPlexHistory: fetchPlexHistoryMock,
  fetchPlexSessions: fetchPlexSessionsMock
}));

describe("plex import orchestration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T18:00:00.000Z"));
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reuses provisional sessions, prunes expired rows, and rebuilds imported history", async () => {
    const rawRecords: Array<{
      id: string;
      source_id: string;
      source_record_id: string;
      imported_at: string;
      payload: PlexHistoryItem | PlexSessionItem;
    }> = [
      {
        id: "session-row-expired",
        source_id: "source-plex",
        source_record_id: "session::expired",
        imported_at: "2026-04-18T17:40:00.000Z",
        payload: {
          Session: { id: "session-recent" },
          ratingKey: "100",
          key: "/library/metadata/100",
          title: "Recent Film",
          type: "movie"
        }
      },
      {
        id: "session-row-reusable",
        source_id: "source-plex",
        source_record_id: "session::reusable",
        imported_at: "2026-04-18T14:00:00.000Z",
        payload: {
          Session: { id: "session-live" },
          ratingKey: "200",
          key: "/library/metadata/200",
          grandparentTitle: "Severance",
          parentIndex: 2,
          index: 4,
          title: "Woe's Hollow",
          type: "episode",
          viewOffset: 45 * 60000,
          duration: 90 * 60000,
          Player: {
            title: "Living Room Apple TV",
            product: "Plex for tvOS",
            platform: "tvOS",
            state: "playing"
          },
          User: {
            id: "u1",
            title: "Alex"
          }
        }
      }
    ];

    queryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM sources") && sql.includes("slug = 'plex'")) {
        return { rows: [{ id: "source-plex" }] };
      }

      if (sql.includes("INSERT INTO import_jobs")) {
        return { rows: [{ id: "import-job-plex" }] };
      }

      if (sql.includes("INSERT INTO raw_import_records")) {
        const [, sourceId, sourceRecordId, payloadJson] = params as [
          string,
          string,
          string,
          string
        ];
        const payload = JSON.parse(payloadJson) as PlexHistoryItem | PlexSessionItem;
        const existing = rawRecords.find(
          (record) => record.source_id === sourceId && record.source_record_id === sourceRecordId
        );
        const row = existing ?? {
          id: `raw-${rawRecords.length + 1}`,
          source_id: sourceId,
          source_record_id: sourceRecordId,
          imported_at: new Date().toISOString(),
          payload
        };

        row.imported_at = new Date().toISOString();
        row.payload = payload;

        if (!existing) {
          rawRecords.push(row);
        }

        return { rows: [{ id: row.id, source_record_id: row.source_record_id }], rowCount: 1 };
      }

      if (
        sql.includes("SELECT id, source_record_id, imported_at::text, payload") &&
        sql.includes("source_record_id NOT LIKE 'session::%'")
      ) {
        return {
          rows: rawRecords
            .filter((record) => record.source_id === "source-plex" && !record.source_record_id.startsWith("session::"))
            .sort((left, right) => left.source_record_id.localeCompare(right.source_record_id))
            .map((record) => ({
              id: record.id,
              source_record_id: record.source_record_id,
              imported_at: record.imported_at,
              payload: record.payload
            }))
        };
      }

      if (
        sql.includes("SELECT id, source_record_id, imported_at::text, payload") &&
        sql.includes("source_record_id LIKE 'session::%'")
      ) {
        return {
          rows: rawRecords
            .filter((record) => record.source_id === "source-plex" && record.source_record_id.startsWith("session::"))
            .sort((left, right) => right.imported_at.localeCompare(left.imported_at))
            .map((record) => ({
              id: record.id,
              source_record_id: record.source_record_id,
              imported_at: record.imported_at,
              payload: record.payload
            }))
        };
      }

      if (sql.includes("DELETE FROM raw_import_records") && sql.includes("id = ANY($2::uuid[])")) {
        const [, removableIds] = params as [string, string[]];
        for (const removableId of removableIds) {
          const index = rawRecords.findIndex((record) => record.id === removableId);
          if (index >= 0) {
            rawRecords.splice(index, 1);
          }
        }

        return { rowCount: removableIds.length };
      }

      if (sql.includes("DELETE FROM watch_events")) {
        return { rowCount: 0 };
      }

      if (sql.includes("INSERT INTO watch_events")) {
        return { rowCount: 1 };
      }

      if (sql.includes("UPDATE import_jobs")) {
        return { rowCount: 1 };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    fetchPlexHistoryMock.mockResolvedValue({
      MediaContainer: {
        Metadata: [
          {
            historyKey: "/status/sessions/history/1",
            ratingKey: "100",
            key: "/library/metadata/100",
            grandparentTitle: "Doctor Who",
            parentIndex: 2,
            index: 4,
            title: "Blink",
            type: "episode",
            viewedAt: Math.floor(new Date("2026-04-18T17:30:00.000Z").getTime() / 1000)
          }
        ]
      }
    });
    fetchPlexSessionsMock.mockResolvedValue({
      MediaContainer: {
        Metadata: [
          {
            Session: { id: "session-recent" },
            ratingKey: "100",
            key: "/library/metadata/100",
            grandparentTitle: "Doctor Who",
            parentIndex: 2,
            index: 4,
            title: "Blink",
            type: "episode"
          },
          {
            Session: { id: "session-live" },
            ratingKey: "200",
            key: "/library/metadata/200",
            grandparentTitle: "Severance",
            parentIndex: 2,
            index: 4,
            title: "Woe's Hollow",
            type: "episode",
            viewOffset: 45 * 60000,
            duration: 90 * 60000,
            Player: {
              title: "Living Room Apple TV",
              product: "Plex for tvOS",
              platform: "tvOS",
              state: "playing"
            },
            User: {
              id: "u1",
              title: "Alex"
            }
          }
        ]
      }
    });

    const { runPlexImport } = await import("@/lib/plex-import");
    const result = await runPlexImport();

    expect(result).toEqual({
      source: "plex",
      importJobId: "import-job-plex",
      recordsSeen: 2,
      recordsImported: 2
    });
    expect(fetchPlexHistoryMock).toHaveBeenCalledTimes(1);
    expect(fetchPlexSessionsMock).toHaveBeenCalledTimes(1);
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
    expect(rawRecords.map((record) => record.source_record_id).sort()).toEqual([
      "/status/sessions/history/1",
      "session::reusable"
    ]);
  });
});
