/**
 * Simple sliding-window rate limit for premium POSTs (per IP).
 * Env: RATE_LIMIT_MAX_PER_MIN (default 120)
 */

const WINDOW_MS = 60_000;
const hits = new Map();

function getMax() {
  const n = Number(process.env.RATE_LIMIT_MAX_PER_MIN);
  return Number.isFinite(n) && n > 0 ? n : 120;
}

export function rateLimitPremium(req, res, next) {
  if (req.method !== "POST") return next();
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  let b = hits.get(ip);
  if (!b || now - b.start > WINDOW_MS) {
    b = { start: now, count: 0 };
  }
  b.count += 1;
  hits.set(ip, b);
  const max = getMax();
  if (b.count > max) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({
      error: "Too many requests",
      message: "Slow down and try again in a minute.",
    });
  }
  next();
}
