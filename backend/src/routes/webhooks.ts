import { Router } from 'express';

import { asyncHandler } from '../middleware/async-handler.js';
import { validate } from '../middleware/validate.js';
import { handleEmailDeliveryReport, isValidEmailDeliverySignature } from '../emails/email-delivery-reports.js';
import { emailDeliveryReportSchema } from '../validation/schemas.js';
import {
  handleWhatsAppWebhook,
  isValidWhatsAppSignature,
  verifyWhatsAppWebhook,
} from '../emails/notifications.js';

const router = Router();

router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (verifyWhatsAppWebhook(mode, token) && typeof challenge === 'string') {
    res.status(200).type('text/plain').send(challenge);
    return;
  }
  res.sendStatus(403);
});

router.post(
  '/email-delivery',
  validate('body', emailDeliveryReportSchema),
  asyncHandler(async (req, res) => {
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    const signature = req.get('x-gsplus-signature-256');
    if (!Buffer.isBuffer(rawBody) || !isValidEmailDeliverySignature(rawBody, signature)) {
      res.sendStatus(401);
      return;
    }
    await handleEmailDeliveryReport(req.body);
    res.sendStatus(200);
  }),
);

router.post(
  '/whatsapp',
  asyncHandler(async (req, res) => {
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    const signature = req.get('x-hub-signature-256');
    if (!Buffer.isBuffer(rawBody) || !isValidWhatsAppSignature(rawBody, signature)) {
      res.sendStatus(401);
      return;
    }
    await handleWhatsAppWebhook(req.body);
    res.sendStatus(200);
  }),
);

export default router;
