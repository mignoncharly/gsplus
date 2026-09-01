import type { RequestHandler } from 'express';

import { getAdminFromRequest, publicAdminUser } from '../services/admin-auth.js';
import { requiresAdminTotp } from '../services/admin-permissions.js';
import { HttpError } from '../errors/http-error.js';

export const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    const admin = await getAdminFromRequest(req);
    // A privileged account without TOTP receives only the self-service enrolment routes.
    // This is the bootstrap path that avoids locking out an existing OWNER while keeping
    // every operational/admin-data route behind the second factor.
    if (requiresAdminTotp(admin) && !admin.totpConfirmedAt && req.path !== '/security/totp' && req.path !== '/security/totp/begin' && req.path !== '/security/totp/confirm') {
      throw new HttpError(403, 'TOTP_ENROLMENT_REQUIRED', 'Configurez la double authentification avant d’accéder à l’administration.');
    }
    res.locals.admin = admin;
    res.locals.adminPublic = publicAdminUser(admin);
    next();
  } catch (error) {
    next(error);
  }
};
