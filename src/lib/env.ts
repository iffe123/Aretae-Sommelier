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

function validateEnv<const T extends EnvSchema>(schema: T, scope: "client" | "server") {
  const missingKeys: T[number][] = [];
  const data: Partial<Record<T[number], string>> = {};

  for (const key of schema) {
    const typedKey = key as T[number];
    const value = process.env[typedKey];
    if (!value || isPlaceholderValue(value)) {
      missingKeys.push(typedKey);
      continue;
    }
    data[typedKey] = value;
  }

  if (missingKeys.length > 0) {
    return { valid: false, data, message: formatEnvError(missingKeys, scope) };
  }

  return { valid: true, data: data as Record<T[number], string>, message: "" };
}

let cachedServerEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const result = validateEnv(serverEnvSchema, "server");
  if (!result.valid) {
    throw new Error(result.message);
  }

  cachedServerEnv = result.data as ServerEnv;
  return cachedServerEnv;
}

export function getClientEnv(): ClientEnv {
  const result = validateEnv(clientEnvSchema, "client");
  if (!result.valid) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(result.message);
    }
    console.warn(result.message);
  }

  return (result.valid ? (result.data as ClientEnv) : (process.env as ClientEnv));
}
