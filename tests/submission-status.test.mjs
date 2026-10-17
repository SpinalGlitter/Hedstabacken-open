import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseMatchday, submissionProgress } from "../lib/submission-status.ts";

test("accepts Premier League matchdays and rejects invalid values", () => {
  assert.equal(parseMatchday("1"), 1);
  assert.equal(parseMatchday("38"), 38);
  assert.throws(() => parseMatchday("0"), /mellan 1 och 38/);
  assert.throws(() => parseMatchday("12.5"), /mellan 1 och 38/);
  assert.throws(() => parseMatchday(null), /mellan 1 och 38/);
});

test("classifies saved round progress without exposing any picks", () => {
  assert.equal(submissionProgress(10, 10), "complete");
  assert.equal(submissionProgress(6, 10), "partial");
  assert.equal(submissionProgress(0, 10), "empty");
  assert.equal(submissionProgress(0, 0), "empty");
});

test("shows submission counts to signed-in members without exposing prediction picks", async () => {
  const [page, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submission-status/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /Inlämnade tips/);
  assert.match(page, /api\/submission-status/);
  assert.match(route, /currentMember\(db, request\)/);
  assert.match(route, /Logga in för att se inlämningsstatus/);
  assert.doesNotMatch(route, /requireAdmin/);
  assert.doesNotMatch(route, /predictions\.pick/);
});
