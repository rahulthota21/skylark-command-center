import { NextResponse } from "next/server";

import { getHealth } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = await getHealth(true);
  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
