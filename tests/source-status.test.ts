import {
  formatLatestImport,
  formatNextSync,
  formatRelativeFailure,
  getHomeAssistantStatus,
  getPlexStatus,
  getRecoveryLabel,
  hasLaterFailure,
  isSourceStale,
  type ImportRow
} from "@/lib/source-status";

describe("source status helpers", () => {
  const originalTimezone = process.env.APP_TIMEZONE;

  beforeEach(() => {
    process.env.APP_TIMEZONE = "UTC";
  });

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalTimezone === undefined) {
      delete process.env.APP_TIMEZONE;
    } else {
      process.env.APP_TIMEZONE = originalTimezone;
    }
  });

  it("formats import labels with timezone-aware output", () => {
    expect(formatLatestImport(null)).toBe("Never");
    expect(formatLatestImport("2026-04-18T14:09:00.000Z")).toBe("18 Apr 2026, 14:09");
    expect(formatNextSync(null)).toBe("Waiting for first run");
    expect(formatNextSync("2026-04-18T18:30:00.000Z")).toBe("18 Apr 2026, 18:30");
  });

  it("shortens long failure messages", () => {
    expect(formatRelativeFailure(null)).toBe("Import failed.");
    expect(formatRelativeFailure("short failure")).toBe("short failure");
    expect(formatRelativeFailure("x".repeat(140))).toBe(`${"x".repeat(117)}...`);
  });

  it("detects a later failure relative to the latest success", () => {
    const failedAfterSuccess: ImportRow = {
      slug: "plex",
      latest_status: "failed",
      latest_started_at: "2026-04-18T12:00:00.000Z",
      latest_completed_at: "2026-04-18T12:05:00.000Z",
      latest_error_message: "boom",
      latest_success_started_at: "2026-04-18T11:00:00.000Z",
      latest_success_completed_at: "2026-04-18T11:05:00.000Z",
      latest_failed_started_at: "2026-04-18T12:00:00.000Z",
      latest_failed_completed_at: "2026-04-18T12:05:00.000Z",
      latest_failed_error_message: "boom"
    };

    const recovered: ImportRow = {
      ...failedAfterSuccess,
      latest_status: "completed",
      latest_success_started_at: "2026-04-18T13:00:00.000Z",
      latest_success_completed_at: "2026-04-18T13:02:00.000Z"
    };

    expect(hasLaterFailure(failedAfterSuccess)).toBe(true);
    expect(hasLaterFailure(recovered)).toBe(false);
  });

  it("marks sources stale only after twice the sync interval has elapsed", () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-18T12:30:00.000Z").getTime());

    expect(isSourceStale("2026-04-18T12:00:00.000Z", true, 20)).toBe(false);
    expect(isSourceStale("2026-04-18T11:40:00.000Z", true, 20)).toBe(true);
    expect(isSourceStale("2026-04-18T11:40:00.000Z", false, 20)).toBe(false);
  });

  it("builds recovery labels only when a success follows the failure", () => {
    expect(
      getRecoveryLabel({
        slug: "home-assistant",
        latest_status: "completed",
        latest_started_at: "2026-04-18T13:00:00.000Z",
        latest_completed_at: "2026-04-18T13:01:00.000Z",
        latest_error_message: null,
        latest_success_started_at: "2026-04-18T13:00:00.000Z",
        latest_success_completed_at: "2026-04-18T13:01:00.000Z",
        latest_failed_started_at: "2026-04-18T12:00:00.000Z",
        latest_failed_completed_at: "2026-04-18T12:05:00.000Z",
        latest_failed_error_message: "boom"
      })
    ).toBe("Recovered on 18 Apr 2026, 13:00");

    expect(
      getRecoveryLabel({
        slug: "home-assistant",
        latest_status: "failed",
        latest_started_at: "2026-04-18T12:00:00.000Z",
        latest_completed_at: "2026-04-18T12:05:00.000Z",
        latest_error_message: "boom",
        latest_success_started_at: "2026-04-18T11:00:00.000Z",
        latest_success_completed_at: "2026-04-18T11:01:00.000Z",
        latest_failed_started_at: "2026-04-18T12:00:00.000Z",
        latest_failed_completed_at: "2026-04-18T12:05:00.000Z",
        latest_failed_error_message: "boom"
      })
    ).toBeNull();
  });

  it("derives Home Assistant status for failing and ready states", () => {
    expect(
      getHomeAssistantStatus(true, true, "2026-04-18T13:00:00.000Z", true, {
        hasRecentFailure: true,
        isStale: false
      })
    ).toMatchObject({
      status: "attention",
      statusLabel: "Failing",
      connectionPathLabel: "Verified"
    });

    expect(
      getHomeAssistantStatus(true, true, null, true, {
        hasRecentFailure: false,
        isStale: false
      })
    ).toMatchObject({
      status: "ready",
      statusLabel: "Connected",
      connectionPathLabel: "Access token"
    });
  });

  it("derives Plex status for blocked and stale states", () => {
    expect(
      getPlexStatus(false, null, false, {
        hasRecentFailure: false,
        isStale: false
      })
    ).toMatchObject({
      status: "blocked",
      statusLabel: "Configuration required",
      connectionPathLabel: "Unknown"
    });

    expect(
      getPlexStatus(true, "2026-04-18T11:00:00.000Z", true, {
        hasRecentFailure: false,
        isStale: true
      })
    ).toMatchObject({
      status: "attention",
      statusLabel: "Stale",
      connectionPathLabel: "Verified"
    });
  });
});
