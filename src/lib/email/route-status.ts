import type { SupplierStatus } from "@prisma/client";

export const PRICE_CONFIDENCE_THRESHOLD = 0.8;

const MANUAL_LOCKED = new Set<SupplierStatus>(["NEGOTIATING", "ACTIVE", "ON_HOLD", "REJECTED"]);
const EARLY = new Set<SupplierStatus>(["CANDIDATE", "QUALIFIED", "CONTACTED"]);

export function isManualLocked(s: SupplierStatus): boolean {
  return MANUAL_LOCKED.has(s);
}

/** Outbound sent: only move early statuses forward to CONTACTED. Never demote. */
export function nextStatusOnSend(current: SupplierStatus): SupplierStatus | null {
  if (isManualLocked(current)) return null;
  if (current === "CANDIDATE" || current === "QUALIFIED") return "CONTACTED";
  return null;
}

/** Inbound received: early statuses -> REPLIED. QUOTED/MANUAL_REVIEW are left to classification. */
export function nextStatusOnReply(current: SupplierStatus): SupplierStatus | null {
  if (isManualLocked(current)) return null;
  if (EARLY.has(current)) return "REPLIED";
  return null;
}

/** AI classification of an inbound message. Forward-only; QUOTED is terminal for automation. */
export function nextStatusFromClassification(
  current: SupplierStatus,
  aiClass: string,
  confidence: number
): SupplierStatus | null {
  if (isManualLocked(current)) return null;
  if (aiClass === "PRICE_LIST" && confidence >= PRICE_CONFIDENCE_THRESHOLD) {
    return current === "QUOTED" ? null : "QUOTED";
  }
  if (current === "QUOTED") return null;
  return current === "MANUAL_REVIEW" ? null : "MANUAL_REVIEW";
}
