import { findChannelBrand } from "@/lib/channels";
import { getAppTimezone } from "@/lib/app-config";
import { formatEventDateTime, formatMinutes } from "@/lib/format";
import type {
  TimelineEvent,
  TimelineGroup,
  TimelineHighlight,
  TimelineInsight,
  TimelineSummary,
  TimelineView,
  TimelineViewMeta
} from "@/lib/types";

export type EventRow = {
  id: string;
  source_id: string;
  event_key: string;
  title: string;
  media_type: string | null;
  source_name: string;
  channel_name: string | null;
  channel_key: string | null;
  device_label: string | null;
  watched_at: string;
  duration_minutes: number | null;
  progress_label: string | null;
  status_label: string | null;
  is_provisional: boolean;
  is_favourite: boolean;
  is_hidden: boolean;
};

export type GroupRow = {
  label: string;
  total_events: number;
  total_duration_minutes: number | null;
  latest_watched_at: string | null;
};

export type SummaryRow = {
  total_events: number;
  unique_titles: number;
  sources: number;
  total_duration_minutes: number | null;
  active_days: number;
};

export type HighlightRow = {
  title: string;
  total_events: number;
  total_duration_minutes: number | null;
};

export type SourceMixRow = {
  source_name: string;
  total_events: number;
};

export const timelineViews = ["week", "month", "year"] as const;

const viewMeta: Record<TimelineView, TimelineViewMeta> = {
  week: {
    title: "The last 7 days, at a glance.",
    description:
      "Weekly view is the front door. It should feel immediate, recent, and alive the moment real source data starts landing.",
    kicker: "Week view"
  },
  month: {
    title: "One month, grouped into watchable moments.",
    description:
      "Monthly view surfaces pace and clustering so repeated sessions and quiet days both read clearly.",
    kicker: "Month view"
  },
  year: {
    title: "A year of watching, compressed into shape.",
    description:
      "Year view acts as the larger map, making it easy to spot active months and move deeper when history accumulates.",
    kicker: "Year view"
  }
};

export function getEscapedTimelineTimezone() {
  return getAppTimezone().replace(/'/g, "''");
}

export function getTimelineViewWindow(view: TimelineView, now = new Date()) {
  const timezone = getEscapedTimelineTimezone();

  switch (view) {
    case "week":
      return {
        intervalSql: "NOW() - INTERVAL '7 days'",
        rangeLabel: "Last 7 days",
        groupByExpression: `TO_CHAR(watched_at AT TIME ZONE '${timezone}', 'Dy DD Mon')`,
        groupSortExpression: `DATE_TRUNC('day', watched_at AT TIME ZONE '${timezone}')`,
        groupLabel: "day"
      };
    case "month":
      return {
        intervalSql: "DATE_TRUNC('month', NOW())",
        rangeLabel: new Intl.DateTimeFormat("en-GB", {
          month: "long",
          year: "numeric",
          timeZone: getAppTimezone()
        }).format(now),
        groupByExpression: `TO_CHAR(watched_at AT TIME ZONE '${timezone}', 'Dy DD Mon')`,
        groupSortExpression: `DATE_TRUNC('day', watched_at AT TIME ZONE '${timezone}')`,
        groupLabel: "day"
      };
    case "year":
      return {
        intervalSql: "DATE_TRUNC('year', NOW())",
        rangeLabel: new Intl.DateTimeFormat("en-GB", {
          year: "numeric",
          timeZone: getAppTimezone()
        }).format(now),
        groupByExpression: `TO_CHAR(watched_at AT TIME ZONE '${timezone}', 'Mon')`,
        groupSortExpression: `DATE_TRUNC('month', watched_at AT TIME ZONE '${timezone}')`,
        groupLabel: "month"
      };
  }
}

export function isTimelineView(value: string): value is TimelineView {
  return (timelineViews as readonly string[]).includes(value);
}

export function getTimelineViewMeta(view: TimelineView) {
  return viewMeta[view];
}

export function mapTimelineEventRow(row: EventRow): TimelineEvent {
  const brand = findChannelBrand({
    channelKey: row.channel_key,
    channelName: row.channel_name ?? row.source_name
  });

  return {
    id: row.id,
    sourceId: row.source_id,
    eventKey: row.event_key,
    title: row.title,
    mediaType: row.media_type,
    sourceName: row.source_name,
    channelName: brand?.label ?? row.channel_name,
    channelKey: brand?.key ?? row.channel_key,
    channelLogoPath: brand?.logoPath ?? null,
    deviceLabel: row.device_label,
    watchedAt: row.watched_at,
    watchedAtLabel: formatEventDateTime(row.watched_at),
    durationMinutes: row.duration_minutes,
    progressLabel: row.progress_label,
    statusLabel: row.status_label,
    isProvisional: row.is_provisional,
    isFavourite: row.is_favourite,
    isHidden: row.is_hidden
  };
}

export function mapTimelineGroupRow(row: GroupRow): TimelineGroup {
  return {
    label: row.label,
    totalEvents: row.total_events,
    totalDurationMinutes: row.total_duration_minutes ?? 0,
    latestWatchedAt: row.latest_watched_at
  };
}

export function buildTimelineSummary(summaryRow?: SummaryRow): TimelineSummary {
  if (!summaryRow) {
    return {
      totalEvents: 0,
      uniqueTitles: 0,
      sources: 0,
      totalDurationMinutes: 0,
      activeDays: 0,
      averageMinutesPerActiveDay: null
    };
  }

  return {
    totalEvents: summaryRow.total_events,
    uniqueTitles: summaryRow.unique_titles,
    sources: summaryRow.sources,
    totalDurationMinutes: summaryRow.total_duration_minutes ?? 0,
    activeDays: summaryRow.active_days,
    averageMinutesPerActiveDay:
      summaryRow.active_days > 0
        ? Math.round((summaryRow.total_duration_minutes ?? 0) / summaryRow.active_days)
        : null
  };
}

export function buildTimelineInsights(params: {
  summary: TimelineSummary;
  groups: TimelineGroup[];
  sourceMixRows: SourceMixRow[];
  events: TimelineEvent[];
}): TimelineInsight[] {
  const { summary, groups, sourceMixRows, events } = params;
  const topGroup = groups[0];
  const latestEvent = events[0];

  return [
    {
      label: "Active days",
      value: summary.activeDays.toString(),
      detail:
        summary.activeDays > 0
          ? `${summary.averageMinutesPerActiveDay ?? 0} min on an average active day`
          : "No active days recorded in this range"
    },
    {
      label: "Busiest moment",
      value: topGroup ? topGroup.label : "None",
      detail: topGroup
        ? `${topGroup.totalEvents} sessions, ${topGroup.totalDurationMinutes} min watched`
        : "No grouped activity yet"
    },
    {
      label: "Source mix",
      value: sourceMixRows[0]?.source_name ?? "None",
      detail:
        sourceMixRows.length > 0
          ? sourceMixRows.map((row) => `${row.source_name} (${row.total_events})`).join(" · ")
          : "No source usage yet"
    },
    {
      label: "Latest activity",
      value: latestEvent ? formatEventDateTime(latestEvent.watchedAt) : "None",
      detail: latestEvent
        ? `${latestEvent.title} on ${latestEvent.channelName ?? latestEvent.sourceName}`
        : "No recent activity in this range"
    }
  ];
}

export function buildTimelineHighlights(params: {
  titleHighlight: HighlightRow | null;
  sourceMixRows: SourceMixRow[];
  events: TimelineEvent[];
}): TimelineHighlight[] {
  const { titleHighlight, sourceMixRows, events } = params;
  const longestSession =
    [...events]
      .filter((event) => (event.durationMinutes ?? 0) > 0)
      .sort((left, right) => (right.durationMinutes ?? 0) - (left.durationMinutes ?? 0))[0] ??
    null;
  const topSource = sourceMixRows[0];

  return [
    {
      label: "Top title",
      title: titleHighlight?.title ?? "Nothing imported yet",
      detail: titleHighlight
        ? `${titleHighlight.total_events} sessions${
            (titleHighlight.total_duration_minutes ?? 0) > 0
              ? ` · ${titleHighlight.total_duration_minutes} min watched`
              : ""
          }`
        : "Import data to start surfacing repeated titles"
    },
    {
      label: "Longest session",
      title: longestSession?.title ?? "Duration pending",
      detail: longestSession?.durationMinutes
        ? `${formatMinutes(longestSession.durationMinutes)} on ${longestSession.channelName ?? longestSession.sourceName}`
        : "No completed timed sessions in this range yet"
    },
    {
      label: "Top source",
      title: topSource?.source_name ?? "No source yet",
      detail: topSource ? `${topSource.total_events} sessions in this range` : "No source usage yet"
    }
  ];
}
