/**
 * Post-extraction filter for action items.
 *
 * Runs synchronously after OpenAI returns and before child-name resolution.
 * Removes logistical noise from action_items (arrival times, attire, etc.)
 * and preserves context as notes so the email detail page still shows it.
 *
 * Three-tier classification:
 *
 *   ALWAYS_NOISE  — arrival times, drop-off/pick-up, generic filler.
 *                   These are unconditionally suppressed. No high-value
 *                   pattern can rescue them.
 *
 *   SOFT_NOISE    — attire / dress-code logistics. Suppressed unless a
 *                   HIGH_VALUE pattern also matches (e.g. "bring PE uniform"
 *                   is rescued because it's a supply action).
 *
 *   HIGH_VALUE    — concrete parent tasks. Keeps the item unless ALWAYS_NOISE
 *                   also matches. "bring" and "send" only count when paired
 *                   with a specific object — not "bring your child to X".
 *
 * Verdict mapping → DB outcome:
 *   "keep"    — passes through unchanged
 *   "review"  — kept but downgraded to priority "low" (shown collapsed)
 *   "noise"   — removed from action_items, added as note (context preserved)
 */

import type { RawExtractionResult, RawActionItem, RawNote } from "./types.js";

// ── Tier 1: ALWAYS_NOISE ─────────────────────────────────────────────────
// Arrival times and logistical filler. Unconditionally suppressed.
// No HIGH_VALUE pattern can override these.

const ALWAYS_NOISE_RE: RegExp[] = [
  // Arrival logistics
  /\barriv(e|al|ing)\b/i,
  /\bbe\s+at\b/i,
  /\bshould\s+be\s+at\b/i,
  /\bshould\s+arrive\b/i,
  /\bensure\s+\S+\s+arrives?\b/i,
  /\bmake\s+sure\s+\S+\s+(is\s+)?(at|there|present)\b/i,
  /\bneed(s)?\s+to\s+be\s+at\b/i,
  // Drop-off / pick-up scheduling
  /\bdrop.?off\b/i,
  /\bpick.?up\b/i,
  // Generic informational filler
  /\blet\s+us\s+know\s+if\b/i,
  /\bif\s+you\s+have\s+(any\s+)?questions?\b/i,
  /\bfor\s+more\s+(information|info|details)\b/i,
  /\bfeel\s+free\s+to\s+(contact|email|reach|call)\b/i,
  /\bplease\s+(contact|email|reach|call)\s+us\b/i,
  /\bdon't\s+hesitate\s+to\b/i,
];

// ── Tier 2: SOFT_NOISE ────────────────────────────────────────────────────
// Attire and dress-code logistics. Suppressed UNLESS a HIGH_VALUE pattern
// also fires (e.g. "bring PE uniform" = supply action → keep).

const SOFT_NOISE_RE: RegExp[] = [
  /\bwear\b/i,
  /\battire\b/i,
  /\bdress\s*code\b/i,
  /\bperformance\s+(attire|outfit|wear|uniform|clothes|clothing)\b/i,
  /\bdressed\b/i,
  /\boutfit\b/i,
  /\bclothes\b/i,
  /\bclothing\b/i,
  // standalone uniform without an action verb = logistics, not task
  /^[^a-z]*(uniform|costume|costume|t-shirt|tshirt|shirt)[^a-z]*$/i,
];

// ── Tier 3: HIGH_VALUE ────────────────────────────────────────────────────
// Concrete parent actions. Override SOFT_NOISE. Do NOT override ALWAYS_NOISE.
//
// "bring" and "send" are only HIGH_VALUE when paired with a specific object
// or deliverable — not generic "bring your child to the event".

const HIGH_VALUE_RE: RegExp[] = [
  // Form/document actions
  /\bsign\b/i,
  /\breturn\b/i,
  /\bsubmit\b/i,
  /\bcomplete\b/i,
  /\bfill\s*(out|in)\b/i,
  /\bpermission\b/i,
  /\bform\b/i,
  /\bslip\b/i,
  // Commitment actions
  /\brsvp\b/i,
  /\bregister\b/i,
  /\benrol(l)?\b/i,
  /\bsign\s*up\b/i,
  // Payment
  /\bpay\b/i,
  /\bpayment\b/i,
  /\bfee\b/i,
  /\bpurchase\b/i,
  /\bbuy\b/i,
  /\bdonate\b/i,
  /\$\d/,          // "$5", "$10" — implies send money
  /\bmoney\b/i,
  /\bcash\b/i,
  // Supply-specific actions (pack/provide/donate)
  /\bpack(ed)?\b/i,
  /\bprovide\b/i,
  // Named supplies the model likely flagged for a reason
  /\bsnacks?\b/i,
  /\blunch(es)?\b/i,
  /\bwater\s*bottle\b/i,
  /\bsuppl(y|ies)\b/i,
  /\bdeadline\b/i,
  // "bring [specific supply]" — NOT bare "bring" (too broad, catches "bring child to X")
  // Allows 0-2 intermediate words so "Bring PE uniform" and "Bring a spare change" match
  /\bbring\s+(?:\w+\s+){0,2}(lunch|snacks?|food|drink|water|bottle|towel|swimsuit|swim\s*suit|gear|supply|supplies|material|materials|permission|form|slip|payment|money|cash|folder|backpack|bag|change|item|book|notebook|pencil|pen|instrument|costume|uniform|equipment|kit|shoes|boots|hat|gloves)\b/i,
  // "send [specific deliverable]" — NOT bare "send"
  /\bsend\s+(?:\w+\s+){0,2}(form|slip|permission|payment|check|note|rsvp|response|photo|picture|proof|receipt|confirmation)\b/i,
  // Payment by check — distinguish from "check your backpack"
  /\bwrite\s+(a\s+)?check\b/i,
  /\$\d+\s*(check|payment)\b/i,
];

// ── Classification ────────────────────────────────────────────────────────

function isAlwaysNoise(task: string): boolean {
  return ALWAYS_NOISE_RE.some((re) => re.test(task));
}

function isSoftNoise(task: string): boolean {
  return SOFT_NOISE_RE.some((re) => re.test(task));
}

function isHighValue(task: string): boolean {
  return HIGH_VALUE_RE.some((re) => re.test(task));
}

/**
 * Classify a single action item.
 *
 *   "keep"   — concrete parent task; show in Action Needed
 *   "review" — ambiguous; kept but downgraded to low (shown in Optional)
 *   "noise"  — logistics or filler; removed, preserved as note
 */
function classify(item: RawActionItem): "keep" | "review" | "noise" {
  // Tier 1 check first — nothing rescues arrival times / filler
  if (isAlwaysNoise(item.task)) return "noise";

  const highValue = isHighValue(item.task);
  const softNoisy = isSoftNoise(item.task);

  // High-value wins over soft noise (e.g. "bring PE uniform" stays)
  if (highValue) return "keep";

  // Soft noise with no saving high-value signal → suppress
  if (softNoisy) return "noise";

  // Low-confidence, low-priority, no due date → suppress as noise
  if (
    item.priority === "low" &&
    !item.due_date &&
    (item.confidence === null || item.confidence < 0.7)
  ) {
    return "noise";
  }

  // Anything else: ambiguous → keep but mark optional
  return "review";
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Filter and re-score action items in a raw extraction result.
 *
 * - "keep"   items pass through unchanged
 * - "review" items are kept but downgraded to priority "low"
 * - "noise"  items are moved to notes (context preserved for detail page)
 *
 * Returns a new RawExtractionResult — does not mutate the input.
 */
export function filterActionItems(result: RawExtractionResult): RawExtractionResult {
  const keptActions: RawActionItem[] = [];
  const newNotes: RawNote[] = [];

  for (const item of result.action_items) {
    const verdict = classify(item);

    if (verdict === "keep") {
      keptActions.push(item);
    } else if (verdict === "review") {
      keptActions.push({ ...item, priority: "low" });
    } else {
      // noise — preserve as note so the email detail page still shows it
      newNotes.push({
        content: item.task,
        child_name: item.child_name,
      });
    }
  }

  return {
    ...result,
    action_items: keptActions,
    notes: [...result.notes, ...newNotes],
  };
}
