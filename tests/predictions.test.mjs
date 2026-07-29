import assert from "node:assert/strict";
import test from "node:test";

import {
  fixtureHasStarted,
  normalizePredictionSubmission,
  shouldRevealPrediction,
} from "../lib/predictions.ts";

const now = Date.parse("2026-08-21T20:00:00Z");

test("reveals future picks only to their owner", () => {
  const futureFixture = { status: "SCHEDULED", utc_date: "2026-08-22T20:00:00Z" };

  assert.equal(shouldRevealPrediction("1", "1", futureFixture, now), true);
  assert.equal(shouldRevealPrediction("1", "2", futureFixture, now), false);
  assert.equal(shouldRevealPrediction("1", null, futureFixture, now), false);
});

test("reveals everyone’s picks once the match has started", () => {
  assert.equal(
    shouldRevealPrediction("1", "2", { status: "IN_PLAY", utc_date: "2026-08-22T20:00:00Z" }, now),
    true,
  );
  assert.equal(
    fixtureHasStarted({ status: "SCHEDULED", utc_date: "2026-08-21T19:00:00Z" }, now),
    true,
  );
});

test("validates and deduplicates a saved prediction row", () => {
  const submitted = normalizePredictionSubmission([
    { fixtureId: 101, pick: "1" },
    { fixtureId: 102, pick: "X" },
    { fixtureId: 101, pick: "2" },
  ]);

  assert.deepEqual([...submitted.entries()], [
    [101, "2"],
    [102, "X"],
  ]);
  assert.throws(() => normalizePredictionSubmission([{ fixtureId: 101, pick: "3" }]), /ogiltiga/);
});
