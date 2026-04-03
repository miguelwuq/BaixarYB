import ytdl from "@distube/ytdl-core";
import { Innertube } from "youtubei.js";
import { createDownloadToken } from "@/lib/download-token";
import { PublicError } from "@/lib/public-error";
import { normalizeYouTubeUrl } from "@/lib/youtube-link";

type NormalizedVideoFormat = {
  itag: number;
  qualityLabel: string;
  container: string;
  fps: number | null;
  approxSize: string;
  contentLength: number | null;
  hasAudio: boolean;
};

type NormalizedAudioFormat = {
  itag: number;
  audioLabel: string;
  container: string;
  approxSize: string;
  audioBitrate: number | null;
  contentLength: number | null;
};

type StreamingFormatLike = {
  itag: number;
  quality_label?: string;
  mime_type?: string;
  fps?: number;
  content_length?: number | string;
  bitrate?: number;
  approx_duration_ms?: number | string;
  has_audio?: boolean;
  has_video?: boolean;
};

type StreamingDataLike = {
  formats?: StreamingFormatLike[];
  adaptive_formats?: StreamingFormatLike[];
};

let innertubePromise: Promise<Innertube> | null = null;

export function validateYouTubeUrl(url: string) {
  if (url.length > 500) {
    throw new PublicError("A URL informada e longa demais.", 400);
  }

  const normalizedUrl = normalizeYouTubeUrl(url);

  if (!ytdl.validateURL(normalizedUrl)) {
    throw new PublicError("Informe uma URL valida do YouTube.", 400);
  }

  return normalizedUrl;
}

export async function getVideoInfo(url: string) {
  const normalizedUrl = validateYouTubeUrl(url);
  const videoId = ytdl.getVideoID(normalizedUrl);
  const innertube = await getInnertubeClient();

  let info: Awaited<ReturnType<Innertube["getInfo"]>>;

  try {
    info = await innertube.getInfo(videoId);
  } catch {
    throw new PublicError("Nao foi possivel consultar esse video agora.", 502);
  }

  const basicInfo = info.basic_info;
  const videoFormats = normalizeVideoFormats(info.streaming_data);
  const audioFormats = normalizeAudioFormats(info.streaming_data);

  if (videoFormats.length === 0 && audioFormats.length === 0) {
    throw new PublicError("Nenhuma opcao de qualidade compativel foi encontrada.", 404);
  }

  const channelName = sanitizeText(
    info.secondary_info?.owner?.author?.name?.toString() || basicInfo.author || "Canal do YouTube",
    80
  );
  const channelUrl = sanitizeExternalUrl(
    info.secondary_info?.owner?.author?.url?.toString() ||
      basicInfo.channel?.url ||
      "https://www.youtube.com"
  );
  const channelAvatarUrl = sanitizeImageUrl(
    info.secondary_info?.owner?.author?.thumbnails?.slice().sort((a, b) => b.width - a.width)[0]
      ?.url ||
      ""
  );

  return {
    data: {
      videoId,
      title: sanitizeText(basicInfo.title || "Video do YouTube", 160),
      channelName,
      channelUrl,
      channelAvatarUrl,
      channelVerified: Boolean(info.secondary_info?.owner?.author?.is_verified),
      thumbnailUrl: getBestThumbnail(basicInfo.thumbnail || []),
      duration: formatDuration(Number(basicInfo.duration || 0)),
      videoFormats: videoFormats.map((format) => ({
        itag: format.itag,
        qualityLabel: format.qualityLabel,
        container: format.container,
        fps: format.fps,
        approxSize: format.approxSize,
        hasAudio: format.hasAudio,
        downloadToken: createDownloadToken(normalizedUrl, format.itag)
      })),
      audioFormats: audioFormats.map((format) => ({
        itag: format.itag,
        audioLabel: format.audioLabel,
        container: format.container,
        approxSize: format.approxSize,
        audioBitrate: format.audioBitrate,
        downloadToken: createDownloadToken(normalizedUrl, format.itag)
      }))
    }
  };
}

export async function getDownloadInfo(url: string) {
  const normalizedUrl = validateYouTubeUrl(url);

  try {
    return await ytdl.getInfo(normalizedUrl, {
      playerClients: ["WEB", "ANDROID", "TV", "IOS", "WEB_EMBEDDED"]
    });
  } catch {
    throw new PublicError("Nao foi possivel preparar esse download agora.", 502);
  }
}

export function findFormatByItag(
  formats: ytdl.videoFormat[],
  itag: number
): ytdl.videoFormat | undefined {
  return formats.find((format) => format.itag === itag);
}

function normalizeVideoFormats(
  streamingData: StreamingDataLike | null | undefined
): NormalizedVideoFormat[] {
  const formats = [
    ...(streamingData?.formats || []),
    ...(streamingData?.adaptive_formats || [])
  ];
  const map = new Map<string, NormalizedVideoFormat>();

  for (const rawFormat of formats) {
    const qualityLabel =
      typeof rawFormat.quality_label === "string" ? rawFormat.quality_label : null;
    const hasVideo = rawFormat.has_video === true;

    if (!hasVideo || !qualityLabel) {
      continue;
    }

    const container = getContainerFromMimeType(
      typeof rawFormat.mime_type === "string" ? rawFormat.mime_type : null
    );

    if (!container) {
      continue;
    }

    const key = qualityLabel;
    const current = map.get(key);
    const candidate = {
      itag: Number(rawFormat.itag),
      qualityLabel,
      container,
      fps: typeof rawFormat.fps === "number" ? rawFormat.fps : null,
      approxSize: getApproxSize({
        contentLength:
          typeof rawFormat.content_length === "number"
            ? rawFormat.content_length
            : Number(rawFormat.content_length || 0),
        bitrate: typeof rawFormat.bitrate === "number" ? rawFormat.bitrate : 0,
        approxDurationMs:
          typeof rawFormat.approx_duration_ms === "number"
            ? rawFormat.approx_duration_ms
            : Number(rawFormat.approx_duration_ms || 0)
      }),
      contentLength:
        typeof rawFormat.content_length === "number"
          ? rawFormat.content_length
          : Number(rawFormat.content_length || 0) || null,
      hasAudio: rawFormat.has_audio === true
    };

    if (!current || getVideoFormatScore(candidate) > getVideoFormatScore(current)) {
      map.set(key, candidate);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aValue = Number.parseInt(a.qualityLabel, 10);
    const bValue = Number.parseInt(b.qualityLabel, 10);
    return bValue - aValue;
  });
}

function normalizeAudioFormats(
  streamingData: StreamingDataLike | null | undefined
): NormalizedAudioFormat[] {
  const formats = [
    ...(streamingData?.formats || []),
    ...(streamingData?.adaptive_formats || [])
  ];
  const map = new Map<string, NormalizedAudioFormat>();

  for (const rawFormat of formats) {
    const hasAudio = rawFormat.has_audio === true;
    const hasVideo = rawFormat.has_video === true;

    if (!hasAudio || hasVideo) {
      continue;
    }

    const container = getContainerFromMimeType(
      typeof rawFormat.mime_type === "string" ? rawFormat.mime_type : null
    );

    if (!container) {
      continue;
    }

    const fallbackBitrate =
      typeof rawFormat.bitrate === "number" ? Math.round(rawFormat.bitrate / 1000) : 0;
    const audioBitrate =
      typeof rawFormat.bitrate === "number" ? Math.round(rawFormat.bitrate / 1000) : null;
    const bitrateLabel = audioBitrate || fallbackBitrate || null;
    const key = `${container}-${bitrateLabel ?? "default"}`;
    const current = map.get(key);
    const candidate = {
      itag: Number(rawFormat.itag),
      audioLabel: bitrateLabel ? `${bitrateLabel} kbps` : "Audio padrao",
      container,
      approxSize: getApproxSize({
        contentLength:
          typeof rawFormat.content_length === "number"
            ? rawFormat.content_length
            : Number(rawFormat.content_length || 0),
        bitrate: typeof rawFormat.bitrate === "number" ? rawFormat.bitrate : 0,
        approxDurationMs:
          typeof rawFormat.approx_duration_ms === "number"
            ? rawFormat.approx_duration_ms
            : Number(rawFormat.approx_duration_ms || 0)
      }),
      audioBitrate: bitrateLabel,
      contentLength:
        typeof rawFormat.content_length === "number"
          ? rawFormat.content_length
          : Number(rawFormat.content_length || 0) || null
    };

    if (!current || (candidate.contentLength ?? 0) > (current.contentLength ?? 0)) {
      map.set(key, candidate);
    }
  }

  return Array.from(map.values()).sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));
}

function getContainerFromMimeType(mimeType: string | null) {
  if (!mimeType) {
    return null;
  }

  const match = mimeType.match(/^(audio|video)\/([a-z0-9]+)/i);
  return match?.[2]?.toLowerCase() ?? null;
}

function getVideoFormatScore(format: {
  container: string;
  contentLength: number | null;
  hasAudio: boolean;
}) {
  let score = 0;

  if (format.hasAudio) {
    score += 10_000_000_000;
  }

  if (format.container === "mp4") {
    score += 1_000_000_000;
  }

  score += format.contentLength ?? 0;
  return score;
}

function getApproxSize(format: {
  contentLength: number;
  bitrate: number;
  approxDurationMs: number;
}) {
  if (format.contentLength > 0) {
    return formatBytes(format.contentLength);
  }

  if (!format.bitrate || !format.approxDurationMs) {
    return "Tamanho indisponivel";
  }

  return formatBytes((format.bitrate / 8) * (format.approxDurationMs / 1000));
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

export function buildSafeFileName(title: string, extension: string) {
  const safeTitle = title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  const baseName = safeTitle || "baixaryb";
  return `${baseName}.${extension}`;
}

async function getInnertubeClient() {
  if (!innertubePromise) {
    innertubePromise = Innertube.create();
  }

  return innertubePromise;
}

function sanitizeText(value: string, maxLength: number) {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, maxLength).trim();
}

function sanitizeExternalUrl(value: string) {
  try {
    const parsed = new URL(value);

    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error("invalid");
    }

    return parsed.protocol === "http:"
      ? parsed.toString().replace(/^http:/, "https:")
      : parsed.toString();
  } catch {
    return "https://www.youtube.com";
  }
}

function sanitizeImageUrl(value: string) {
  try {
    const parsed = new URL(value);

    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error("invalid");
    }

    return parsed.protocol === "http:"
      ? parsed.toString().replace(/^http:/, "https:")
      : parsed.toString();
  } catch {
    return "https://i.ytimg.com/vi/default/default.jpg";
  }
}
