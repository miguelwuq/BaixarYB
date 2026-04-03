import { NextRequest, NextResponse } from "next/server";
import { readDownloadToken } from "@/lib/download-token";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  applyRateLimitHeaders,
  getClientIp,
  noStoreJson,
  toErrorResponse
} from "@/lib/http";
import {
  buildSafeFileName,
  findFormatByItag,
  getDownloadInfo,
  isAllowedMediaRedirect,
  validateYouTubeUrl
} from "@/lib/youtube";
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
    const streamMode = request.nextUrl.searchParams.get("stream") === "1";

    if (!token) {
      throw new PublicError("Link de download invalido.", 400);
    }

    const { url, itag } = readDownloadToken(token);
    validateYouTubeUrl(url);
    const info = await getDownloadInfo(url);
    const format = findFormatByItag(info.formats, itag);

    if (!format?.url) {
      throw new PublicError("A qualidade selecionada nao esta mais disponivel.", 404);
    }

    if (!isAllowedMediaRedirect(format.url)) {
      throw new PublicError("Destino de download bloqueado por seguranca.", 400);
    }

    if (streamMode) {
      const upstream = await fetch(format.url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 BaixarYB"
        }
      });

      if (!upstream.ok || !upstream.body) {
        throw new PublicError("Nao foi possivel baixar esse arquivo agora.", 502);
      }

      const extension = format.container || "bin";
      const fileName = buildSafeFileName(info.videoDetails.title, extension);
      const response = new NextResponse(upstream.body, { status: 200 });
      response.headers.set(
        "Content-Type",
        upstream.headers.get("content-type") || "application/octet-stream"
      );
      response.headers.set(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );
      response.headers.set("Cache-Control", "no-store, max-age=0");

      const contentLength = upstream.headers.get("content-length");

      if (contentLength) {
        response.headers.set("Content-Length", contentLength);
      }

      return applyRateLimitHeaders(response, rate);
    }

    const response = NextResponse.redirect(format.url, 302);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return applyRateLimitHeaders(response, rate);
  } catch (error) {
    const response = toErrorResponse(error, "Nao foi possivel iniciar o download.");
    return applyRateLimitHeaders(response, rate);
  }
}
