import assert from "node:assert/strict";
import test from "node:test";

import { calculateCompetition } from "../lib/scoring.ts";

const members = [
  { id: "anna", name: "Anna" },
  { id: "erik", name: "Erik" },
  { id: "johan", name: "Johan" },
];

test("gives every shared round winner two bonus points and one win", () => {
  const fixtures = [
    { id: 1, matchday: 1, status: "FINISHED", result: "1" },
    { id: 2, matchday: 1, status: "FINISHED", result: "X" },
    { id: 3, matchday: 2, status: "FINISHED", result: "2" },
    { id: 4, matchday: 2, status: "POSTPONED" },
  ];
  const predictions = {
    anna: { 1: "1", 2: "X", 3: "2", 4: "1" },
    erik: { 1: "1", 2: "X", 3: "1", 4: "X" },
    johan: { 1: "2", 2: "X", 3: "2", 4: "2" },
  };

  const competition = calculateCompetition(members, fixtures, predictions);
  const anna = competition.standings.find((member) => member.memberId === "anna");
  const erik = competition.standings.find((member) => member.memberId === "erik");

  assert.equal(competition.roundResults.length, 1);
  assert.deepEqual(competition.roundResults[0].winnerIds, ["anna", "erik"]);
  assert.equal(competition.roundResults[0].shared, true);
  assert.deepEqual(
    { bonus: anna?.bonus, wins: anna?.roundWins },
    { bonus: 2, wins: 1 },
  );
  assert.deepEqual(
    { bonus: erik?.bonus, wins: erik?.roundWins },
    { bonus: 2, wins: 1 },
  );
});

test("requires a complete row and recalculates after a corrected result", () => {
  const fixtures = [
    { id: 1, matchday: 1, status: "FINISHED", result: "1" },
    { id: 2, matchday: 1, status: "FINISHED", result: "X" },
  ];
  const predictions = {
    anna: { 1: "1", 2: "X" },
    erik: { 1: "1", 2: "2" },
    johan: { 1: "1" },
  };

  const original = calculateCompetition(members, fixtures, predictions);
  assert.deepEqual(original.roundResults[0].winnerIds, ["anna"]);

  const corrected = calculateCompetition(
    members,
    fixtures.map((fixture) => (fixture.id === 2 ? { ...fixture, result: "2" } : fixture)),
    predictions,
  );

  assert.deepEqual(corrected.roundResults[0].winnerIds, ["erik"]);
  assert.equal(corrected.standings.find((member) => member.memberId === "anna")?.bonus, 0);
  assert.equal(corrected.standings.find((member) => member.memberId === "erik")?.bonus, 2);
  assert.equal(corrected.standings.find((member) => member.memberId === "johan")?.roundWins, 0);
});

test("waits for every final result before awarding the round bonus", () => {
  const fixtures = [
    { id: 1, matchday: 1, status: "FINISHED", result: "1" },
    { id: 2, matchday: 1, status: "FINISHED" },
  ];
  const predictions = {
    anna: { 1: "1", 2: "X" },
    erik: { 1: "2", 2: "1" },
    johan: { 1: "2", 2: "2" },
  };

  const competition = calculateCompetition(members, fixtures, predictions);

  assert.equal(competition.roundResults.length, 0);
  assert.equal(competition.standings.every((member) => member.bonus === 0), true);
});
