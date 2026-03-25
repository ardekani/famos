/**
 * Supabase JWT auth middleware for Express.
 *
 * Verifies the Authorization: Bearer <token> header against Supabase Auth,
 * then sets req.userId so downstream route handlers can trust it.
 *
 * Returns 401 if the token is missing, invalid, or expired.
 */

import type { Request, Response, NextFunction } from "express";
import { getSupabaseClient } from "./supabase.js";
import { logger } from "./logger.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice(7);

  try {
    const sb = getSupabaseClient();
    const { data: { user }, error } = await sb.auth.getUser(token);

    if (error || !user) {
      logger.warn({ err: error?.message }, "Auth token rejected");
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    req.userId = user.id;
    next();
  } catch (err) {
    logger.error({ err }, "Auth middleware threw");
    res.status(500).json({ error: "Auth check failed" });
  }
}
