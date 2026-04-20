import { getAppTimezone } from "@/lib/app-config";
import type { SourceStatus } from "@/lib/types";

export type ImportRow = {
  slug: string;
  latest_status: string | null;
  latest_started_at: string | null;
  latest_completed_at: string | null;
  latest_error_message: string | null;
  latest_success_started_at: string | null;
  latest_success_completed_at: string | null;
  latest_failed_started_at: string | null;
  latest_failed_completed_at: string | null;
  latest_failed_error_message: string | null;
};

export type DerivedImportHealth = {
  hasRecentFailure: boolean;
  isStale: boolean;
};

export type DerivedSourceStatus = Omit<
  SourceStatus,
  | "slug"
  | "displayName"
  | "kindLabel"
  | "healthLabel"
  | "healthDetail"
  | "lastSuccessLabel"
  | "lastFailureLabel"
  | "recoveryLabel"
  | "expectedEnvVars"
  | "latestImportLabel"
  | "configStatusLabel"
  | "configuredItems"
  | "connectionDetails"
  | "syncEnabled"
  | "syncIntervalMinutes"
  | "syncStatusLabel"
  | "nextSyncLabel"
  | "retentionModeLabel"
  | "retentionSummaryLabel"
  | "retentionDetail"
  | "retentionHistoryDays"
  | "retentionImportJobDays"
  | "retentionProvisionalHours"
  | "retentionSupportsProvisional"
>;

export function formatLatestImport(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: getAppTimezone()
  }).format(new Date(value));
}

export function formatNextSync(value: string | null) {
  if (!value) {
    return "Waiting for first run";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: getAppTimezone()
  }).format(new Date(value));
}

export function formatRelativeFailure(message: string | null) {
  if (!message) {
    return "Import failed. Check the source configuration and connectivity.";
  }

  return "Import failed. Check the source configuration and connectivity.";
}

export function hasLaterFailure(importRow: ImportRow | null) {
  if (!importRow?.latest_failed_started_at) {
    return false;
  }

  if (!importRow.latest_success_started_at) {
    return true;
  }

  return (
    new Date(importRow.latest_failed_started_at).getTime() >=
    new Date(importRow.latest_success_started_at).getTime()
  );
}

export function isSourceStale(
  latestImportAt: string | null,
  syncEnabled: boolean,
  syncIntervalMinutes: number
) {
  if (!syncEnabled || !latestImportAt) {
    return false;
  }

  const elapsedMs = Date.now() - new Date(latestImportAt).getTime();

  return elapsedMs > syncIntervalMinutes * 2 * 60 * 1000;
}

export function getRecoveryLabel(importRow: ImportRow | null) {
  if (!importRow?.latest_failed_started_at || !importRow.latest_success_started_at) {
    return null;
  }

  const lastFailure = new Date(importRow.latest_failed_started_at).getTime();
  const lastSuccess = new Date(importRow.latest_success_started_at).getTime();

  if (lastSuccess <= lastFailure) {
    return null;
  }

  return `Recovered on ${formatLatestImport(importRow.latest_success_started_at)}`;
}

export function getHomeAssistantStatus(
  configReady: boolean,
  envReady: boolean,
  latestImportAt: string | null,
  connectionOk: boolean,
  importHealth: DerivedImportHealth
): DerivedSourceStatus {
  if (configReady && envReady && importHealth.hasRecentFailure) {
    return {
      status: "attention",
      statusLabel: "Failing",
      envReady,
      connectionPathLabel: connectionOk ? "Verified" : "Unavailable",
      operationalTitle: "Latest import failed",
      operationalBody:
        connectionOk
          ? "Connectivity is working, but the latest Home Assistant import failed. The app should keep running and scheduled sync will retry at the next interval."
          : "The latest Home Assistant import failed and the current connectivity check is also failing. The app should keep running and scheduled sync will retry at the next interval."
    };
  }

  if (configReady && envReady && connectionOk && importHealth.isStale) {
    return {
      status: "attention",
      statusLabel: "Stale",
      envReady,
      connectionPathLabel: "Verified",
      operationalTitle: "Import freshness is behind",
      operationalBody:
        "Home Assistant is connected, but recent imports are older than expected for the configured sync interval."
    };
  }

  if (latestImportAt) {
    return {
      status: "ready",
      statusLabel: "Imported",
      envReady,
      connectionPathLabel: "Verified",
      operationalTitle: "Source is importing normally",
      operationalBody:
        "Home Assistant data has landed and the source is ready for manual or scheduled refreshes."
    };
  }

  if (configReady && envReady && connectionOk) {
    return {
      status: "ready",
      statusLabel: "Connected",
      envReady,
      connectionPathLabel: "Access token",
      operationalTitle: "Ready for the first import",
      operationalBody:
        "Connectivity is working and the configured entities are ready to import."
    };
  }

  if (configReady && envReady) {
    return {
      status: "attention",
      statusLabel: "Ready to verify",
      envReady,
      connectionPathLabel: "Access token",
      operationalTitle: "Connection needs verification",
      operationalBody:
        "The config file and token are present, but the connectivity check still needs to pass."
    };
  }

  return {
    status: "blocked",
    statusLabel: "Configuration required",
    envReady,
    connectionPathLabel: "Unknown",
    operationalTitle: "Configuration is incomplete",
    operationalBody:
      "Create the Home Assistant YAML config file with the base URL and tracked entities, then add a long-lived access token in the env file."
  };
}

export function getPlexStatus(
  envReady: boolean,
  latestImportAt: string | null,
  connectionOk: boolean,
  importHealth: DerivedImportHealth
): DerivedSourceStatus {
  if (envReady && importHealth.hasRecentFailure) {
    return {
      status: "attention",
      statusLabel: "Failing",
      envReady,
      connectionPathLabel: connectionOk ? "Verified" : "Unavailable",
      operationalTitle: "Latest import failed",
      operationalBody:
        connectionOk
          ? "Connectivity is working, but the latest Plex import failed. The app should keep running and scheduled sync will retry at the next interval."
          : "The latest Plex import failed and the current connectivity check is also failing. The app should keep running and scheduled sync will retry at the next interval."
    };
  }

  if (envReady && connectionOk && importHealth.isStale) {
    return {
      status: "attention",
      statusLabel: "Stale",
      envReady,
      connectionPathLabel: "Verified",
      operationalTitle: "Import freshness is behind",
      operationalBody:
        "Plex is connected, but recent imports are older than expected for the configured sync interval."
    };
  }

  if (latestImportAt) {
    return {
      status: "ready",
      statusLabel: "Imported",
      envReady,
      connectionPathLabel: "Verified",
      operationalTitle: "Source is importing normally",
      operationalBody:
        "Plex history is landing and the source is ready for manual or scheduled refreshes."
    };
  }

  if (envReady && connectionOk) {
    return {
      status: "ready",
      statusLabel: "Connected",
      envReady,
      connectionPathLabel: "Server token",
      operationalTitle: "Ready for the first import",
      operationalBody:
        "Connectivity is working and the Plex server is ready to import."
    };
  }

  if (envReady) {
    return {
      status: "attention",
      statusLabel: "Ready to verify",
      envReady,
      connectionPathLabel: "Server token",
      operationalTitle: "Connection needs verification",
      operationalBody:
        "The Plex env vars are present, but the server URL and token still need to pass the connectivity check."
    };
  }

  return {
    status: "blocked",
    statusLabel: "Configuration required",
    envReady,
    connectionPathLabel: "Unknown",
    operationalTitle: "Configuration is incomplete",
    operationalBody:
      "Set PLEX_BASE_URL and PLEX_TOKEN in the env file so the app can authenticate to the Plex Media Server."
  };
}
