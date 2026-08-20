import { ShieldCheck } from 'lucide-react';
import LegalPageLayout from '../components/LegalPageLayout';
import OwnerLegalDocument from '../components/OwnerLegalDocument';
import { PRIVACY_LAST_UPDATED } from '../content/legal';
import { OWNER_LEGAL_DOCUMENTS } from '../content/owner-legal-documents';
import { useLocale } from '../lib/i18n.js';

const Privacy = () => {
  const { locale } = useLocale();
  return <LegalPageLayout icon={ShieldCheck} title={locale === 'en' ? 'Privacy policy' : 'Politique de confidentialité'} lastUpdated={PRIVACY_LAST_UPDATED}>
    {locale === 'en' && <p className="legal-notice" lang="en">English convenience translation. The French OWNER text remains the authoritative version.</p>}
    <OwnerLegalDocument text={locale === 'en' ? OWNER_LEGAL_DOCUMENTS.en.privacy : OWNER_LEGAL_DOCUMENTS.privacy} />
  </LegalPageLayout>;
};

export default Privacy;
