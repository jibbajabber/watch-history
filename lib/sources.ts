import { getAppTimezone } from "@/lib/app-config";
import { checkHomeAssistantConnectivity } from "@/lib/home-assistant";
import { readHomeAssistantConfig } from "@/lib/home-assistant-config";
import { readPlexConfig } from "@/lib/plex-config";
import { checkPlexConnectivity, getPlexBaseUrl } from "@/lib/plex";
import { query } from "@/lib/db";
import type { SourceStatus } from "@/lib/types";

type SourceRow = {
  id: string;
  slug: string;
  display_name: string;
  source_kind: string;
};

type ImportRow = {
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

const sourceRegistry = [
  {
    slug: "home-assistant",
    displayName: "Home Assistant",
    kindLabel: "Automation source",
    sourceKind: "home_automation",
    description:
      "The first planned live source. It should authenticate to a Home Assistant instance and then read history for the Sky Q media-player entities through the supported APIs.",
    expectedEnvVars: [
      "HOME_ASSISTANT_ACCESS_TOKEN"
    ],
    connectionPathLabel: "Access token"
  },
  {
    slug: "plex",
    displayName: "Plex",
    kindLabel: "Media server",
    sourceKind: "media_server",
    description:
      "The next live source. It should connect to a personal Plex Media Server and import watch history through the supported server API.",
    expectedEnvVars: ["PLEX_BASE_URL", "PLEX_TOKEN"],
    connectionPathLabel: "Server token"
  }
] as const;

async function ensureSourcesExist() {
  await Promise.all(
    sourceRegistry.map((source) =>
      query(
        `
          INSERT INTO sources (slug, display_name, source_kind)
          VALUES ($1, $2, $3)
          ON CONFLICT (slug) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              source_kind = EXCLUDED.source_kind
        `,
        [source.slug, source.displayName, source.sourceKind]
      )
    )
  );
}

function formatLatestImport(value: string | null) {
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

function formatNextSync(value: string | null) {
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

function formatRelativeFailure(message: string | null) {
  if (!message) {
    return "Import failed.";
  }

  return message.length > 120 ? `${message.slice(0, 117)}...` : message;
}

function hasLaterFailure(importRow: ImportRow | null) {
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

function isSourceStale(
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

function getRecoveryLabel(importRow: ImportRow | null) {
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

type HomeAssistantDerivedStatus = Omit<
  SourceStatus,
  | "slug"
  | "displayName"
  | "kindLabel"
  | "description"
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
>;

function getHomeAssistantStatus(
  configReady: boolean,
  envReady: boolean,
  latestImportAt: string | null,
  connectionOk: boolean,
  importHealth: {
    hasRecentFailure: boolean;
    isStale: boolean;
  }
): HomeAssistantDerivedStatus {
  if (configReady && envReady && importHealth.hasRecentFailure) {
    return {
      status: "attention",
      statusLabel: "Failing",
      envReady,
      connectionPathLabel: connectionOk ? "Verified" : "Unavailable",
      nextStepTitle: "Import health needs attention.",
      nextStepBody:
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
      nextStepTitle: "Import freshness needs attention.",
      nextStepBody:
        "Home Assistant is connected, but recent imports are older than expected for the configured sync interval."
    };
  }

  if (latestImportAt) {
    return {
      status: "ready",
      statusLabel: "Imported",
      envReady,
      connectionPathLabel: "Verified",
      nextStepTitle: "Expand from connectivity into entity-history imports.",
      nextStepBody:
        "Home Assistant data has already landed. The next work should focus on Sky Q entity history ingestion, idempotent re-imports, and source-specific normalization."
    };
  }

  if (configReady && envReady && connectionOk) {
    return {
      status: "ready",
      statusLabel: "Connected",
      envReady,
      connectionPathLabel: "Access token",
      nextStepTitle: "Start Sky Q history ingestion.",
      nextStepBody:
        "Home Assistant connectivity is working. The next step is to query history for the configured Sky Q media-player entities and store the raw records."
    };
  }

  if (configReady && envReady) {
    return {
      status: "attention",
      statusLabel: "Ready to verify",
      envReady,
      connectionPathLabel: "Access token",
      nextStepTitle: "Resolve connectivity or entity checks.",
      nextStepBody:
        "The config file and token are present. The next step is to make the Home Assistant connectivity check pass and confirm the configured Sky Q entities exist."
    };
  }

  return {
    status: "blocked",
    statusLabel: "Configuration required",
    envReady,
    connectionPathLabel: "Unknown",
    nextStepTitle: "Configure the Home Assistant source.",
    nextStepBody:
      "Create the Home Assistant YAML config file with the base URL and tracked entities, then add a long-lived access token in the env file."
  };
}

function getPlexStatus(
  envReady: boolean,
  latestImportAt: string | null,
  connectionOk: boolean,
  importHealth: {
    hasRecentFailure: boolean;
    isStale: boolean;
  }
): HomeAssistantDerivedStatus {
  if (envReady && importHealth.hasRecentFailure) {
    return {
      status: "attention",
      statusLabel: "Failing",
      envReady,
      connectionPathLabel: connectionOk ? "Verified" : "Unavailable",
      nextStepTitle: "Import health needs attention.",
      nextStepBody:
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
      nextStepTitle: "Import freshness needs attention.",
      nextStepBody:
        "Plex is connected, but recent imports are older than expected for the configured sync interval."
    };
  }

  if (latestImportAt) {
    return {
      status: "ready",
      statusLabel: "Imported",
      envReady,
      connectionPathLabel: "Verified",
      nextStepTitle: "Expand from connectivity into repeat Plex imports.",
      nextStepBody:
        "Plex watch history has already landed. The next work should refine normalization and any later enrichment without changing the v1 history import path."
    };
  }

  if (envReady && connectionOk) {
    return {
      status: "ready",
      statusLabel: "Connected",
      envReady,
      connectionPathLabel: "Server token",
      nextStepTitle: "Start Plex history ingestion.",
      nextStepBody:
        "Plex connectivity is working. The next step is to import `/status/sessions/history/all` and store the raw history rows."
    };
  }

  if (envReady) {
    return {
      status: "attention",
      statusLabel: "Ready to verify",
      envReady,
      connectionPathLabel: "Server token",
      nextStepTitle: "Resolve connectivity checks.",
      nextStepBody:
        "The Plex env vars are present. The next step is to verify the server URL and token by calling the Plex history endpoint."
    };
  }

  return {
    status: "blocked",
    statusLabel: "Configuration required",
    envReady,
    connectionPathLabel: "Unknown",
    nextStepTitle: "Configure the Plex source.",
    nextStepBody:
      "Set PLEX_BASE_URL and PLEX_TOKEN in the env file so the app can authenticate to the Plex Media Server."
  };
}

export async function getSourceStatuses(): Promise<SourceStatus[]> {
  await ensureSourcesExist();
  const configResult = await readHomeAssistantConfig();
  const plexConfigResult = await readPlexConfig();
  const [homeAssistantConnectivity, plexConnectivity] = await Promise.all([
    checkHomeAssistantConnectivity(),
    checkPlexConnectivity()
  ]);

  const sourcesResult = await query<SourceRow>(
    `
      SELECT id, slug, display_name, source_kind
      FROM sources
      WHERE slug = ANY($1::text[])
      ORDER BY display_name ASC
    `,
    [sourceRegistry.map((source) => source.slug)]
  );

  const importsResult = await query<ImportRow>(
    `
      SELECT
        s.slug,
        latest.status AS latest_status,
        latest.started_at::text AS latest_started_at,
        latest.completed_at::text AS latest_completed_at,
        latest.error_message AS latest_error_message,
        latest_success.started_at::text AS latest_success_started_at,
        latest_success.completed_at::text AS latest_success_completed_at,
        latest_failed.started_at::text AS latest_failed_started_at,
        latest_failed.completed_at::text AS latest_failed_completed_at,
        latest_failed.error_message AS latest_failed_error_message
      FROM sources s
      LEFT JOIN LATERAL (
        SELECT status, started_at, completed_at, error_message
        FROM import_jobs
        WHERE source_id = s.id
        ORDER BY started_at DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT started_at, completed_at
        FROM import_jobs
        WHERE source_id = s.id
          AND status = 'completed'
        ORDER BY started_at DESC
        LIMIT 1
      ) latest_success ON true
      LEFT JOIN LATERAL (
        SELECT started_at, completed_at, error_message
        FROM import_jobs
        WHERE source_id = s.id
          AND status = 'failed'
        ORDER BY started_at DESC
        LIMIT 1
      ) latest_failed ON true
      WHERE s.slug = ANY($1::text[])
    `,
    [sourceRegistry.map((source) => source.slug)]
  );

  const importBySlug = new Map(importsResult.rows.map((row) => [row.slug, row]));

  return sourceRegistry.map((registrySource) => {
    const source = sourcesResult.rows.find((row) => row.slug === registrySource.slug);
    const latestImport = importBySlug.get(registrySource.slug) ?? null;
    const envReady = registrySource.expectedEnvVars.every((envVar) => Boolean(process.env[envVar]));
    const latestImportAt = latestImport?.latest_started_at ?? null;
    const isHomeAssistant = registrySource.slug === "home-assistant";
    const syncEnabled = isHomeAssistant
      ? configResult.ok
        ? configResult.config.sync.enabled
        : false
      : plexConfigResult.ok
        ? plexConfigResult.config.sync.enabled
        : false;
    const syncIntervalMinutes = isHomeAssistant
      ? configResult.ok
        ? configResult.config.sync.intervalMinutes
        : 30
      : plexConfigResult.ok
        ? plexConfigResult.config.sync.intervalMinutes
        : 30;
    const freshnessTime = latestImport?.latest_completed_at ?? latestImportAt;
    const nextSyncAt = syncEnabled && freshnessTime
      ? new Date(new Date(freshnessTime).getTime() + syncIntervalMinutes * 60 * 1000).toISOString()
      : null;
    const nextSyncLabel = syncEnabled
      ? nextSyncAt
        ? new Date(nextSyncAt).getTime() <= Date.now()
          ? "Due now"
          : formatNextSync(nextSyncAt)
        : "Waiting for first run"
      : "Disabled";

    const importHealth = {
      hasRecentFailure: hasLaterFailure(latestImport),
      isStale: isSourceStale(freshnessTime, syncEnabled, syncIntervalMinutes)
    };
    const lastSuccessLabel = latestImport?.latest_success_started_at
      ? formatLatestImport(latestImport.latest_success_started_at)
      : "Never";
    const lastFailureLabel = latestImport?.latest_failed_started_at
      ? formatLatestImport(latestImport.latest_failed_started_at)
      : "None";
    const recoveryLabel = getRecoveryLabel(latestImport);

    const configuredItems = isHomeAssistant
      ? configResult.ok
        ? configResult.config.entities
        : []
      : getPlexBaseUrl()
        ? [getPlexBaseUrl()!, "/status/sessions/history/all"]
        : [];

    const connectionDetails = isHomeAssistant
      ? homeAssistantConnectivity.ok
        ? [
            `API: ${homeAssistantConnectivity.apiMessage}`,
            `Base URL: ${homeAssistantConnectivity.baseUrl}`,
            ...homeAssistantConnectivity.entityChecks.map((entityCheck) =>
              entityCheck.exists
                ? `${entityCheck.entityId}: ${entityCheck.state ?? "unknown"}`
                : `${entityCheck.entityId}: not found`
            )
          ]
        : [
            homeAssistantConnectivity.baseUrl
              ? `Base URL: ${homeAssistantConnectivity.baseUrl}`
              : "Base URL: not configured",
            `Check: ${homeAssistantConnectivity.message}`
          ]
      : plexConnectivity.ok
        ? [
            plexConnectivity.serverName
              ? `Server: ${plexConnectivity.serverName}`
              : "Server: reachable",
            `Base URL: ${plexConnectivity.baseUrl}`,
            `History endpoint: /status/sessions/history/all`,
            `Sample rows returned: ${plexConnectivity.historyCount}`,
            plexConnectivity.latestViewedAt
              ? `Latest history row: ${formatLatestImport(new Date(plexConnectivity.latestViewedAt * 1000).toISOString())}`
              : "Latest history row: none yet"
          ]
        : [
            plexConnectivity.baseUrl ? `Base URL: ${plexConnectivity.baseUrl}` : "Base URL: not configured",
            `Check: ${plexConnectivity.message}`
          ];

    if (latestImport?.latest_success_started_at) {
      connectionDetails.push(
        `Last successful import: ${formatLatestImport(latestImport.latest_success_started_at)}`
      );
    }

    if (latestImport?.latest_failed_started_at && importHealth.hasRecentFailure) {
      connectionDetails.push(
        `Last failed import: ${formatLatestImport(latestImport.latest_failed_started_at)}`
      );
      connectionDetails.push(
        `Failure: ${formatRelativeFailure(latestImport.latest_failed_error_message)}`
      );
    } else if (importHealth.isStale && freshnessTime) {
      connectionDetails.push(
        `Import freshness: older than expected for the ${syncIntervalMinutes} min sync interval`
      );
    }

    const derivedStatus = isHomeAssistant
      ? getHomeAssistantStatus(
          configResult.ok,
          envReady,
          latestImportAt,
          homeAssistantConnectivity.ok,
          importHealth
        )
      : getPlexStatus(envReady, latestImportAt, plexConnectivity.ok, importHealth);
    const healthLabel =
      derivedStatus.status === "attention" && importHealth.hasRecentFailure
        ? "Recent import failure"
        : derivedStatus.status === "attention" && importHealth.isStale
          ? "Import overdue"
          : derivedStatus.status === "blocked"
            ? "Configuration blocked"
            : latestImport?.latest_status === "completed"
              ? "Healthy"
              : "Not imported yet";
    const healthDetail =
      importHealth.hasRecentFailure
        ? formatRelativeFailure(latestImport?.latest_failed_error_message ?? null)
        : importHealth.isStale
          ? `No completed import within the expected ${syncIntervalMinutes} minute sync window.`
          : recoveryLabel
            ? `${recoveryLabel}.`
            : latestImport?.latest_status === "completed"
              ? "Recent imports are landing normally."
              : "This source has not completed an import yet.";

    return {
      slug: registrySource.slug,
      displayName: source?.display_name ?? registrySource.displayName,
      kindLabel: registrySource.kindLabel,
      description: registrySource.description,
      expectedEnvVars: [...registrySource.expectedEnvVars],
      latestImportLabel: latestImport
        ? `${formatLatestImport(latestImport.latest_started_at ?? latestImportAt)} (${latestImport.latest_status})`
        : "Never",
      healthLabel,
      healthDetail,
      lastSuccessLabel,
      lastFailureLabel,
      recoveryLabel,
      configStatusLabel: isHomeAssistant
        ? configResult.ok
          ? "Configured"
          : "Missing or invalid"
        : plexConfigResult.ok
          ? "Configured"
          : "Missing or invalid",
      configuredItems,
      connectionDetails,
      syncEnabled,
      syncIntervalMinutes,
      syncStatusLabel: syncEnabled ? "Enabled" : "Disabled",
      nextSyncLabel,
      ...derivedStatus
    };
  });
}

export async function getSourceHealthNotice() {
  const sources = await getSourceStatuses();
  const affected = sources.filter(
    (source) =>
      source.status !== "ready" &&
      (source.syncEnabled || source.latestImportLabel !== "Never")
  );

  if (affected.length === 0) {
    return null;
  }

  const labels = affected.slice(0, 2).map((source) => `${source.displayName}: ${source.statusLabel}`);
  const extra = affected.length > 2 ? ` +${affected.length - 2} more` : "";

  return {
    title:
      affected.length === 1
        ? `${affected[0].displayName} needs attention`
        : `${affected.length} sources need attention`,
    body: `${labels.join(" · ")}${extra}. Imports will retry on the next interval when sync is enabled. Check Sources for details.`
  };
}
