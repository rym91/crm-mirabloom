import type { TemplateKind } from "@prisma/client";

export type FollowUpStep = { step: number; afterDays: number; kind: TemplateKind };

const STEPS: FollowUpStep[] = [
  { step: 1, afterDays: 3, kind: "FOLLOWUP_1" },
  { step: 2, afterDays: 7, kind: "FOLLOWUP_2" },
];

/** sentFollowUps = EmailThread.followUpStep (how many follow-ups already sent). */
export function nextFollowUp(sentFollowUps: number): FollowUpStep | null {
  return STEPS[sentFollowUps] ?? null;
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}
