"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runHomeAssistantImport } from "@/lib/home-assistant-import";
import { readHomeAssistantConfig, writeHomeAssistantConfig } from "@/lib/home-assistant-config";
import { readPlexConfig, writePlexConfig } from "@/lib/plex-config";
import { runPlexImport } from "@/lib/plex-import";
import {
  getDefaultSourceRetentionConfig,
  type SourceRetentionConfig
} from "@/lib/source-retention";

function getSourceDisplayName(slug: string) {
  if (slug === "home-assistant") {
    return "Home Assistant";
  }

  if (slug === "plex") {
    return "Plex";
  }

  return "Source";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "An unexpected error occurred.";
}

function redirectToSources(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);

  redirect(`/sources?${searchParams.toString()}`);
}

export async function importSourceHistory(formData: FormData) {
  const slug = String(formData.get("source_slug") ?? "");

  try {
    if (slug === "home-assistant") {
      await runHomeAssistantImport();
    } else if (slug === "plex") {
      await runPlexImport();
    } else {
      throw new Error("Unsupported source import.");
    }
  } catch (error) {
    revalidatePath("/sources");

    redirectToSources({
      tone: "error",
      message: `${getSourceDisplayName(slug)} import failed`,
      detail: getErrorMessage(error)
    });
  }

  revalidatePath("/sources");
  revalidatePath("/week");
  revalidatePath("/month");
  revalidatePath("/year");

  redirectToSources({
    tone: "success",
    message: `${getSourceDisplayName(slug)} import complete`
  });
}

export async function updateHomeAssistantSyncSettings(formData: FormData) {
  const slug = String(formData.get("source_slug") ?? "");
  const intervalValue = Number(formData.get("interval_minutes"));
  const enabled = formData.get("sync_enabled") === "on";

  try {
    if (!Number.isFinite(intervalValue) || intervalValue < 1 || intervalValue > 1440) {
      throw new Error("Sync interval must be between 1 and 1440 minutes.");
    }

    if (slug === "home-assistant") {
      const configResult = await readHomeAssistantConfig();

      if (!configResult.ok) {
        throw new Error(configResult.message);
      }

      await writeHomeAssistantConfig({
        ...configResult.config,
        sync: {
          enabled,
          intervalMinutes: Math.floor(intervalValue)
        }
      });
    } else if (slug === "plex") {
      const configResult = await readPlexConfig();

      if (!configResult.ok && configResult.reason === "invalid") {
        throw new Error(configResult.message);
      }

      await writePlexConfig({
        sync: {
          enabled,
          intervalMinutes: Math.floor(intervalValue)
        },
        retention: configResult.ok ? configResult.config.retention : getDefaultSourceRetentionConfig()
      });
    } else {
      throw new Error("Unsupported source sync settings.");
    }
  } catch (error) {
    revalidatePath("/sources");

    redirectToSources({
      tone: "error",
      message: `${getSourceDisplayName(slug)} sync settings failed`,
      detail: getErrorMessage(error)
    });
  }

  revalidatePath("/sources");

  redirectToSources({
    tone: "success",
    message: `${getSourceDisplayName(slug)} sync settings saved`
  });
}

function parseBoundedInteger(
  formData: FormData,
  fieldName: string,
  label: string,
  minimum: number,
  maximum: number
) {
  const value = Number(formData.get(fieldName));

  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }

  return Math.floor(value);
}

function buildRetentionConfig(formData: FormData, supportsProvisional: boolean): SourceRetentionConfig {
  const keepIndefinite = formData.get("retention_keep_indefinite") === "on";

  if (keepIndefinite) {
    return {
      mode: "indefinite",
      historyDays: null,
      importJobDays: null,
      provisionalHours: null
    };
  }

  return {
    mode: "windowed",
    historyDays: parseBoundedInteger(formData, "history_days", "History retention", 1, 36500),
    importJobDays: parseBoundedInteger(formData, "import_job_days", "Import-job retention", 1, 36500),
    provisionalHours: supportsProvisional
      ? parseBoundedInteger(formData, "provisional_hours", "Provisional retention", 1, 8760)
      : null
  };
}

export async function updateSourceRetentionSettings(formData: FormData) {
  const slug = String(formData.get("source_slug") ?? "");

  try {
    if (slug === "home-assistant") {
      const configResult = await readHomeAssistantConfig();

      if (!configResult.ok) {
        throw new Error(configResult.message);
      }

      await writeHomeAssistantConfig({
        ...configResult.config,
        retention: buildRetentionConfig(formData, false)
      });
    } else if (slug === "plex") {
      const configResult = await readPlexConfig();

      if (!configResult.ok && configResult.reason === "invalid") {
        throw new Error(configResult.message);
      }

      await writePlexConfig({
        sync: configResult.ok
          ? configResult.config.sync
          : {
              enabled: false,
              intervalMinutes: 30
            },
        retention: buildRetentionConfig(formData, true)
      });
    } else {
      throw new Error("Unsupported source retention settings.");
    }
  } catch (error) {
    revalidatePath("/sources");

    redirectToSources({
      tone: "error",
      message: `${getSourceDisplayName(slug)} retention settings failed`,
      detail: getErrorMessage(error)
    });
  }

  revalidatePath("/sources");

  redirectToSources({
    tone: "success",
    message: `${getSourceDisplayName(slug)} retention settings saved`
  });
}
