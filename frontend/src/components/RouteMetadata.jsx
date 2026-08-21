import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getLocalBusinessSchema, getRouteMetadata } from '../content/site-metadata';
import { useLocale } from '../lib/i18n.js';

const upsertMeta = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, value);
  });
};

const upsertCanonical = (href) => {
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!href) {
    canonical?.remove();
    return;
  }
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', href);
};

const updateAlternates = (alternates) => {
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((tag) => tag.remove());
  if (!alternates) return;
  for (const [language, href] of [['fr', alternates.fr], ['en', alternates.en], ['x-default', alternates.xDefault]]) {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = language;
    link.href = href;
    document.head.appendChild(link);
  }
};

const updateStructuredData = (metadata) => {
  let script = document.getElementById('local-business-schema');
  if (!metadata.indexable) {
    script?.remove();
    return;
  }
  if (!script) {
    script = document.createElement('script');
    script.id = 'local-business-schema';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(getLocalBusinessSchema(metadata));
};

const RouteMetadata = () => {
  const { pathname } = useLocation();
  const { locale } = useLocale();

  useEffect(() => {
    const metadata = getRouteMetadata(pathname, locale);
    document.documentElement.lang = metadata.locale;
    document.title = metadata.title;

    upsertMeta('meta[name="description"]', { name: 'description', content: metadata.description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: metadata.robots });

    if (metadata.indexable) {
      upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
      upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: metadata.locale === 'en' ? 'en_US' : 'fr_FR' });
      upsertMeta('meta[property="og:locale:alternate"]', { property: 'og:locale:alternate', content: metadata.locale === 'en' ? 'fr_FR' : 'en_US' });
      upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Golden Studio Plus' });
      upsertMeta('meta[property="og:title"]', { property: 'og:title', content: metadata.title });
      upsertMeta('meta[property="og:description"]', { property: 'og:description', content: metadata.description });
      upsertMeta('meta[property="og:url"]', { property: 'og:url', content: metadata.canonical });
      upsertMeta('meta[property="og:image"]', { property: 'og:image', content: metadata.image });
      upsertMeta('meta[property="og:image:secure_url"]', { property: 'og:image:secure_url', content: metadata.image });
      upsertMeta('meta[property="og:image:type"]', { property: 'og:image:type', content: metadata.imageType });
      upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: String(metadata.imageWidth) });
      upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: String(metadata.imageHeight) });
      upsertMeta('meta[property="og:image:alt"]', {
        property: 'og:image:alt',
        content: metadata.imageAlt,
      });
      upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
      upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: metadata.title });
      upsertMeta('meta[name="twitter:description"]', {
        name: 'twitter:description',
        content: metadata.description,
      });
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: metadata.image });
      upsertMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: metadata.imageAlt });
    } else {
      document.head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((tag) => tag.remove());
    }

    upsertCanonical(metadata.canonical);
    updateAlternates(metadata.alternates);
    updateStructuredData(metadata);
  }, [locale, pathname]);

  return null;
};

export default RouteMetadata;
