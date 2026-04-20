const readHomeAssistantConfigMock = vi.fn();

vi.mock("@/lib/home-assistant-config", () => ({
  readHomeAssistantConfig: readHomeAssistantConfigMock
}));

describe("connectivity safety", () => {
  const originalHomeAssistantToken = process.env.HOME_ASSISTANT_ACCESS_TOKEN;
  const originalPlexBaseUrl = process.env.PLEX_BASE_URL;
  const originalPlexToken = process.env.PLEX_TOKEN;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.HOME_ASSISTANT_ACCESS_TOKEN = "ha-secret-token";
    process.env.PLEX_BASE_URL = "http://plex.local:32400";
    process.env.PLEX_TOKEN = "plex-secret-token";
  });

  afterEach(() => {
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

    globalThis.fetch = originalFetch;
  });

  it("does not echo raw home assistant fetch errors", async () => {
    readHomeAssistantConfigMock.mockResolvedValue({
      ok: true,
      config: {
        baseUrl: "http://home-assistant.local:8123",
        entities: ["media_player.sky_q_living_room"]
      }
    });

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Bearer ha-secret-token")) as unknown as typeof fetch;

    const { checkHomeAssistantConnectivity } = await import("@/lib/home-assistant");
    const result = await checkHomeAssistantConnectivity();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Home Assistant connectivity failed.");
      expect(result.message).not.toContain("ha-secret-token");
    }
  });

  it("does not echo raw plex fetch errors", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Bearer plex-secret-token")) as unknown as typeof fetch;

    const { checkPlexConnectivity } = await import("@/lib/plex");
    const result = await checkPlexConnectivity();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Plex connectivity failed.");
      expect(result.message).not.toContain("plex-secret-token");
    }
  });
});
