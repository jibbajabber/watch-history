"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runHomeAssistantImport } from "@/lib/home-assistant-import";
import { readHomeAssistantConfig, writeHomeAssistantConfig } from "@/lib/home-assistant-config";
import { readPlexConfig, writePlexConfig } from "@/lib/plex-config";
import { runPlexImport } from "@/lib/plex-import";

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
        }
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
