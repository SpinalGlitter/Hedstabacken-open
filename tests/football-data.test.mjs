import assert from "node:assert/strict";
import test from "node:test";

import { mergeStoredFixtureResult, normalizeMatchStatus, totalStandingTable } from "../lib/football-data.ts";

test("normalizes provider and malformed match statuses", () => {
  assert.equal(normalizeMatchStatus("TIMED"), "SCHEDULED");
  assert.equal(normalizeMatchStatus("AWARDED"), "FINISHED");
  assert.equal(normalizeMatchStatus("IN_PLAY"), "IN_PLAY");
  assert.equal(normalizeMatchStatus("2026-09-05 10:30:00Z"), "SCHEDULED");
});

test("does not erase a finished result when the API regresses to scheduled", () => {
  const finished = {
    status: "FINISHED",
    homeScore: 2,
    awayScore: 2,
    winner: "DRAW",
  };

  assert.deepEqual(
    mergeStoredFixtureResult(finished, {
      status: "SCHEDULED",
      homeScore: null,
      awayScore: null,
      winner: null,
    }),
    finished,
  );
});

test("accepts a corrected finished result", () => {
  assert.deepEqual(
    mergeStoredFixtureResult(
      { status: "FINISHED", homeScore: 2, awayScore: 2, winner: "DRAW" },
      { status: "FINISHED", homeScore: 2, awayScore: 1, winner: "HOME_TEAM" },
    ),
    { status: "FINISHED", homeScore: 2, awayScore: 1, winner: "HOME_TEAM" },
  );
});

test("selects the total Premier League table instead of home or away standings", () => {
  const totalTable = [
    {
      position: 1,
      team: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS" },
      playedGames: 3,
      won: 3,
      draw: 0,
      lost: 0,
      points: 9,
      goalsFor: 7,
      goalsAgainst: 1,
      goalDifference: 6,
    },
  ];

  assert.deepEqual(
    totalStandingTable({
      season: { currentMatchday: 3 },
      standings: [
        { type: "HOME", table: [] },
        { type: "TOTAL", table: totalTable },
        { type: "AWAY", table: [] },
      ],
    }),
    totalTable,
  );
});

test("returns an empty table when total standings are unavailable", () => {
  assert.deepEqual(
    totalStandingTable({ season: { currentMatchday: null }, standings: [{ type: "HOME", table: [] }] }),
    [],
  );
});
