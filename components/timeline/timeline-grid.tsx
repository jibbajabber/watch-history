import { TimelineEventCard } from "@/components/timeline/event-card";
import type { TimelineResponse } from "@/lib/types";
import { formatEventDateTime } from "@/lib/format";

export function TimelineGrid({ data }: { data: TimelineResponse }) {
  const topGroupTotal = data.groups[0]?.totalEvents ?? 1;

  return (
    <section
      className="timeline-layout"
    >
      <div
        className="glass-panel"
        style={{
          borderRadius: "28px",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            padding: "22px 24px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            gap: "18px",
            flexWrap: "wrap"
          }}
        >
          <div style={{ display: "grid", gap: "6px" }}>
            <span className="eyebrow">Activity</span>
            <strong style={{ fontSize: "1.1rem" }}>Timeline entries</strong>
          </div>
          <span className="muted" style={{ alignSelf: "end", fontSize: "0.92rem" }}>
            Sorted by most recent watch time
          </span>
        </div>

        <div style={{ display: "grid" }}>
          {data.events.map((event) => (
            <TimelineEventCard key={`${event.sourceId}-${event.eventKey}`} event={event} />
          ))}
        </div>
      </div>

      <aside
        style={{
          display: "grid",
          gap: "18px"
        }}
      >
        <section
          className="glass-panel"
          style={{
            borderRadius: "24px",
            padding: "22px",
            display: "grid",
            gap: "18px"
          }}
        >
          <div style={{ display: "grid", gap: "6px" }}>
            <span className="eyebrow">Moments</span>
            <strong style={{ fontSize: "1.08rem" }}>Grouped by {data.meta.groupLabel}</strong>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {data.groups.slice(0, 5).map((group) => (
              <div
                key={group.label}
                style={{
                  borderRadius: "18px",
                  border: "1px solid var(--line)",
                  padding: "14px 16px",
                  background: "rgba(255,255,255,0.03)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "16px",
                  alignItems: "center"
                }}
              >
                <div style={{ display: "grid", gap: "4px" }}>
                  <strong style={{ fontSize: "0.96rem" }}>{group.label}</strong>
                  <span className="muted" style={{ fontSize: "0.84rem" }}>
                      {group.totalDurationMinutes > 0
                        ? `${group.totalDurationMinutes} min watched`
                        : group.latestWatchedAt
                          ? `${group.totalEvents} sessions · latest ${formatEventDateTime(group.latestWatchedAt)}`
                          : `${group.totalEvents} sessions`}
                    </span>
                </div>
                <div style={{ display: "grid", gap: "10px", minWidth: "8rem" }}>
                  <strong style={{ fontSize: "1.2rem", textAlign: "right" }}>{group.totalEvents}</strong>
                  <div className="activity-meter">
                    <div className="activity-meter-bar">
                      <div
                        className="activity-meter-fill"
                        style={{
                          width: `${Math.max(12, Math.round((group.totalEvents / topGroupTotal) * 100))}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="glass-panel"
          style={{
            borderRadius: "24px",
            padding: "22px",
            display: "grid",
            gap: "14px"
          }}
        >
          <span className="eyebrow">Activity Shape</span>
          <div
            style={{
              display: "grid",
              gap: "12px"
            }}
          >
            {data.groups.slice(0, 7).map((group) => (
              <div key={`shape-${group.label}`} style={{ display: "grid", gap: "6px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    alignItems: "baseline"
                  }}
                >
                  <strong style={{ fontSize: "0.92rem" }}>{group.label}</strong>
                  <span className="muted" style={{ fontSize: "0.82rem" }}>
                    {group.totalEvents} sessions
                  </span>
                </div>
                <div className="activity-meter-bar">
                  <div
                    className="activity-meter-fill"
                    style={{
                      width: `${Math.max(8, Math.round((group.totalEvents / topGroupTotal) * 100))}%`
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className="glass-panel"
          style={{
            borderRadius: "24px",
            padding: "22px",
            display: "grid",
            gap: "14px"
          }}
        >
          <span className="eyebrow">Highlights</span>
          <div style={{ display: "grid", gap: "12px" }}>
            {data.highlights.map((highlight) => (
              <div key={highlight.label} className="source-stat-card">
                <span className="muted" style={{ fontSize: "0.82rem" }}>
                  {highlight.label}
                </span>
                <strong style={{ fontSize: "1rem" }}>{highlight.title}</strong>
                <span className="muted" style={{ fontSize: "0.84rem" }}>
                  {highlight.detail}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section
          className="glass-panel"
          style={{
            borderRadius: "24px",
            padding: "22px",
            display: "grid",
            gap: "14px"
          }}
        >
          <span className="eyebrow">Insights</span>
          <div style={{ display: "grid", gap: "12px" }}>
            {data.insights.map((insight) => (
              <div key={insight.label} className="source-stat-card">
                <span className="muted" style={{ fontSize: "0.82rem" }}>
                  {insight.label}
                </span>
                <strong style={{ fontSize: "1rem" }}>{insight.value}</strong>
                <span className="muted" style={{ fontSize: "0.84rem" }}>
                  {insight.detail}
                </span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </section>
  );
}
