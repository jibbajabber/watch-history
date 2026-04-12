import { AppShell } from "@/components/app-shell";
import { SourceListScreen } from "@/components/source-list-screen";
import {
  importHomeAssistantHistory,
  updateHomeAssistantSyncSettings
} from "@/app/sources/actions";
import { getSourceStatuses } from "@/lib/sources";

export default async function SourcesPage() {
  const sources = await getSourceStatuses();

  return (
    <AppShell activeView="sources">
      <SourceListScreen
        sources={sources}
        importAction={importHomeAssistantHistory}
        updateSyncAction={updateHomeAssistantSyncSettings}
      />
    </AppShell>
  );
}
