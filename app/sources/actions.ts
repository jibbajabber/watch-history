"use server";

import { revalidatePath } from "next/cache";
import { runHomeAssistantImport } from "@/lib/home-assistant-import";
import { readHomeAssistantConfig, writeHomeAssistantConfig } from "@/lib/home-assistant-config";
import { readPlexConfig, writePlexConfig } from "@/lib/plex-config";
import { runPlexImport } from "@/lib/plex-import";

export async function importSourceHistory(formData: FormData) {
  const slug = formData.get("source_slug");

  if (slug === "home-assistant") {
    await runHomeAssistantImport();
  } else if (slug === "plex") {
    await runPlexImport();
  } else {
    throw new Error("Unsupported source import.");
  }

  revalidatePath("/sources");
  revalidatePath("/week");
  revalidatePath("/month");
  revalidatePath("/year");
}

export async function updateHomeAssistantSyncSettings(formData: FormData) {
  const slug = formData.get("source_slug");
  const intervalValue = Number(formData.get("interval_minutes"));
  const enabled = formData.get("sync_enabled") === "on";

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

  revalidatePath("/sources");
}
