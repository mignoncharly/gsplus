export const PORTFOLIO_CATEGORIES = [
  'Portrait',
  'Couple',
  'Maternité',
  'Corporate',
  'Famille',
  'Événementiel',
];

const categoryAliases = new Map([
  ['portrait', 'Portrait'],
  ['couple', 'Couple'],
  ['maternite', 'Maternité'],
  ['corporate', 'Corporate'],
  ['famille', 'Famille'],
  ['evenementiel', 'Événementiel'],
]);

const normalizedKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export const canonicalPortfolioCategory = (value) => categoryAliases.get(normalizedKey(value)) || null;

const validMediaUrl = (value) =>
  typeof value === 'string' && (value.startsWith('/') || /^https:\/\//i.test(value));

const normalizeItem = (item) => {
  const category = canonicalPortfolioCategory(item?.category);
  if (!category || !validMediaUrl(item?.url)) return null;

  return {
    ...item,
    category,
    altText: item.altText || item.title || `${category} — Golden Studio Plus`,
  };
};

export const curatePortfolioMedia = (apiItems = [], fallbackItems = []) => {
  const seen = new Set();
  const curated = [];

  for (const candidate of [...apiItems, ...fallbackItems]) {
    const item = normalizeItem(candidate);
    if (!item) continue;

    const key = item.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    curated.push(item);
  }

  return curated;
};

export const responsiveImageData = (item, mapUrl = (value) => value) => {
  const candidates = [
    { url: item?.thumbnailUrl, width: item?.thumbnailWidth },
    { url: item?.url, width: item?.width },
  ]
    .filter((candidate) => validMediaUrl(candidate.url))
    .map((candidate) => ({ ...candidate, url: mapUrl(candidate.url) }))
    .filter((candidate, index, values) => values.findIndex((value) => value.url === candidate.url) === index)
    .sort((left, right) => (left.width || 0) - (right.width || 0));

  const source = candidates[0]?.url || '';
  const srcSet = candidates
    .filter((candidate) => Number.isInteger(candidate.width))
    .map((candidate) => `${candidate.url} ${candidate.width}w`)
    .join(', ');

  return {
    src: source,
    srcSet: srcSet || undefined,
    width: item?.thumbnailWidth || item?.width,
    height: item?.thumbnailHeight || item?.height,
  };
};
