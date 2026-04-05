import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

async function loadEnvModule() {
  vi.resetModules();
  return import('../env');
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('env server validation (AI credentials)', () => {
  it('throws when both gateway and direct AI credentials are missing', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;

    const { getServerEnv, ENV_PUBLIC_ERROR_MESSAGE } = await loadEnvModule();

    expect(() => getServerEnv()).toThrow('AI_GATEWAY_API_KEY');
    expect(ENV_PUBLIC_ERROR_MESSAGE).toContain('Service is not configured');
  });

  it('throws when GEMINI_API_KEY is a placeholder value', async () => {
    process.env.GEMINI_API_KEY = 'your_gemini_api_key_here';
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;

    const { getServerEnv } = await loadEnvModule();

    expect(() => getServerEnv()).toThrow('AI_GATEWAY_API_KEY');
  });

  it('returns env when GEMINI_API_KEY is provided', async () => {
    process.env.GEMINI_API_KEY = 'test-real-looking-key';
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;

    const { getServerEnv } = await loadEnvModule();

    expect(getServerEnv()).toEqual(
      expect.objectContaining({
        GEMINI_API_KEY: 'test-real-looking-key',
      }),
    );
  });

  it('returns env when VERCEL_OIDC_TOKEN is provided without GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    process.env.VERCEL_OIDC_TOKEN = 'oidc-token';

    const { getServerEnv } = await loadEnvModule();

    expect(getServerEnv()).toEqual(
      expect.objectContaining({
        VERCEL_OIDC_TOKEN: 'oidc-token',
      }),
    );
  });
});
