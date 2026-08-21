export const parseAdminDestination = (pathname, search = '') => {
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0] !== 'admin') return null;
  if (segments.length === 1) {
    const legacy = new URLSearchParams(search);
    if (legacy.get('reservation')) return { area: 'reservations', reference: legacy.get('reservation') };
    if (legacy.get('lead')) return { area: 'leads', reference: legacy.get('lead') };
    return null;
  }
  if (segments.length < 3) return null;
  const [, area, reference] = segments;
  if (!reference || !['reservations', 'leads', 'finance'].includes(area)) return null;
  return { area, reference };
};
