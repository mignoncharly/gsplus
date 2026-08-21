import terms from '../../../docs/new docs/cgv.txt?raw';
import legalNotice from '../../../docs/new docs/mentions legales.txt?raw';
import privacy from '../../../docs/new docs/politique de confidentialite.txt?raw';
import termsEn from '../../../docs/new docs/cgv.en.txt?raw';
import legalNoticeEn from '../../../docs/new docs/mentions legales.en.txt?raw';
import privacyEn from '../../../docs/new docs/politique de confidentialite.en.txt?raw';

export const ENGLISH_AUTHORITY_NOTICE = 'This English translation is provided for convenience. The French version remains authoritative.';

export const OWNER_LEGAL_DOCUMENTS = Object.freeze({
  terms,
  legalNotice,
  privacy,
  en: Object.freeze({ terms: termsEn, legalNotice: legalNoticeEn, privacy: privacyEn }),
});
