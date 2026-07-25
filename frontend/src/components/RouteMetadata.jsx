import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getRouteMetadata, LOCAL_BUSINESS_SCHEMA } from '../content/site-metadata';

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

const updateStructuredData = (enabled) => {
  let script = document.getElementById('local-business-schema');
  if (!enabled) {
    script?.remove();
    return;
  }
  if (!script) {
    script = document.createElement('script');
    script.id = 'local-business-schema';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(LOCAL_BUSINESS_SCHEMA);
};

const RouteMetadata = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const metadata = getRouteMetadata(pathname);
    document.documentElement.lang = 'fr';
    document.title = metadata.title;

    upsertMeta('meta[name="description"]', { name: 'description', content: metadata.description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: metadata.robots });

    if (metadata.indexable) {
      upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
      upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'fr_FR' });
      upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Golden Studio Plus' });
      upsertMeta('meta[property="og:title"]', { property: 'og:title', content: metadata.title });
      upsertMeta('meta[property="og:description"]', { property: 'og:description', content: metadata.description });
      upsertMeta('meta[property="og:url"]', { property: 'og:url', content: metadata.canonical });
      upsertMeta('meta[property="og:image"]', { property: 'og:image', content: metadata.image });
      upsertMeta('meta[property="og:image:alt"]', {
        property: 'og:image:alt',
        content: 'Portrait Golden Studio Plus à Douala',
      });
      upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
      upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: metadata.title });
      upsertMeta('meta[name="twitter:description"]', {
        name: 'twitter:description',
        content: metadata.description,
      });
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: metadata.image });
    } else {
      document.head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((tag) => tag.remove());
    }

    upsertCanonical(metadata.canonical);
    updateStructuredData(metadata.indexable);
  }, [pathname]);

  return null;
};

export default RouteMetadata;
