type PlexFetchOptions = {
  timeoutMs?: number;
};

type PlexHistoryMetadata = {
  historyKey?: string;
  key?: string;
  ratingKey?: string;
  librarySectionID?: string;
  parentKey?: string;
  grandparentKey?: string;
  title?: string;
  grandparentTitle?: string;
  type?: string;
  index?: number;
  parentIndex?: number;
  originallyAvailableAt?: string;
  viewedAt?: number;
  accountID?: number;
  deviceID?: number | string;
};

type PlexSessionMetadata = {
  sessionKey?: string;
  key?: string;
  ratingKey?: string;
  parentKey?: string;
  grandparentKey?: string;
  title?: string;
  grandparentTitle?: string;
  type?: string;
  index?: number;
  parentIndex?: number;
  viewOffset?: number;
  duration?: number;
  Player?: {
    title?: string;
    product?: string;
    platform?: string;
    state?: string;
  };
  User?: {
    id?: number | string;
    title?: string;
  };
  Session?: {
    id?: string;
  };
};

type PlexHistoryResponse = {
  MediaContainer?: {
    Metadata?: PlexHistoryMetadata[];
    size?: number;
    title1?: string;
    friendlyName?: string;
    machineIdentifier?: string;
  };
};

type PlexSessionsResponse = {
  MediaContainer?: {
    Metadata?: PlexSessionMetadata[];
    size?: number;
  };
};

export type PlexConnectivityResult =
  | {
      ok: true;
      baseUrl: string;
      checkedAt: string;
      serverName: string | null;
      machineIdentifier: string | null;
      historyCount: number;
      latestViewedAt: number | null;
    }
  | {
      ok: false;
      code: "base_url_missing" | "token_missing" | "unauthorized" | "network_error" | "api_error";
      message: string;
      baseUrl: string | null;
    };

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getPlexBaseUrl() {
  const value = process.env.PLEX_BASE_URL;

  if (!value || value.trim() === "") {
    return null;
  }

  return normalizeBaseUrl(value.trim());
}

export function getPlexToken() {
  const value = process.env.PLEX_TOKEN;

  if (!value || value.trim() === "") {
    return null;
  }

  return value.trim();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const cause = error.cause;

    if (cause && typeof cause === "object") {
      const code = "code" in cause && typeof cause.code === "string" ? cause.code : null;
      const message =
        "message" in cause && typeof cause.message === "string" ? cause.message : null;

      if (code && message) {
        return `${error.message} (${code}: ${message})`;
      }

      if (message) {
        return `${error.message} (${message})`;
      }
    }

    return error.message;
  }

  return "Failed to reach Plex.";
}

function getNetworkHint(message: string) {
  const lowered = message.toLowerCase();

  if (lowered.includes("enotfound")) {
    return "DNS resolution failed. Check PLEX_BASE_URL.";
  }

  if (lowered.includes("econnrefused")) {
    return "Connection was refused. Check the Plex host, port, and whether it is reachable from the container.";
  }

  if (lowered.includes("etimedout") || lowered.includes("headers timeout")) {
    return "Connection timed out. Check network reachability between the container and Plex.";
  }

  return null;
}

export async function fetchPlex(
  path: string,
  { timeoutMs = 5000 }: PlexFetchOptions = {}
) {
  const baseUrl = getPlexBaseUrl();
  const token = getPlexToken();

  if (!baseUrl) {
    throw new Error("PLEX_BASE_URL is not configured.");
  }

  if (!token) {
    throw new Error("PLEX_TOKEN is not configured.");
  }

  const url = new URL(path, `${baseUrl}/`);

  return fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Plex-Token": token,
      "X-Plex-Product": "Watch History",
      "X-Plex-Client-Identifier": "watch-history"
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store"
  });
}

export async function fetchPlexHistory() {
  const response = await fetchPlex("/status/sessions/history/all?sort=viewedAt:desc", {
    timeoutMs: 15000
  });

  if (response.status === 401) {
    throw new Error("Plex rejected the supplied token.");
  }

  if (!response.ok) {
    throw new Error(`Plex history request failed with status ${response.status}.`);
  }

  return (await response.json()) as PlexHistoryResponse;
}

export async function fetchPlexSessions() {
  const response = await fetchPlex("/status/sessions", {
    timeoutMs: 10000
  });

  if (response.status === 401) {
    throw new Error("Plex rejected the supplied token.");
  }

  if (!response.ok) {
    throw new Error(`Plex sessions request failed with status ${response.status}.`);
  }

  return (await response.json()) as PlexSessionsResponse;
}

export async function checkPlexConnectivity(): Promise<PlexConnectivityResult> {
  const baseUrl = getPlexBaseUrl();

  if (!baseUrl) {
    return {
      ok: false,
      code: "base_url_missing",
      message: "PLEX_BASE_URL is not configured.",
      baseUrl: null
    };
  }

  if (!getPlexToken()) {
    return {
      ok: false,
      code: "token_missing",
      message: "PLEX_TOKEN is not configured.",
      baseUrl
    };
  }

  try {
    const payload = await fetchPlexHistory();
    const metadata = payload.MediaContainer?.Metadata ?? [];
    const latestViewedAt =
      metadata
        .map((row) => (typeof row.viewedAt === "number" ? row.viewedAt : null))
        .find((value) => value !== null) ?? null;

    return {
      ok: true,
      baseUrl,
      checkedAt: new Date().toISOString(),
      serverName: payload.MediaContainer?.friendlyName ?? payload.MediaContainer?.title1 ?? null,
      machineIdentifier: payload.MediaContainer?.machineIdentifier ?? null,
      historyCount: metadata.length,
      latestViewedAt
    };
  } catch (error) {
    const message = getErrorMessage(error);

    if (message.includes("rejected the supplied token")) {
      return {
        ok: false,
        code: "unauthorized",
        message: "Plex rejected the supplied token.",
        baseUrl
      };
    }

    if (message.includes("status")) {
      return {
        ok: false,
        code: "api_error",
        message,
        baseUrl
      };
    }

    const hint = getNetworkHint(message);

    return {
      ok: false,
      code: "network_error",
      message: hint ? `${message} ${hint}` : message,
      baseUrl
    };
  }
}
