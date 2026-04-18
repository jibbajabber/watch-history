import {
  buildNormalizedTitle,
  buildSessionContentKey,
  findReusableSessionRecordId,
  formatProgressLabel,
  makeSessionSourceRecordId,
  normalizeHistoryItem,
  normalizeSessionItem,
  sessionMatchesRecentHistory,
  shouldIncludeActiveSession,
  type PersistedPlexRawRow,
  type PlexHistoryItem,
  type PlexSessionItem
} from "@/lib/plex-normalization";

describe("plex normalization helpers", () => {
  it("builds normalized titles and progress labels", () => {
    expect(
      buildNormalizedTitle({
        type: "episode",
        grandparentTitle: "Severance",
        parentIndex: 2,
        index: 4,
        title: "Woe's Hollow"
      })
    ).toBe("Severance · S02E04 · Woe's Hollow");

    expect(formatProgressLabel(30 * 60000, 60 * 60000)).toBe("30 of 60 min (50%)");
    expect(formatProgressLabel(null, 60 * 60000)).toBeNull();
  });

  it("normalizes durable history and provisional sessions", () => {
    const historyItem: PlexHistoryItem = {
      historyKey: "/status/sessions/history/1",
      ratingKey: "123",
      key: "/library/metadata/123",
      title: "Film Night",
      type: "movie",
      viewedAt: 1_713_470_400
    };
    const sessionItem: PlexSessionItem = {
      Session: { id: "session-1" },
      ratingKey: "456",
      key: "/library/metadata/456",
      title: "Current Film",
      type: "movie",
      viewOffset: 45 * 60000,
      duration: 90 * 60000,
      Player: { title: "Living Room Apple TV", product: "Plex for tvOS", platform: "tvOS" },
      User: { id: "u1", title: "Alex" }
    };

    expect(normalizeHistoryItem(historyItem, "raw-1")).toMatchObject({
      rawImportRecordId: "raw-1",
      title: "Film Night",
      watchedAt: new Date(historyItem.viewedAt! * 1000).toISOString(),
      metadata: {
        history_key: "/status/sessions/history/1",
        is_provisional: false
      }
    });

    expect(
      normalizeSessionItem(sessionItem, "2026-04-18T18:00:00.000Z", "In progress", "45 of 90 min (50%)", "raw-2")
    ).toMatchObject({
      rawImportRecordId: "raw-2",
      title: "Current Film",
      watchedAt: "2026-04-18T18:00:00.000Z",
      metadata: {
        session_id: "session-1",
        device_label: "Living Room Apple TV",
        status_label: "In progress",
        progress_label: "45 of 90 min (50%)",
        is_provisional: true
      }
    });
  });

  it("builds stable session ids and content keys", () => {
    const session: PlexSessionItem = {
      Session: { id: "session-1" },
      ratingKey: "456",
      key: "/library/metadata/456",
      title: "Current Film",
      type: "movie"
    };

    expect(buildSessionContentKey(session)).toContain("456");
    expect(makeSessionSourceRecordId(session, "2026-04-18T18:00:00.000Z")).toContain(
      "session::"
    );
  });

  it("detects recent history matches and session reuse eligibility", () => {
    const session: PlexSessionItem = {
      Session: { id: "session-1" },
      ratingKey: "456",
      key: "/library/metadata/456",
      title: "Current Film",
      type: "movie"
    };
    const history: PlexHistoryItem[] = [
      {
        historyKey: "h1",
        ratingKey: "456",
        key: "/library/metadata/456",
        title: "Current Film",
        type: "movie",
        viewedAt: Math.floor(new Date("2026-04-18T16:30:00.000Z").getTime() / 1000)
      }
    ];
    const reusableRows: PersistedPlexRawRow[] = [
      {
        id: "row-1",
        source_record_id: "session::reusable",
        imported_at: "2026-04-18T04:00:00.000Z",
        payload: session
      }
    ];

    expect(sessionMatchesRecentHistory(session, "2026-04-18T18:00:00.000Z", history)).toBe(true);
    expect(shouldIncludeActiveSession(session, history, "2026-04-18T18:00:00.000Z")).toBe(false);
    expect(findReusableSessionRecordId(session, reusableRows, [])).toBe("session::reusable");
  });
});
