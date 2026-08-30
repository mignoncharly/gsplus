import { createContext, useContext } from 'react';

import { CONTENT_FALLBACK, SETTINGS_FALLBACK } from './site-settings';

/**
 * The context and its hook live outside the provider component so the module stays
 * component-only and fast refresh keeps working.
 */
export const SiteSettingsContext = createContext({ settings: SETTINGS_FALLBACK, content: CONTENT_FALLBACK });

export const useSiteSettings = () => useContext(SiteSettingsContext);
