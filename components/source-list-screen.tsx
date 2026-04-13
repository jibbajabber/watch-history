import type { SourceStatus } from "@/lib/types";

function getTone(status: SourceStatus["status"]) {
  switch (status) {
    case "ready":
      return {
        pillBg: "rgba(116, 224, 192, 0.16)",
        pillBorder: "rgba(116, 224, 192, 0.42)",
        pillText: "var(--mint)"
      };
    case "attention":
      return {
        pillBg: "rgba(255, 191, 105, 0.16)",
        pillBorder: "rgba(255, 191, 105, 0.42)",
        pillText: "var(--gold)"
      };
    case "blocked":
      return {
        pillBg: "rgba(255, 127, 106, 0.16)",
        pillBorder: "rgba(255, 127, 106, 0.42)",
        pillText: "var(--salmon)"
      };
  }
}

export function SourceListScreen({
  sources,
  flashTone,
  flashMessage,
  flashDetail,
  importSourceAction,
  updateSyncAction
}: {
  sources: SourceStatus[];
  flashTone?: "error" | "success";
  flashMessage?: string;
  flashDetail?: string;
  importSourceAction: (formData: FormData) => Promise<void>;
  updateSyncAction: (formData: FormData) => Promise<void>;
}) {
  const flashStyles =
    flashTone === "error"
      ? {
          border: "1px solid rgba(255, 127, 106, 0.38)",
          background: "rgba(255, 127, 106, 0.12)",
          title: "Import issue",
          accent: "var(--salmon)"
        }
      : {
          border: "1px solid rgba(116, 224, 192, 0.32)",
          background: "rgba(116, 224, 192, 0.1)",
          title: "Update",
          accent: "var(--mint)"
        };

  return (
    <section style={{ display: "grid", gap: "24px" }}>
      <div style={{ display: "grid", gap: "10px", maxWidth: "48rem" }}>
        <span className="eyebrow">Sources</span>
        <h2
          className="headline"
          style={{
            margin: 0,
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            lineHeight: 0.98
          }}
        >
          Connect your watch-history sources and import real activity.
        </h2>
        <p
          className="muted"
          style={{
            margin: 0,
            lineHeight: 1.7,
            fontSize: "1rem"
          }}
        >
          This screen tracks source readiness, authentication, and import status as the app grows
          from Home Assistant into additional media history integrations such as Plex.
        </p>
      </div>

      {flashMessage ? (
        <section
          className="glass-panel"
          style={{
            borderRadius: "24px",
            padding: "18px 20px",
            display: "grid",
            gap: "8px",
            border: flashStyles.border,
            background: flashStyles.background
          }}
        >
          <span className="eyebrow" style={{ color: flashStyles.accent }}>
            {flashStyles.title}
          </span>
          <strong style={{ fontSize: "1rem" }}>{flashMessage}</strong>
          {flashDetail ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
              {flashDetail}
            </p>
          ) : null}
        </section>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          gap: "18px"
        }}
      >
        {sources.map((source) => {
          const tone = getTone(source.status);

          return (
            <article
              key={source.slug}
              className="glass-panel"
              style={{
                borderRadius: "28px",
                padding: "22px",
                display: "grid",
                gap: "18px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "14px",
                  flexWrap: "wrap",
                  alignItems: "start"
                }}
              >
                <div style={{ display: "grid", gap: "8px" }}>
                  <span className="eyebrow">{source.kindLabel}</span>
                  <h3
                    className="headline"
                    style={{
                      margin: 0,
                      fontSize: "1.8rem",
                      lineHeight: 1
                    }}
                  >
                    {source.displayName}
                  </h3>
                </div>

                <span
                  style={{
                    padding: "7px 11px",
                    borderRadius: "999px",
                    background: tone.pillBg,
                    border: `1px solid ${tone.pillBorder}`,
                    color: tone.pillText,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase"
                  }}
                >
                  {source.statusLabel}
                </span>
              </div>

              <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
                {source.description}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: "12px"
                }}
              >
                <div className="source-stat-card">
                  <span className="muted">Connection path</span>
                  <strong>{source.connectionPathLabel}</strong>
                </div>
                <div className="source-stat-card">
                  <span className="muted">Env readiness</span>
                  <strong>{source.envReady ? "Configured" : "Not configured"}</strong>
                </div>
                <div className="source-stat-card">
                  <span className="muted">Config file</span>
                  <strong>{source.configStatusLabel}</strong>
                </div>
                <div className="source-stat-card">
                  <span className="muted">Latest import</span>
                  <strong>{source.latestImportLabel}</strong>
                </div>
              </div>

              <section
                className="source-stat-card"
                style={{
                  gap: "12px",
                  border:
                    source.status === "attention"
                      ? "1px solid rgba(255, 191, 105, 0.36)"
                      : source.status === "blocked"
                        ? "1px solid rgba(255, 127, 106, 0.36)"
                        : "1px solid var(--line)"
                }}
              >
                <div style={{ display: "grid", gap: "4px" }}>
                  <span className="eyebrow">Import health</span>
                  <strong style={{ fontSize: "1rem" }}>{source.healthLabel}</strong>
                  <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                    {source.healthDetail}
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                    gap: "10px"
                  }}
                >
                  <div className="source-stat-card">
                    <span className="muted">Last success</span>
                    <strong>{source.lastSuccessLabel}</strong>
                  </div>
                  <div className="source-stat-card">
                    <span className="muted">Last failure</span>
                    <strong>{source.lastFailureLabel}</strong>
                  </div>
                  <div className="source-stat-card">
                    <span className="muted">Recovery</span>
                    <strong>{source.recoveryLabel ?? "Not needed"}</strong>
                  </div>
                </div>
              </section>

              <section
                style={{
                  display: "grid",
                  gap: "10px"
                }}
              >
                <span className="eyebrow">Next step</span>
                <strong style={{ fontSize: "1rem" }}>{source.nextStepTitle}</strong>
                <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
                  {source.nextStepBody}
                </p>
              </section>

              {source.slug === "home-assistant" || source.slug === "plex" ? (
                <section style={{ display: "grid", gap: "14px" }}>
                  <form action={importSourceAction}>
                    <input type="hidden" name="source_slug" value={source.slug} />
                    <button
                      type="submit"
                      style={{
                        border: "1px solid transparent",
                        borderRadius: "999px",
                        background:
                          "linear-gradient(135deg, rgba(255, 191, 105, 0.92), rgba(255, 127, 106, 0.88))",
                        color: "#181311",
                        padding: "12px 18px",
                        fontWeight: 800,
                        letterSpacing: "0.02em",
                        cursor: "pointer"
                      }}
                    >
                      {source.slug === "home-assistant" ? "Import Sky Q history" : "Import Plex history"}
                    </button>
                  </form>

                  <form action={updateSyncAction} className="source-stat-card">
                    <input type="hidden" name="source_slug" value={source.slug} />
                    <div style={{ display: "grid", gap: "12px" }}>
                      <div style={{ display: "grid", gap: "4px" }}>
                        <span className="eyebrow">Scheduled sync</span>
                        <span className="muted" style={{ fontSize: "0.9rem" }}>
                          Run imports automatically inside Docker using the configured interval.
                        </span>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: "10px"
                        }}
                      >
                        <div className="source-stat-card">
                          <span className="muted">Current status</span>
                          <strong>{source.syncStatusLabel}</strong>
                        </div>
                        <div className="source-stat-card">
                          <span className="muted">Saved interval</span>
                          <strong>{source.syncIntervalMinutes} min</strong>
                        </div>
                        <div className="source-stat-card">
                          <span className="muted">Next automatic run</span>
                          <strong>{source.nextSyncLabel}</strong>
                        </div>
                      </div>

                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          fontSize: "0.92rem"
                        }}
                      >
                        <input type="checkbox" name="sync_enabled" defaultChecked={source.syncEnabled} />
                        Enable automatic sync
                      </label>

                      <label style={{ display: "grid", gap: "6px" }}>
                        <span className="muted" style={{ fontSize: "0.84rem" }}>
                          Interval in minutes
                        </span>
                        <input
                          type="number"
                          name="interval_minutes"
                          min={1}
                          max={1440}
                          defaultValue={source.syncIntervalMinutes}
                          style={{
                            borderRadius: "12px",
                            border: "1px solid var(--line)",
                            background: "rgba(255,255,255,0.04)",
                            color: "var(--text)",
                            padding: "10px 12px"
                          }}
                        />
                      </label>

                      <button
                        type="submit"
                        style={{
                          border: "1px solid var(--line)",
                          borderRadius: "999px",
                          background: "rgba(255,255,255,0.04)",
                          color: "var(--text)",
                          padding: "10px 14px",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        Save sync settings
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}

              <section
                style={{
                  display: "grid",
                  gap: "8px"
                }}
              >
                <span className="eyebrow">Source configuration</span>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap"
                  }}
                >
                  {source.configuredItems.length > 0 ? (
                    source.configuredItems.map((item) => (
                      <code
                        key={item}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "10px",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid var(--line)",
                          fontSize: "0.84rem"
                        }}
                      >
                        {item}
                      </code>
                    ))
                  ) : (
                    <span className="muted">No source configuration detected yet.</span>
                  )}
                </div>
              </section>

              <section
                style={{
                  display: "grid",
                  gap: "8px"
                }}
              >
                <span className="eyebrow">Connection details</span>
                <div style={{ display: "grid", gap: "8px" }}>
                  {source.connectionDetails.map((detail) => (
                    <div key={detail} className="source-stat-card" style={{ gap: "0" }}>
                      <span style={{ fontSize: "0.92rem" }}>{detail}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section
                style={{
                  display: "grid",
                  gap: "8px"
                }}
              >
                <span className="eyebrow">Expected env vars</span>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap"
                  }}
                >
                  {source.expectedEnvVars.map((envVar) => (
                    <code
                      key={envVar}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid var(--line)",
                        fontSize: "0.84rem"
                      }}
                    >
                      {envVar}
                    </code>
                  ))}
                </div>
              </section>
            </article>
          );
        })}
      </div>
    </section>
  );
}
