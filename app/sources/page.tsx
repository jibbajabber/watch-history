import { AppShell } from "@/components/app-shell";
import { SourceListScreen } from "@/components/source-list-screen";
import {
  importSourceHistory,
  updateHomeAssistantSyncSettings
} from "@/app/sources/actions";
import { getSourceStatuses } from "@/lib/sources";

export default async function SourcesPage() {
  const sources = await getSourceStatuses();

  return (
    <AppShell activeView="sources">
      <SourceListScreen
        sources={sources}
        importSourceAction={importSourceHistory}
        updateSyncAction={updateHomeAssistantSyncSettings}
      />
    </AppShell>
  );
}
