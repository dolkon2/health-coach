/**
 * uuidv7 — time-sortable IDs (data-model.md: ObservationId is uuid v7).
 *
 * Layout: 48-bit Unix-ms timestamp, version (7) + variant bits, the rest random.
 * Being time-ordered means IDs sort chronologically, a useful tiebreaker for the
 * timeline. Randomness comes from expo-crypto (no polyfill needed).
 */
import * as Crypto from 'expo-crypto';

export function uuidv7(): string {
  const ts = Date.now();
  const bytes = new Uint8Array(16);

  // 48-bit big-endian timestamp in the first 6 bytes.
  bytes[0] = Math.floor(ts / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ts / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ts / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ts / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;

  // Remaining 10 bytes random.
  bytes.set(Crypto.getRandomBytes(10), 6);

  // Version 7 (high nibble of byte 6) and RFC 4122 variant (top bits of byte 8).
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
