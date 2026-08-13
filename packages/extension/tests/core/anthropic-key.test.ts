import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAnthropicApiKey,
  getAnthropicKeyStatus,
  removeAnthropicApiKey,
  saveAnthropicApiKey,
} from '../../src/core/anthropic-key';

beforeEach(async () => {
  await chrome.storage.sync.remove('anthropicApiKey');
});

describe('anthropic-key storage', () => {
  it('reports no key when none is stored', async () => {
    expect(await getAnthropicApiKey()).toBeUndefined();
    expect(await getAnthropicKeyStatus()).toEqual({ hasKey: false });
  });

  it('saves and retrieves a key', async () => {
    await saveAnthropicApiKey('sk-ant-api03-abcdefghijklmnop');
    expect(await getAnthropicApiKey()).toBe('sk-ant-api03-abcdefghijklmnop');
  });

  it('reports hasKey with a masked preview once saved', async () => {
    await saveAnthropicApiKey('sk-ant-api03-abcdefghijklmnop');
    const status = await getAnthropicKeyStatus();
    expect(status.hasKey).toBe(true);
    expect(status.keyPreview).toBe('sk-ant-a…mnop');
  });

  it('removes a stored key', async () => {
    await saveAnthropicApiKey('sk-ant-api03-abcdefghijklmnop');
    await removeAnthropicApiKey();
    expect(await getAnthropicApiKey()).toBeUndefined();
  });
});
