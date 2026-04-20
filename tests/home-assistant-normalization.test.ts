import {
  buildTitle,
  getChannel,
  getMediaType,
  getStateTimestamp,
  isMeaningfulWatchState,
  makeSourceRecordId,
  normalizeHistoryToSessions,
  pickFirstText,
  sortStatesChronologically,
  type HomeAssistantHistoryState
} from "@/lib/home-assistant-normalization";

describe("home assistant normalization helpers", () => {
  it("picks the first non-empty text attribute and derives title/channel/media type", () => {
    const state: HomeAssistantHistoryState = {
      entity_id: "media_player.sky_q_livingroom",
      state: "playing",
      last_changed: "2026-04-18T20:00:00.000Z",
      attributes: {
        media_series_title: "Doctor Who",
        episode_title: "Blink",
        media_channel: "BBC One HD",
        media_content_type: "episode"
      }
    };

    expect(pickFirstText(state.attributes ?? {}, ["missing", "media_series_title"])).toBe("Doctor Who");
    expect(buildTitle(state)).toBe("Doctor Who · Blink");
    expect(getChannel(state)).toBe("BBC One HD");
    expect(getMediaType(state)).toBe("episode");
  });

  it("identifies meaningful watch states and builds record ids from timestamps", () => {
    const meaningful: HomeAssistantHistoryState = {
      entity_id: "media_player.sky_q_livingroom",
      state: "playing",
      last_reported: "2026-04-18T20:00:00.000Z",
      attributes: { media_title: "Match of the Day" }
    };
    const ignored: HomeAssistantHistoryState = {
      entity_id: "media_player.sky_q_livingroom",
      state: "idle",
      last_changed: "2026-04-18T20:10:00.000Z",
      attributes: { media_title: "Match of the Day" }
    };

    expect(getStateTimestamp(meaningful)).toBe("2026-04-18T20:00:00.000Z");
    expect(isMeaningfulWatchState(meaningful)).toBe(true);
    expect(isMeaningfulWatchState(ignored)).toBe(false);
    expect(makeSourceRecordId(meaningful)).toBe(
      "media_player.sky_q_livingroom::2026-04-18T20:00:00.000Z::playing"
    );
  });

  it("sorts state history and groups resumable states into one normalized session", () => {
    const history = sortStatesChronologically([
      {
        entity_id: "media_player.sky_q_livingroom",
        state: "paused",
        last_changed: "2026-04-18T20:20:00.000Z",
        attributes: {
          media_series_title: "Doctor Who",
          episode_title: "Blink",
          media_channel: "BBC One HD",
          media_content_type: "episode"
        }
      },
      {
        entity_id: "media_player.sky_q_livingroom",
        state: "playing",
        last_changed: "2026-04-18T20:00:00.000Z",
        attributes: {
          media_series_title: "Doctor Who",
          episode_title: "Blink",
          media_channel: "BBC One HD",
          media_content_type: "episode"
        }
      },
      {
        entity_id: "media_player.sky_q_livingroom",
        state: "off",
        last_changed: "2026-04-18T20:31:00.000Z",
        attributes: {}
      }
    ]);

    expect(history.map((state) => state.state)).toEqual(["playing", "paused", "off"]);

    expect(normalizeHistoryToSessions([history])).toEqual([
      {
        entityId: "media_player.sky_q_livingroom",
        title: "Doctor Who · Blink",
        mediaType: "episode",
        channel: "BBC One HD",
        watchedAt: "2026-04-18T20:00:00.000Z",
        durationMinutes: 20,
        metadata: {
          entity_id: "media_player.sky_q_livingroom",
          channel: "BBC One HD",
          channel_key: "bbc-one",
          normalized_from: "home_assistant_session",
          states: ["playing", "paused"],
          attributes: {
            media_series_title: "Doctor Who",
            episode_title: "Blink",
            media_channel: "BBC One HD",
            media_content_type: "episode"
          }
        }
      }
    ]);
  });

  it("splits sessions when the programme changes on the same entity", () => {
    const history: HomeAssistantHistoryState[] = [
      {
        entity_id: "media_player.sky_q_livingroom",
        state: "playing",
        last_changed: "2026-04-18T20:00:00.000Z",
        attributes: { media_title: "News at Six", media_channel: "BBC One" }
      },
      {
        entity_id: "media_player.sky_q_livingroom",
        state: "playing",
        last_changed: "2026-04-18T20:35:00.000Z",
        attributes: { media_title: "The One Show", media_channel: "BBC One" }
      }
    ];

    expect(normalizeHistoryToSessions([history]).map((session) => session.title)).toEqual([
      "News at Six",
      "The One Show"
    ]);
  });
});
