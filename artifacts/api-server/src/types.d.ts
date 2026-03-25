/**
 * Extend Express Request with fields set by auth middleware.
 */
declare namespace Express {
  interface Request {
    /** Authenticated Supabase user ID — set by requireAuth middleware */
    userId: string;
  }
}
