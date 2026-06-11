// lib/rate-limit.ts — simple in-memory rate limiter for API routes
// Sufficient for single-process deployments (dev / small university).
// Replace the store with Redis for multi-instance production.

interface Bucket { count: number; resetAt: number }

const store = new Map<string, Bucket>()

// Prune expired entries every 5 minutes to avoid unbounded growth
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * @returns true  — request allowed
 * @returns false — rate limit exceeded; respond 429
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const bucket = store.get(key)

  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= limit) return false

  bucket.count++
  return true
}

/** Extract client IP from Next.js request headers */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  )
}
