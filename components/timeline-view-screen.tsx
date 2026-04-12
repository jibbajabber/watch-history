import { EmptyTimelineState } from "@/components/timeline/empty-timeline-state";
import { SummaryCards } from "@/components/timeline/summary-cards";
import { TimelineGrid } from "@/components/timeline/timeline-grid";
import type { TimelineResponse, TimelineViewMeta } from "@/lib/types";

export function TimelineViewScreen({
  data,
  meta
}: {
  data: TimelineResponse;
  meta: TimelineViewMeta;
}) {
  return (
    <section style={{ display: "grid", gap: "24px" }}>
      <div
        style={{
          display: "grid",
          gap: "10px"
        }}
      >
        <span className="eyebrow">{meta.kicker}</span>
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
              {meta.title}
            </h2>
            <p
              className="muted"
              style={{
                margin: 0,
                fontSize: "1rem",
                lineHeight: 1.7,
                maxWidth: "42rem"
              }}
            >
              {meta.description}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gap: "8px",
              minWidth: "16rem"
            }}
          >
            <span className="eyebrow">Coverage</span>
            <strong style={{ fontSize: "1.08rem" }}>{data.rangeLabel}</strong>
            <span className="muted" style={{ fontSize: "0.95rem" }}>
              {data.events.length > 0
                ? `Showing ${data.events.length} recorded watch events.`
                : "No watch events have been imported for this range yet."}
            </span>
          </div>
        </div>
      </div>

      <SummaryCards summary={data.summary} />

      {data.events.length === 0 ? <EmptyTimelineState view={data.view} /> : <TimelineGrid data={data} />}
    </section>
  );
}

