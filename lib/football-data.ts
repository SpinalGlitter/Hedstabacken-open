export type FootballDataWinner = "HOME_TEAM" | "DRAW" | "AWAY_TEAM" | null;
export type PredictionPick = "1" | "X" | "2";

export type FootballDataMatch = {
  id: number;
  utcDate: string;
  status:
    | "SCHEDULED"
    | "TIMED"
    | "LIVE"
    | "IN_PLAY"
    | "PAUSED"
    | "FINISHED"
    | "AWARDED"
    | "POSTPONED"
    | "SUSPENDED"
    | "CANCELLED";
  matchday: number | null;
  homeTeam: {
    name: string;
  };
  awayTeam: {
    name: string;
  };
  score: {
    winner: FootballDataWinner;
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
};

export type FootballDataMatchesResponse = {
  matches: FootballDataMatch[];
};

export type StoredMatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED";

export function normalizeMatchStatus(status: FootballDataMatch["status"]): StoredMatchStatus {
  if (status === "TIMED") {
    return "SCHEDULED";
  }

  if (status === "AWARDED") {
    return "FINISHED";
  }

  return status;
}

export function winnerToPick(winner: FootballDataWinner): PredictionPick | null {
  if (winner === "HOME_TEAM") {
    return "1";
  }

  if (winner === "DRAW") {
    return "X";
  }

  if (winner === "AWAY_TEAM") {
    return "2";
  }

  return null;
}

export function shouldLockFixture(status: FootballDataMatch["status"], kickoff: string, now = new Date()) {
  return status === "FINISHED" || status === "IN_PLAY" || status === "LIVE" || new Date(kickoff) <= now;
}

export async function fetchPremierLeagueMatches(seasonStartYear: number, token: string) {
  const response = await fetch(`https://api.football-data.org/v4/competitions/PL/matches?season=${seasonStartYear}`, {
    headers: {
      "X-Auth-Token": token,
    },
  });

  if (!response.ok) {
    throw new Error(`football-data.org svarade med ${response.status}`);
  }

  return (await response.json()) as FootballDataMatchesResponse;
}
