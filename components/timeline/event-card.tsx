"use client";

import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChannelLogo } from "@/components/timeline/channel-logo";
import type { TimelineEvent } from "@/lib/types";

function formatDeviceLabel(label: string) {
  return label.replace("media_player.", "").replaceAll("_", " ");
}

export function TimelineEventCard({
  event,
  context = "timeline"
}: {
  event: TimelineEvent;
  context?: "timeline" | "favourites";
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const cardRef = useRef<HTMLElement | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!cardRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  function clearLongPress() {
    if (longPressTimeoutRef.current !== null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") {
      return;
    }

    clearLongPress();
    longPressTimeoutRef.current = window.setTimeout(() => {
      setMenuOpen(true);
    }, 450);
  }

  async function submitAction(action: "favourite" | "unfavourite" | "hide" | "unhide") {
    setErrorMessage(null);

    try {
      const response = await fetch("/api/curation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourceId: event.sourceId,
          eventKey: event.eventKey,
          action
        })
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update curation.");
      }

      setMenuOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update curation.");
    }
  }

  return (
    <article
      ref={cardRef}
      onPointerDown={handlePointerDown}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: "18px",
        padding: "18px 24px",
        borderBottom: "1px solid var(--line)",
        position: "relative"
      }}
    >
      <div style={{ display: "grid", gap: "8px" }}>
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "center"
          }}
        >
          <strong style={{ fontSize: "1.08rem" }}>{event.title}</strong>
          {event.isFavourite ? (
            <span
              style={{
                borderRadius: "999px",
                border: "1px solid rgba(255, 191, 105, 0.4)",
                background: "rgba(255, 191, 105, 0.14)",
                color: "var(--gold)",
                padding: "4px 10px",
                fontSize: "0.78rem",
                fontWeight: 700
              }}
            >
              Favourite
            </span>
          ) : null}
          {event.isHidden ? (
            <span
              style={{
                borderRadius: "999px",
                border: "1px solid rgba(157, 168, 186, 0.28)",
                background: "rgba(157, 168, 186, 0.08)",
                color: "var(--muted)",
                padding: "4px 10px",
                fontSize: "0.78rem",
                fontWeight: 700
              }}
            >
              Hidden
            </span>
          ) : null}
          {event.statusLabel ? (
            <span
              style={{
                borderRadius: "999px",
                border: event.isProvisional
                  ? "1px solid rgba(255, 191, 105, 0.42)"
                  : "1px solid var(--line)",
                background: event.isProvisional
                  ? "rgba(255, 191, 105, 0.14)"
                  : "rgba(255,255,255,0.04)",
                color: event.isProvisional ? "var(--gold)" : "var(--muted)",
                padding: "4px 10px",
                fontSize: "0.78rem",
                fontWeight: 700
              }}
            >
              {event.statusLabel}
            </span>
          ) : null}
          {event.mediaType ? (
            <span
              style={{
                borderRadius: "999px",
                border: "1px solid var(--line)",
                padding: "4px 10px",
                fontSize: "0.78rem",
                color: "var(--muted)"
              }}
            >
              {event.mediaType}
            </span>
          ) : null}
        </div>

        <div
          className="muted"
          style={{
            display: "flex",
            gap: "14px",
            flexWrap: "wrap",
            fontSize: "0.92rem"
          }}
        >
          {event.channelName ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              {event.channelLogoPath ? (
                <ChannelLogo label={event.channelName} logoPath={event.channelLogoPath} />
              ) : null}
              <span>{event.channelName}</span>
            </span>
          ) : (
            <span>{event.sourceName}</span>
          )}
          {event.deviceLabel ? <span>{formatDeviceLabel(event.deviceLabel)}</span> : null}
          {event.progressLabel ? <span>{event.progressLabel}</span> : null}
          {event.durationMinutes ? <span>{event.durationMinutes} min</span> : null}
        </div>

        {context === "favourites" ? (
          <p
            className="muted"
            style={{
              margin: 0,
              lineHeight: 1.6,
              fontSize: "0.9rem"
            }}
          >
            {event.isHidden
              ? "Hidden from the default timeline. Restore it here if it belongs back in the watch history."
              : "Kept in Favourites so it is easy to find again when you want to recommend it later."}
          </p>
        ) : null}
      </div>

      <div
        style={{
          textAlign: "right",
          display: "grid",
          gap: "10px",
          alignContent: "start",
          justifyItems: "end"
        }}
      >
        <strong style={{ fontSize: "0.92rem" }}>{event.watchedAtLabel}</strong>
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          disabled={isPending}
          style={{
            borderRadius: "999px",
            border: "1px solid var(--line)",
            background: menuOpen ? "rgba(255, 191, 105, 0.14)" : "rgba(255, 255, 255, 0.03)",
            color: "var(--text)",
            padding: "8px 12px",
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          {context === "favourites" ? "Change" : "Curate"}
        </button>
      </div>

      {menuOpen ? (
        <div
          style={{
            gridColumn: "1 / -1",
            marginTop: "-4px",
            border: "1px solid var(--line)",
            background: "rgba(255, 255, 255, 0.03)",
            borderRadius: "18px",
            padding: "14px",
            display: "grid",
            gap: "10px"
          }}
        >
          <div style={{ display: "grid", gap: "4px" }}>
            <strong style={{ fontSize: "0.94rem" }}>Keep what was worth recommending later.</strong>
            <span className="muted" style={{ fontSize: "0.84rem", lineHeight: 1.5 }}>
              Favourite the important titles or hide the low-value rows from the default timeline.
            </span>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => void submitAction(event.isFavourite ? "unfavourite" : "favourite")}
              style={menuButtonStyle}
            >
              {event.isFavourite ? "Remove favourite" : "Add to favourites"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => void submitAction(event.isHidden ? "unhide" : "hide")}
              style={menuButtonStyle}
            >
              {event.isHidden ? "Show in timeline again" : "Hide from timeline"}
            </button>
          </div>

          {errorMessage ? (
            <span style={{ color: "var(--salmon)", fontSize: "0.84rem", lineHeight: 1.5 }}>
              {errorMessage}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

const menuButtonStyle: CSSProperties = {
  borderRadius: "14px",
  border: "1px solid var(--line)",
  background: "rgba(255, 255, 255, 0.03)",
  color: "var(--text)",
  padding: "10px 12px",
  textAlign: "left",
  fontWeight: 700,
  cursor: "pointer"
};
