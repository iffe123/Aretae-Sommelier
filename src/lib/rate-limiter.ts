// Simple in-memory rate limiter

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 10; // 10 requests per window

// Clean up old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  const cutoff = now - WINDOW_MS;

  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

/**
 * Check if a request is allowed based on IP-based rate limiting
 * @param identifier - Usually the client IP address
 * @returns RateLimitResult with allowed status and metadata
 */
export function checkRateLimit(identifier: string): RateLimitResult {
  cleanup();

  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  let entry = rateLimitStore.get(identifier);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(identifier, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  const remaining = Math.max(0, MAX_REQUESTS - entry.timestamps.length);
  const oldestTimestamp = entry.timestamps[0] || now;
  const resetInMs = oldestTimestamp + WINDOW_MS - now;

  if (entry.timestamps.length >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: Math.max(0, resetInMs),
    };
  }

  // Record this request
  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: remaining - 1,
    resetInMs: WINDOW_MS,
  };
}

/**
 * Get client IP from Next.js request
 */
export function getClientIP(request: Request): string {
  // Check various headers that might contain the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to a default identifier (useful for local development)
  return 'unknown';
}
