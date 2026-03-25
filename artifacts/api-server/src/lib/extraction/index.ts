/**
 * Extraction service — barrel export.
 *
 * Import from here in route handlers:
 *   import { extractFromEmail } from "../lib/extraction/index.js";
 */

export { extractFromEmail } from "./service.js";
export { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";
export { validateExtractionOutput } from "./validate.js";
export type {
  ChildRef,
  RawExtractionResult,
  RawEvent,
  RawDeadline,
  RawActionItem,
  RawNote,
  ResolvedExtractionResult,
  ResolvedEvent,
  ResolvedDeadline,
  ResolvedActionItem,
  ResolvedNote,
  ExtractionServiceResult,
} from "./types.js";
