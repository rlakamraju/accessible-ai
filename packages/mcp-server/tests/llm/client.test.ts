import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();
const mockConstructor = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  class MockAPIError extends Error {
    status?: number;
  }
  class MockAnthropic {
    messages = { create: mockCreate };
    constructor(opts: { apiKey: string }) {
      mockConstructor(opts);
    }
    static APIError = MockAPIError;
  }
  return { default: MockAnthropic };
});

const originalEnvKey = process.env.ANTHROPIC_API_KEY;

describe('callClaude', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreate.mockReset();
    mockConstructor.mockReset();
    mockCreate.mockResolvedValue({
      usage: { input_tokens: 10, output_tokens: 5 },
      content: [{ type: 'text', text: 'response' }],
    });
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalEnvKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalEnvKey;
  });

  it('throws a clear error when no apiKey is given and no env var is set', async () => {
    const { callClaude } = await import('../../src/llm/client');
    await expect(callClaude({ system: 's', messages: [] })).rejects.toThrow(/No Anthropic API key configured/);
  });

  it('uses ANTHROPIC_API_KEY from the environment when no per-request key is given', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key';
    const { callClaude } = await import('../../src/llm/client');
    await callClaude({ system: 's', messages: [] });
    expect(mockConstructor).toHaveBeenCalledWith({ apiKey: 'env-key' });
  });

  it('caches the env-based client across calls', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key';
    const { callClaude } = await import('../../src/llm/client');
    await callClaude({ system: 's', messages: [] });
    await callClaude({ system: 's', messages: [] });
    expect(mockConstructor).toHaveBeenCalledTimes(1);
  });

  it('prefers a per-request apiKey over the env var, and never caches it', async () => {
    process.env.ANTHROPIC_API_KEY = 'env-key';
    const { callClaude } = await import('../../src/llm/client');
    await callClaude({ system: 's', messages: [], apiKey: 'client-key-1' });
    await callClaude({ system: 's', messages: [], apiKey: 'client-key-2' });
    expect(mockConstructor).toHaveBeenNthCalledWith(1, { apiKey: 'client-key-1' });
    expect(mockConstructor).toHaveBeenNthCalledWith(2, { apiKey: 'client-key-2' });
  });
});
