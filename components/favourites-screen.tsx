import type { CSSProperties } from "react";
import Link from "next/link";
import { TimelineEventCard } from "@/components/timeline/event-card";
import type { CuratedFilter, FavouritesResponse } from "@/lib/types";

const filters: Array<{ value: CuratedFilter; label: string }> = [
  { value: "favourites", label: "Favourites" },
  { value: "hidden", label: "Hidden" },
  { value: "all", label: "All" }
];

function buildFilterHref(filter: CuratedFilter) {
  return filter === "favourites"
    ? { pathname: "/favourites" as const }
    : {
        pathname: "/favourites" as const,
        query: {
          filter
        }
      };
}

export function FavouritesScreen({ data }: { data: FavouritesResponse }) {
  return (
    <section style={{ display: "grid", gap: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "18px",
          flexWrap: "wrap",
          alignItems: "end"
        }}
      >
        <div style={{ display: "grid", gap: "10px", maxWidth: "46rem" }}>
          <span className="eyebrow">Favourites</span>
          <h2
            className="headline"
            style={{
              margin: 0,
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              lineHeight: 0.98
            }}
          >
            Keep the titles you would recommend again.
          </h2>
          <p
            className="muted"
            style={{
              margin: 0,
              fontSize: "1rem",
              lineHeight: 1.7
            }}
          >
            Favourites turns passive watch history into a shortlist: keep the meaningful titles close,
            and recover anything you hid from the default timeline when you need to review it again.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px",
            minWidth: "min(100%, 28rem)"
          }}
        >
          <article className="glass-panel" style={summaryCardStyle}>
            <span className="muted">All curated</span>
            <strong style={{ fontSize: "1.55rem" }}>{data.summary.curatedItems}</strong>
          </article>
          <article className="glass-panel" style={summaryCardStyle}>
            <span className="muted">Favourites</span>
            <strong style={{ fontSize: "1.55rem" }}>{data.summary.favourites}</strong>
          </article>
          <article className="glass-panel" style={summaryCardStyle}>
            <span className="muted">Hidden</span>
            <strong style={{ fontSize: "1.55rem" }}>{data.summary.hidden}</strong>
          </article>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap"
        }}
      >
        {filters.map((filter) => {
          const active = data.filter === filter.value;

          return (
            <Link
              key={filter.value}
              href={buildFilterHref(filter.value)}
              scroll={false}
              style={{
                borderRadius: "999px",
                border: active ? "1px solid transparent" : "1px solid var(--line)",
                background: active
                  ? "linear-gradient(135deg, rgba(255, 191, 105, 0.92), rgba(255, 127, 106, 0.88))"
                  : "rgba(255, 255, 255, 0.03)",
                color: active ? "#181311" : "var(--text)",
                padding: "12px 18px",
                fontWeight: 700
              }}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <section
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
            <span className="eyebrow">Curated watch history</span>
            <strong style={{ fontSize: "1.1rem" }}>
              {data.filter === "hidden" ? "Hidden timeline items" : "Saved titles"}
            </strong>
          </div>
          <span className="muted" style={{ alignSelf: "end", fontSize: "0.92rem" }}>
            {data.filter === "hidden"
              ? "Use this view to restore items to the main timeline."
              : "Use favourites to keep what was worth recommending again later."}
          </span>
        </div>

        {data.items.length === 0 ? (
          <div
            style={{
              padding: "28px 24px",
              display: "grid",
              gap: "10px"
            }}
          >
            <strong style={{ fontSize: "1.02rem" }}>
              {data.filter === "hidden" ? "Nothing is hidden right now." : "No curated items yet."}
            </strong>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
              {data.filter === "hidden"
                ? "Hidden rows will show up here so they can be restored without reappearing in the default timeline by accident."
                : "Use the Curate action on a timeline row to keep a favourite or hide a low-value watch event."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid" }}>
            {data.items.map((event) => (
              <TimelineEventCard
                key={`${event.sourceId}-${event.eventKey}`}
                event={event}
                context="favourites"
              />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

const summaryCardStyle: CSSProperties = {
  borderRadius: "22px",
  padding: "18px 18px 20px",
  display: "grid",
  gap: "10px"
};
