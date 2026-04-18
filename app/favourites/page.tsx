import { AppShell } from "@/components/app-shell";
import { FavouritesScreen } from "@/components/favourites-screen";
import { getFavouritesData } from "@/lib/curation";
import type { CuratedFilter } from "@/lib/types";

function isCuratedFilter(value: string): value is CuratedFilter {
  return value === "all" || value === "favourites" || value === "hidden";
}

export default async function FavouritesPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: rawFilter } = await searchParams;
  const filter = rawFilter && isCuratedFilter(rawFilter) ? rawFilter : "favourites";
  const data = await getFavouritesData(filter);

  return (
    <AppShell activeView="favourites">
      <FavouritesScreen data={data} />
    </AppShell>
  );
}
