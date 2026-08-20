import { useLocale } from '../lib/i18n.js';
import './LanguageSwitcher.css';

const LanguageSwitcher = ({ compact = false }) => {
  const { locale, setLocale, t } = useLocale();
  return (
    <fieldset className={`language-switcher${compact ? ' language-switcher--compact' : ''}`} aria-label={t('language')}>
      <legend className="sr-only">{t('language')}</legend>
      <button type="button" className={locale === 'fr' ? 'is-active' : ''} onClick={() => setLocale('fr')} aria-pressed={locale === 'fr'} lang="fr">FR</button>
      <button type="button" className={locale === 'en' ? 'is-active' : ''} onClick={() => setLocale('en')} aria-pressed={locale === 'en'} lang="en">EN</button>
    </fieldset>
  );
};

export default LanguageSwitcher;
