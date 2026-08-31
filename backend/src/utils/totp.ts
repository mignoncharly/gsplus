import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * RFC 4226 / RFC 6238, implemented here rather than pulled in.
 *
 * It is about forty lines of standard arithmetic, it sits on the authentication path, and
 * a dependency there is a dependency that can change under us. `node:crypto` does the only
 * part worth trusting to someone else.
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const base32Encode = (buffer: Uint8Array) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

export const base32Decode = (input: string) => {
  const cleaned = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of cleaned) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index === -1) throw new Error('TOTP_SECRET_INVALID');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
};

/** 20 bytes is the RFC 4226 recommendation and what every authenticator app expects. */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

export const totpCodeAt = (secret: string, timestampMs: number, stepSeconds = 30, digits = 6) => {
  const counter = Math.floor(timestampMs / 1000 / stepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  // Dynamic truncation, RFC 4226 §5.4.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
};

/**
 * One step either side of now, which is what every authenticator does: phones drift, and
 * a code typed at the very end of its window is still the code the user was shown.
 * Wider than that starts trading real security for convenience.
 */
export const verifyTotp = (secret: string, code: string, nowMs = Date.now(), window = 1) => {
  const candidate = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(candidate)) return false;
  for (let drift = -window; drift <= window; drift += 1) {
    const expected = totpCodeAt(secret, nowMs + drift * 30_000);
    // Constant time, so a wrong code cannot be narrowed down by how long the answer took.
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))) return true;
  }
  return false;
};

export const totpProvisioningUri = (secret: string, account: string, issuer = 'Golden Studio Plus') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
  + `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
