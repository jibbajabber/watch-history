import { formatEventDateTime } from "@/lib/format";
import type {
  AnalyticsImportSource,
  AnalyticsRankedItem,
  AnalyticsResponse,
  AnalyticsSeriesPoint,
  AnalyticsSourceContribution
} from "@/lib/types";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function formatAverage(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return formatCount(Math.round(value));
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No data yet";
  }

  return formatEventDateTime(value);
}

function formatRange(start: string | null, end: string | null) {
  if (!start || !end) {
    return "History will appear here after the first import lands.";
  }

  return `${formatEventDateTime(start)} to ${formatEventDateTime(end)}`;
}

function OverviewCards({ data }: { data: AnalyticsResponse["overview"] }) {
  const cards = [
    {
      label: "Watch events",
      value: formatCount(data.totalWatchEvents),
      detail: `+${formatCount(data.eventGrowthLast7)} in 7 days`,
      secondary: `+${formatCount(data.eventGrowthLast30)} in 30 days`,
      accent: "var(--gold)"
    },
    {
      label: "Raw records",
      value: formatCount(data.totalRawRecords),
      detail: `+${formatCount(data.rawGrowthLast7)} in 7 days`,
      secondary: `+${formatCount(data.rawGrowthLast30)} in 30 days`,
      accent: "var(--mint)"
    },
    {
      label: "Import jobs",
      value: formatCount(data.totalImportJobs),
      detail: `${formatCount(data.importRunsLast30)} ran in 30 days`,
      secondary:
        data.importFailuresLast30 > 0
          ? `${formatCount(data.importFailuresLast30)} failed recently`
          : "No failures in the last 30 days",
      accent: "var(--salmon)"
    },
    {
      label: "Sources with history",
      value: formatCount(data.sourcesWithHistory),
      detail: "Durable watch history currently stored",
      secondary: `${formatCount(data.activeDaysLast30)} active days in 30 days`,
      accent: "#9fb8ff"
    }
  ];

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: "14px"
      }}
    >
      {cards.map((card) => (
        <article
          key={card.label}
          className="glass-panel"
          style={{
            borderRadius: "22px",
            padding: "18px 18px 20px",
            display: "grid",
            gap: "12px"
          }}
        >
          <div
            style={{
              width: "3rem",
              height: "0.35rem",
              borderRadius: "999px",
              background: card.accent
            }}
          />
          <div className="muted" style={{ fontSize: "0.88rem" }}>
            {card.label}
          </div>
          <strong style={{ fontSize: "2rem", lineHeight: 1 }}>{card.value}</strong>
          <div style={{ display: "grid", gap: "4px" }}>
            <span className="muted" style={{ fontSize: "0.92rem" }}>
              {card.detail}
            </span>
            <span className="muted" style={{ fontSize: "0.92rem" }}>
              {card.secondary}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}

function BarSeries<T extends AnalyticsSeriesPoint>({
  title,
  eyebrow,
  description,
  points,
  tone = "var(--gold)",
  secondaryLabel,
  valueFormatter
}: {
  title: string;
  eyebrow: string;
  description: string;
  points: T[];
  tone?: string;
  secondaryLabel?: string;
  valueFormatter?: (point: T) => string;
}) {
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  return (
    <article
      className="glass-panel"
      style={{
        borderRadius: "24px",
        padding: "20px",
        display: "grid",
        gap: "18px"
      }}
    >
      <div style={{ display: "grid", gap: "8px" }}>
        <span className="eyebrow">{eyebrow}</span>
        <div style={{ display: "grid", gap: "6px" }}>
          <strong style={{ fontSize: "1.12rem" }}>{title}</strong>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            {description}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        {points.map((point) => (
          <div key={point.label} style={{ display: "grid", gap: "7px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "baseline"
              }}
            >
              <strong style={{ fontSize: "0.95rem" }}>{point.label}</strong>
              <span className="muted" style={{ fontSize: "0.9rem" }}>
                {valueFormatter
                  ? valueFormatter(point)
                  : `${formatCount(point.value)}${
                      secondaryLabel && point.secondaryValue !== undefined
                        ? ` ${secondaryLabel} ${formatCount(point.secondaryValue)}`
                        : ""
                    }`}
              </span>
            </div>
            <div className="activity-meter-bar">
              <div
                className="activity-meter-fill"
                style={{
                  width: `${Math.max((point.value / maxValue) * 100, point.value > 0 ? 8 : 0)}%`,
                  background: `linear-gradient(135deg, ${tone}, rgba(255, 127, 106, 0.88))`
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function RankedList({
  eyebrow,
  title,
  items,
  emptyMessage
}: {
  eyebrow: string;
  title: string;
  items: AnalyticsRankedItem[];
  emptyMessage: string;
}) {
  return (
    <article
      className="glass-panel"
      style={{
        borderRadius: "24px",
        padding: "20px",
        display: "grid",
        gap: "16px"
      }}
    >
      <div style={{ display: "grid", gap: "8px" }}>
        <span className="eyebrow">{eyebrow}</span>
        <strong style={{ fontSize: "1.12rem" }}>{title}</strong>
      </div>

      {items.length === 0 ? (
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
          {emptyMessage}
        </p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {items.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              style={{
                display: "grid",
                gridTemplateColumns: "auto minmax(0, 1fr) auto",
                gap: "12px",
                alignItems: "start"
              }}
            >
              <span
                className="eyebrow"
                style={{
                  color: "var(--muted)",
                  minWidth: "1.4rem"
                }}
              >
                {index + 1}
              </span>
              <div style={{ display: "grid", gap: "4px" }}>
                <strong style={{ fontSize: "0.96rem" }}>{item.label}</strong>
                <span className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
                  {item.detail}
                </span>
              </div>
              <strong style={{ fontSize: "1rem" }}>{formatCount(item.value)}</strong>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function SourceContributionTable({ rows }: { rows: AnalyticsSourceContribution[] }) {
  return (
    <article
      className="glass-panel"
      style={{
        borderRadius: "24px",
        padding: "20px",
        display: "grid",
        gap: "16px"
      }}
    >
      <div style={{ display: "grid", gap: "8px" }}>
        <span className="eyebrow">Dataset growth</span>
        <strong style={{ fontSize: "1.12rem" }}>Source contribution</strong>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
          Durable watch rows and raw source volume side by side, with import outcomes for context.
        </p>
      </div>

      <div style={{ display: "grid", gap: "10px" }}>
        {rows.map((row) => (
          <div
            key={row.sourceName}
            style={{
              borderRadius: "18px",
              border: "1px solid var(--line)",
              background: "rgba(255, 255, 255, 0.03)",
              padding: "14px 16px",
              display: "grid",
              gap: "10px"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap"
              }}
            >
              <strong style={{ fontSize: "1rem" }}>{row.sourceName}</strong>
              <span className="muted" style={{ fontSize: "0.9rem" }}>
                Latest success: {formatTimestamp(row.latestSuccessAt)}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "10px"
              }}
            >
              <div className="source-stat-card">
                <span className="muted">Watch events</span>
                <strong>{formatCount(row.watchEvents)}</strong>
              </div>
              <div className="source-stat-card">
                <span className="muted">Raw records</span>
                <strong>{formatCount(row.rawRecords)}</strong>
              </div>
              <div className="source-stat-card">
                <span className="muted">Successful imports</span>
                <strong>{formatCount(row.successfulImports)}</strong>
              </div>
              <div className="source-stat-card">
                <span className="muted">Failed imports</span>
                <strong>{formatCount(row.failedImports)}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ImportActivityTable({ rows }: { rows: AnalyticsImportSource[] }) {
  return (
    <article
      className="glass-panel"
      style={{
        borderRadius: "24px",
        padding: "20px",
        display: "grid",
        gap: "16px"
      }}
    >
      <div style={{ display: "grid", gap: "8px" }}>
        <span className="eyebrow">Import activity</span>
        <strong style={{ fontSize: "1.12rem" }}>Last 30 days by source</strong>
      </div>

      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
          Import-run analytics will populate after the first successful or failed job is recorded.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {rows.map((row) => (
            <div
              key={row.sourceName}
              style={{
                borderRadius: "18px",
                border: "1px solid var(--line)",
                background: "rgba(255, 255, 255, 0.03)",
                padding: "14px 16px",
                display: "grid",
                gap: "10px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap"
                }}
              >
                <strong style={{ fontSize: "1rem" }}>{row.sourceName}</strong>
                <span className="muted" style={{ fontSize: "0.9rem" }}>
                  Latest success: {formatTimestamp(row.latestSuccessAt)}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "10px"
                }}
              >
                <div className="source-stat-card">
                  <span className="muted">Runs</span>
                  <strong>{formatCount(row.totalRuns)}</strong>
                </div>
                <div className="source-stat-card">
                  <span className="muted">Succeeded</span>
                  <strong>{formatCount(row.successfulRuns)}</strong>
                </div>
                <div className="source-stat-card">
                  <span className="muted">Failed</span>
                  <strong>{formatCount(row.failedRuns)}</strong>
                </div>
                <div className="source-stat-card">
                  <span className="muted">Avg imported rows</span>
                  <strong>{formatAverage(row.averageRecordsImported)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function AnalyticsScreen({ data }: { data: AnalyticsResponse }) {
  return (
    <section style={{ display: "grid", gap: "24px" }}>
      <div style={{ display: "grid", gap: "10px" }}>
        <span className="eyebrow">Analytics</span>
        <div
          style={{
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            gap: "18px",
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "grid", gap: "10px" }}>
            <h2
              className="headline"
              style={{
                margin: 0,
                fontSize: "clamp(2rem, 5vw, 3.5rem)",
                lineHeight: 0.98
              }}
            >
              The shape of the whole dataset.
            </h2>
            <p
              className="muted"
              style={{
                margin: 0,
                fontSize: "1rem",
                lineHeight: 1.7,
                maxWidth: "48rem"
              }}
            >
              Read the watch history beyond fixed timeline ranges: what has accumulated, which
              sources are contributing, and how imports are turning raw rows into durable sessions.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: "8px",
              minWidth: "18rem"
            }}
          >
            <span className="eyebrow">Coverage</span>
            <strong style={{ fontSize: "1.08rem" }}>
              {formatRange(data.watchPatterns.earliestWatchAt, data.watchPatterns.latestWatchAt)}
            </strong>
            <span className="muted" style={{ fontSize: "0.95rem" }}>
              Raw ingest window:{" "}
              {formatRange(data.datasetGrowth.earliestImportedAt, data.datasetGrowth.latestImportedAt)}
            </span>
          </div>
        </div>
      </div>

      <OverviewCards data={data.overview} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "18px"
        }}
      >
        <BarSeries
          eyebrow="Watch patterns"
          title="Monthly watch activity"
          description="Durable sessions per month, with active-day counts beside each month."
          points={data.watchPatterns.monthlyActivity}
          tone="rgba(255, 191, 105, 0.95)"
          secondaryLabel="active days"
        />
        <BarSeries
          eyebrow="Dataset growth"
          title="Rows added per month"
          description="Each bar reflects the larger of raw rows or normalized watch rows added that month."
          points={data.datasetGrowth.monthlyCreated}
          tone="rgba(116, 224, 192, 0.95)"
          valueFormatter={(point) =>
            `${formatCount(point.rawRecords)} raw / ${formatCount(point.watchEvents)} watch`
          }
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "18px"
        }}
      >
        <RankedList
          eyebrow="Watch patterns"
          title="Most repeated titles"
          items={data.watchPatterns.topTitles}
          emptyMessage="Top-title analytics will populate after durable watch events have been imported."
        />
        <RankedList
          eyebrow="Watch patterns"
          title="Most active sources"
          items={data.watchPatterns.topSources}
          emptyMessage="Source ranking will populate after watch events land."
        />
      </div>

      <SourceContributionTable rows={data.datasetGrowth.sourceContribution} />

      <article
        className="glass-panel"
        style={{
          borderRadius: "24px",
          padding: "20px",
          display: "grid",
          gap: "16px"
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px"
          }}
        >
          <div className="source-stat-card">
            <span className="muted">Import runs in 30 days</span>
            <strong>{formatCount(data.importActivity.totalRunsLast30)}</strong>
          </div>
          <div className="source-stat-card">
            <span className="muted">Succeeded in 30 days</span>
            <strong>{formatCount(data.importActivity.successCountLast30)}</strong>
          </div>
          <div className="source-stat-card">
            <span className="muted">Failed in 30 days</span>
            <strong>{formatCount(data.importActivity.failureCountLast30)}</strong>
          </div>
          <div className="source-stat-card">
            <span className="muted">Sources importing in 30 days</span>
            <strong>
              {formatCount(
                data.importActivity.bySourceLast30Days.filter((source) => source.totalRuns > 0).length
              )}
            </strong>
          </div>
        </div>
      </article>

      <ImportActivityTable rows={data.importActivity.bySourceLast30Days} />
    </section>
  );
}
