import { NextResponse } from "next/server";
import { runPlexImport } from "@/lib/plex-import";

export async function POST() {
  try {
    const result = await runPlexImport();

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        error: "Failed to import Plex history."
      },
      {
        status: 500
      }
    );
  }
}
