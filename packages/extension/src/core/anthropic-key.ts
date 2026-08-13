const STORAGE_KEY = 'anthropicApiKey';

export interface AnthropicKeyStatus {
  hasKey: boolean;
  keyPreview?: string;
}

function previewKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

export async function getAnthropicApiKey(): Promise<string | undefined> {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  return stored[STORAGE_KEY] as string | undefined;
}

export async function getAnthropicKeyStatus(): Promise<AnthropicKeyStatus> {
  const key = await getAnthropicApiKey();
  if (!key) return { hasKey: false };
  return { hasKey: true, keyPreview: previewKey(key) };
}

export async function saveAnthropicApiKey(key: string): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: key });
}

export async function removeAnthropicApiKey(): Promise<void> {
  await chrome.storage.sync.remove(STORAGE_KEY);
}
