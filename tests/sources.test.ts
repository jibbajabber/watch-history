import type { SourceRetentionConfig } from "@/lib/source-retention";

const queryMock = vi.fn();
const readHomeAssistantConfigMock = vi.fn();
const readPlexConfigMock = vi.fn();
const checkHomeAssistantConnectivityMock = vi.fn();
const checkPlexConnectivityMock = vi.fn();
const getPlexBaseUrlMock = vi.fn();

vi.mock("@/lib/db", () => ({
  query: queryMock
}));

vi.mock("@/lib/home-assistant-config", () => ({
  readHomeAssistantConfig: readHomeAssistantConfigMock
}));

vi.mock("@/lib/plex-config", () => ({
  readPlexConfig: readPlexConfigMock
}));

vi.mock("@/lib/home-assistant", () => ({
  checkHomeAssistantConnectivity: checkHomeAssistantConnectivityMock
}));

vi.mock("@/lib/plex", () => ({
  checkPlexConnectivity: checkPlexConnectivityMock,
  getPlexBaseUrl: getPlexBaseUrlMock
}));

type SourceRow = {
  id: string;
  slug: string;
  display_name: string;
  source_kind: string;
};

type ImportRow = {
  slug: string;
  latest_status: string | null;
  latest_started_at: string | null;
  latest_completed_at: string | null;
  latest_error_message: string | null;
  latest_success_started_at: string | null;
  latest_success_completed_at: string | null;
  latest_failed_started_at: string | null;
  latest_failed_completed_at: string | null;
  latest_failed_error_message: string | null;
};

function buildRetention(
  overrides: Partial<SourceRetentionConfig> = {}
): SourceRetentionConfig {
  return {
    mode: "indefinite",
    historyDays: null,
    importJobDays: null,
    provisionalHours: null,
    ...overrides
  };
}

function mockSourceQueries(params: {
  sources: SourceRow[];
  imports: ImportRow[];
}) {
  queryMock.mockImplementation(async (sql: string) => {
    if (sql.includes("INSERT INTO sources")) {
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes("FROM sources") && sql.includes("ORDER BY display_name ASC")) {
      return { rows: params.sources, rowCount: params.sources.length };
    }

    if (sql.includes("FROM sources s")) {
      return { rows: params.imports, rowCount: params.imports.length };
    }

    throw new Error(`Unexpected query: ${sql}`);
  });
}

describe("sources orchestration", () => {
  const originalTimezone = process.env.APP_TIMEZONE;
  const originalHomeAssistantToken = process.env.HOME_ASSISTANT_ACCESS_TOKEN;
  const originalPlexBaseUrl = process.env.PLEX_BASE_URL;
  const originalPlexToken = process.env.PLEX_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.APP_TIMEZONE = "UTC";
  });

  afterEach(() => {
    if (originalTimezone === undefined) {
      delete process.env.APP_TIMEZONE;
    } else {
      process.env.APP_TIMEZONE = originalTimezone;
    }

    if (originalHomeAssistantToken === undefined) {
      delete process.env.HOME_ASSISTANT_ACCESS_TOKEN;
    } else {
      process.env.HOME_ASSISTANT_ACCESS_TOKEN = originalHomeAssistantToken;
    }

    if (originalPlexBaseUrl === undefined) {
      delete process.env.PLEX_BASE_URL;
    } else {
      process.env.PLEX_BASE_URL = originalPlexBaseUrl;
    }

    if (originalPlexToken === undefined) {
      delete process.env.PLEX_TOKEN;
    } else {
      process.env.PLEX_TOKEN = originalPlexToken;
    }
  });

  it("assembles source statuses for failing and blocked sources", async () => {
    process.env.HOME_ASSISTANT_ACCESS_TOKEN = "ha-token";
    delete process.env.PLEX_BASE_URL;
    delete process.env.PLEX_TOKEN;

    readHomeAssistantConfigMock.mockResolvedValue({
      ok: true,
      config: {
        entities: ["media_player.sky_q_living_room"],
        sync: { enabled: true, intervalMinutes: 30 },
        retention: buildRetention({ mode: "windowed", historyDays: 14, importJobDays: 30 })
      }
    });
    readPlexConfigMock.mockResolvedValue({
      ok: false,
      error: "missing config"
    });
    checkHomeAssistantConnectivityMock.mockResolvedValue({
      ok: true,
      apiMessage: "Connected",
      baseUrl: "http://ha.local:8123",
      entityChecks: [{ entityId: "media_player.sky_q_living_room", exists: true, state: "playing" }]
    });
    checkPlexConnectivityMock.mockResolvedValue({
      ok: false,
      baseUrl: null,
      message: "Plex token is not configured."
    });
    getPlexBaseUrlMock.mockReturnValue(null);
    mockSourceQueries({
      sources: [
        {
          id: "source-ha",
          slug: "home-assistant",
          display_name: "Home Assistant",
          source_kind: "home_automation"
        },
        {
          id: "source-plex",
          slug: "plex",
          display_name: "Plex",
          source_kind: "media_server"
        }
      ],
      imports: [
        {
          slug: "home-assistant",
          latest_status: "failed",
          latest_started_at: "2026-04-18T12:00:00.000Z",
          latest_completed_at: "2026-04-18T12:05:00.000Z",
          latest_error_message: "Home Assistant API timed out while fetching history rows.",
          latest_success_started_at: "2026-04-18T11:00:00.000Z",
          latest_success_completed_at: "2026-04-18T11:04:00.000Z",
          latest_failed_started_at: "2026-04-18T12:00:00.000Z",
          latest_failed_completed_at: "2026-04-18T12:05:00.000Z",
          latest_failed_error_message: "Home Assistant API timed out while fetching history rows."
        }
      ]
    });

    const { getSourceStatuses } = await import("@/lib/sources");
    const statuses = await getSourceStatuses();

    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(statuses).toHaveLength(2);

    expect(statuses[0]).toMatchObject({
      slug: "home-assistant",
      status: "attention",
      statusLabel: "Failing",
      latestImportLabel: "18 Apr 2026, 12:00 (failed)",
      healthLabel: "Recent import failure",
      configStatusLabel: "Configured",
      syncStatusLabel: "Enabled",
      nextSyncLabel: "Due now",
      retentionModeLabel: "Windowed",
      retentionSummaryLabel: "14 day history window",
      retentionSupportsProvisional: false
    });
    expect(statuses[0].connectionDetails).toContain("API: Connected");
    expect(statuses[0].connectionDetails).toContain("Base URL: http://ha.local:8123");
    expect(statuses[0].connectionDetails).toContain("Last failed import: 18 Apr 2026, 12:00");
    expect(statuses[0].healthDetail).toBe("Home Assistant API timed out while fetching history rows.");

    expect(statuses[1]).toMatchObject({
      slug: "plex",
      status: "blocked",
      statusLabel: "Configuration required",
      latestImportLabel: "Never",
      healthLabel: "Configuration blocked",
      configStatusLabel: "Missing or invalid",
      configuredItems: [],
      syncStatusLabel: "Disabled",
      nextSyncLabel: "Disabled",
      retentionModeLabel: "Indefinite",
      retentionSupportsProvisional: true
    });
    expect(statuses[1].connectionDetails).toEqual([
      "Base URL: not configured",
      "Check: Plex token is not configured."
    ]);
  });

  it("marks stale sources and summarizes the shared health notice", async () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-18T15:00:00.000Z").getTime());
    process.env.HOME_ASSISTANT_ACCESS_TOKEN = "ha-token";
    process.env.PLEX_BASE_URL = "http://plex.local:32400";
    process.env.PLEX_TOKEN = "plex-token";

    readHomeAssistantConfigMock.mockResolvedValue({
      ok: true,
      config: {
        entities: ["media_player.sky_q_living_room"],
        sync: { enabled: true, intervalMinutes: 30 },
        retention: buildRetention()
      }
    });
    readPlexConfigMock.mockResolvedValue({
      ok: true,
      config: {
        sync: { enabled: true, intervalMinutes: 30 },
        retention: buildRetention({
          mode: "windowed",
          historyDays: 21,
          importJobDays: 45,
          provisionalHours: 8
        })
      }
    });
    checkHomeAssistantConnectivityMock.mockResolvedValue({
      ok: true,
      apiMessage: "Connected",
      baseUrl: "http://ha.local:8123",
      entityChecks: [{ entityId: "media_player.sky_q_living_room", exists: true, state: "idle" }]
    });
    checkPlexConnectivityMock.mockResolvedValue({
      ok: true,
      baseUrl: "http://plex.local:32400",
      serverName: "Living Room Plex",
      historyCount: 42,
      latestViewedAt: 1_776_513_600
    });
    getPlexBaseUrlMock.mockReturnValue("http://plex.local:32400");
    mockSourceQueries({
      sources: [
        {
          id: "source-ha",
          slug: "home-assistant",
          display_name: "Home Assistant",
          source_kind: "home_automation"
        },
        {
          id: "source-plex",
          slug: "plex",
          display_name: "Plex",
          source_kind: "media_server"
        }
      ],
      imports: [
        {
          slug: "home-assistant",
          latest_status: "completed",
          latest_started_at: "2026-04-18T14:45:00.000Z",
          latest_completed_at: "2026-04-18T14:48:00.000Z",
          latest_error_message: null,
          latest_success_started_at: "2026-04-18T14:45:00.000Z",
          latest_success_completed_at: "2026-04-18T14:48:00.000Z",
          latest_failed_started_at: null,
          latest_failed_completed_at: null,
          latest_failed_error_message: null
        },
        {
          slug: "plex",
          latest_status: "completed",
          latest_started_at: "2026-04-18T13:00:00.000Z",
          latest_completed_at: "2026-04-18T13:05:00.000Z",
          latest_error_message: null,
          latest_success_started_at: "2026-04-18T13:00:00.000Z",
          latest_success_completed_at: "2026-04-18T13:05:00.000Z",
          latest_failed_started_at: null,
          latest_failed_completed_at: null,
          latest_failed_error_message: null
        }
      ]
    });

    const { getSourceHealthNotice, getSourceStatuses } = await import("@/lib/sources");
    const statuses = await getSourceStatuses();

    expect(statuses[0]).toMatchObject({
      slug: "home-assistant",
      status: "ready",
      statusLabel: "Imported",
      healthLabel: "Healthy",
      nextSyncLabel: "18 Apr 2026, 15:18"
    });

    expect(statuses[1]).toMatchObject({
      slug: "plex",
      status: "attention",
      statusLabel: "Stale",
      healthLabel: "Import overdue",
      healthDetail: "No completed import within the expected 30 minute sync window.",
      configuredItems: ["http://plex.local:32400", "/status/sessions/history/all"],
      nextSyncLabel: "Due now",
      retentionModeLabel: "Windowed",
      retentionSummaryLabel: "21 day history window",
      retentionProvisionalHours: 8
    });
    expect(statuses[1].connectionDetails).toContain("Server: Living Room Plex");
    expect(statuses[1].connectionDetails).toContain("Sample rows returned: 42");
    expect(statuses[1].connectionDetails).toContain(
      "Import freshness: older than expected for the 30 min sync interval"
    );

    await expect(getSourceHealthNotice()).resolves.toEqual({
      title: "Plex needs attention",
      body: "Plex: Stale. Imports will retry on the next interval when sync is enabled. Check Sources for details."
    });
  });
});
