export type TimelineView = "week" | "month" | "year";
export type AppSection = TimelineView | "analytics" | "sources";

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
  progressLabel: string | null;
  statusLabel: string | null;
  isProvisional: boolean;
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

export type AnalyticsSeriesPoint = {
  label: string;
  value: number;
  secondaryValue?: number;
};

export type AnalyticsRankedItem = {
  label: string;
  value: number;
  detail: string;
};

export type AnalyticsSourceContribution = {
  sourceName: string;
  watchEvents: number;
  rawRecords: number;
  successfulImports: number;
  failedImports: number;
  latestSuccessAt: string | null;
};

export type AnalyticsImportSource = {
  sourceName: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRecordsImported: number | null;
  latestSuccessAt: string | null;
};

export type AnalyticsResponse = {
  overview: {
    totalWatchEvents: number;
    totalRawRecords: number;
    totalImportJobs: number;
    sourcesWithHistory: number;
    activeDaysLast30: number;
    eventGrowthLast7: number;
    eventGrowthLast30: number;
    rawGrowthLast7: number;
    rawGrowthLast30: number;
    importRunsLast30: number;
    importFailuresLast30: number;
  };
  watchPatterns: {
    monthlyActivity: AnalyticsSeriesPoint[];
    topTitles: AnalyticsRankedItem[];
    topSources: AnalyticsRankedItem[];
    earliestWatchAt: string | null;
    latestWatchAt: string | null;
  };
  datasetGrowth: {
    monthlyCreated: Array<
      AnalyticsSeriesPoint & {
        rawRecords: number;
        watchEvents: number;
      }
    >;
    sourceContribution: AnalyticsSourceContribution[];
    earliestImportedAt: string | null;
    latestImportedAt: string | null;
  };
  importActivity: {
    bySourceLast30Days: AnalyticsImportSource[];
    totalRunsLast30: number;
    successCountLast30: number;
    failureCountLast30: number;
  };
};

export type SourceStatus = {
  slug: string;
  displayName: string;
  kindLabel: string;
  status: "ready" | "attention" | "blocked";
  statusLabel: string;
  envReady: boolean;
  connectionPathLabel: string;
  latestImportLabel: string;
  operationalTitle: string;
  operationalBody: string;
  healthLabel: string;
  healthDetail: string;
  lastSuccessLabel: string;
  lastFailureLabel: string;
  recoveryLabel: string | null;
  expectedEnvVars: string[];
  configStatusLabel: string;
  configuredItems: string[];
  connectionDetails: string[];
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  syncStatusLabel: string;
  nextSyncLabel: string;
  retentionModeLabel: string;
  retentionSummaryLabel: string;
  retentionDetail: string;
  retentionHistoryDays: number | null;
  retentionImportJobDays: number | null;
  retentionProvisionalHours: number | null;
  retentionSupportsProvisional: boolean;
};
