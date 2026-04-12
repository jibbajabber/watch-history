import { NextResponse } from "next/server";
import { getSourceStatuses } from "@/lib/sources";

export async function GET() {
  try {
    const sources = await getSourceStatuses();

    return NextResponse.json({
      sources
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load sources"
      },
      {
        status: 500
      }
    );
  }
}

