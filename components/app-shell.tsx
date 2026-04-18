import Link from "next/link";
import type { Route } from "next";
import { getSourceHealthNotice } from "@/lib/sources";
import type { AppSection, TimelineView } from "@/lib/types";

const views: Array<{ href: Route; label: string; view: AppSection }> = [
  { href: "/week", label: "Week", view: "week" },
  { href: "/month", label: "Month", view: "month" },
  { href: "/year", label: "Year", view: "year" },
  { href: "/sources", label: "Sources", view: "sources" }
];

const sectionCards: Record<
  AppSection,
  {
    eyebrow: string;
    title: string;
    body: string;
  }
> = {
  week: {
    eyebrow: "This view",
    title: "Recent sessions and fresh activity.",
    body: "Use the week view to verify what landed most recently, spot duplicates quickly, and understand how the last few days actually looked."
  },
  month: {
    eyebrow: "This view",
    title: "Patterns across a full month.",
    body: "Month view is for rhythm: clusters of activity, repeated titles, heavy days, and quiet gaps become easier to read here."
  },
  year: {
    eyebrow: "This view",
    title: "The larger shape of watching.",
    body: "Year view compresses the timeline into a broader pattern so active months, long gaps, and recurring habits are easier to compare."
  },
  sources: {
    eyebrow: "This section",
    title: "Connection health and import control.",
    body: "Use Sources to verify integrations, inspect import freshness, and trigger syncs when you want the timeline views to refresh."
  }
};

export async function AppShell({
  activeView,
  children
}: {
  activeView: AppSection;
  children: React.ReactNode;
}) {
  const sectionCard = sectionCards[activeView];
  const healthNotice = await getSourceHealthNotice();

  return (
    <main className="page-shell">
      <div className="page-frame">
        <section
          className="glass-panel"
          style={{
            borderRadius: "32px",
            padding: "28px",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "28px"
            }}
          >
            <header
              style={{
                display: "grid",
                gap: "20px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  gap: "20px",
                  flexWrap: "wrap"
                }}
              >
                <div style={{ display: "grid", gap: "10px", maxWidth: "42rem" }}>
                  <span className="eyebrow">Watch History</span>
                  <div style={{ display: "grid", gap: "12px" }}>
                    <h1
                      className="headline"
                      style={{
                        margin: 0,
                        fontSize: "clamp(2.75rem, 6vw, 5.75rem)",
                        lineHeight: 0.92
                      }}
                    >
                      Time turns your viewing into a story.
                    </h1>
                    <p
                      className="muted"
                      style={{
                        margin: 0,
                        fontSize: "1.05rem",
                        lineHeight: 1.7
                      }}
                    >
                      A timeline-first watch journal for the last week, the shape of a month,
                      and the rhythm of a year.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    minWidth: "16rem",
                    display: "grid",
                    gap: "12px"
                  }}
                >
                  <div
                    className="glass-panel"
                    style={{
                      borderRadius: "20px",
                      padding: "16px 18px",
                      display: "grid",
                      gap: "10px"
                    }}
                  >
                    <span className="eyebrow">{sectionCard.eyebrow}</span>
                    <strong style={{ fontSize: "1rem" }}>{sectionCard.title}</strong>
                    <p className="muted" style={{ margin: 0, lineHeight: 1.6, fontSize: "0.94rem" }}>
                      {sectionCard.body}
                    </p>
                  </div>

                  {healthNotice ? (
                    <div
                      className="glass-panel"
                      style={{
                        borderRadius: "20px",
                        padding: "16px 18px",
                        display: "grid",
                        gap: "10px",
                        border: "1px solid rgba(255, 191, 105, 0.34)",
                        background:
                          "linear-gradient(180deg, rgba(255, 191, 105, 0.08), rgba(255, 255, 255, 0.03))"
                      }}
                    >
                      <span className="eyebrow">Source Health</span>
                      <strong style={{ fontSize: "1rem" }}>{healthNotice.title}</strong>
                      <p className="muted" style={{ margin: 0, lineHeight: 1.6, fontSize: "0.92rem" }}>
                        {healthNotice.body}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <nav
                aria-label="Timeline views"
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap"
                }}
              >
                {views.map((item) => {
                  const active = item.view === activeView;

                  return (
                    <Link
                      key={item.view}
                      href={item.href}
                      style={{
                        borderRadius: "999px",
                        border: active ? "1px solid transparent" : "1px solid var(--line)",
                        background: active
                          ? "linear-gradient(135deg, rgba(255, 191, 105, 0.92), rgba(255, 127, 106, 0.88))"
                          : "rgba(255, 255, 255, 0.03)",
                        color: active ? "#181311" : "var(--text)",
                        padding: "12px 18px",
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                        boxShadow: active ? "0 10px 30px rgba(255, 127, 106, 0.22)" : "none"
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </header>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
