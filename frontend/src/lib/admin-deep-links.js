/**
 * Admin routing vocabulary.
 *
 * `tab` is the internal view key used by AdminDashboard state.
 * `slug` is the public URL segment and is permanent: administrators bookmark it and
 * later phases must not renumber it.
 * `aliases` keep every URL that has ever been published working. In particular
 * `/admin/leads/:reference` and `/admin/finance/:id` are embedded in e-mails that
 * have already been delivered and in Cal.com event descriptions, so they can never
 * stop resolving — see backend/src/utils/admin-links.ts.
 */
export const ADMIN_VIEWS = Object.freeze([
  { tab: 'overview', slug: 'tableau-de-bord' },
  { tab: 'reservations', slug: 'reservations', record: 'reservations' },
  { tab: 'leads', slug: 'demandes', record: 'leads', aliases: ['leads'] },
  { tab: 'finance', slug: 'paiements', record: 'finance', aliases: ['finance'] },
  { tab: 'tarifs', slug: 'offres' },
  { tab: 'availability', slug: 'planning' },
  { tab: 'portfolio', slug: 'medias' },
  { tab: 'notifications', slug: 'messages' },
  { tab: 'governance', slug: 'conformite' },
  { tab: 'account', slug: 'securite' },
]);

export const DEFAULT_ADMIN_TAB = 'overview';

const bySlug = new Map();
const byTab = new Map();
for (const view of ADMIN_VIEWS) {
  byTab.set(view.tab, view);
  bySlug.set(view.slug, view);
  // Every internal tab key also resolves, so no previously constructed link breaks.
  bySlug.set(view.tab, view);
  for (const alias of view.aliases ?? []) bySlug.set(alias, view);
}

export const adminViewPath = (tab) => `/admin/${(byTab.get(tab) ?? byTab.get(DEFAULT_ADMIN_TAB)).slug}`;

export const adminRecordPath = (record, reference) => {
  const view = ADMIN_VIEWS.find((item) => item.record === record);
  if (!view || !reference) return adminViewPath(DEFAULT_ADMIN_TAB);
  return `${adminViewPath(view.tab)}/${encodeURIComponent(reference)}`;
};

const legacyQueryDestination = (search) => {
  const query = new URLSearchParams(search);
  const reservation = query.get('reservation');
  if (reservation) return { tab: 'reservations', area: 'reservations', reference: reservation };
  const lead = query.get('lead');
  if (lead) return { tab: 'leads', area: 'leads', reference: lead };
  return null;
};

/**
 * Resolves an admin URL to the view it selects and, when the path carries one, the
 * record to open. Returns null only when the path is not an admin path at all;
 * an unrecognised admin segment falls back to the dashboard rather than stranding
 * the administrator on a blank view.
 */
export const parseAdminDestination = (pathname, search = '') => {
  const segments = String(pathname || '').split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== 'admin') return null;

  if (segments.length === 1) {
    return legacyQueryDestination(search) ?? { tab: DEFAULT_ADMIN_TAB, area: null, reference: null };
  }

  const view = bySlug.get(segments[1]);
  if (!view) return { tab: DEFAULT_ADMIN_TAB, area: null, reference: null };

  const reference = segments[2];
  if (reference && view.record) return { tab: view.tab, area: view.record, reference };
  return { tab: view.tab, area: null, reference: null };
};

export const adminTabFromPath = (pathname, search = '') =>
  parseAdminDestination(pathname, search)?.tab ?? DEFAULT_ADMIN_TAB;
