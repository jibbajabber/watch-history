import { checkHomeAssistantConnectivity } from "@/lib/home-assistant";
import { readHomeAssistantConfig } from "@/lib/home-assistant-config";
import { readPlexConfig } from "@/lib/plex-config";
import { checkPlexConnectivity, getPlexBaseUrl } from "@/lib/plex";
import { query } from "@/lib/db";
import { summarizeSourceRetention } from "@/lib/source-retention";
import {
  formatLatestImport,
  formatNextSync,
  formatRelativeFailure,
  getHomeAssistantStatus,
  getPlexStatus,
  getRecoveryLabel,
  hasLaterFailure,
  isSourceStale,
  type ImportRow
} from "@/lib/source-status";
import type { SourceStatus } from "@/lib/types";

type SourceRow = {
  id: string;
  slug: string;
  display_name: string;
  source_kind: string;
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
    const retentionConfig = isHomeAssistant
      ? configResult.ok
        ? configResult.config.retention
        : {
            mode: "indefinite" as const,
            historyDays: null,
            importJobDays: null,
            provisionalHours: null
          }
      : plexConfigResult.ok
        ? plexConfigResult.config.retention
        : {
            mode: "indefinite" as const,
            historyDays: null,
            importJobDays: null,
            provisionalHours: null
          };
    const retentionSummary = summarizeSourceRetention(retentionConfig, {
      supportsProvisional: !isHomeAssistant
    });
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
      retentionModeLabel: retentionSummary.modeLabel,
      retentionSummaryLabel: retentionSummary.summaryLabel,
      retentionDetail: retentionSummary.detail,
      retentionHistoryDays: retentionConfig.historyDays,
      retentionImportJobDays: retentionConfig.importJobDays,
      retentionProvisionalHours: retentionConfig.provisionalHours,
      retentionSupportsProvisional: !isHomeAssistant,
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
