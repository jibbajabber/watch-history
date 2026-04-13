export type TimelineView = "week" | "month" | "year";
export type AppSection = TimelineView | "sources";

export type TimelineEvent = {
  id: string;
  title: string;
  mediaType: string | null;
  sourceName: string;
  channelName: string | null;
  channelKey: string | null;
  channelLogoPath: string | null;
  deviceLabel: string | null;
  watchedAt: string;
  durationMinutes: number | null;
};

export type TimelineGroup = {
  label: string;
  totalEvents: number;
  totalDurationMinutes: number;
  latestWatchedAt: string | null;
};

export type TimelineInsight = {
  label: string;
  value: string;
  detail: string;
};

export type TimelineHighlight = {
  label: string;
  title: string;
  detail: string;
};

export type TimelineSummary = {
  totalEvents: number;
  uniqueTitles: number;
  sources: number;
  totalDurationMinutes: number;
  activeDays: number;
  averageMinutesPerActiveDay: number | null;
};

export type TimelineResponse = {
  view: TimelineView;
  rangeLabel: string;
  events: TimelineEvent[];
  groups: TimelineGroup[];
  summary: TimelineSummary;
  insights: TimelineInsight[];
  highlights: TimelineHighlight[];
  meta: {
    groupLabel: string;
  };
};

export type TimelineViewMeta = {
  title: string;
  description: string;
  kicker: string;
};

export type SourceStatus = {
  slug: string;
  displayName: string;
  kindLabel: string;
  description: string;
  status: "ready" | "attention" | "blocked";
  statusLabel: string;
  envReady: boolean;
  connectionPathLabel: string;
  latestImportLabel: string;
  nextStepTitle: string;
  nextStepBody: string;
  expectedEnvVars: string[];
  configStatusLabel: string;
  configuredItems: string[];
  connectionDetails: string[];
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  syncStatusLabel: string;
  nextSyncLabel: string;
};
