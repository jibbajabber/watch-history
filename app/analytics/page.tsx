import { getAnalyticsData } from "@/lib/analytics";
import { AppShell } from "@/components/app-shell";
import { AnalyticsScreen } from "@/components/analytics-screen";

export default async function AnalyticsPage() {
  const data = await getAnalyticsData();

  return (
    <AppShell activeView="analytics">
      <AnalyticsScreen data={data} />
    </AppShell>
  );
}
