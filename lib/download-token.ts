import { createHmac, timingSafeEqual } from "node:crypto";
import { PublicError } from "@/lib/public-error";

type DownloadTokenPayload = {
  url: string;
  itag: number;
  exp: number;
};

const DEFAULT_SECRET = "change-this-secret-before-production";

function getSecret() {
  return process.env.DOWNLOAD_TOKEN_SECRET || DEFAULT_SECRET;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createDownloadToken(url: string, itag: number, ttlSeconds = 600) {
  const payload: DownloadTokenPayload = {
    url,
    itag,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };

  const encodedPayload = encode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function readDownloadToken(token: string): DownloadTokenPayload {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    throw new PublicError("Link de download invalido.", 400);
  }

  const expectedSignature = sign(encodedPayload);
  const valid =
    signature.length === expectedSignature.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!valid) {
    throw new PublicError("Link de download invalido.", 400);
  }

  let payload: DownloadTokenPayload;

  try {
    payload = JSON.parse(decode(encodedPayload)) as DownloadTokenPayload;
  } catch {
    throw new PublicError("Link de download invalido.", 400);
  }

  if (
    typeof payload.url !== "string" ||
    !Number.isInteger(payload.itag) ||
    !Number.isInteger(payload.exp)
  ) {
    throw new PublicError("Link de download invalido.", 400);
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new PublicError("Esse link expirou. Busque o video novamente.", 410);
  }

  return payload;
}
