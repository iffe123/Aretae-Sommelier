export const ENV_PUBLIC_ERROR_MESSAGE =
  "Service is not configured. Please set required environment variables. See README.md#environment-variables.";

type EnvSchema = readonly string[];

const PLACEHOLDER_PATTERNS = [
  "your_api_key_here",
  "your_project_id",
  "your_sender_id",
  "your_app_id",
  "your_project",
  "your_gemini_api_key_here",
  "your_",
];

export function isPlaceholderValue(value?: string): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => normalized.includes(pattern));
}

const clientEnvSchema = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

const serverEnvSchema = ["GEMINI_API_KEY"] as const;

export interface ClientEnv {
  NEXT_PUBLIC_FIREBASE_API_KEY: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  NEXT_PUBLIC_FIREBASE_APP_ID: string;
}

export interface ServerEnv {
  GEMINI_API_KEY: string;
}

function formatEnvError(keys: string[], scope: "client" | "server"): string {
  const keyList = keys.length > 0 ? keys.join(", ") : "unknown";
  return `[env] Missing or invalid environment variables (${scope}): ${keyList}. See README.md#environment-variables.`;
}

function validateEnv<T extends EnvSchema>(schema: T, scope: "client" | "server") {
  const missingKeys: string[] = [];
  const data: Record<string, string> = {};

  for (const key of schema) {
    const value = process.env[key];
    if (!value || isPlaceholderValue(value)) {
      missingKeys.push(key);
      continue;
    }
    data[key] = value;
  }

  if (missingKeys.length > 0) {
    return { valid: false, data, message: formatEnvError(missingKeys, scope) };
  }

  return { valid: true, data, message: "" };
}

let cachedServerEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const result = validateEnv(serverEnvSchema, "server");
  if (!result.valid) {
    throw new Error(result.message);
  }

  cachedServerEnv = result.data as unknown as ServerEnv;
  return cachedServerEnv;
}

export function getClientEnv(): ClientEnv {
  const result = validateEnv(clientEnvSchema, "client");
  if (!result.valid) {
    // Only throw at runtime in production when the app is actually running
    // During build/prerendering (NEXT_PHASE check) or SSR, use fallback values
    const isRuntimeProduction = process.env.NODE_ENV === "production" && typeof window !== "undefined";
    if (isRuntimeProduction) {
      throw new Error(result.message);
    }
    // Log warning in development or during SSR/build
    if (process.env.NODE_ENV !== "production") {
      console.warn(result.message);
    }
    // Return fallback values with empty strings for missing values
    // This maintains type safety while allowing the app to build/run for development
    return {
      NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
      NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
    };
  }

  return result.data as unknown as ClientEnv;
}
