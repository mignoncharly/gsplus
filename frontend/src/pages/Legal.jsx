import { FileText } from 'lucide-react';
import LegalPageLayout from '../components/LegalPageLayout';
import OwnerLegalDocument from '../components/OwnerLegalDocument';
import { LEGAL_MENTIONS_LAST_UPDATED } from '../content/legal';
import { ENGLISH_AUTHORITY_NOTICE, OWNER_LEGAL_DOCUMENTS } from '../content/owner-legal-documents';
import { useLocale } from '../lib/i18n.js';

const Legal = () => {
  const { locale } = useLocale();
  return <LegalPageLayout icon={FileText} title={locale === 'en' ? 'Legal notice' : 'Mentions légales'} lastUpdated={LEGAL_MENTIONS_LAST_UPDATED}>
    {locale === 'en' && <p className="legal-notice" lang="en">{ENGLISH_AUTHORITY_NOTICE}</p>}
    <OwnerLegalDocument text={locale === 'en' ? OWNER_LEGAL_DOCUMENTS.en.legalNotice : OWNER_LEGAL_DOCUMENTS.legalNotice} />
  </LegalPageLayout>;
};

export default Legal;
