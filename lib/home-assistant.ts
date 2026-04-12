import { readFile } from "node:fs/promises";
import path from "node:path";
import { Agent } from "undici";
import { readHomeAssistantConfig } from "@/lib/home-assistant-config";

export type HomeAssistantConnectivityResult =
  | {
      ok: true;
      baseUrl: string;
      entities: string[];
      checkedAt: string;
      apiMessage: string;
      entityChecks: Array<{
        entityId: string;
        exists: boolean;
        state: string | null;
      }>;
    }
  | {
      ok: false;
      code:
        | "config_missing"
        | "config_invalid"
        | "token_missing"
        | "network_error"
        | "unauthorized"
        | "api_error";
      message: string;
      baseUrl: string | null;
      entities: string[];
    };

type HomeAssistantApiState = {
  entity_id: string;
  state: string;
};

const caCertPath = path.join(process.cwd(), "configs", "home-assistant-ca.crt");

function getAccessToken() {
  const token = process.env.HOME_ASSISTANT_ACCESS_TOKEN;

  if (!token) {
    return null;
  }

  return token.trim() || null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const cause = error.cause;

    if (cause && typeof cause === "object") {
      const code =
        "code" in cause && typeof cause.code === "string" ? cause.code : null;
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

  return "Failed to reach Home Assistant.";
}

function getNetworkHint(message: string) {
  const lowered = message.toLowerCase();

  if (
    lowered.includes("self-signed") ||
    lowered.includes("unable to verify the first certificate") ||
    lowered.includes("self signed certificate") ||
    lowered.includes("certificate")
  ) {
    return "TLS verification failed. The container likely does not trust your Home Assistant CA yet.";
  }

  if (lowered.includes("enotfound")) {
    return "DNS resolution failed. Check the Home Assistant hostname in configs/home-assistant.yaml.";
  }

  if (lowered.includes("econnrefused")) {
    return "Connection was refused. Check the Home Assistant URL, port, and whether it is reachable from the container.";
  }

  if (lowered.includes("etimedout") || lowered.includes("headers timeout")) {
    return "Connection timed out. Check network reachability between the container and Home Assistant.";
  }

  return null;
}

async function fetchJson(url: string, token: string) {
  let dispatcher: Agent | undefined;

  try {
    const ca = await readFile(caCertPath, "utf8");

    dispatcher = new Agent({
      connect: {
        ca
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!message.includes("ENOENT")) {
      throw error;
    }
  }

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(3000),
    cache: "no-store",
    dispatcher
  });
}

export async function fetchHomeAssistant(url: string, token: string, timeoutMs = 3000) {
  let dispatcher: Agent | undefined;

  try {
    const ca = await readFile(caCertPath, "utf8");

    dispatcher = new Agent({
      connect: {
        ca
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (!message.includes("ENOENT")) {
      throw error;
    }
  }

  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
    dispatcher
  });
}

export async function checkHomeAssistantConnectivity(): Promise<HomeAssistantConnectivityResult> {
  const configResult = await readHomeAssistantConfig();

  if (!configResult.ok) {
    return {
      ok: false,
      code: configResult.reason === "missing" ? "config_missing" : "config_invalid",
      message: configResult.message,
      baseUrl: null,
      entities: []
    };
  }

  const token = getAccessToken();

  if (!token) {
    return {
      ok: false,
      code: "token_missing",
      message: "HOME_ASSISTANT_ACCESS_TOKEN is not configured.",
      baseUrl: configResult.config.baseUrl,
      entities: configResult.config.entities
    };
  }

  try {
    const apiResponse = await fetchJson(`${configResult.config.baseUrl}/api/`, token);

    if (apiResponse.status === 401) {
      return {
        ok: false,
        code: "unauthorized",
        message: "Home Assistant rejected the supplied access token.",
        baseUrl: configResult.config.baseUrl,
        entities: configResult.config.entities
      };
    }

    if (!apiResponse.ok) {
      return {
        ok: false,
        code: "api_error",
        message: `Home Assistant API check failed with status ${apiResponse.status}.`,
        baseUrl: configResult.config.baseUrl,
        entities: configResult.config.entities
      };
    }

    const apiPayload = (await apiResponse.json()) as { message?: string };

    const entityChecks = await Promise.all(
      configResult.config.entities.map(async (entityId) => {
        const response = await fetchJson(
          `${configResult.config.baseUrl}/api/states/${encodeURIComponent(entityId)}`,
          token
        );

        if (response.status === 404) {
          return {
            entityId,
            exists: false,
            state: null
          };
        }

        if (!response.ok) {
          throw new Error(`Entity check failed for ${entityId} with status ${response.status}.`);
        }

        const payload = (await response.json()) as HomeAssistantApiState;

        return {
          entityId,
          exists: true,
          state: payload.state
        };
      })
    );

    return {
      ok: true,
      baseUrl: configResult.config.baseUrl,
      entities: configResult.config.entities,
      checkedAt: new Date().toISOString(),
      apiMessage: apiPayload.message ?? "API reachable",
      entityChecks
    };
  } catch (error) {
    const message = getErrorMessage(error);
    const hint = getNetworkHint(message);

    return {
      ok: false,
      code: "network_error",
      message: hint ? `${message} ${hint}` : message,
      baseUrl: configResult.config.baseUrl,
      entities: configResult.config.entities
    };
  }
}
