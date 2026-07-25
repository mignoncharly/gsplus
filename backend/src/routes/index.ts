import { Router } from 'express';

import adminRoutes from './admin.js';
import publicRoutes from './public.js';
import webhookRoutes from './webhooks.js';
import { getCalendarSyncHealth } from '../services/calendar.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'golden-studio-plus-api',
  });
});

router.get('/calendar/health', async (_req, res) => {
  const health = await getCalendarSyncHealth();
  res.status(health.ok ? 200 : 503).json({
    data: health,
  });
});

router.use('/webhooks', webhookRoutes);
router.use(publicRoutes);
router.use('/admin', adminRoutes);

export default router;
