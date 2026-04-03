import ytdl from "@distube/ytdl-core";
import { createDownloadToken } from "@/lib/download-token";
import { PublicError } from "@/lib/public-error";

type NormalizedFormat = {
  itag: number;
  qualityLabel: string;
  container: string;
  fps: number | null;
  approxSize: string;
  contentLength: number | null;
};

export function validateYouTubeUrl(url: string) {
  if (url.length > 500) {
    throw new PublicError("A URL informada e longa demais.", 400);
  }

  if (!ytdl.validateURL(url)) {
    throw new PublicError("Informe uma URL valida do YouTube.", 400);
  }
}

export async function getVideoInfo(url: string) {
  validateYouTubeUrl(url);
  let info: ytdl.videoInfo;

  try {
    info = await ytdl.getInfo(url);
  } catch {
    throw new PublicError("Nao foi possivel consultar esse video agora.", 502);
  }

  const details = info.videoDetails;
  const formats = normalizeFormats(info.formats);

  if (formats.length === 0) {
    throw new PublicError("Nenhuma opcao de qualidade compativel foi encontrada.", 404);
  }

  return {
    info,
    data: {
      videoId: details.videoId,
      title: sanitizeText(details.title, 160),
      channelName: sanitizeText(details.author.name, 80),
      channelUrl: sanitizeExternalUrl(details.author.channel_url),
      channelAvatarUrl:
        sanitizeImageUrl(
          details.author.thumbnails?.slice().sort((a, b) => b.width - a.width)[0]?.url ??
            details.author.avatar
        ),
      channelVerified: details.author.verified,
      thumbnailUrl: getBestThumbnail(details.thumbnails),
      duration: formatDuration(Number(details.lengthSeconds)),
      formats: formats.map((format) => ({
        itag: format.itag,
        qualityLabel: format.qualityLabel,
        container: format.container,
        fps: format.fps,
        approxSize: format.approxSize,
        downloadUrl: `/api/download?token=${encodeURIComponent(createDownloadToken(url, format.itag))}`
      }))
    }
  };
}

export function findFormatByItag(
  formats: ytdl.videoFormat[],
  itag: number
): ytdl.videoFormat | undefined {
  return formats.find((format) => format.itag === itag);
}

function normalizeFormats(formats: ytdl.videoFormat[]): NormalizedFormat[] {
  const map = new Map<string, NormalizedFormat>();

  for (const format of formats) {
    if (!format.hasVideo || !format.hasAudio) {
      continue;
    }

    if (format.container !== "mp4" || !format.qualityLabel) {
      continue;
    }

    const key = `${format.qualityLabel}-${format.container}`;
    const current = map.get(key);
    const candidate = {
      itag: format.itag,
      qualityLabel: format.qualityLabel,
      container: format.container,
      fps: format.fps ?? null,
      approxSize: getApproxSize(format),
      contentLength: format.contentLength ? Number(format.contentLength) : null
    };

    if (!current || (candidate.contentLength ?? 0) > (current.contentLength ?? 0)) {
      map.set(key, candidate);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aValue = Number.parseInt(a.qualityLabel, 10);
    const bValue = Number.parseInt(b.qualityLabel, 10);
    return bValue - aValue;
  });
}

function getApproxSize(format: ytdl.videoFormat) {
  if (format.contentLength) {
    return formatBytes(Number(format.contentLength));
  }

  const bitrate = format.bitrate ?? 0;
  const durationMs = Number(format.approxDurationMs ?? 0);

  if (!bitrate || !durationMs) {
    return "Tamanho indisponivel";
  }

  return formatBytes((bitrate / 8) * (durationMs / 1000));
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "Tamanho indisponivel";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function getBestThumbnail(
  thumbnails: Array<{ url: string; width: number; height: number }>
) {
  return sanitizeImageUrl(
    thumbnails.slice().sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? ""
  );
}

function formatDuration(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "Ao vivo ou duracao indisponivel";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function isAllowedMediaRedirect(url: string) {
  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "googlevideo.com" || parsed.hostname.endsWith(".googlevideo.com"))
    );
  } catch {
    return false;
  }
}

function sanitizeText(value: string, maxLength: number) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, maxLength).trim();
}

function sanitizeExternalUrl(value: string) {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "https:") {
      throw new Error("invalid");
    }

    return parsed.toString();
  } catch {
    return "https://www.youtube.com";
  }
}

function sanitizeImageUrl(value: string) {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "https:") {
      throw new Error("invalid");
    }

    return parsed.toString();
  } catch {
    return "https://i.ytimg.com/vi/default/default.jpg";
  }
}
