export type PlexHistoryItem = {
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

export type PlexSessionItem = {
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

export type PersistedPlexRawRow = {
  id: string;
  source_record_id: string;
  imported_at: string;
  payload: PlexHistoryItem | PlexSessionItem;
};

export type NormalizedPlexWatch = {
  rawImportRecordId: string | null;
  title: string;
  mediaType: string | null;
  watchedAt: string;
  durationMinutes: number | null;
  metadata: Record<string, unknown>;
};

const recentHistoryMatchWindowMs = 12 * 60 * 60 * 1000;

export function buildNormalizedTitle(item: PlexHistoryItem | PlexSessionItem) {
  if (item.type === "episode" && item.grandparentTitle && item.title) {
    const season = typeof item.parentIndex === "number" ? `S${String(item.parentIndex).padStart(2, "0")}` : null;
    const episode = typeof item.index === "number" ? `E${String(item.index).padStart(2, "0")}` : null;
    const code = season && episode ? `${season}${episode}` : null;

    return code
      ? `${item.grandparentTitle} · ${code} · ${item.title}`
      : `${item.grandparentTitle} · ${item.title}`;
  }

  return item.title?.trim() || item.grandparentTitle?.trim() || item.ratingKey || "Unknown Plex item";
}

export function formatProgressLabel(viewOffsetMs: number | null, durationMs: number | null) {
  if (
    typeof viewOffsetMs !== "number" ||
    typeof durationMs !== "number" ||
    viewOffsetMs <= 0 ||
    durationMs <= 0
  ) {
    return null;
  }

  const watchedMinutes = Math.max(1, Math.round(viewOffsetMs / 60000));
  const totalMinutes = Math.max(1, Math.round(durationMs / 60000));
  const percent = Math.max(1, Math.min(99, Math.round((viewOffsetMs / durationMs) * 100)));

  return `${watchedMinutes} of ${totalMinutes} min (${percent}%)`;
}

export function buildSessionContentKey(item: PlexSessionItem) {
  return [
    item.ratingKey ?? "no-rating-key",
    item.key ?? "no-key",
    item.grandparentKey ?? "no-grandparent-key",
    item.parentKey ?? "no-parent-key",
    item.type ?? "no-type",
    buildNormalizedTitle(item)
  ].join("::");
}

export function makeSessionSourceRecordId(item: PlexSessionItem, importedAt: string) {
  return `session::${buildSessionContentKey(item)}::${importedAt}`;
}

export function normalizeHistoryItem(
  item: PlexHistoryItem,
  rawImportRecordId: string | null = null
): NormalizedPlexWatch | null {
  if (!item.historyKey || typeof item.viewedAt !== "number") {
    return null;
  }

  return {
    rawImportRecordId,
    title: buildNormalizedTitle(item),
    mediaType: typeof item.type === "string" ? item.type : null,
    watchedAt: new Date(item.viewedAt * 1000).toISOString(),
    durationMinutes: null,
    metadata: {
      history_key: item.historyKey,
      plex_key: item.key ?? null,
      rating_key: item.ratingKey ?? null,
      library_section_id: item.librarySectionID ?? null,
      account_id: item.accountID ?? null,
      device_id: item.deviceID ?? null,
      parent_key: item.parentKey ?? null,
      grandparent_key: item.grandparentKey ?? null,
      grandparent_title: item.grandparentTitle ?? null,
      originally_available_at: item.originallyAvailableAt ?? null,
      is_provisional: false,
      normalized_from: "plex_history",
      attributes: item
    }
  };
}

export function normalizeSessionItem(
  item: PlexSessionItem,
  observedAt: string,
  statusLabel: string,
  progressLabel: string | null,
  rawImportRecordId: string | null = null
): NormalizedPlexWatch | null {
  const sessionId = item.Session?.id;

  if (!sessionId) {
    return null;
  }

  return {
    rawImportRecordId,
    title: buildNormalizedTitle(item),
    mediaType: typeof item.type === "string" ? item.type : null,
    watchedAt: observedAt,
    durationMinutes: null,
    metadata: {
      session_id: sessionId,
      plex_key: item.key ?? null,
      rating_key: item.ratingKey ?? null,
      account_id: item.User?.id ?? null,
      user_title: item.User?.title ?? null,
      device_label: item.Player?.title ?? item.Player?.product ?? null,
      player_product: item.Player?.product ?? null,
      player_platform: item.Player?.platform ?? null,
      player_state: item.Player?.state ?? null,
      view_offset_ms: item.viewOffset ?? null,
      duration_ms: item.duration ?? null,
      parent_key: item.parentKey ?? null,
      grandparent_key: item.grandparentKey ?? null,
      grandparent_title: item.grandparentTitle ?? null,
      progress_label: progressLabel,
      status_label: statusLabel,
      is_provisional: true,
      normalized_from: "plex_session",
      attributes: item
    }
  };
}

export function shouldIncludeActiveSession(
  session: PlexSessionItem,
  history: PlexHistoryItem[],
  importedAt: string
) {
  const ratingKey = session.ratingKey;

  if (!ratingKey) {
    return true;
  }

  const importedAtMs = new Date(importedAt).getTime();

  return !history.some((item) => {
    if (item.ratingKey !== ratingKey || typeof item.viewedAt !== "number") {
      return false;
    }

    const viewedAtMs = item.viewedAt * 1000;
    return importedAtMs - viewedAtMs < 6 * 60 * 60 * 1000;
  });
}

export function sessionMatchesRecentHistory(
  session: PlexSessionItem,
  observedAt: string,
  history: PlexHistoryItem[]
) {
  const observedAtMs = new Date(observedAt).getTime();

  return history.some((item) => {
    if (typeof item.viewedAt !== "number") {
      return false;
    }

    const sameRatingKey =
      Boolean(session.ratingKey) &&
      Boolean(item.ratingKey) &&
      session.ratingKey === item.ratingKey;
    const sameKey =
      Boolean(session.key) &&
      Boolean(item.key) &&
      session.key === item.key;

    if (!sameRatingKey && !sameKey) {
      return false;
    }

    const viewedAtMs = item.viewedAt * 1000;
    return Math.abs(observedAtMs - viewedAtMs) <= recentHistoryMatchWindowMs;
  });
}

export function findReusableSessionRecordId(
  session: PlexSessionItem,
  sessionRows: PersistedPlexRawRow[],
  history: PlexHistoryItem[]
) {
  const contentKey = buildSessionContentKey(session);

  const match = sessionRows.find((row) => {
    const payload = row.payload as PlexSessionItem;

    return (
      buildSessionContentKey(payload) === contentKey &&
      !sessionMatchesRecentHistory(payload, row.imported_at, history)
    );
  });

  return match?.source_record_id ?? null;
}
