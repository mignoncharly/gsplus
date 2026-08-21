import { Scale } from 'lucide-react';
import LegalPageLayout from '../components/LegalPageLayout';
import OwnerLegalDocument from '../components/OwnerLegalDocument';
import { TERMS_LAST_UPDATED } from '../content/legal';
import { ENGLISH_AUTHORITY_NOTICE, OWNER_LEGAL_DOCUMENTS } from '../content/owner-legal-documents';
import { useLocale } from '../lib/i18n.js';

const Terms = () => {
  const { locale } = useLocale();
  return <LegalPageLayout icon={Scale} title={locale === 'en' ? 'Terms of sale' : 'Conditions Générales de Vente'} lastUpdated={TERMS_LAST_UPDATED}>
    {locale === 'en' && <p className="legal-notice" lang="en">{ENGLISH_AUTHORITY_NOTICE}</p>}
    <OwnerLegalDocument text={locale === 'en' ? OWNER_LEGAL_DOCUMENTS.en.terms : OWNER_LEGAL_DOCUMENTS.terms} />
  </LegalPageLayout>;
};

export default Terms;
