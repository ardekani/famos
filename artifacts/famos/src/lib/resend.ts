/**
 * Resend client stub (server-side only — do not expose RESEND_API_KEY to the browser).
 * Actual email sending should be done through the API server (artifacts/api-server).
 *
 * In the API server, you can initialize the client like this:
 *
 * import { Resend } from "resend";
 * const resend = new Resend(process.env.RESEND_API_KEY);
 */

export const RESEND_NOTE =
  "Resend calls are made server-side via the API server. See artifacts/api-server.";
