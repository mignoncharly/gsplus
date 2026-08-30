import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { AdminRole } from '../../src/generated/prisma/client.js';
import { SETTING_GROUPS, getEffectiveSettings } from '../../src/services/studio-settings.js';
import { CONTENT_DEFINITIONS, getPublishedContent } from '../../src/services/site-content.js';

const app = createApp();
const password = 'adm-09-admin-password';

const resetDatabase = async () => {
  await prisma.auditLog.deleteMany();
  await prisma.siteContent.deleteMany();
  await prisma.studioSetting.deleteMany();
  await prisma.adminUser.deleteMany();
};

const seed = async () => prisma.adminUser.create({
  data: { email: 'adm-09-owner@example.test', name: 'Owner', passwordHash: await bcrypt.hash(password, 4), role: AdminRole.OWNER },
});

const signIn = async () => {
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ email: 'adm-09-owner@example.test', password }).expect(200);
  return agent;
};

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('ADM-09 the owner can change ordinary information', () => {
  it('serves the compiled defaults when nothing has been customised', async () => {
    // Deploying this phase must change nothing anyone can see until someone edits.
    expect(await prisma.studioSetting.count()).toBe(0);
    const settings = await getEffectiveSettings();
    expect(settings.identity.phoneE164).toBe('+237673026654');
    expect(settings.identity.publicName).toBe('Golden Studio Plus');
    expect(settings.features.contactFormEnabled).toBe(true);
  });

  it('changes a public phone number without a deployment', async () => {
    await seed();
    const agent = await signIn();
    await agent.put('/api/admin/settings/identity')
      .send({ values: { phoneE164: '+237690000000', phoneDisplay: '+237 690 000 000' } })
      .expect(200);

    const publicResponse = await request(app).get('/api/site-settings').expect(200);
    expect(publicResponse.body.data.settings.identity.phoneE164).toBe('+237690000000');
    // Untouched fields keep their defaults rather than being blanked.
    expect(publicResponse.body.data.settings.identity.publicName).toBe('Golden Studio Plus');

    const audit = await prisma.auditLog.findFirst({ where: { action: 'settings.update' } });
    expect(audit).not.toBeNull();
  });

  it('ignores keys the registry does not define', async () => {
    await seed();
    const agent = await signIn();
    await agent.put('/api/admin/settings/identity')
      .send({ values: { phoneE164: '+237690000000', smtpPassword: 'should-not-be-stored' } })
      .expect(200);
    const row = await prisma.studioSetting.findUniqueOrThrow({ where: { group: 'identity' } });
    expect(Object.keys(row.value as object)).not.toContain('smtpPassword');
  });

  it('rejects an unknown settings group', async () => {
    await seed();
    const agent = await signIn();
    await agent.put('/api/admin/settings/nonsense').send({ values: {} }).expect(404);
  });

  it('never exposes a secret through the settings surface', async () => {
    // Provider credentials stay in the environment. No field in any group may be one.
    const fieldKeys = SETTING_GROUPS.flatMap((group) => group.fields.map((field) => `${group.key}.${field.key}`));
    for (const key of fieldKeys) {
      expect(key.toLowerCase()).not.toMatch(/secret|token|password|apikey|api_key/);
    }
    const publicResponse = await request(app).get('/api/site-settings').expect(200);
    expect(JSON.stringify(publicResponse.body)).not.toMatch(/secret|token|password/i);
  });

  it('publishes content through draft, publish and history without overwriting a version', async () => {
    await seed();
    const agent = await signIn();
    const key = CONTENT_DEFINITIONS[0].key;

    // A draft is invisible to the public.
    await agent.post(`/api/admin/content/${encodeURIComponent(key)}`)
      .send({ locale: 'fr', body: { weekdaysValue: '10 h - 17 h' } })
      .expect(200);
    let published = await getPublishedContent('fr');
    expect(published[key].weekdaysValue).toBe('9 h - 18 h');

    await agent.post(`/api/admin/content/${encodeURIComponent(key)}/publish`).expect(200);
    published = await getPublishedContent('fr');
    expect(published[key].weekdaysValue).toBe('10 h - 17 h');

    // Editing again opens a new version; publishing archives the previous one.
    await agent.post(`/api/admin/content/${encodeURIComponent(key)}`)
      .send({ locale: 'fr', body: { weekdaysValue: '11 h - 16 h' } })
      .expect(200);
    await agent.post(`/api/admin/content/${encodeURIComponent(key)}/publish`).expect(200);

    const versions = await prisma.siteContent.findMany({ where: { key, locale: 'fr' }, orderBy: { version: 'asc' } });
    expect(versions).toHaveLength(2);
    expect(versions[0].status).toBe('ARCHIVED');
    expect(versions[1].status).toBe('PUBLISHED');
    expect((await getPublishedContent('fr'))[key].weekdaysValue).toBe('11 h - 16 h');
  });

  it('refuses to publish when there is no draft', async () => {
    await seed();
    const agent = await signIn();
    await agent.post(`/api/admin/content/${encodeURIComponent(CONTENT_DEFINITIONS[0].key)}/publish`).expect(409);
  });

  it('shows the administration what the public currently sees', async () => {
    await seed();
    const agent = await signIn();
    const response = await agent.get('/api/admin/content').expect(200);
    const entry = response.body.data.find((item: { key: string }) => item.key === CONTENT_DEFINITIONS[0].key);
    expect(entry.effective.weekdaysValue).toBe('9 h - 18 h');
    expect(entry.published).toBeNull();
    expect(entry.draft).toBeNull();
  });
});
