import { useEffect, useMemo, useState } from 'react';
import { getStoredLocale, LocaleContext, messages, resolveLocale, storeLocale } from '../lib/i18n';

const LocaleProvider = ({ children }) => {
  const [locale, setLocaleState] = useState(getStoredLocale);
  const setLocale = (nextLocale) => setLocaleState(resolveLocale(nextLocale));
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
    storeLocale(locale);
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (key) => messages[locale][key] ?? messages.fr[key] ?? key }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export default LocaleProvider;
