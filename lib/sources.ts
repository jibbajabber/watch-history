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
  started_at: string;
  status: string;
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

type HomeAssistantDerivedStatus = Omit<
  SourceStatus,
  | "slug"
  | "displayName"
  | "kindLabel"
  | "description"
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
  connectionOk: boolean
): HomeAssistantDerivedStatus {
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
  connectionOk: boolean
): HomeAssistantDerivedStatus {
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

  const importsResult = await query<ImportRow & { slug: string }>(
    `
      SELECT
        s.slug,
        ij.started_at::text,
        ij.status
      FROM import_jobs ij
      INNER JOIN sources s ON s.id = ij.source_id
      INNER JOIN (
        SELECT source_id, MAX(started_at) AS max_started_at
        FROM import_jobs
        GROUP BY source_id
      ) latest
        ON latest.source_id = ij.source_id
       AND latest.max_started_at = ij.started_at
      WHERE s.slug = ANY($1::text[])
    `,
    [sourceRegistry.map((source) => source.slug)]
  );

  const importBySlug = new Map(importsResult.rows.map((row) => [row.slug, row]));

  return sourceRegistry.map((registrySource) => {
    const source = sourcesResult.rows.find((row) => row.slug === registrySource.slug);
    const latestImport = importBySlug.get(registrySource.slug) ?? null;
    const envReady = registrySource.expectedEnvVars.every((envVar) => Boolean(process.env[envVar]));
    const latestImportAt = latestImport?.started_at ?? null;
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
    const nextSyncAt = syncEnabled && latestImportAt
      ? new Date(new Date(latestImportAt).getTime() + syncIntervalMinutes * 60 * 1000).toISOString()
      : null;
    const nextSyncLabel = syncEnabled
      ? nextSyncAt
        ? new Date(nextSyncAt).getTime() <= Date.now()
          ? "Due now"
          : formatNextSync(nextSyncAt)
        : "Waiting for first run"
      : "Disabled";

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

    const derivedStatus = isHomeAssistant
      ? getHomeAssistantStatus(
          configResult.ok,
          envReady,
          latestImportAt,
          homeAssistantConnectivity.ok
        )
      : getPlexStatus(envReady, latestImportAt, plexConnectivity.ok);

    return {
      slug: registrySource.slug,
      displayName: source?.display_name ?? registrySource.displayName,
      kindLabel: registrySource.kindLabel,
      description: registrySource.description,
      expectedEnvVars: [...registrySource.expectedEnvVars],
      latestImportLabel: latestImport
        ? `${formatLatestImport(latestImport.started_at)} (${latestImport.status})`
        : "Never",
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
