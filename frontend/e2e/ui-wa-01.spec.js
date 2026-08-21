import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 992, height: 900 },
  { width: 1280, height: 720 },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/packages' || url.pathname === '/api/media') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });
});

test('UI-WA-01 keeps the official mark inside every supported viewport and safe edge', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/mentions-legales', { waitUntil: 'domcontentloaded' });

    const fab = page.locator('.whatsapp-fab');
    await expect(fab).toBeVisible();
    await expect(fab.locator('img.whatsapp-fab__mark')).toHaveAttribute('src', '/images/whatsapp-mark-white.svg');
    await expect(fab).toHaveCSS('background-color', 'rgb(37, 211, 102)');
    await expect(fab).toHaveAttribute('rel', /noopener/);

    const box = await fab.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.y).toBeGreaterThanOrEqual(8);
    expect(viewport.width - box.x - box.width).toBeGreaterThanOrEqual(8);
    expect(viewport.height - box.y - box.height).toBeGreaterThanOrEqual(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('UI-WA-01 yields to the mobile keyboard and any colliding form action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/contact', { waitUntil: 'domcontentloaded' });

  const fab = page.locator('.whatsapp-fab');
  const phone = page.getByLabel('Téléphone (requis uniquement pour WhatsApp)');
  await phone.scrollIntoViewIfNeeded();
  await phone.focus();
  await expect(fab).toHaveAttribute('data-obscured', 'true');
  await expect(fab).toHaveAttribute('data-keyboard-open', 'true');
  await expect(fab).toHaveCSS('pointer-events', 'none');

  await phone.blur();
  const action = page.getByRole('button', { name: 'Envoyer le message' });
  await action.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('Envoyer le message'));
    const fabNode = document.querySelector('.whatsapp-fab');
    const buttonBox = button.getBoundingClientRect();
    const fabBox = fabNode.getBoundingClientRect();
    window.scrollBy(0, buttonBox.top + buttonBox.height / 2 - (fabBox.top + fabBox.height / 2));
  });
  await expect(fab).toHaveAttribute('data-obscured', 'true');

  const overlap = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('Envoyer le message'));
    const a = button.getBoundingClientRect();
    const b = document.querySelector('.whatsapp-fab').getBoundingClientRect();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  });
  expect(overlap).toBe(true);
});


test('UI-WA-01 hides for modal dialogs and never covers final form actions across the Phase 5 matrix', async ({ page }) => {
  const matrix = [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 992, height: 900 },
    { width: 1280, height: 720 },
  ];

  for (const viewport of matrix) {
    await page.setViewportSize(viewport);
    await page.goto('/contact', { waitUntil: 'domcontentloaded' });
    const fab = page.locator('.whatsapp-fab');
    const phone = page.getByLabel('Téléphone (requis uniquement pour WhatsApp)');
    await phone.scrollIntoViewIfNeeded();
    await phone.focus();
    if (viewport.width <= 992) {
      await expect(fab).toHaveAttribute('data-keyboard-open', 'true');
      await expect(fab).toHaveAttribute('data-obscured', 'true');
    }
    await phone.blur();

    const action = page.getByRole('button', { name: 'Envoyer le message' });
    await action.scrollIntoViewIfNeeded();
    const state = await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('Envoyer le message'));
      const fabNode = document.querySelector('.whatsapp-fab');
      const a = button.getBoundingClientRect();
      const b = fabNode.getBoundingClientRect();
      const overlap = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return { overlap, obscured: fabNode.dataset.obscured === 'true' };
    });
    expect(state.overlap && !state.obscured, `final action at ${viewport.width}px`).toBe(false);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.locator('.whatsapp-fab')).toHaveAttribute('data-obscured', 'true');

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/portfolio', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Agrandir/ }).first().click();
  await expect(page.getByRole('dialog', { name: 'Aperçu de la photographie' })).toBeVisible();
  await expect(page.locator('.whatsapp-fab')).toHaveAttribute('data-obscured', 'true');
});
