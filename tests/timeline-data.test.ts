import {
  buildTimelineHighlights,
  buildTimelineInsights,
  buildTimelineSummary,
  getEscapedTimelineTimezone,
  getTimelineViewMeta,
  getTimelineViewWindow,
  isTimelineView,
  mapTimelineEventRow,
  mapTimelineGroupRow,
  type EventRow
} from "@/lib/timeline-data";

describe("timeline data helpers", () => {
  const originalTimezone = process.env.APP_TIMEZONE;

  beforeEach(() => {
    process.env.APP_TIMEZONE = "UTC";
  });

  afterEach(() => {
    if (originalTimezone === undefined) {
      delete process.env.APP_TIMEZONE;
    } else {
      process.env.APP_TIMEZONE = originalTimezone;
    }
  });

  it("recognizes valid timeline views and returns view metadata", () => {
    expect(isTimelineView("week")).toBe(true);
    expect(isTimelineView("quarter")).toBe(false);
    expect(getTimelineViewMeta("year")).toMatchObject({
      kicker: "Year view"
    });
  });

  it("builds timeline windows using the configured timezone", () => {
    process.env.APP_TIMEZONE = "Europe/London";

    expect(getEscapedTimelineTimezone()).toBe("Europe/London");
    expect(getTimelineViewWindow("week")).toMatchObject({
      rangeLabel: "Last 7 days",
      groupLabel: "day"
    });
    expect(getTimelineViewWindow("month", new Date("2026-04-18T12:00:00.000Z"))).toMatchObject({
      rangeLabel: "April 2026",
      groupLabel: "day"
    });
    expect(getTimelineViewWindow("year", new Date("2026-04-18T12:00:00.000Z"))).toMatchObject({
      rangeLabel: "2026",
      groupLabel: "month"
    });
  });

  it("maps timeline rows with channel branding and formatting", () => {
    const row: EventRow = {
      id: "1",
      source_id: "source-1",
      event_key: "event-1",
      title: "News at Ten",
      media_type: "programme",
      source_name: "Home Assistant",
      channel_name: "BBC One HD",
      channel_key: null,
      device_label: "Living Room",
      watched_at: "2026-04-18T21:00:00.000Z",
      duration_minutes: 60,
      progress_label: "Watched",
      status_label: "Completed",
      is_provisional: false,
      is_favourite: true,
      is_hidden: false
    };

    expect(mapTimelineEventRow(row)).toMatchObject({
      channelName: "BBC One",
      channelKey: "bbc-one",
      channelLogoPath: "/channel-logos/bbc-one.svg",
      watchedAtLabel: "18 Apr, 21:00"
    });
  });

  it("builds summary, insights, and highlights from mapped timeline data", () => {
    const events = [
      mapTimelineEventRow({
        id: "1",
        source_id: "source-1",
        event_key: "event-1",
        title: "Film Night",
        media_type: "movie",
        source_name: "Plex",
        channel_name: null,
        channel_key: "plex",
        device_label: "TV",
        watched_at: "2026-04-18T20:00:00.000Z",
        duration_minutes: 125,
        progress_label: null,
        status_label: "Completed",
        is_provisional: false,
        is_favourite: false,
        is_hidden: false
      }),
      mapTimelineEventRow({
        id: "2",
        source_id: "source-2",
        event_key: "event-2",
        title: "Evening News",
        media_type: "programme",
        source_name: "Home Assistant",
        channel_name: "BBC One",
        channel_key: "bbc-one",
        device_label: "TV",
        watched_at: "2026-04-17T18:30:00.000Z",
        duration_minutes: 30,
        progress_label: null,
        status_label: "Completed",
        is_provisional: false,
        is_favourite: false,
        is_hidden: false
      })
    ];
    const groups = [
      mapTimelineGroupRow({
        label: "Fri 18 Apr",
        total_events: 2,
        total_duration_minutes: 155,
        latest_watched_at: "2026-04-18T20:00:00.000Z"
      })
    ];
    const summary = buildTimelineSummary({
      total_events: 2,
      unique_titles: 2,
      sources: 2,
      total_duration_minutes: 155,
      active_days: 2
    });

    expect(summary).toMatchObject({
      averageMinutesPerActiveDay: 78
    });

    expect(
      buildTimelineInsights({
        summary,
        groups,
        sourceMixRows: [
          { source_name: "Plex", total_events: 1 },
          { source_name: "Home Assistant", total_events: 1 }
        ],
        events
      })
    ).toEqual([
      {
        label: "Active days",
        value: "2",
        detail: "78 min on an average active day"
      },
      {
        label: "Busiest moment",
        value: "Fri 18 Apr",
        detail: "2 sessions, 155 min watched"
      },
      {
        label: "Source mix",
        value: "Plex",
        detail: "Plex (1) · Home Assistant (1)"
      },
      {
        label: "Latest activity",
        value: "18 Apr, 20:00",
        detail: "Film Night on Plex"
      }
    ]);

    expect(
      buildTimelineHighlights({
        titleHighlight: {
          title: "Film Night",
          total_events: 1,
          total_duration_minutes: 125
        },
        sourceMixRows: [{ source_name: "Plex", total_events: 1 }],
        events
      })
    ).toEqual([
      {
        label: "Top title",
        title: "Film Night",
        detail: "1 sessions · 125 min watched"
      },
      {
        label: "Longest session",
        title: "Film Night",
        detail: "2h 5m on Plex"
      },
      {
        label: "Top source",
        title: "Plex",
        detail: "1 sessions in this range"
      }
    ]);
  });
});
