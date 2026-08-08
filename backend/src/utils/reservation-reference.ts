import { randomBytes as cryptoRandomBytes } from 'node:crypto';

import { businessDateKey } from './business-time.js';

export const PUBLIC_REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PUBLIC_REFERENCE_PATTERN = /^GSP-\d{6}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

type RandomBytes = (size: number) => Uint8Array;

type GenerateOptions = {
  now?: Date;
  randomBytes?: RandomBytes;
};

type AllocateOptions = {
  exists: (candidate: string) => Promise<boolean>;
  generate?: () => string;
  maxAttempts?: number;
};

export const generatePublicReservationReference = ({
  now = new Date(),
  randomBytes = cryptoRandomBytes,
}: GenerateOptions = {}) => {
  const compactDate = businessDateKey(now).slice(2).replaceAll('-', '');
  const alphabetLength = PUBLIC_REFERENCE_ALPHABET.length;
  const unbiasedLimit = 256 - (256 % alphabetLength);
  let suffix = '';

  for (let draw = 0; suffix.length < 4 && draw < 128; draw += 1) {
    const bytes = randomBytes(Math.max(8, (4 - suffix.length) * 2));
    for (const byte of bytes) {
      if (byte >= unbiasedLimit) continue;
      suffix += PUBLIC_REFERENCE_ALPHABET[byte % alphabetLength];
      if (suffix.length === 4) break;
    }
  }

  if (suffix.length !== 4) {
    throw new Error('PUBLIC_REFERENCE_RANDOMNESS_EXHAUSTED');
  }

  return `GSP-${compactDate}-${suffix}`;
};

export const allocatePublicReservationReference = async ({
  exists,
  generate = generatePublicReservationReference,
  maxAttempts = 8,
}: AllocateOptions) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generate();
    if (!(await exists(candidate))) return candidate;
  }

  throw new Error('PUBLIC_REFERENCE_ALLOCATION_EXHAUSTED');
};
