import { useLocation, useNavigate } from 'react-router-dom';
import { useLocale } from '../lib/i18n.js';
import { localizedPath } from '../lib/locale-routes.js';
import './LanguageSwitcher.css';

const LanguageSwitcher = ({ compact = false }) => {
  const { locale, setLocale, t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const selectLocale = (nextLocale) => {
    if (nextLocale === locale) return;
    setLocale(nextLocale);
    navigate(`${localizedPath(nextLocale, location.pathname)}${location.search}${location.hash}`);
  };

  return (
    <fieldset className={`language-switcher${compact ? ' language-switcher--compact' : ''}`} aria-label={t('language')}>
      <legend className="sr-only">{t('language')}</legend>
      <button type="button" className={locale === 'fr' ? 'is-active' : ''} onClick={() => selectLocale('fr')} aria-pressed={locale === 'fr'} lang="fr">FR</button>
      <button type="button" className={locale === 'en' ? 'is-active' : ''} onClick={() => selectLocale('en')} aria-pressed={locale === 'en'} lang="en">EN</button>
    </fieldset>
  );
};

export default LanguageSwitcher;
