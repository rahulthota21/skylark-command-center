import { NextResponse } from "next/server";
import { z } from "zod";

import { answerQuestion } from "@/lib/analytics/agent";
import { safeApiError } from "@/lib/api/server";
import { loadLiveData } from "@/lib/data/load-data";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  question: z.string().trim().min(3, "Please enter a more specific business question.").max(900),
});

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8_000) {
    return NextResponse.json(
      { status: "unavailable", message: "Question payload is too large." },
      { status: 413 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "unavailable", message: parsed.error.issues[0]?.message || "Invalid question." },
      { status: 400 },
    );
  }

  try {
    const context = await loadLiveData();
    const answer = await answerQuestion(parsed.data.question, context);
    return NextResponse.json(
      { status: "connected", answer },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const safe = safeApiError(error);
    return NextResponse.json(safe, { status: safe.status === "setup_required" ? 400 : 503 });
  }
}
