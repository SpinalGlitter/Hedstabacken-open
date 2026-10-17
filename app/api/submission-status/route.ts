import { currentMember, getDatabase } from "@/lib/server-auth";
import { parseMatchday } from "@/lib/submission-status";

const SEASON_START_YEAR = 2026;

type SubmissionRow = {
  id: number;
  display_name: string;
  saved_count: number;
};

export async function GET(request: Request) {
  try {
    const db = await getDatabase();
    const signedInMember = await currentMember(db, request);
    if (!signedInMember) {
      return Response.json({ error: "Logga in för att se inlämningsstatus." }, { status: 401 });
    }
    const matchday = parseMatchday(new URL(request.url).searchParams.get("matchday"));

    const [fixtureCount, submissions] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM fixtures
           JOIN seasons ON seasons.id = fixtures.season_id
           WHERE seasons.competition_code = ? AND seasons.start_year = ? AND fixtures.matchday = ?`,
        )
        .bind("PL", SEASON_START_YEAR, matchday)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT family_members.id, family_members.display_name,
            (
              SELECT COUNT(*)
              FROM predictions
              JOIN fixtures ON fixtures.id = predictions.fixture_id
              JOIN seasons ON seasons.id = fixtures.season_id
              WHERE predictions.member_id = family_members.id
                AND seasons.competition_code = ?
                AND seasons.start_year = ?
                AND fixtures.matchday = ?
            ) AS saved_count
           FROM family_members
           ORDER BY family_members.created_at, family_members.id`,
        )
        .bind("PL", SEASON_START_YEAR, matchday)
        .all<SubmissionRow>(),
    ]);

    return Response.json(
      {
        matchday,
        totalFixtures: fixtureCount?.count ?? 0,
        members: submissions.results.map((row) => ({
          id: String(row.id),
          name: row.display_name,
          savedCount: row.saved_count,
        })),
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    if (error instanceof Error && /Omgången/.test(error.message)) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Inlämningsstatus kunde inte hämtas.";
    return Response.json({ error: message }, { status: 503 });
  }
}
