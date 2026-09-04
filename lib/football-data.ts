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

export type FootballDataStandingRow = {
  position: number;
  team: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type FootballDataStandingsResponse = {
  season: {
    currentMatchday: number | null;
  };
  standings: Array<{
    type: "TOTAL" | "HOME" | "AWAY";
    table: FootballDataStandingRow[];
  }>;
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

export type StoredFixtureResult = {
  status: StoredMatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  winner: FootballDataWinner;
};

const STORED_MATCH_STATUSES = new Set<StoredMatchStatus>([
  "SCHEDULED",
  "LIVE",
  "IN_PLAY",
  "PAUSED",
  "FINISHED",
  "POSTPONED",
  "SUSPENDED",
  "CANCELLED",
]);

export function normalizeMatchStatus(status: unknown): StoredMatchStatus {
  if (status === "TIMED") {
    return "SCHEDULED";
  }

  if (status === "AWARDED") {
    return "FINISHED";
  }

  return STORED_MATCH_STATUSES.has(status as StoredMatchStatus) ? (status as StoredMatchStatus) : "SCHEDULED";
}

export function mergeStoredFixtureResult(
  existing: StoredFixtureResult | undefined,
  incoming: StoredFixtureResult,
): StoredFixtureResult {
  if (existing?.status === "FINISHED" && incoming.status !== "FINISHED") {
    return existing;
  }

  return incoming;
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

export function totalStandingTable(response: FootballDataStandingsResponse) {
  return response.standings.find((standing) => standing.type === "TOTAL")?.table ?? [];
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

export async function fetchPremierLeagueStandings(seasonStartYear: number, token: string) {
  const response = await fetch(`https://api.football-data.org/v4/competitions/PL/standings?season=${seasonStartYear}`, {
    headers: {
      "X-Auth-Token": token,
    },
  });

  if (!response.ok) {
    throw new Error(`football-data.org svarade med ${response.status}`);
  }

  return (await response.json()) as FootballDataStandingsResponse;
}
