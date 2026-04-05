export const ENV_PUBLIC_ERROR_MESSAGE =
  "Service is not configured. Please set required environment variables. See README.md#environment-variables.";

const PLACEHOLDER_PATTERNS = [
  "your_api_key_here",
  "your_project_id",
  "your_sender_id",
  "your_app_id",
  "your_project",
  "your_gemini_api_key_here",
  "your_ai_gateway_api_key_here",
  "your_",
];

export function isPlaceholderValue(value?: string): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export interface ClientEnv {
  NEXT_PUBLIC_FIREBASE_API_KEY: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  NEXT_PUBLIC_FIREBASE_APP_ID: string;
}

export interface ServerEnv {
  GEMINI_API_KEY?: string;
  AI_GATEWAY_API_KEY?: string;
  VERCEL_OIDC_TOKEN?: string;
  AI_PRIMARY_MODEL?: string;
  AI_VISION_MODEL?: string;
  AI_FALLBACK_MODELS?: string;
  FIREBASE_SERVICE_ACCOUNT_KEY?: string;
}

function formatEnvError(keys: string[], scope: "client" | "server"): string {
  const keyList = keys.length > 0 ? keys.join(", ") : "unknown";
  return `[env] Missing or invalid environment variables (${scope}): ${keyList}. See README.md#environment-variables.`;
}

let cachedServerEnv: ServerEnv | undefined;

function readOptionalServerEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value || isPlaceholderValue(value)) {
    return undefined;
  }

  return value;
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const env: ServerEnv = {
    GEMINI_API_KEY: readOptionalServerEnv("GEMINI_API_KEY"),
    AI_GATEWAY_API_KEY: readOptionalServerEnv("AI_GATEWAY_API_KEY"),
    VERCEL_OIDC_TOKEN: readOptionalServerEnv("VERCEL_OIDC_TOKEN"),
    AI_PRIMARY_MODEL: readOptionalServerEnv("AI_PRIMARY_MODEL"),
    AI_VISION_MODEL: readOptionalServerEnv("AI_VISION_MODEL"),
    AI_FALLBACK_MODELS: readOptionalServerEnv("AI_FALLBACK_MODELS"),
  };

  const hasGatewayAuth = Boolean(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN);
  const hasDirectModelAuth = Boolean(env.GEMINI_API_KEY);

  if (!hasGatewayAuth && !hasDirectModelAuth) {
    throw new Error(
      formatEnvError(
        ["AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN", "GEMINI_API_KEY"],
        "server"
      )
    );
  }

  // Add optional server env vars
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey && !isPlaceholderValue(serviceAccountKey)) {
    env.FIREBASE_SERVICE_ACCOUNT_KEY = serviceAccountKey;
  }

  cachedServerEnv = env;
  return cachedServerEnv;
}

export function getClientEnv(): ClientEnv {
  // IMPORTANT: Next.js only inlines NEXT_PUBLIC_* env vars when accessed as
  // static string literals (e.g. process.env.NEXT_PUBLIC_FIREBASE_API_KEY).
  // Dynamic access like process.env[key] does NOT work in the browser bundle.
  // We must reference each variable explicitly for Next.js to inline them.
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };
}
