import { getKnownChannelKey } from "@/lib/channels";

export type HomeAssistantHistoryState = {
  entity_id: string;
  state: string;
  last_changed?: string;
  last_reported?: string;
  last_updated?: string;
  attributes?: Record<string, unknown>;
};

export type NormalizedSession = {
  entityId: string;
  title: string;
  mediaType: string | null;
  channel: string | null;
  watchedAt: string;
  durationMinutes: number | null;
  metadata: Record<string, unknown>;
};

const ignoredStates = new Set([
  "off",
  "idle",
  "standby",
  "unavailable",
  "unknown",
  "None",
  "none"
]);

const resumableStates = new Set(["playing", "paused", "buffering"]);
const sessionGapMs = 30 * 60 * 1000;

export function coerceText(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function pickFirstText(attributes: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = coerceText(attributes[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

export function buildTitle(state: HomeAssistantHistoryState) {
  const attributes = state.attributes ?? {};
  const primary =
    pickFirstText(attributes, [
      "media_series_title",
      "series_title",
      "programme_title",
      "program_title",
      "title",
      "episode_title",
      "media_title",
      "friendly_name"
    ]) ?? state.entity_id;
  const secondary = pickFirstText(attributes, ["episode", "episode_title"]);

  return secondary && secondary !== primary ? `${primary} · ${secondary}` : primary;
}

export function hasMeaningfulProgrammeMetadata(state: HomeAssistantHistoryState) {
  const attributes = state.attributes ?? {};

  return Boolean(
    pickFirstText(attributes, [
      "media_series_title",
      "series_title",
      "programme_title",
      "program_title",
      "title",
      "episode",
      "episode_title",
      "media_title"
    ])
  );
}

export function getMediaType(state: HomeAssistantHistoryState) {
  const attributes = state.attributes ?? {};
  return pickFirstText(attributes, ["media_content_type", "content_type"]);
}

export function getChannel(state: HomeAssistantHistoryState) {
  const attributes = state.attributes ?? {};
  return pickFirstText(attributes, ["media_channel", "channel", "channel_name", "media_title"]);
}

export function getStateTimestamp(state: HomeAssistantHistoryState) {
  return state.last_reported ?? state.last_updated ?? state.last_changed ?? null;
}

export function isMeaningfulWatchState(state: HomeAssistantHistoryState) {
  const stateValue = state.state;

  if (ignoredStates.has(stateValue)) {
    return false;
  }

  if (!getStateTimestamp(state)) {
    return false;
  }

  return hasMeaningfulProgrammeMetadata(state) &&
    (stateValue === "playing" || stateValue === "paused" || stateValue === "buffering");
}

export function makeSourceRecordId(state: HomeAssistantHistoryState) {
  const timestamp = getStateTimestamp(state);
  return [state.entity_id, timestamp ?? "no-timestamp", state.state].join("::");
}

export function sortStatesChronologically(states: HomeAssistantHistoryState[]) {
  return [...states].sort((left, right) => {
    const leftTime = getStateTimestamp(left) ?? "";
    const rightTime = getStateTimestamp(right) ?? "";
    return leftTime.localeCompare(rightTime);
  });
}

function finalizeSession(
  sessions: NormalizedSession[],
  session: {
    entityId: string;
    title: string;
    mediaType: string | null;
    channel: string | null;
    startedAt: string;
    endedAt: string;
    states: string[];
    attributes: Record<string, unknown>;
  } | null
) {
  if (!session) {
    return;
  }

  const durationMs = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
  const durationMinutes = durationMs > 0 ? Math.max(1, Math.ceil(durationMs / 60000)) : null;

  sessions.push({
    entityId: session.entityId,
    title: session.title,
    mediaType: session.mediaType,
    channel: session.channel,
    watchedAt: session.startedAt,
    durationMinutes,
    metadata: {
      entity_id: session.entityId,
      channel: session.channel,
      channel_key: getKnownChannelKey(session.channel),
      normalized_from: "home_assistant_session",
      states: session.states,
      attributes: session.attributes
    }
  });
}

export function normalizeHistoryToSessions(historyGroups: HomeAssistantHistoryState[][]) {
  const sessions: NormalizedSession[] = [];

  for (const entityHistory of historyGroups) {
    const states = sortStatesChronologically(entityHistory);
    let currentSession:
      | {
          entityId: string;
          title: string;
          mediaType: string | null;
          channel: string | null;
          startedAt: string;
          endedAt: string;
          states: string[];
          attributes: Record<string, unknown>;
        }
      | null = null;

    for (const state of states) {
      const timestamp = getStateTimestamp(state);

      if (!timestamp) {
        continue;
      }

      if (!isMeaningfulWatchState(state)) {
        finalizeSession(sessions, currentSession);
        currentSession = null;
        continue;
      }

      const title = buildTitle(state);
      const mediaType = getMediaType(state);
      const channel = getChannel(state);
      const stateTime = new Date(timestamp).getTime();
      const isResumable = resumableStates.has(state.state);

      if (!currentSession) {
        currentSession = {
          entityId: state.entity_id,
          title,
          mediaType,
          channel,
          startedAt: timestamp,
          endedAt: timestamp,
          states: [state.state],
          attributes: state.attributes ?? {}
        };
        continue;
      }

      const currentEnd = new Date(currentSession.endedAt).getTime();
      const sameProgram =
        currentSession.entityId === state.entity_id &&
        currentSession.title === title &&
        currentSession.mediaType === mediaType;
      const withinGap = stateTime - currentEnd <= sessionGapMs;

      if (sameProgram && withinGap && isResumable) {
        currentSession.endedAt = timestamp;
        currentSession.states = Array.from(new Set([...currentSession.states, state.state]));
        currentSession.attributes = state.attributes ?? currentSession.attributes;
        continue;
      }

      finalizeSession(sessions, currentSession);
      currentSession = {
        entityId: state.entity_id,
        title,
        mediaType,
        channel,
        startedAt: timestamp,
        endedAt: timestamp,
        states: [state.state],
        attributes: state.attributes ?? {}
      };
    }

    finalizeSession(sessions, currentSession);
  }

  return sessions;
}
