import {
  fetchPremierLeagueMatches,
  normalizeMatchStatus,
  winnerToPick,
} from "@/lib/football-data";

const SEASON_START_YEAR = 2026;
const SEASON_LABEL = "2026/27";
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

type FixtureRow = {
  football_data_id: number;
  matchday: number;
  utc_date: string;
  home_team: string;
  away_team: string;
  status: "SCHEDULED" | "LIVE" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED" | "SUSPENDED" | "CANCELLED";
  home_score: number | null;
  away_score: number | null;
  winner: "HOME_TEAM" | "DRAW" | "AWAY_TEAM" | null;
  last_synced_at: string;
};

async function getRuntimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env;
}

async function getSeasonId(db: D1Database) {
  const existing = await db
    .prepare("SELECT id FROM seasons WHERE competition_code = ? AND start_year = ? ORDER BY id LIMIT 1")
    .bind("PL", SEASON_START_YEAR)
    .first<{ id: number }>();

  if (existing) {
    return existing.id;
  }

  await db
    .prepare("INSERT INTO seasons (competition_code, start_year, label) VALUES (?, ?, ?)")
    .bind("PL", SEASON_START_YEAR, SEASON_LABEL)
    .run();

  const created = await db
    .prepare("SELECT id FROM seasons WHERE competition_code = ? AND start_year = ? ORDER BY id LIMIT 1")
    .bind("PL", SEASON_START_YEAR)
    .first<{ id: number }>();

  if (!created) {
    throw new Error("Säsongen kunde inte skapas i databasen.");
  }

  return created.id;
}

async function readFixtures(db: D1Database, seasonId: number) {
  const result = await db
    .prepare(
      `SELECT football_data_id, matchday, utc_date, home_team, away_team, status,
        home_score, away_score, winner, last_synced_at
       FROM fixtures
       WHERE season_id = ?
       ORDER BY matchday, utc_date, football_data_id`,
    )
    .bind(seasonId)
    .all<FixtureRow>();

  return result.results;
}

function shouldSync(fixtures: FixtureRow[]) {
  if (fixtures.length === 0) {
    return true;
  }

  const lastSyncedAt = Date.parse(fixtures[0].last_synced_at);
  return !Number.isFinite(lastSyncedAt) || Date.now() - lastSyncedAt >= SYNC_INTERVAL_MS;
}

async function syncFixtures(db: D1Database, seasonId: number, token: string) {
  const response = await fetchPremierLeagueMatches(SEASON_START_YEAR, token);
  const syncedAt = new Date().toISOString();
  const matches = response.matches.filter((match) => match.matchday !== null);

  for (let index = 0; index < matches.length; index += 50) {
    const batch = matches.slice(index, index + 50).map((match) =>
      db
        .prepare(
          `INSERT INTO fixtures (
            football_data_id, season_id, matchday, utc_date, home_team, away_team,
            status, home_score, away_score, winner, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(football_data_id) DO UPDATE SET
            season_id = excluded.season_id,
            matchday = excluded.matchday,
            utc_date = excluded.utc_date,
            home_team = excluded.home_team,
            away_team = excluded.away_team,
            status = excluded.status,
            home_score = excluded.home_score,
            away_score = excluded.away_score,
            winner = excluded.winner,
            last_synced_at = excluded.last_synced_at`,
        )
        .bind(
          match.id,
          seasonId,
          match.matchday,
          match.utcDate,
          match.homeTeam.name,
          match.awayTeam.name,
          normalizeMatchStatus(match.status),
          match.score.fullTime.home,
          match.score.fullTime.away,
          match.score.winner,
          syncedAt,
        ),
    );

    await db.batch(batch);
  }
}

function toClientFixture(row: FixtureRow) {
  const hasScore = row.home_score !== null && row.away_score !== null;
  const status =
    row.status === "LIVE" || row.status === "PAUSED"
      ? "IN_PLAY"
      : row.status === "SUSPENDED" || row.status === "CANCELLED"
        ? "POSTPONED"
        : row.status;

  return {
    id: row.football_data_id,
    matchday: row.matchday,
    kickoff: row.utc_date,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    status,
    result: winnerToPick(row.winner) ?? undefined,
    score: hasScore ? `${row.home_score}-${row.away_score}` : undefined,
  };
}

export async function GET() {
  const runtimeEnv = await getRuntimeEnv();

  if (!runtimeEnv.DB) {
    return Response.json({ error: "Matchdatabasen är inte tillgänglig." }, { status: 503 });
  }

  if (!runtimeEnv.FOOTBALL_DATA_API_TOKEN) {
    return Response.json({ error: "API-token saknas på servern." }, { status: 503 });
  }

  const seasonId = await getSeasonId(runtimeEnv.DB);
  let fixtures = await readFixtures(runtimeEnv.DB, seasonId);
  let warning: string | undefined;

  if (shouldSync(fixtures)) {
    try {
      await syncFixtures(runtimeEnv.DB, seasonId, runtimeEnv.FOOTBALL_DATA_API_TOKEN);
      fixtures = await readFixtures(runtimeEnv.DB, seasonId);
    } catch (error) {
      if (fixtures.length === 0) {
        const message = error instanceof Error ? error.message : "Okänt API-fel.";
        return Response.json({ error: `Matcherna kunde inte synkas: ${message}` }, { status: 502 });
      }

      warning = "Visar senast sparade matcher. Den senaste API-kontrollen misslyckades.";
    }
  }

  return Response.json(
    {
      fixtures: fixtures.map(toClientFixture),
      seasonLabel: SEASON_LABEL,
      syncedAt: fixtures[0]?.last_synced_at ?? null,
      warning,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    },
  );
}
