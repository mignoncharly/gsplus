import bcrypt from 'bcryptjs';

import { AdminRole } from '../src/generated/prisma/client.js';
import { createPrismaClient } from '../src/db/client.js';

const prisma = createPrismaClient();

const packages = [
  { slug: 'flash-social', name: 'Flash Social', category: 'Portraits & Individuels', price: 5000, durationMin: 30, isPromo: true, sortOrder: 10 },
  { slug: 'happy-hours', name: 'Happy Hours', category: 'Portraits & Individuels', price: 4000, durationMin: 30, isPromo: true, sortOrder: 20 },
  { slug: 'pack-decouverte', name: 'Pack Decouverte', category: 'Portraits & Individuels', price: 10000, durationMin: 45, sortOrder: 30 },
  { slug: 'classic-propre', name: 'Classic Propre', category: 'Portraits & Individuels', price: 18000, durationMin: 60, sortOrder: 40 },
  { slug: 'pack-signature', name: 'Pack Signature', category: 'Portraits & Individuels', price: 32000, durationMin: 90, sortOrder: 50 },
  { slug: 'corporate-linkedin', name: 'Corporate LinkedIn', category: 'Portraits & Individuels', price: 25000, durationMin: 45, sortOrder: 60 },
  { slug: 'duo-couple', name: 'Duo / Couple', category: 'Duo, Famille & Enfants', price: 22000, durationMin: 60, sortOrder: 70 },
  { slug: 'famille', name: 'Famille (<=5)', category: 'Duo, Famille & Enfants', price: 28000, durationMin: 60, sortOrder: 80 },
  { slug: 'groupe-fun', name: 'Groupe Fun', category: 'Duo, Famille & Enfants', price: 35000, durationMin: 90, sortOrder: 90 },
  { slug: 'enfant', name: 'Enfant', category: 'Duo, Famille & Enfants', price: 8000, durationMin: 45, isRange: true, sortOrder: 100 },
  { slug: 'anniversaire', name: 'Anniversaire', category: 'Duo, Famille & Enfants', price: 8000, durationMin: 60, isRange: true, sortOrder: 110 },
  { slug: 'maternite', name: 'Maternite', category: 'Maternite & Naissance', price: 10000, durationMin: 90, isRange: true, sortOrder: 120 },
  { slug: 'bebe-naissance', name: 'Bebe / Naissance', category: 'Maternite & Naissance', price: 12000, durationMin: 60, isRange: true, sortOrder: 130 },
  { slug: 'fiancailles-decouverte', name: 'Fiancailles Decouverte', category: 'Fiancailles & Pre-mariage', price: 25000, durationMin: 90, sortOrder: 140 },
  { slug: 'fiancailles-classic', name: 'Fiancailles Classic', category: 'Fiancailles & Pre-mariage', price: 35000, durationMin: 120, sortOrder: 150 },
  { slug: 'fiancailles-premium', name: 'Fiancailles Premium', category: 'Fiancailles & Pre-mariage', price: 50000, durationMin: 180, sortOrder: 160 },
  { slug: 'pre-mariage-decouverte', name: 'Pre-mariage Decouverte', category: 'Fiancailles & Pre-mariage', price: 40000, durationMin: 120, sortOrder: 170 },
  { slug: 'pre-mariage-classic', name: 'Pre-mariage Classic', category: 'Fiancailles & Pre-mariage', price: 60000, durationMin: 180, sortOrder: 180 },
  { slug: 'pre-mariage-premium', name: 'Pre-mariage Premium', category: 'Fiancailles & Pre-mariage', price: 100000, durationMin: 480, sortOrder: 190 },
  { slug: 'event-lite', name: 'Event Lite', category: 'Evenementiel', price: 80000, durationMin: 240, sortOrder: 200 },
  { slug: 'event-standard', name: 'Event Standard', category: 'Evenementiel', price: 140000, durationMin: 360, sortOrder: 210 },
  { slug: 'event-premium', name: 'Event Premium', category: 'Evenementiel', price: 220000, durationMin: 480, sortOrder: 220 },
];

const businessHours = [
  { dayOfWeek: 0, opensAt: '09:00', closesAt: '18:00', isClosed: true },
  { dayOfWeek: 1, opensAt: '09:00', closesAt: '18:00', isClosed: false },
  { dayOfWeek: 2, opensAt: '09:00', closesAt: '18:00', isClosed: false },
  { dayOfWeek: 3, opensAt: '09:00', closesAt: '18:00', isClosed: false },
  { dayOfWeek: 4, opensAt: '09:00', closesAt: '18:00', isClosed: false },
  { dayOfWeek: 5, opensAt: '09:00', closesAt: '18:00', isClosed: false },
  { dayOfWeek: 6, opensAt: '09:00', closesAt: '18:00', isClosed: false },
];

const main = async () => {
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD is required when seeding production.');
  }

  const adminPassword = process.env.ADMIN_PASSWORD ?? 'change-me-admin-password';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.adminUser.upsert({
    where: { email: 'goldenstudplus@gmail.com' },
    update: {
      passwordHash: adminPasswordHash,
    },
    create: {
      email: 'goldenstudplus@gmail.com',
      name: 'Golden Studio Plus Admin',
      passwordHash: adminPasswordHash,
      role: AdminRole.OWNER,
    },
  });

  for (const item of packages) {
    const packageItem = await prisma.package.upsert({
      where: { slug: item.slug },
      update: item,
      create: item,
    });
    await prisma.packageVersion.upsert({
      where: {
        packageId_version: {
          packageId: packageItem.id,
          version: packageItem.version,
        },
      },
      update: {},
      create: {
        packageId: packageItem.id,
        version: packageItem.version,
        name: packageItem.name,
        category: packageItem.category,
        description: packageItem.description,
        price: packageItem.price,
        currency: packageItem.currency,
        durationMin: packageItem.durationMin,
      },
    });
  }

  for (const item of businessHours) {
    await prisma.businessHour.upsert({
      where: { dayOfWeek: item.dayOfWeek },
      update: item,
      create: item,
    });
  }

  await prisma.mediaItem.upsert({
    where: { id: 'seed-hero' },
    update: {},
    create: {
      id: 'seed-hero',
      title: 'Golden Studio Plus Hero',
      altText: 'Studio portrait session',
      url: '/images/hero.png',
      category: 'hero',
      isFeatured: true,
      sortOrder: 10,
    },
  });
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
