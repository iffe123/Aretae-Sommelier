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

describe('env server validation (Gemini)', () => {
  it('throws when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const { getServerEnv, ENV_PUBLIC_ERROR_MESSAGE } = await loadEnvModule();

    expect(() => getServerEnv()).toThrow('GEMINI_API_KEY');
    expect(ENV_PUBLIC_ERROR_MESSAGE).toContain('Service is not configured');
  });

  it('throws when GEMINI_API_KEY is a placeholder value', async () => {
    process.env.GEMINI_API_KEY = 'your_gemini_api_key_here';

    const { getServerEnv } = await loadEnvModule();

    expect(() => getServerEnv()).toThrow('GEMINI_API_KEY');
  });

  it('returns env when GEMINI_API_KEY is provided', async () => {
    process.env.GEMINI_API_KEY = 'test-real-looking-key';

    const { getServerEnv } = await loadEnvModule();

    expect(getServerEnv()).toEqual(
      expect.objectContaining({
        GEMINI_API_KEY: 'test-real-looking-key',
      }),
    );
  });
});
