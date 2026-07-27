# Hedstabacken Open

Familjeapp för tippning av Premier League med 1, X och 2.

## Första versionen

- Separata familjemedlemmar i gränssnittet.
- Enkel inloggning med namn och PIN-kod.
- Admin kan se prototypens PIN-koder och ska i den riktiga versionen kunna återställa dem.
- Omgångsväljare för Premier League.
- Tips per match med 1, X eller 2.
- Slumpa endast tomma matcher eller slumpa hela öppna omgången.
- Matcher låses vid avspark eller när de är färdigspelade.
- Andras tips visas först när matchen är låst.
- Den inloggade användaren kan bara ändra sin egen rad.
- Totalställning räknas från färdigspelade matcher.
- Databasschema för användare, säsonger, matcher, tips och manuella korrigeringar.
- Hela Premier League-säsongen 2026/27 hämtas från `football-data.org` och sparas i D1.

Startsidan visar det riktiga spelschemat. När någon öppnar appen kontrolleras schema och resultat på nytt om den senaste synkningen är äldre än femton minuter.

## football-data.org

Appen använder `football-data.org` som källa till Premier League-schema och resultat.

Relevant endpoint:

```http
GET https://api.football-data.org/v4/competitions/PL/matches?season=2026
X-Auth-Token: FOOTBALL_DATA_API_TOKEN
```

För säsongen 2026/27 används `season=2026`, eftersom parametern avser säsongens startår.

API:ets `score.winner` mappas så här:

- `HOME_TEAM` blir `1`
- `DRAW` blir `X`
- `AWAY_TEAM` blir `2`

Gratisnivån har fördröjda resultat. Appen läser alltid från den egna databasen och gör högst en ny API-synkning per femton minuter.

## Miljövariabler

```bash
FOOTBALL_DATA_API_TOKEN=din_api_nyckel
```

## Nästa steg

1. Spara användare och tips i D1-tabellerna.
2. Flytta PIN-kontrollen till servern och låt admin återställa koder.
3. Lägg till en schemalagd resultatsynk som komplement till synkningen vid besök.
4. Bygg adminvy för manuella korrigeringar.
