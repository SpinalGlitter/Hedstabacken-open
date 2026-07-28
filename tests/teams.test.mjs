import assert from "node:assert/strict";
import test from "node:test";

import { teamAbbreviation } from "../lib/teams.ts";

const expectedAbbreviations = {
  "Arsenal FC": "ARS",
  "Aston Villa FC": "AVL",
  "AFC Bournemouth": "BOU",
  "Brentford FC": "BRE",
  "Brighton & Hove Albion FC": "BHA",
  "Chelsea FC": "CHE",
  "Coventry City FC": "COV",
  "Crystal Palace FC": "CRY",
  "Everton FC": "EVE",
  "Fulham FC": "FUL",
  "Hull City AFC": "HUL",
  "Ipswich Town FC": "IPS",
  "Leeds United FC": "LEE",
  "Liverpool FC": "LIV",
  "Manchester City FC": "MCI",
  "Manchester United FC": "MUN",
  "Newcastle United FC": "NEW",
  "Nottingham Forest FC": "NFO",
  "Sunderland AFC": "SUN",
  "Tottenham Hotspur FC": "TOT",
};

test("uses the requested abbreviations for all Premier League teams", () => {
  for (const [teamName, abbreviation] of Object.entries(expectedAbbreviations)) {
    assert.equal(teamAbbreviation(teamName), abbreviation);
  }
});

test("keeps an unknown team name readable", () => {
  assert.equal(teamAbbreviation("Unknown United FC"), "Unknown United FC");
});
