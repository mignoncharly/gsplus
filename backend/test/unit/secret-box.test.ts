import { describe, expect, it } from 'vitest';

import { openSecret, sealSecret } from '../../src/utils/secret-box.js';
import { env } from '../../src/config/env.js';

describe('secret box', () => {
  it('round-trips a secret', () => {
    expect(openSecret(sealSecret('JBSWY3DPEHPK3PXP'))).toBe('JBSWY3DPEHPK3PXP');
  });

  it('produces a different ciphertext every time', () => {
    // A repeated ciphertext would leak that two accounts share a secret.
    expect(sealSecret('same')).not.toBe(sealSecret('same'));
  });

  it('refuses a tampered payload rather than returning a wrong secret', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP');
    const [version, iv, tag, payload] = sealed.split('.');
    const flipped = Buffer.from(payload, 'base64');
    flipped[0] ^= 0xff;
    expect(() => openSecret([version, iv, tag, flipped.toString('base64')].join('.'))).toThrow();
    expect(() => openSecret([version, iv, 'AAAAAAAAAAAAAAAAAAAAAA==', payload].join('.'))).toThrow();
    expect(() => openSecret('not-a-sealed-value')).toThrow('SECRET_BOX_MALFORMED');
  });

  it('cannot open a value sealed for another purpose', () => {
    const sealed = sealSecret('JBSWY3DPEHPK3PXP', 'admin-totp');
    expect(() => openSecret(sealed, 'something-else')).toThrow();
  });

  it('opens the previous key only during a controlled rollover window', () => {
    const current = env.ADMIN_TOTP_ENCRYPTION_KEY;
    const previous = env.ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY;
    try {
      env.ADMIN_TOTP_ENCRYPTION_KEY = 'old-test-totp-encryption-key';
      env.ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY = undefined;
      const sealed = sealSecret('JBSWY3DPEHPK3PXP');
      env.ADMIN_TOTP_ENCRYPTION_KEY = 'new-test-totp-encryption-key';
      env.ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY = 'old-test-totp-encryption-key';
      expect(openSecret(sealed)).toBe('JBSWY3DPEHPK3PXP');
      env.ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY = undefined;
      expect(() => openSecret(sealed)).toThrow();
    } finally {
      env.ADMIN_TOTP_ENCRYPTION_KEY = current;
      env.ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY = previous;
    }
  });
});
