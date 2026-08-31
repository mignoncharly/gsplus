import { apiFetch } from './api-transport.js';

/**
 * The public site's only settings call, kept out of `api.js`.
 *
 * `api.js` holds the whole administration API surface. Importing it from a component
 * the public entry loads eagerly pulled every admin endpoint into the bundle every
 * visitor downloads, which is how this call added roughly 10 kB to the entry when it
 * first landed.
 */
export const getSiteSettings = async (locale = 'fr') => (await apiFetch(`/api/site-settings?locale=${encodeURIComponent(locale)}`)).data;
