import assert from "node:assert/strict";
import test from "node:test";

import { calculateCompetition, pointsForCorrectPick } from "../lib/scoring.ts";

const members = [
  { id: "anna", name: "Anna" },
  { id: "erik", name: "Erik" },
  { id: "johan", name: "Johan" },
  { id: "max", name: "Max" },
];

test("splits each match's 100 point pool between all correct predictors", () => {
  assert.equal(pointsForCorrectPick(1), 100);
  assert.equal(pointsForCorrectPick(2), 50);
  assert.equal(pointsForCorrectPick(3), 33);
  assert.equal(pointsForCorrectPick(4), 25);
  assert.equal(pointsForCorrectPick(10), 10);
});

test("returns no points when nobody predicted the correct result", () => {
  assert.equal(pointsForCorrectPick(0), 0);
});

test("totals rarity points for every finished match", () => {
  const fixtures = [
    { id: 1, matchday: 1, status: "FINISHED", result: "1" },
    { id: 2, matchday: 1, status: "FINISHED", result: "X" },
    { id: 3, matchday: 1, status: "FINISHED", result: "2" },
  ];
  const predictions = {
    anna: { 1: "1", 2: "X", 3: "2" },
    erik: { 1: "X", 2: "X", 3: "2" },
    johan: { 1: "2", 2: "1", 3: "2" },
    max: { 1: "X", 2: "2", 3: "2" },
  };

  const competition = calculateCompetition(members, fixtures, predictions);

  assert.deepEqual(
    competition.standings.map(({ memberId, correct, matchPoints, roundBonus, total }) => ({
      memberId,
      correct,
      matchPoints,
      roundBonus,
      total,
    })),
    [
      { memberId: "anna", correct: 3, matchPoints: 175, roundBonus: 50, total: 225 },
      { memberId: "erik", correct: 2, matchPoints: 75, roundBonus: 0, total: 75 },
      { memberId: "johan", correct: 1, matchPoints: 25, roundBonus: 0, total: 25 },
      { memberId: "max", correct: 1, matchPoints: 25, roundBonus: 0, total: 25 },
    ],
  );
});

test("splits the 50 point round bonus pool between shared winners", () => {
  const fixtures = [
    { id: 1, matchday: 1, status: "FINISHED", result: "1" },
    { id: 2, matchday: 1, status: "FINISHED", result: "X" },
  ];
  const predictions = {
    anna: { 1: "1", 2: "X" },
    erik: { 1: "1", 2: "X" },
    johan: { 1: "1" },
    max: { 1: "2", 2: "2" },
  };

  const competition = calculateCompetition(members, fixtures, predictions);

  assert.deepEqual(competition.roundResults[0].winnerIds, ["anna", "erik"]);
  assert.equal(competition.roundResults[0].bonusPerWinner, 25);
  assert.equal(competition.standings.find((member) => member.memberId === "anna")?.roundBonus, 25);
  assert.equal(competition.standings.find((member) => member.memberId === "erik")?.roundBonus, 25);
  assert.equal(competition.standings.find((member) => member.memberId === "johan")?.roundBonus, 0);
});

test("rounds a three-way shared round bonus down to whole points", () => {
  const fixtures = [{ id: 1, matchday: 1, status: "FINISHED", result: "1" }];
  const predictions = {
    anna: { 1: "1" },
    erik: { 1: "1" },
    johan: { 1: "1" },
    max: { 1: "2" },
  };

  const competition = calculateCompetition(members, fixtures, predictions);

  assert.equal(competition.roundResults[0].bonusPerWinner, 16);
  assert.equal(competition.standings.find((member) => member.memberId === "anna")?.roundBonus, 16);
  assert.equal(competition.standings.find((member) => member.memberId === "max")?.roundBonus, 0);
});

test("ignores unfinished matches and recalculates after a corrected result", () => {
  const fixtures = [
    { id: 1, matchday: 1, status: "FINISHED", result: "1" },
    { id: 2, matchday: 1, status: "SCHEDULED" },
  ];
  const predictions = {
    anna: { 1: "1", 2: "X" },
    erik: { 1: "2", 2: "X" },
    johan: { 1: "2" },
    max: {},
  };

  const original = calculateCompetition(members, fixtures, predictions);
  assert.equal(original.standings.find((member) => member.memberId === "anna")?.total, 100);

  const corrected = calculateCompetition(
    members,
    fixtures.map((fixture) => (fixture.id === 1 ? { ...fixture, result: "2" } : fixture)),
    predictions,
  );

  assert.equal(corrected.standings.find((member) => member.memberId === "erik")?.total, 50);
  assert.equal(corrected.standings.find((member) => member.memberId === "johan")?.total, 50);
  assert.equal(corrected.standings.find((member) => member.memberId === "anna")?.total, 0);
});
