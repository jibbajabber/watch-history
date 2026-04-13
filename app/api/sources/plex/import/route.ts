import { NextResponse } from "next/server";
import { runPlexImport } from "@/lib/plex-import";

export async function POST() {
  try {
    const result = await runPlexImport();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to import Plex history"
      },
      {
        status: 500
      }
    );
  }
}
