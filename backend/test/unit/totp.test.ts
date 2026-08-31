import { describe, expect, it } from 'vitest';

import { base32Decode, base32Encode, generateTotpSecret, totpCodeAt, totpProvisioningUri, verifyTotp } from '../../src/utils/totp.js';

describe('TOTP', () => {
  it('round-trips base32', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'abcd', 'abcde', 'Golden Studio Plus']) {
      expect(base32Decode(base32Encode(Buffer.from(text))).toString()).toBe(text);
    }
  });

  it('matches the RFC 6238 reference vectors', () => {
    // RFC 6238 appendix B uses the ASCII secret "12345678901234567890".
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    expect(totpCodeAt(secret, 59_000)).toBe('287082');
    expect(totpCodeAt(secret, 1_111_111_109_000)).toBe('081804');
    expect(totpCodeAt(secret, 1_234_567_890_000)).toBe('005924');
    expect(totpCodeAt(secret, 2_000_000_000_000)).toBe('279037');
  });

  it('accepts one step of drift either side and nothing beyond', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totpCodeAt(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, totpCodeAt(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpCodeAt(secret, now + 30_000), now)).toBe(true);
    // Two steps out is a code the user is no longer being shown.
    expect(verifyTotp(secret, totpCodeAt(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, totpCodeAt(secret, now + 90_000), now)).toBe(false);
  });

  it('refuses anything that is not six digits, without throwing', () => {
    const secret = generateTotpSecret();
    for (const code of ['', '12345', '1234567', 'abcdef', '12 34 56', null, undefined]) {
      expect(verifyTotp(secret, code as string)).toBe(false);
    }
  });

  it('builds a provisioning URI an authenticator can read', () => {
    const uri = totpProvisioningUri('JBSWY3DPEHPK3PXP', 'owner@example.test');
    expect(uri).toContain('otpauth://totp/Golden%20Studio%20Plus:owner%40example.test');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('period=30');
  });
});
