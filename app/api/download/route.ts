import { NextRequest, NextResponse } from "next/server";
import { readDownloadToken } from "@/lib/download-token";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  applyRateLimitHeaders,
  getClientIp,
  noStoreJson,
  toErrorResponse
} from "@/lib/http";
import { findFormatByItag, getVideoInfo, isAllowedMediaRedirect, validateYouTubeUrl } from "@/lib/youtube";
import { PublicError } from "@/lib/public-error";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit({
    key: `download:${getClientIp(request)}`,
    limit: 30,
    windowMs: 60_000
  });

  if (!rate.allowed) {
    const response = noStoreJson(
      { error: "Muitos downloads iniciados em pouco tempo. Aguarde um pouco." },
      { status: 429 }
    );

    return applyRateLimitHeaders(response, rate);
  }

  try {
    const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

    if (!token) {
      throw new PublicError("Link de download invalido.", 400);
    }

    const { url, itag } = readDownloadToken(token);
    validateYouTubeUrl(url);
    const { info } = await getVideoInfo(url);
    const format = findFormatByItag(info.formats, itag);

    if (!format?.url) {
      throw new PublicError("A qualidade selecionada nao esta mais disponivel.", 404);
    }

    if (!isAllowedMediaRedirect(format.url)) {
      throw new PublicError("Destino de download bloqueado por seguranca.", 400);
    }

    const response = NextResponse.redirect(format.url, 302);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return applyRateLimitHeaders(response, rate);
  } catch (error) {
    const response = toErrorResponse(error, "Nao foi possivel iniciar o download.");
    return applyRateLimitHeaders(response, rate);
  }
}
