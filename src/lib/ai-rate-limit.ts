import type { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AIEndpoint } from "@/lib/observability";

export interface AIRateLimitPolicy {
  maxRequests: number;
  windowMs: number;
}

export interface AIRateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  windowMs: number;
  store: "firestore" | "memory";
}

interface AIRateLimitRecord {
  count: number;
  windowStartedAt: number;
}

interface FirestoreRateLimitRecord extends AIRateLimitRecord {
  endpoint: AIEndpoint;
  updatedAt: number;
  expiresAt: Date;
}

const RATE_LIMIT_COLLECTION = "aiRateLimits";
const MEMORY_STORE_PRUNE_THRESHOLD = 500;

export const AI_RATE_LIMIT_POLICIES: Record<AIEndpoint, AIRateLimitPolicy> = {
  chat: {
    maxRequests: 12,
    windowMs: 5 * 60 * 1000,
  },
  "analyze-wine": {
    maxRequests: 8,
    windowMs: 10 * 60 * 1000,
  },
  lookup: {
    maxRequests: 20,
    windowMs: 10 * 60 * 1000,
  },
  "drinking-window": {
    maxRequests: 16,
    windowMs: 10 * 60 * 1000,
  },
};

const memoryStore = new Map<string, AIRateLimitRecord>();

function getPolicy(endpoint: AIEndpoint): AIRateLimitPolicy {
  return AI_RATE_LIMIT_POLICIES[endpoint];
}

function createRateLimitDocId(endpoint: AIEndpoint, userId: string): string {
  return Buffer.from(`${endpoint}:${userId}`).toString("base64url");
}

function toAllowedResult(
  policy: AIRateLimitPolicy,
  count: number,
  windowStartedAt: number,
  store: AIRateLimitResult["store"]
): AIRateLimitResult {
  const resetAt = windowStartedAt + policy.windowMs;
  return {
    allowed: true,
    limit: policy.maxRequests,
    remaining: Math.max(policy.maxRequests - count, 0),
    resetAt,
    retryAfterSeconds: Math.max(Math.ceil((resetAt - Date.now()) / 1000), 0),
    windowMs: policy.windowMs,
    store,
  };
}

function toRejectedResult(
  policy: AIRateLimitPolicy,
  windowStartedAt: number,
  store: AIRateLimitResult["store"]
): AIRateLimitResult {
  const resetAt = windowStartedAt + policy.windowMs;
  return {
    allowed: false,
    limit: policy.maxRequests,
    remaining: 0,
    resetAt,
    retryAfterSeconds: Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1),
    windowMs: policy.windowMs,
    store,
  };
}

function pruneMemoryStore(now: number) {
  if (memoryStore.size < MEMORY_STORE_PRUNE_THRESHOLD) {
    return;
  }

  for (const [key, entry] of memoryStore.entries()) {
    const isExpired = now - entry.windowStartedAt > 30 * 60 * 1000;
    if (isExpired) {
      memoryStore.delete(key);
    }
  }
}

function consumeFromMemory(
  endpoint: AIEndpoint,
  userId: string,
  policy: AIRateLimitPolicy
): AIRateLimitResult {
  const key = `${endpoint}:${userId}`;
  const now = Date.now();
  pruneMemoryStore(now);

  const existing = memoryStore.get(key);
  if (!existing || now - existing.windowStartedAt >= policy.windowMs) {
    memoryStore.set(key, {
      count: 1,
      windowStartedAt: now,
    });

    return toAllowedResult(policy, 1, now, "memory");
  }

  if (existing.count >= policy.maxRequests) {
    return toRejectedResult(policy, existing.windowStartedAt, "memory");
  }

  const nextCount = existing.count + 1;
  memoryStore.set(key, {
    count: nextCount,
    windowStartedAt: existing.windowStartedAt,
  });

  return toAllowedResult(policy, nextCount, existing.windowStartedAt, "memory");
}

async function consumeFromFirestore(
  db: Firestore,
  endpoint: AIEndpoint,
  userId: string,
  policy: AIRateLimitPolicy
): Promise<AIRateLimitResult> {
  const now = Date.now();
  const docRef = db
    .collection(RATE_LIMIT_COLLECTION)
    .doc(createRateLimitDocId(endpoint, userId));

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    const existing = snapshot.data() as Partial<FirestoreRateLimitRecord> | undefined;
    const windowStartedAt =
      typeof existing?.windowStartedAt === "number"
        ? existing.windowStartedAt
        : now;
    const count = typeof existing?.count === "number" ? existing.count : 0;
    const windowExpired = now - windowStartedAt >= policy.windowMs;
    const nextWindowStartedAt = windowExpired ? now : windowStartedAt;

    if (!snapshot.exists || windowExpired) {
      transaction.set(docRef, {
        count: 1,
        endpoint,
        windowStartedAt: nextWindowStartedAt,
        updatedAt: now,
        expiresAt: new Date(now + policy.windowMs * 2),
      } satisfies FirestoreRateLimitRecord);

      return toAllowedResult(policy, 1, nextWindowStartedAt, "firestore");
    }

    if (count >= policy.maxRequests) {
      transaction.set(
        docRef,
        {
          updatedAt: now,
          expiresAt: new Date(windowStartedAt + policy.windowMs * 2),
        },
        { merge: true }
      );

      return toRejectedResult(policy, windowStartedAt, "firestore");
    }

    const nextCount = count + 1;
    transaction.set(
      docRef,
      {
        count: nextCount,
        endpoint,
        windowStartedAt,
        updatedAt: now,
        expiresAt: new Date(windowStartedAt + policy.windowMs * 2),
      } satisfies FirestoreRateLimitRecord,
      { merge: true }
    );

    return toAllowedResult(policy, nextCount, windowStartedAt, "firestore");
  });
}

export async function consumeAIRateLimit({
  endpoint,
  userId,
}: {
  endpoint: AIEndpoint;
  userId: string;
}): Promise<AIRateLimitResult> {
  const policy = getPolicy(endpoint);
  let firestore: Firestore | null = null;

  try {
    firestore = getAdminFirestore();
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        domain: "ai",
        endpoint,
        event: "rate_limit_firestore_init_failed",
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }

  if (firestore) {
    try {
      return await consumeFromFirestore(firestore, endpoint, userId, policy);
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          domain: "ai",
          endpoint,
          event: "rate_limit_firestore_fallback",
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  return consumeFromMemory(endpoint, userId, policy);
}

export function applyRateLimitHeaders(
  response: NextResponse,
  result: AIRateLimitResult
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(result.resetAt));

  if (!result.allowed || result.retryAfterSeconds > 0) {
    response.headers.set("Retry-After", String(result.retryAfterSeconds));
  }

  return response;
}

export function resetAIRateLimitMemoryStore() {
  memoryStore.clear();
}
