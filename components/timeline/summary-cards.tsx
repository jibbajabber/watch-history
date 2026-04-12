import { formatMinutes } from "@/lib/format";
import type { TimelineSummary } from "@/lib/types";

export function SummaryCards({ summary }: { summary: TimelineSummary }) {
  const cards = [
    {
      label: "Sessions",
      value: summary.totalEvents.toString(),
      accent: "var(--gold)"
    },
    {
      label: "Titles",
      value: summary.uniqueTitles.toString(),
      accent: "var(--mint)"
    },
    {
      label: "Sources",
      value: summary.sources.toString(),
      accent: "var(--salmon)"
    },
    {
      label: "Watch time",
      value: formatMinutes(summary.totalDurationMinutes),
      accent: "#9fb8ff"
    },
    {
      label: "Active days",
      value: summary.activeDays.toString(),
      accent: "#d7a6ff"
    }
  ];

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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
              width: "2.75rem",
              height: "0.35rem",
              borderRadius: "999px",
              background: card.accent
            }}
          />
          <div className="muted" style={{ fontSize: "0.88rem" }}>
            {card.label}
          </div>
          <strong style={{ fontSize: "1.8rem", lineHeight: 1 }}>{card.value}</strong>
        </article>
      ))}
    </section>
  );
}
