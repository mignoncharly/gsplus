import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getStoredLocale, LocaleContext, messages, resolveLocale, storeLocale } from '../lib/i18n';
import { routeLocale } from '../lib/locale-routes.js';

const LocaleProvider = ({ children }) => {
  const location = useLocation();
  const [preferredLocale, setPreferredLocale] = useState(getStoredLocale);
  const locale = routeLocale(location.pathname) || preferredLocale;
  const setLocale = (nextLocale) => setPreferredLocale(resolveLocale(nextLocale));

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
    storeLocale(locale);
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t: (key) => messages[locale][key] ?? messages.fr[key] ?? key }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export default LocaleProvider;
