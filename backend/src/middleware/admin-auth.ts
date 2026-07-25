import type { RequestHandler } from 'express';

import { getAdminFromRequest, publicAdminUser } from '../services/admin-auth.js';

export const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    const admin = await getAdminFromRequest(req);
    res.locals.admin = admin;
    res.locals.adminPublic = publicAdminUser(admin);
    next();
  } catch (error) {
    next(error);
  }
};
