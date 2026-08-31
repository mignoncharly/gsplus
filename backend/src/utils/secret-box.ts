import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

import { env } from '../config/env.js';

/**
 * Authenticated encryption for the few secrets that must live in the database.
 *
 * Today that is one thing: a TOTP secret. It cannot be hashed — verifying a code requires
 * the secret itself — so it is encrypted, and the key is derived from the session secret
 * that already exists in the environment rather than adding another one to rotate.
 *
 * The derivation is scoped by `info`, so a value encrypted for one purpose cannot be
 * decrypted as another even with the same environment secret.
 */
const keyFor = (secret: string, purpose: string) =>
  Buffer.from(hkdfSync('sha256', Buffer.from(secret), Buffer.alloc(0), Buffer.from(purpose), 32));

export const sealSecret = (plaintext: string, purpose = 'admin-totp') => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(env.ADMIN_TOTP_ENCRYPTION_KEY, purpose), iv);
  const sealed = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  // v1 names the scheme, so a later change can be told apart from a corrupt value.
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), sealed.toString('base64')].join('.');
};

export const openSecret = (sealed: string, purpose = 'admin-totp') => {
  const [version, iv, tag, payload] = String(sealed ?? '').split('.');
  if (version !== 'v1' || !iv || !tag || !payload) throw new Error('SECRET_BOX_MALFORMED');
  const openWith = (key: string) => {
    const decipher = createDecipheriv('aes-256-gcm', keyFor(key, purpose), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]).toString('utf8');
  };
  try {
    return openWith(env.ADMIN_TOTP_ENCRYPTION_KEY);
  } catch (error) {
    // The previous key exists only for a short rollover window. A value that cannot be
    // opened by either key stays rejected: authentication must never accept corruption.
    if (!env.ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY) throw error;
    return openWith(env.ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY);
  }
};
