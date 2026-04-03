type LimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

type LimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Bucket>();

export function checkRateLimit(config: LimitConfig): LimitResult {
  const now = Date.now();
  const existing = store.get(config.key);

  if (!existing || existing.resetAt <= now) {
    const bucket = {
      count: 1,
      resetAt: now + config.windowMs
    };

    store.set(config.key, bucket);

    return {
      allowed: true,
      limit: config.limit,
      remaining: Math.max(config.limit - 1, 0),
      resetAt: bucket.resetAt
    };
  }

  if (existing.count >= config.limit) {
    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetAt: existing.resetAt
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    limit: config.limit,
    remaining: Math.max(config.limit - existing.count, 0),
    resetAt: existing.resetAt
  };
}
