import type { HomeAssistantHistoryState } from "@/lib/home-assistant-normalization";

const queryMock = vi.fn();
const connectMock = vi.fn();
const lockClientQueryMock = vi.fn();
const releaseMock = vi.fn();
const checkHomeAssistantConnectivityMock = vi.fn();
const readHomeAssistantConfigMock = vi.fn();
const fetchHomeAssistantMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getPool: () => ({
    connect: connectMock
  }),
  query: queryMock
}));

vi.mock("@/lib/home-assistant-config", () => ({
  readHomeAssistantConfig: readHomeAssistantConfigMock
}));

vi.mock("@/lib/home-assistant", () => ({
  checkHomeAssistantConnectivity: checkHomeAssistantConnectivityMock,
  fetchHomeAssistant: fetchHomeAssistantMock
}));

describe("home assistant import orchestration", () => {
  const originalToken = process.env.HOME_ASSISTANT_ACCESS_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env.HOME_ASSISTANT_ACCESS_TOKEN = "home-assistant-token";
    connectMock.mockResolvedValue({
      query: lockClientQueryMock,
      release: releaseMock
    });
    checkHomeAssistantConnectivityMock.mockResolvedValue({
      ok: true,
      baseUrl: "http://home-assistant.local:8123",
      entities: ["media_player.sky_q_living_room"],
      checkedAt: "2026-04-18T19:55:00.000Z",
      apiMessage: "Connected",
      entityChecks: [
        {
          entityId: "media_player.sky_q_living_room",
          exists: true,
          state: "playing"
        }
      ]
    });
    readHomeAssistantConfigMock.mockResolvedValue({
      ok: true,
      config: {
        baseUrl: "http://home-assistant.local:8123",
        entities: ["media_player.sky_q_living_room"]
      }
    });
    lockClientQueryMock
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [] });
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.HOME_ASSISTANT_ACCESS_TOKEN;
    } else {
      process.env.HOME_ASSISTANT_ACCESS_TOKEN = originalToken;
    }
  });

  it("rebuilds sessions from persisted history and current-state enrichment", async () => {
    const persistedRecords: Array<{
      id: string;
      source_id: string;
      source_record_id: string;
      payload: HomeAssistantHistoryState;
    }> = [];

    queryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM sources") && sql.includes("slug = 'home-assistant'")) {
        return { rows: [{ id: "source-home-assistant" }] };
      }

      if (sql.includes("INSERT INTO import_jobs")) {
        return { rows: [{ id: "import-job-1" }] };
      }

      if (sql.includes("INSERT INTO raw_import_records")) {
        const [, sourceId, sourceRecordId, payloadJson] = params as [
          string,
          string,
          string,
          string
        ];
        const payload = JSON.parse(payloadJson) as HomeAssistantHistoryState;
        const existing = persistedRecords.find(
          (record) => record.source_id === sourceId && record.source_record_id === sourceRecordId
        );
        const row = existing ?? {
          id: `raw-${persistedRecords.length + 1}`,
          source_id: sourceId,
          source_record_id: sourceRecordId,
          payload
        };

        row.payload = payload;
        if (!existing) {
          persistedRecords.push(row);
        }

        return { rows: [{ id: row.id }], rowCount: 1 };
      }

      if (
        sql.includes("SELECT payload") &&
        sql.includes("FROM raw_import_records") &&
        sql.includes("payload->>'entity_id' = ANY")
      ) {
        const [sourceId, entityIds] = params as [string, string[]];
        return {
          rows: persistedRecords
            .filter(
              (record) =>
                record.source_id === sourceId &&
                entityIds.includes(record.payload.entity_id)
            )
            .map((record) => ({ payload: record.payload }))
        };
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

    fetchHomeAssistantMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/history/period/")) {
        return {
          ok: true,
          json: async () => [
            [
              {
                entity_id: "media_player.sky_q_living_room",
                state: "playing",
                last_changed: "2026-04-18T20:00:00.000Z",
                attributes: {
                  media_series_title: "Doctor Who",
                  episode_title: "Blink",
                  media_channel: "BBC One HD",
                  media_content_type: "episode"
                }
              }
            ]
          ]
        };
      }

      if (url.includes("/api/states/")) {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            entity_id: "media_player.sky_q_living_room",
            state: "paused",
            last_changed: "2026-04-18T20:20:00.000Z",
            attributes: {
              media_series_title: "Doctor Who",
              episode_title: "Blink",
              media_channel: "BBC One HD",
              media_content_type: "episode"
            }
          })
        };
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const { runHomeAssistantImport } = await import("@/lib/home-assistant-import");
    const result = await runHomeAssistantImport();

    expect(result).toEqual({
      ok: true,
      importJobId: "import-job-1",
      recordsSeen: 2,
      recordsImported: 1
    });
    expect(queryMock.mock.calls[0]?.[0]).toContain("FROM sources");
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
    expect(fetchHomeAssistantMock).toHaveBeenCalledTimes(2);
  });
});
