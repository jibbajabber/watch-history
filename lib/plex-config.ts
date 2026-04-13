import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const configDirectory = path.join(process.cwd(), "configs");
const configPath = path.join(configDirectory, "plex.yaml");
const configExamplePath = path.join(configDirectory, "plex.yaml.example");

type ParsedPlexConfig = {
  sync?: {
    enabled?: unknown;
    interval_minutes?: unknown;
  };
};

export type PlexConfig = {
  sync: {
    enabled: boolean;
    intervalMinutes: number;
  };
};

function parseConfigDocument(raw: string): PlexConfig {
  const parsed = YAML.parse(raw) as ParsedPlexConfig | null;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Plex config must be a YAML object.");
  }

  const intervalValue = parsed.sync?.interval_minutes;
  const intervalMinutes =
    typeof intervalValue === "number" && Number.isFinite(intervalValue) && intervalValue > 0
      ? Math.floor(intervalValue)
      : 30;

  return {
    sync: {
      enabled: parsed.sync?.enabled === true,
      intervalMinutes
    }
  };
}

export async function readPlexConfig() {
  try {
    const raw = await readFile(configPath, "utf8");
    const config = parseConfigDocument(raw);

    return {
      ok: true as const,
      path: configPath,
      config
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown config error";

    if (message.includes("ENOENT")) {
      return {
        ok: false as const,
        path: configPath,
        examplePath: configExamplePath,
        reason: "missing" as const,
        message: "Create configs/plex.yaml from configs/plex.yaml.example."
      };
    }

    return {
      ok: false as const,
      path: configPath,
      examplePath: configExamplePath,
      reason: "invalid" as const,
      message
    };
  }
}

export async function writePlexConfig(config: PlexConfig) {
  const serialized = YAML.stringify({
    sync: {
      enabled: config.sync.enabled,
      interval_minutes: config.sync.intervalMinutes
    }
  });

  await writeFile(configPath, serialized, "utf8");
}
