import assert from "node:assert/strict";
import test from "node:test";

import { totalStandingTable } from "../lib/football-data.ts";

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
