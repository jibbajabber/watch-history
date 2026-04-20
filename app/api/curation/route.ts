import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { type CurationAction, updateWatchEventCuration } from "@/lib/curation";

type RequestBody = {
  sourceId?: string;
  eventKey?: string;
  action?: CurationAction;
};

function isCurationAction(value: unknown): value is CurationAction {
  return value === "favourite" || value === "unfavourite" || value === "hide" || value === "unhide";
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON body."
      },
      {
        status: 400
      }
    );
  }

  const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : "";
  const eventKey = typeof body.eventKey === "string" ? body.eventKey.trim() : "";

  if (!sourceId || !eventKey || !isCurationAction(body.action)) {
    return NextResponse.json(
      {
        error: "sourceId, eventKey, and a valid action are required."
      },
      {
        status: 400
      }
    );
  }

  try {
    const state = await updateWatchEventCuration({
      sourceId,
      eventKey,
      action: body.action
    });

    for (const path of ["/", "/week", "/month", "/year", "/analytics", "/favourites"]) {
      revalidatePath(path);
    }

    return NextResponse.json({
      ok: true,
      state
    });
  } catch {
    return NextResponse.json(
      {
        error: "Failed to update curation."
      },
      {
        status: 500
      }
    );
  }
}
