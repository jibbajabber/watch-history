import { formatEventDateTime, formatMinutes } from "@/lib/format";

describe("format helpers", () => {
  const originalTimezone = process.env.APP_TIMEZONE;

  afterEach(() => {
    if (originalTimezone === undefined) {
      delete process.env.APP_TIMEZONE;
    } else {
      process.env.APP_TIMEZONE = originalTimezone;
    }
  });

  it("formats event timestamps in the configured timezone", () => {
    process.env.APP_TIMEZONE = "UTC";

    expect(formatEventDateTime("2026-04-18T09:30:00.000Z")).toBe("18 Apr, 09:30");
  });

  it("returns unknown for missing or non-positive durations", () => {
    expect(formatMinutes(null)).toBe("Unknown");
    expect(formatMinutes(0)).toBe("Unknown");
  });

  it("formats minute and hour durations compactly", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(125)).toBe("2h 5m");
  });
});
