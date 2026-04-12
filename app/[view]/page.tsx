import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TimelineViewScreen } from "@/components/timeline-view-screen";
import { getTimelineViewData, getTimelineViewMeta, isTimelineView } from "@/lib/timeline";

export default async function TimelinePage({
  params
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;

  if (!isTimelineView(view)) {
    notFound();
  }

  const data = await getTimelineViewData(view);
  const meta = getTimelineViewMeta(view);

  return (
    <AppShell activeView={view}>
      <TimelineViewScreen data={data} meta={meta} />
    </AppShell>
  );
}

