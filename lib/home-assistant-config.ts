import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";

const configDirectory = path.join(process.cwd(), "configs");
const configPath = path.join(configDirectory, "home-assistant.yaml");
const configExamplePath = path.join(configDirectory, "home-assistant.yaml.example");

type ParsedHomeAssistantConfig = {
  base_url?: unknown;
  entities?: unknown;
  sync?: {
    enabled?: unknown;
    interval_minutes?: unknown;
  };
};

export type HomeAssistantConfig = {
  baseUrl: string;
  entities: string[];
  sync: {
    enabled: boolean;
    intervalMinutes: number;
  };
};

function normalizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function parseConfigDocument(raw: string): HomeAssistantConfig {
  const parsed = YAML.parse(raw) as ParsedHomeAssistantConfig | null;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Home Assistant config must be a YAML object.");
  }

  if (typeof parsed.base_url !== "string" || parsed.base_url.trim() === "") {
    throw new Error("Home Assistant config requires a non-empty base_url string.");
  }

  if (!Array.isArray(parsed.entities) || parsed.entities.length === 0) {
    throw new Error("Home Assistant config requires at least one entity in entities.");
  }

  const entities = parsed.entities.map((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error("Each Home Assistant entity must be a non-empty string.");
    }

    return value.trim();
  });

  const intervalValue = parsed.sync?.interval_minutes;
  const intervalMinutes =
    typeof intervalValue === "number" && Number.isFinite(intervalValue) && intervalValue > 0
      ? Math.floor(intervalValue)
      : 30;

  return {
    baseUrl: normalizeBaseUrl(parsed.base_url.trim()),
    entities,
    sync: {
      enabled: parsed.sync?.enabled === true,
      intervalMinutes
    }
  };
}

export async function readHomeAssistantConfig() {
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
        message: "Create configs/home-assistant.yaml from configs/home-assistant.yaml.example."
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

export async function writeHomeAssistantConfig(config: HomeAssistantConfig) {
  const serialized = YAML.stringify({
    base_url: config.baseUrl,
    entities: config.entities,
    sync: {
      enabled: config.sync.enabled,
      interval_minutes: config.sync.intervalMinutes
    }
  });

  await writeFile(configPath, serialized, "utf8");
}
