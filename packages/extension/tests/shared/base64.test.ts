// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { toBase64 } from '../../src/shared/base64';

function fromBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

describe('toBase64', () => {
  it('round-trips a short ASCII string', () => {
    const encoded = toBase64('hello world');
    expect(fromBase64(encoded)).toBe('hello world');
  });

  it('round-trips non-ASCII UTF-8 content', () => {
    const input = 'Accessibilité — 你好 — emoji 🎉';
    expect(fromBase64(toBase64(input))).toBe(input);
  });

  it('round-trips a payload larger than the internal chunk size', () => {
    const input = 'x'.repeat(0x8000 * 3 + 17);
    expect(fromBase64(toBase64(input))).toBe(input);
  });

  it('round-trips an empty string', () => {
    expect(fromBase64(toBase64(''))).toBe('');
  });
});
