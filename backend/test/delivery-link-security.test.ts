import { describe, expect, it } from 'vitest';

import { verifyPublicDeliveryLink } from '../src/services/reservation-deliveries.js';

describe('delivery link security', () => {
  it.each([
    ['', 'DELIVERY_URL_INVALID'],
    ['not-a-url', 'DELIVERY_URL_INVALID'],
    ['http://delivery.example.test/gallery', 'DELIVERY_URL_INVALID'],
    ['https://localhost/gallery', 'DELIVERY_URL_NOT_PUBLIC'],
    ['https://127.0.0.1/gallery', 'DELIVERY_URL_NOT_PUBLIC'],
    ['https://10.0.0.8/gallery', 'DELIVERY_URL_NOT_PUBLIC'],
  ])('rejects unsafe or invalid delivery URL %j before any request', async (url, code) => {
    await expect(verifyPublicDeliveryLink(url)).rejects.toMatchObject({ code });
  });
});
