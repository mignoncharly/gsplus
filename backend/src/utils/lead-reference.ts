import { randomBytes as cryptoRandomBytes } from 'node:crypto';

import { LeadType } from '../generated/prisma/enums.js';
import { businessDateKey } from './business-time.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LEAD_REFERENCE_PATTERN = /^(CONTACT|B2B|DEVIS)-\d{6}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

const prefixForType = (type: LeadType) => type === LeadType.CONTACT ? 'CONTACT' : type === LeadType.B2B ? 'B2B' : 'DEVIS';

export const generateLeadReference = (type: LeadType, now = new Date(), randomBytes: (size: number) => Uint8Array = cryptoRandomBytes) => {
  const compactDate = businessDateKey(now).slice(2).replaceAll('-', '');
  const unbiasedLimit = 256 - (256 % ALPHABET.length);
  let suffix = '';
  for (let draw = 0; suffix.length < 4 && draw < 128; draw += 1) {
    for (const byte of randomBytes(8)) {
      if (byte >= unbiasedLimit) continue;
      suffix += ALPHABET[byte % ALPHABET.length];
      if (suffix.length === 4) break;
    }
  }
  if (suffix.length !== 4) throw new Error('LEAD_REFERENCE_RANDOMNESS_EXHAUSTED');
  return `${prefixForType(type)}-${compactDate}-${suffix}`;
};

export const allocateLeadReference = async (type: LeadType, exists: (reference: string) => Promise<boolean>, generate = () => generateLeadReference(type)) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const reference = generate();
    if (!(await exists(reference))) return reference;
  }
  throw new Error('LEAD_REFERENCE_ALLOCATION_EXHAUSTED');
};
