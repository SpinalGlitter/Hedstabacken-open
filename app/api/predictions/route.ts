import { currentMember, getDatabase } from "@/lib/server-auth";
import { fixtureAcceptsPredictions, normalizePredictionSubmission, shouldRevealPrediction } from "@/lib/predictions";

type PredictionRow = {
  member_id: number;
  football_data_id: number;
  pick: "1" | "X" | "2";
  status: string;
  utc_date: string;
};

type FixtureRow = {
  id: number;
  football_data_id: number;
  status: string;
  utc_date: string;
};

export async function GET(request: Request) {
  try {
    const db = await getDatabase();
    const signedInMember = await currentMember(db, request);
    const result = await db
      .prepare(
        `SELECT predictions.member_id, fixtures.football_data_id, predictions.pick,
          fixtures.status, fixtures.utc_date
         FROM predictions
         JOIN fixtures ON fixtures.id = predictions.fixture_id
         ORDER BY predictions.member_id, fixtures.utc_date`,
      )
      .all<PredictionRow>();

    const predictions: Record<string, Record<number, "1" | "X" | "2">> = {};
    for (const row of result.results) {
      const memberId = String(row.member_id);
      if (!shouldRevealPrediction(memberId, signedInMember?.id ?? null, row)) {
        continue;
      }

      predictions[memberId] ??= {};
      predictions[memberId][row.football_data_id] = row.pick;
    }

    return Response.json(
      { predictions },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tipsen kunde inte hämtas.";
    return Response.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDatabase();
    const signedInMember = await currentMember(db, request);
    if (!signedInMember) {
      return Response.json({ error: "Logga in för att spara tips." }, { status: 401 });
    }

    const body = (await request.json()) as {
      predictions?: Array<{ fixtureId?: unknown; pick?: unknown }>;
    };
    const submitted = normalizePredictionSubmission(body.predictions);

    if (submitted.size === 0) {
      return Response.json({ saved: 0 });
    }

    const footballDataIds = [...submitted.keys()];
    const placeholders = footballDataIds.map(() => "?").join(", ");
    const fixtureResult = await db
      .prepare(
        `SELECT id, football_data_id, status, utc_date
         FROM fixtures
         WHERE football_data_id IN (${placeholders})`,
      )
      .bind(...footballDataIds)
      .all<FixtureRow>();

    if (fixtureResult.results.length !== footballDataIds.length) {
      return Response.json({ error: "En eller flera matcher kunde inte hittas." }, { status: 400 });
    }

    const openFixtures = fixtureResult.results.filter((fixture) => fixtureAcceptsPredictions(fixture));
    if (openFixtures.length === 0) {
      return Response.json({ error: "Ett tips kunde inte sparas eftersom matchen har låsts." }, { status: 409 });
    }

    const statements = openFixtures.map((fixture) =>
      db
        .prepare(
          `INSERT INTO predictions (member_id, fixture_id, pick)
           VALUES (?, ?, ?)
           ON CONFLICT(member_id, fixture_id) DO UPDATE SET
             pick = excluded.pick,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .bind(Number(signedInMember.id), fixture.id, submitted.get(fixture.football_data_id)),
    );
    await db.batch(statements);

    return Response.json({ saved: statements.length, skippedLocked: fixtureResult.results.length - openFixtures.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tipsen kunde inte sparas.";
    return Response.json({ error: message }, { status: 400 });
  }
}
