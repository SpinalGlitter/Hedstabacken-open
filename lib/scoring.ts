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

export type MemberStanding = {
  memberId: string;
  name: string;
  correct: number;
  matchPoints: number;
  roundBonus: number;
  roundWins: number;
  total: number;
  submitted: number;
};

export type RoundResult = {
  matchday: number;
  winnerIds: string[];
  maxMatchPoints: number | null;
  mostCorrectIds: string[];
  maxCorrect: number | null;
  bonusPerWinner: number;
};

export function pointsForCorrectPick(correctCount: number) {
  if (correctCount < 1) {
    return 0;
  }

  return Math.floor(100 / correctCount);
}

export function calculateCompetition(
  members: ScoringMember[],
  fixtures: ScoringFixture[],
  predictions: ScoringPredictionBook,
) {
  const finishedFixtures = fixtures.filter(
    (fixture) => fixture.status === "FINISHED" && fixture.result !== undefined,
  );
  const correctCounts = new Map(
    finishedFixtures.map((fixture) => [
      fixture.id,
      members.filter((member) => predictions[member.id]?.[fixture.id] === fixture.result).length,
    ]),
  );

  const matchdays = Array.from(new Set(fixtures.map((fixture) => fixture.matchday))).sort((a, b) => a - b);
  const roundResults = matchdays.flatMap<RoundResult>((matchday) => {
    const roundFixtures = fixtures.filter((fixture) => fixture.matchday === matchday);
    const isComplete =
      roundFixtures.length > 0 &&
      roundFixtures.every((fixture) => fixture.status === "FINISHED" && fixture.result !== undefined);

    if (!isComplete) {
      return [];
    }

    const eligibleScores = members.flatMap((member) => {
      const memberPredictions = predictions[member.id] ?? {};
      const hasCompleteRow = roundFixtures.every((fixture) => memberPredictions[fixture.id] !== undefined);
      if (!hasCompleteRow) {
        return [];
      }

      const matchPoints = roundFixtures.reduce(
        (points, fixture) =>
          memberPredictions[fixture.id] === fixture.result
            ? points + pointsForCorrectPick(correctCounts.get(fixture.id) ?? 0)
            : points,
        0,
      );
      const correct = roundFixtures.filter(
        (fixture) => memberPredictions[fixture.id] === fixture.result,
      ).length;
      return [{ memberId: member.id, matchPoints, correct }];
    });
    const maxMatchPoints = eligibleScores.length > 0
      ? Math.max(...eligibleScores.map((score) => score.matchPoints))
      : null;
    const winnerIds = maxMatchPoints && maxMatchPoints > 0
      ? eligibleScores
          .filter((score) => score.matchPoints === maxMatchPoints)
          .map((score) => score.memberId)
      : [];
    const maxCorrect = eligibleScores.length > 0
      ? Math.max(...eligibleScores.map((score) => score.correct))
      : null;
    const mostCorrectIds = maxCorrect && maxCorrect > 0
      ? eligibleScores.filter((score) => score.correct === maxCorrect).map((score) => score.memberId)
      : [];
    const bonusPerWinner = winnerIds.length > 0 ? Math.floor(50 / winnerIds.length) : 0;

    return [{ matchday, winnerIds, maxMatchPoints, mostCorrectIds, maxCorrect, bonusPerWinner }];
  });

  const standings = members
    .map<MemberStanding>((member) => {
      const memberPredictions = predictions[member.id] ?? {};
      const correctFixtures = finishedFixtures.filter(
        (fixture) => memberPredictions[fixture.id] === fixture.result,
      );
      const matchPoints = correctFixtures.reduce(
        (points, fixture) =>
          points + pointsForCorrectPick(correctCounts.get(fixture.id) ?? 0),
        0,
      );
      const submitted = fixtures.filter((fixture) => memberPredictions[fixture.id] !== undefined).length;
      const roundWins = roundResults.filter((round) => round.winnerIds.includes(member.id)).length;
      const roundBonus = roundResults.reduce(
        (bonus, round) => bonus + (round.winnerIds.includes(member.id) ? round.bonusPerWinner : 0),
        0,
      );

      return {
        memberId: member.id,
        name: member.name,
        correct: correctFixtures.length,
        matchPoints,
        roundBonus,
        roundWins,
        total: matchPoints + roundBonus,
        submitted,
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.matchPoints - a.matchPoints ||
        b.roundWins - a.roundWins ||
        b.correct - a.correct ||
        b.submitted - a.submitted ||
        a.name.localeCompare(b.name),
    );

  return { standings, roundResults };
}
