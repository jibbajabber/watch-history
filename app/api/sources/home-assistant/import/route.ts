import { NextResponse } from "next/server";
import { runHomeAssistantImport } from "@/lib/home-assistant-import";

export async function POST() {
  try {
    const result = await runHomeAssistantImport();

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        error: "Failed to import Home Assistant history."
      },
      {
        status: 500
      }
    );
  }
}
