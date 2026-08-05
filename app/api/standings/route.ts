import { fetchPremierLeagueStandings, totalStandingTable } from "@/lib/football-data";

const SEASON_START_YEAR = 2026;
const SEASON_LABEL = "2026/27";

async function getRuntimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env;
}

export async function GET() {
  const runtimeEnv = await getRuntimeEnv();

  if (!runtimeEnv.FOOTBALL_DATA_API_TOKEN) {
    return Response.json({ error: "API-token saknas på servern." }, { status: 503 });
  }

  try {
    const response = await fetchPremierLeagueStandings(SEASON_START_YEAR, runtimeEnv.FOOTBALL_DATA_API_TOKEN);
    const table = totalStandingTable(response);

    if (table.length === 0) {
      return Response.json({ error: "Premier League-tabellen är inte tillgänglig ännu." }, { status: 502 });
    }

    return Response.json(
      {
        seasonLabel: SEASON_LABEL,
        currentMatchday: response.season.currentMatchday,
        table,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=900",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Okänt API-fel.";
    return Response.json({ error: `Premier League-tabellen kunde inte hämtas: ${message}` }, { status: 502 });
  }
}
