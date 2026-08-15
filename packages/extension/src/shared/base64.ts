/**
 * UTF-8-safe string → base64. Chunks the byte array before spreading into `String.fromCharCode`
 * to avoid a call-stack overflow on large inputs (e.g. a DOM snapshot).
 */
export function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
