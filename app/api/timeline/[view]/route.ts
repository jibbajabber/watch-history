import { NextResponse } from "next/server";
import { getTimelineViewData, isTimelineView } from "@/lib/timeline";

export async function GET(
  _request: Request,
  context: { params: Promise<{ view: string }> }
) {
  const { view } = await context.params;

  if (!isTimelineView(view)) {
    return NextResponse.json(
      {
        error: "Unsupported timeline view"
      },
      {
        status: 404
      }
    );
  }

  try {
    const data = await getTimelineViewData(view);

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        error: "Failed to load timeline."
      },
      {
        status: 500
      }
    );
  }
}
