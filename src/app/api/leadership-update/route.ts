import { NextResponse } from "next/server";

import { createLeadershipUpdate } from "@/lib/analytics/agent";
import { safeApiError } from "@/lib/api/server";
import { loadLiveData } from "@/lib/data/load-data";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const context = await loadLiveData();
    const update = await createLeadershipUpdate(context);
    return NextResponse.json(
      { status: "connected", update },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const safe = safeApiError(error);
    return NextResponse.json(safe, { status: safe.status === "setup_required" ? 400 : 503 });
  }
}
