import { NextResponse } from "next/server";

import { getHealth } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await getHealth(false);
  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
