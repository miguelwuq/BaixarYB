import { PublicError } from "@/lib/public-error";

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

export function extractYouTubeVideoId(rawUrl: string) {
  const parsed = parseUrl(rawUrl);

  if (!parsed) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (!ALLOWED_HOSTS.has(host)) {
    return null;
  }

  if (host === "youtu.be") {
    const candidate = parsed.pathname.split("/").filter(Boolean)[0] || "";
    return isVideoId(candidate) ? candidate : null;
  }

  if (parsed.pathname === "/watch") {
    const candidate = parsed.searchParams.get("v") || "";
    return isVideoId(candidate) ? candidate : null;
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const marker = segments[0];
  const candidate = segments[1] || "";

  if (marker === "shorts" || marker === "embed" || marker === "live") {
    return isVideoId(candidate) ? candidate : null;
  }

  return null;
}

export function normalizeYouTubeUrl(rawUrl: string) {
  const videoId = extractYouTubeVideoId(rawUrl);

  if (!videoId) {
    throw new PublicError("Informe uma URL valida do YouTube.", 400);
  }

  return `https://www.youtube.com/watch?v=${videoId}`;
}

function parseUrl(rawUrl: string) {
  try {
    return new URL(rawUrl.trim());
  } catch {
    return null;
  }
}

function isVideoId(value: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(value);
}
