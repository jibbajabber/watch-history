import {
  getDefaultSourceRetentionConfig,
  parseSourceRetentionConfig,
  serializeSourceRetentionConfig,
  summarizeSourceRetention
} from "@/lib/source-retention";

describe("source retention helpers", () => {
  it("returns the default config when retention is missing", () => {
    expect(parseSourceRetentionConfig(null, { supportsProvisional: false })).toEqual(
      getDefaultSourceRetentionConfig()
    );
  });

  it("parses a windowed retention config and defaults provisional hours when supported", () => {
    expect(
      parseSourceRetentionConfig(
        {
          mode: "windowed",
          history_days: 30,
          import_job_days: 14
        },
        { supportsProvisional: true }
      )
    ).toEqual({
      mode: "windowed",
      historyDays: 30,
      importJobDays: 14,
      provisionalHours: 24
    });
  });

  it("ignores provisional hours when the source does not support them", () => {
    expect(
      parseSourceRetentionConfig(
        {
          mode: "windowed",
          history_days: 30,
          import_job_days: 14,
          provisional_hours: 8
        },
        { supportsProvisional: false }
      )
    ).toEqual({
      mode: "windowed",
      historyDays: 30,
      importJobDays: 14,
      provisionalHours: null
    });
  });

  it("serializes and summarizes a windowed retention config", () => {
    const config = {
      mode: "windowed" as const,
      historyDays: 7,
      importJobDays: 30,
      provisionalHours: 12
    };

    expect(serializeSourceRetentionConfig(config, { supportsProvisional: true })).toEqual({
      mode: "windowed",
      history_days: 7,
      import_job_days: 30,
      provisional_hours: 12
    });

    expect(summarizeSourceRetention(config, { supportsProvisional: true })).toEqual({
      modeLabel: "Windowed",
      summaryLabel: "7 day history window",
      detail:
        "Deletes durable raw and normalized history older than 7 days. Deletes import-job audit rows older than 30 days. Deletes provisional session data older than 12 hours."
    });
  });

  it("rejects non-positive retention windows", () => {
    expect(() =>
      parseSourceRetentionConfig(
        {
          mode: "windowed",
          history_days: 0,
          import_job_days: 14
        },
        { supportsProvisional: true }
      )
    ).toThrow("Retention history_days must be a positive number.");
  });
});
