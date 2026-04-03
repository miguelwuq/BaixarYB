import { NextRequest } from "next/server";
import { getVideoInfo } from "@/lib/youtube";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  applyRateLimitHeaders,
  assertAllowedJsonBody,
  assertSameOrigin,
  getClientIp,
  noStoreJson,
  toErrorResponse
} from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rate = checkRateLimit({
    key: `video-info:${getClientIp(request)}`,
    limit: 15,
    windowMs: 60_000
  });

  if (!rate.allowed) {
    const response = noStoreJson(
      { error: "Muitas consultas em pouco tempo. Tente novamente em instantes." },
      { status: 429 }
    );

    return applyRateLimitHeaders(response, rate);
  }

  try {
    assertSameOrigin(request);
    assertAllowedJsonBody(request);
    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";

    if (!url) {
      const response = noStoreJson(
        { error: "Cole um link do YouTube para continuar." },
        { status: 400 }
      );

      return applyRateLimitHeaders(response, rate);
    }

    const { data } = await getVideoInfo(url);
    const response = noStoreJson(data, { status: 200 });
    return applyRateLimitHeaders(response, rate);
  } catch (error) {
    const response = toErrorResponse(error, "Nao foi possivel processar o video.");
    return applyRateLimitHeaders(response, rate);
  }
}
