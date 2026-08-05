export type SubmissionProgress = "complete" | "partial" | "empty";

export function parseMatchday(value: string | null) {
  const matchday = Number(value);

  if (!Number.isInteger(matchday) || matchday < 1 || matchday > 38) {
    throw new Error("Omgången måste vara mellan 1 och 38.");
  }

  return matchday;
}

export function submissionProgress(savedCount: number, totalFixtures: number): SubmissionProgress {
  if (totalFixtures > 0 && savedCount >= totalFixtures) {
    return "complete";
  }

  return savedCount > 0 ? "partial" : "empty";
}
