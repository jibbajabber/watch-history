import { NextResponse } from "next/server";
import { runHomeAssistantImport } from "@/lib/home-assistant-import";

export async function POST() {
  try {
    const result = await runHomeAssistantImport();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to import Home Assistant history"
      },
      {
        status: 500
      }
    );
  }
}

