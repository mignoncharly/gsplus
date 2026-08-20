import { expect, test } from '@playwright/test';

const expectedMembership = {
  'portraits-identite': ['classic-propre', 'corporate-linkedin', 'flash-social', 'identite-standard', 'pack-decouverte', 'pack-signature'],
  'couples-familles-groupes': ['duo-couple', 'famille', 'groupe-fun', 'pack-fratrie'],
  'maternite-bebe-enfant': ['ado-swag', 'bebe-naissance', 'bebe-premiere-magie', 'enfant', 'enfant-star', 'maternite', 'maternite-douce', 'maternite-elegance'],
  anniversaires: ['anniversaire', 'anniversaire-adulte-classic', 'anniversaire-adulte-premium', 'anniversaire-enfant-star'],
  'fiancailles-pre-mariage': ['fiancailles-classic', 'fiancailles-decouverte', 'fiancailles-premium', 'pre-mariage-classic', 'pre-mariage-decouverte', 'pre-mariage-premium'],
  evenements: ['event-lite', 'event-premium', 'event-standard'],
  'createurs-entreprises': ['abonnement-createur-pro', 'abonnement-createur-starter', 'abonnement-influenceur-vip'],
  'privileges-golden-promotion': ['happy-hours'],
};

const expectedLabels = {
  'portraits-identite': { fr: 'Portraits & identité', en: 'Portraits & identity' },
  'couples-familles-groupes': { fr: 'Couples, familles & groupes', en: 'Couples, families & groups' },
  'maternite-bebe-enfant': { fr: 'Maternité, bébé & enfant', en: 'Maternity, baby & children' },
  anniversaires: { fr: 'Anniversaires', en: 'Birthdays' },
  'fiancailles-pre-mariage': { fr: 'Fiançailles & pré-mariage', en: 'Engagements & pre-wedding' },
  evenements: { fr: 'Événements', en: 'Events' },
  'createurs-entreprises': { fr: 'Créateurs & entreprises', en: 'Creators & businesses' },
  'privileges-golden-promotion': { fr: 'Privilèges Golden — Promotion', en: 'Golden privileges — Promotion' },
};

test('POST-03 publie 35 offres et réserve uniquement les 31 offres directes', async ({ page }) => {
  const catalogueResponse = await page.request.get('/api/catalogue');
  expect(catalogueResponse.status()).toBe(200);
  const catalogue = (await catalogueResponse.json()).data;
  expect(catalogue.packages).toHaveLength(35);
  expect(catalogue.taxonomy).toHaveLength(8);
  expect(catalogue.benefits).toHaveLength(2);
  expect(Object.fromEntries(catalogue.taxonomy.map((item) => [item.key, item.locales]))).toEqual(expectedLabels);
  expect(Object.fromEntries(catalogue.taxonomy.map((item) => [item.key, catalogue.packages.filter((pack) => pack.taxonomyKey === item.key).map((pack) => pack.slug).sort()]))).toEqual(expectedMembership);
  expect(catalogue.packages.flatMap((pack) => pack.locales).every((locale) => locale.approvedAt)).toBe(true);
  expect(catalogue.benefits.flatMap((benefit) => benefit.locales).every((locale) => locale.approvedAt)).toBe(true);

  const servicesResponse = await page.goto('/services', { waitUntil: 'domcontentloaded' });
  expect(servicesResponse?.status()).toBe(200);

  const identity = page.locator('.pack-card-premium').filter({ hasText: 'Identité Standard' });
  await expect(identity).toContainText('Organisation sur échange');
  await expect(identity.getByRole('link', { name: 'Nous contacter' })).toHaveAttribute('href', '/contact');
  await expect(identity.getByRole('link', { name: 'Réserver ce pack' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Avantage étudiant' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Parrainage Golden' })).toBeVisible();

  const reservationResponse = await page.goto('/reservation', { waitUntil: 'domcontentloaded' });
  expect(reservationResponse?.status()).toBe(200);
  const select = page.locator('#booking-package');
  await expect(select).toBeEnabled();
  await expect(select.locator('option')).toHaveCount(31);
  await expect(select).not.toContainText('Identité Standard');
  await expect(select).not.toContainText('Abonnement Créateur');
  await expect(select).not.toContainText('Abonnement Influenceur');
  await expect(select).toContainText('Happy Hours — Flash Social');
});
