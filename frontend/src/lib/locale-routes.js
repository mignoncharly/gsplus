import { DEFAULT_LOCALE, SUPPORTED_LOCALES, resolveLocale } from './i18n.js';

export const PUBLIC_BASE_PATHS = Object.freeze([
  '/', '/services', '/portfolio', '/reservation', '/services-creatifs', '/a-propos',
  '/contact', '/corporate', '/mentions-legales', '/confidentialite', '/cgv',
]);

export const routeLocale = (pathname = '') => {
  const segment = pathname.split('/').filter(Boolean)[0];
  return SUPPORTED_LOCALES.includes(segment) ? segment : null;
};

export const baseRoutePath = (pathname = '/') => {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '') || '/';
  const locale = routeLocale(normalized);
  if (!locale) return normalized;
  const base = normalized.slice(locale.length + 1);
  return base || '/';
};

export const localizedPath = (locale, path = '/') => {
  if (path === '/admin' || path.startsWith('/admin/')) return path;
  const suffixIndex = path.search(/[?#]/);
  const pathname = suffixIndex === -1 ? path : path.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : path.slice(suffixIndex);
  const base = baseRoutePath(pathname);
  const prefix = `/${resolveLocale(locale || DEFAULT_LOCALE)}`;
  return `${base === '/' ? prefix : prefix + base}${suffix}`;
};

export const alternatePaths = (basePath) => ({
  fr: localizedPath('fr', basePath),
  en: localizedPath('en', basePath),
  xDefault: localizedPath(DEFAULT_LOCALE, basePath),
});
