import { useEffect, useMemo, useState } from 'react';

import { getSiteSettings } from '../lib/public-settings-api';
import { useLocale } from '../lib/i18n';
import { mergeContent, mergeSettings } from '../lib/site-settings';
import { SiteSettingsContext } from '../lib/use-site-settings';

/**
 * Serves the published settings to the whole public site. It renders its children
 * immediately with the compiled fallbacks and swaps in the published values when they
 * arrive, so a slow or failed request never blanks a phone number or blocks the page.
 */
const SiteSettingsProvider = ({ children }) => {
  const [published, setPublished] = useState(null);
  const { locale } = useLocale();

  useEffect(() => {
    let cancelled = false;
    getSiteSettings(locale)
      .then((data) => { if (!cancelled) setPublished(data); })
      .catch(() => { /* the fallbacks already render a correct site */ });
    return () => { cancelled = true; };
  }, [locale]);

  const value = useMemo(() => ({
    settings: mergeSettings(published?.settings),
    content: mergeContent(published?.content),
  }), [published]);

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
};

export default SiteSettingsProvider;
