import { AppShell } from "@/components/app-shell";
import { SourceListScreen } from "@/components/source-list-screen";
import {
  importSourceHistory,
  updateHomeAssistantSyncSettings
} from "@/app/sources/actions";
import { getSourceStatuses } from "@/lib/sources";

type SourcesPageProps = {
  searchParams?: Promise<{
    tone?: string;
    message?: string;
    detail?: string;
  }>;
};

export default async function SourcesPage({ searchParams }: SourcesPageProps) {
  const sources = await getSourceStatuses();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const flashTone =
    resolvedSearchParams?.tone === "error" || resolvedSearchParams?.tone === "success"
      ? resolvedSearchParams.tone
      : undefined;

  return (
    <AppShell activeView="sources">
      <SourceListScreen
        sources={sources}
        flashTone={flashTone}
        flashMessage={resolvedSearchParams?.message}
        flashDetail={resolvedSearchParams?.detail}
        importSourceAction={importSourceHistory}
        updateSyncAction={updateHomeAssistantSyncSettings}
      />
    </AppShell>
  );
}
