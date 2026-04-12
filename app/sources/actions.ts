"use server";

import { revalidatePath } from "next/cache";
import { runHomeAssistantImport } from "@/lib/home-assistant-import";
import { readHomeAssistantConfig, writeHomeAssistantConfig } from "@/lib/home-assistant-config";

export async function importHomeAssistantHistory() {
  await runHomeAssistantImport();
  revalidatePath("/sources");
  revalidatePath("/week");
  revalidatePath("/month");
  revalidatePath("/year");
}

export async function updateHomeAssistantSyncSettings(formData: FormData) {
  const configResult = await readHomeAssistantConfig();

  if (!configResult.ok) {
    throw new Error(configResult.message);
  }

  const intervalValue = Number(formData.get("interval_minutes"));
  const enabled = formData.get("sync_enabled") === "on";

  if (!Number.isFinite(intervalValue) || intervalValue < 1 || intervalValue > 1440) {
    throw new Error("Sync interval must be between 1 and 1440 minutes.");
  }

  await writeHomeAssistantConfig({
    ...configResult.config,
    sync: {
      enabled,
      intervalMinutes: Math.floor(intervalValue)
    }
  });

  revalidatePath("/sources");
}
