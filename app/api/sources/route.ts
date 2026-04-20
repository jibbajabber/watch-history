import { NextResponse } from "next/server";
import { getSourceStatuses } from "@/lib/sources";

export async function GET() {
  try {
    const sources = await getSourceStatuses();

    return NextResponse.json({
      sources
    });
  } catch {
    return NextResponse.json(
      {
        error: "Failed to load sources."
      },
      {
        status: 500
      }
    );
  }
}
