import type { ScoringPick } from "@/lib/scoring";

export function fixtureHasStarted(fixture: { status: string; utc_date: string }, now = Date.now()) {
  return ["LIVE", "IN_PLAY", "PAUSED", "FINISHED"].includes(fixture.status) || Date.parse(fixture.utc_date) <= now;
}

export function shouldRevealPrediction(
  predictionOwnerId: string,
  signedInMemberId: string | null,
  fixture: { status: string; utc_date: string },
  now = Date.now(),
) {
  return predictionOwnerId === signedInMemberId || fixtureHasStarted(fixture, now);
}

export function normalizePredictionSubmission(value: unknown) {
  if (!Array.isArray(value) || value.length > 20) {
    throw new Error("Tipsraden har ett ogiltigt format.");
  }

  const submitted = new Map<number, ScoringPick>();
  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new Error("Ett eller flera tips är ogiltiga.");
    }

    const fixtureId = "fixtureId" in item && typeof item.fixtureId === "number" ? item.fixtureId : Number.NaN;
    const pick = "pick" in item ? item.pick : undefined;
    if (!Number.isSafeInteger(fixtureId) || fixtureId < 1 || !["1", "X", "2"].includes(String(pick))) {
      throw new Error("Ett eller flera tips är ogiltiga.");
    }

    submitted.set(fixtureId, pick as ScoringPick);
  }

  return submitted;
}
