import type { PartCandidate } from '@/types/domain'
import { d } from './calendar'

/**
 * Five identities on one component position.
 *
 * §7.4 defines five relationships and the first draft of the the design notes instantiated
 * two of them, which is the easy half of the problem. The drawer is worth
 * building because of the other three.
 *
 * **Superseded** is the relationship a planner most often gets wrong. The
 * predecessor is still in the item master, still has stock, and looks correct
 * — it is only wrong because a date passed.
 *
 * **Potential duplicate** is the one most likely to describe a real
 * actual condition: the same physical part carrying two item numbers, with
 * separate stock, separate safety targets and separate purchase orders. Nothing
 * in a planning screen surfaces it today, which is why it is here and why the
 * product refuses to merge them automatically.
 *
 * **Similar description** is the trap. It reads as a match to anyone scanning
 * a list, and it is incompatible in a way that only voltage and frequency
 * reveal. It gets no allocation control at all — not a disabled one, none.
 */

const REQUIRED = 'ABC-MTR-460-60-R2'

export const PART_CANDIDATES: PartCandidate[] = [
  {
    requiredPart: REQUIRED,
    candidatePart: 'ABC-MTR-460-60-R2',
    relationship: 'exact',
    reason: 'The effective part for this configuration and date.',
    requiresApprovalFrom: null,
    approvedAt: null,
    approvedBy: null,
  },
  {
    requiredPart: REQUIRED,
    candidatePart: 'ABC-MTR-460-60-ALT',
    relationship: 'approved_substitute',
    reason:
      'Approved for this configuration. Same voltage, phase and frequency; ' +
      'different frame size, so the mount plate differs.',
    requiresApprovalFrom: 'Engineering Approver',
    /* Signed off before the walk begins, and that is deliberate rather than
     * convenient. FR-018 makes an unresolved approval a blocking failure and
     * §13.3 says blocking failures disable the primary CTA — so if this were
     * still outstanding at the requisition screen, the demo's most important
     * click would land on a button the specification requires to be dead. The
     * sign-off happens in the flow, before the handoff. */
    approvedAt: d(-1),
    approvedBy: 'Engineering Approver',
  },
  {
    requiredPart: REQUIRED,
    candidatePart: 'ABC-MTR-460-60-R1',
    relationship: 'superseded',
    reason:
      'Predecessor revision. Superseded by -R2 with effect from the revision ' +
      'date; stock remains but is not valid for new builds without a deviation.',
    /* Not ineligible — held.
     *
     * A superseded revision sitting in stock is the case where "there is no
     * button" and "you may not press the button" are genuinely different
     * answers, and the product says which one it means. Engineering can
     * release this part against a deviation; a planner cannot. So the control
     * renders inside a gate naming the role, rather than being absent like the
     * similar-description candidate below, which no role can ever allocate.
     *
     * `allocatable()` still refuses it, so nothing about what gets ordered
     * changes — this governs who may raise the question, not the arithmetic. */
    requiresApprovalFrom: 'Engineering Approver',
    approvedAt: null,
    approvedBy: null,
  },
  {
    requiredPart: REQUIRED,
    candidatePart: 'ABC-MTR-460-60-D2',
    relationship: 'potential_duplicate',
    reason:
      'Same specification and same vendor part number as the required item, ' +
      'under a second identity. Holds its own stock and its own safety target. ' +
      'A master-data question, not a substitution.',
    requiresApprovalFrom: null,
    approvedAt: null,
    approvedBy: null,
  },
  {
    requiredPart: REQUIRED,
    candidatePart: 'ABC-MTR-380-50',
    relationship: 'similar_only',
    reason:
      'Description resembles the required item. 380 V / 50 Hz against ' +
      '460 V / 60 Hz — not electrically compatible. Not eligible.',
    requiresApprovalFrom: null,
    approvedAt: null,
    approvedBy: null,
  },
]

/**
 * Three can be allocated; two of them only after a signature.
 *
 * A superseded revision was refused unconditionally until the release action
 * was actually wired up, and then the control read "Release against deviation"
 * while releasing nothing — the whole point of a deviation is that it permits
 * the part. Signing one off now makes it allocatable, which is what the button
 * says it does.
 *
 * Nothing in the authored dataset carries a sign-off on a superseded
 * candidate, so the resting behaviour is unchanged: this only opens for a
 * decision somebody takes on screen.
 */
export function allocatable(c: PartCandidate): boolean {
  if (c.relationship === 'exact') return true
  if (c.relationship === 'approved_substitute') return c.approvedAt !== null
  if (c.relationship === 'superseded') return c.approvedAt !== null
  return false
}

export function candidatesFor(requiredPart: string): PartCandidate[] {
  return PART_CANDIDATES.filter((c) => c.requiredPart === requiredPart)
}
