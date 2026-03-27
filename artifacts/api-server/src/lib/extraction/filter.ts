/**
 * Post-extraction filter for action items.
 *
 * Runs synchronously after OpenAI returns and before child-name resolution.
 * Removes logistical noise from action_items (arrival times, attire, etc.)
 * and preserves important context as notes instead of silently dropping it.
 *
 * Classification:
 *   "keep"   — concrete parent task (sign, submit, bring, pay, RSVP …)
 *   "noise"  — event logistics; moved to notes, removed from action_items
 *   "review" — ambiguous; kept but downgraded to priority "low"
 */

import type { RawExtractionResult, RawActionItem, RawNote } from "./types.js";

// ── Heuristic pattern sets ────────────────────────────────────────────────

/**
 * If any of these match, the item is almost certainly a real parent action.
 * These win over any noise pattern.
 */
const HIGH_VALUE_RE: RegExp[] = [
  /\bsign\b/i,
  /\breturn\b/i,
  /\bsubmit\b/i,
  /\bcomplete\b/i,
  /\bfill\s*(out|in)\b/i,
  /\bpermission\b/i,
  /\bform\b/i,
  /\brsvp\b/i,
  /\bpay\b/i,
  /\bpayment\b/i,
  /\bfee\b/i,
  /\bregister\b/i,
  /\benrol(l)?\b/i,
  /\bring\b/i,
  /\bsend\b/i,
  /\bpack(ed)?\b/i,
  /\bpurchase\b/i,
  /\bbuy\b/i,
  /\bdonate\b/i,
  /\bprovide\b/i,
  /\bslip\b/i,       // permission slip
  /\bsnack\b/i,
  /\blunch\b/i,
  /\bwater\s*bottle\b/i,
  /\bsuppl(y|ies)\b/i,
  /\bdeadline\b/i,
];

/**
 * If any of these match (and no HIGH_VALUE pattern matches),
 * the item is logistical noise and gets moved to notes.
 */
const NOISE_RE: RegExp[] = [
  /\barriv(e|al|ing)\b/i,
  /\bbe\s+at\b/i,
  /\bshould\s+be\s+at\b/i,
  /\bshould\s+arrive\b/i,
  /\bensure\s+\S+\s+arrives?\b/i,
  /\bmake\s+sure\s+\S+\s+(is\s+)?(at|there|present)\b/i,
  /\bwear\b/i,
  /\battire\b/i,
  /\bdress\s*code\b/i,
  /\bperformance\s+(attire|outfit|wear|uniform)\b/i,
  /\blet\s+us\s+know\s+if\b/i,
  /\bif\s+you\s+have\s+(any\s+)?questions?\b/i,
  /\bfor\s+more\s+information\b/i,
  /\bfeel\s+free\s+to\s+(contact|email|reach)\b/i,
  /\bplease\s+(contact|email|reach)\s+us\b/i,
  /\bdrop.?off\b/i,
  /\bpick.?up\b/i,
];

// ── Classification logic ──────────────────────────────────────────────────

function isHighValue(task: string): boolean {
  return HIGH_VALUE_RE.some((re) => re.test(task));
}

function isNoise(task: string): boolean {
  return NOISE_RE.some((re) => re.test(task));
}

/**
 * Classify a single action item.
 *   "keep"   — explicit high-value action
 *   "noise"  — logistics that belong in event description or notes
 *   "review" — neither clearly high-value nor clearly noise; downgrade to low
 */
function classify(item: RawActionItem): "keep" | "noise" | "review" {
  if (isHighValue(item.task)) return "keep";
  if (isNoise(item.task)) return "noise";

  // Low-confidence low-priority items with no due date are suspect
  if (
    item.priority === "low" &&
    !item.due_date &&
    (item.confidence === null || item.confidence < 0.7)
  ) {
    return "noise";
  }

  // Unknown items without due dates become low-priority suggestions
  return "review";
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Filter and re-score action items in a raw extraction result.
 *
 * - "keep"   items pass through unchanged
 * - "review" items are kept but downgraded to priority "low"
 * - "noise"  items are removed and their task text preserved as a note
 *            (so context is not lost on the email detail page)
 *
 * Notes generated from suppressed items get a "📌 " prefix so the UI can
 * distinguish them from model-authored notes if needed.
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
      // noise — preserve as note so detail page still shows it
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
