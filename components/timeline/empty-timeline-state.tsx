import type { TimelineView } from "@/lib/types";

const viewCopy: Record<TimelineView, { title: string; body: string }> = {
  week: {
    title: "Nothing has landed in the last 7 days yet.",
    body: "Once a source starts syncing, the weekly view becomes the front page for recent plays, rewatches, and late-night sessions."
  },
  month: {
    title: "This month is waiting for its first watch event.",
    body: "Monthly view is designed to reveal rhythm and density. Right now it is empty because no live import has written events for this period."
  },
  year: {
    title: "The year view opens once watch history exists.",
    body: "As sources arrive, this screen will show how activity clusters across months without leaning on placeholder data."
  }
};

export function EmptyTimelineState({ view }: { view: TimelineView }) {
  const copy = viewCopy[view];

  return (
    <section
      className="glass-panel"
      style={{
        borderRadius: "28px",
        padding: "28px",
        display: "grid",
        gap: "18px"
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "12px",
          maxWidth: "38rem"
        }}
      >
        <span className="eyebrow">Waiting For Imports</span>
        <h3
          className="headline"
          style={{
            margin: 0,
            fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
            lineHeight: 1
          }}
        >
          {copy.title}
        </h3>
        <p
          className="muted"
          style={{
            margin: 0,
            lineHeight: 1.7,
            fontSize: "1rem"
          }}
        >
          {copy.body}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "14px"
        }}
      >
        {[
          { label: "Expected source", value: "Amazon Prime first" },
          { label: "Normal mode", value: "Live imported data" },
          { label: "Next milestone", value: "Source sync pipeline" }
        ].map((item) => (
          <div
            key={item.label}
            style={{
              borderRadius: "18px",
              border: "1px solid var(--line)",
              padding: "16px",
              background: "rgba(255, 255, 255, 0.03)"
            }}
          >
            <div className="muted" style={{ fontSize: "0.85rem", marginBottom: "6px" }}>
              {item.label}
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

