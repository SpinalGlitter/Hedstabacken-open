const PREMIER_LEAGUE_ABBREVIATIONS: Record<string, string> = {
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

export function teamAbbreviation(teamName: string) {
  return PREMIER_LEAGUE_ABBREVIATIONS[teamName] ?? teamName;
}
