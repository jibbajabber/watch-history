import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    await sql`select 1`;

    return NextResponse.json({
      ok: true
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Database health check failed."
      },
      {
        status: 503
      }
    );
  }
}
