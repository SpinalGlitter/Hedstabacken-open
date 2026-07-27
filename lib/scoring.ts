export type ScoringPick = "1" | "X" | "2";

export type ScoringFixture = {
  id: number;
  matchday: number;
  status: string;
  result?: ScoringPick;
};

export type ScoringMember = {
  id: string;
  name: string;
};

export type ScoringPredictionBook = Record<string, Record<number, ScoringPick | undefined>>;

export type RoundScore = {
  memberId: string;
  correct: number;
  submitted: number;
  eligible: boolean;
};

export type RoundResult = {
  matchday: number;
  fixtureCount: number;
  winnerIds: string[];
  maxCorrect: number | null;
  shared: boolean;
  scores: RoundScore[];
};

export type MemberStanding = {
  memberId: string;
  name: string;
  correct: number;
  bonus: number;
  total: number;
  roundWins: number;
  submitted: number;
};

export function calculateCompetition(
  members: ScoringMember[],
  fixtures: ScoringFixture[],
  predictions: ScoringPredictionBook,
) {
  const matchdays = Array.from(new Set(fixtures.map((fixture) => fixture.matchday))).sort((a, b) => a - b);

  const roundResults = matchdays.flatMap<RoundResult>((matchday) => {
    const roundFixtures = fixtures.filter((fixture) => fixture.matchday === matchday);
    const isComplete =
      roundFixtures.length > 0 &&
      roundFixtures.every((fixture) => fixture.status === "FINISHED" && fixture.result !== undefined);

    if (!isComplete) {
      return [];
    }

    const scores = members.map((member) => {
      const memberPredictions = predictions[member.id] ?? {};
      const submitted = roundFixtures.filter((fixture) => memberPredictions[fixture.id] !== undefined).length;
      const correct = roundFixtures.reduce(
        (total, fixture) =>
          total +
          (fixture.result !== undefined && memberPredictions[fixture.id] === fixture.result ? 1 : 0),
        0,
      );

      return {
        memberId: member.id,
        correct,
        submitted,
        eligible: submitted === roundFixtures.length,
      };
    });

    const eligibleScores = scores.filter((score) => score.eligible);
    const maxCorrect = eligibleScores.length > 0 ? Math.max(...eligibleScores.map((score) => score.correct)) : null;
    const winnerIds =
      maxCorrect === null
        ? []
        : eligibleScores.filter((score) => score.correct === maxCorrect).map((score) => score.memberId);

    return [
      {
        matchday,
        fixtureCount: roundFixtures.length,
        winnerIds,
        maxCorrect,
        shared: winnerIds.length > 1,
        scores,
      },
    ];
  });

  const standings = members
    .map<MemberStanding>((member) => {
      const memberPredictions = predictions[member.id] ?? {};
      const correct = fixtures.reduce(
        (total, fixture) =>
          total +
          (fixture.status === "FINISHED" &&
          fixture.result !== undefined &&
          memberPredictions[fixture.id] === fixture.result
            ? 1
            : 0),
        0,
      );
      const submitted = fixtures.filter((fixture) => memberPredictions[fixture.id] !== undefined).length;
      const roundWins = roundResults.filter((round) => round.winnerIds.includes(member.id)).length;
      const bonus = roundWins * 2;

      return {
        memberId: member.id,
        name: member.name,
        correct,
        bonus,
        total: correct + bonus,
        roundWins,
        submitted,
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.roundWins - a.roundWins ||
        b.correct - a.correct ||
        b.submitted - a.submitted ||
        a.name.localeCompare(b.name),
    );

  return { standings, roundResults };
}
