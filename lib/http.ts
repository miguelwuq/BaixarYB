import { NextRequest, NextResponse } from "next/server";
import { PublicError, isPublicError } from "@/lib/public-error";

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return realIp?.trim() || "unknown";
}

export function assertAllowedJsonBody(request: NextRequest, maxBytes = 2048) {
  const contentType = request.headers.get("content-type") || "";
  const contentLength = Number.parseInt(request.headers.get("content-length") || "0", 10);

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new PublicError("Envie os dados em JSON.", 415);
  }

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new PublicError("Requisicao muito grande.", 413);
  }
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return;
  }

  const host = request.headers.get("host");

  if (!host) {
    throw new PublicError("Origem da requisicao invalida.", 403);
  }

  const expectedOrigin = `${request.nextUrl.protocol}//${host}`;

  if (origin !== expectedOrigin) {
    throw new PublicError("Origem da requisicao nao autorizada.", 403);
  }
}

export function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export function applyRateLimitHeaders(response: NextResponse, rate: {
  limit: number;
  remaining: number;
  resetAt: number;
}) {
  response.headers.set("X-RateLimit-Limit", String(rate.limit));
  response.headers.set("X-RateLimit-Remaining", String(rate.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(rate.resetAt / 1000)));
  return response;
}

export function toErrorResponse(error: unknown, fallbackMessage: string) {
  if (isPublicError(error)) {
    return noStoreJson({ error: error.message }, { status: error.status });
  }

  return noStoreJson({ error: fallbackMessage }, { status: 500 });
}
