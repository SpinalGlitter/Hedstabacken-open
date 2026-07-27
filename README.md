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

Startsidan använder fortfarande demodata. Den visar 10 matcher per omgång för att spegla Premier League-formatet, men alla 380 matcher hämtas först när `football-data.org`-importen körs med en riktig API-nyckel.

## football-data.org

Appen är förberedd för `football-data.org` som källa till Premier League-schema och resultat.

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

Gratisnivån har fördröjda resultat, så synken bör köras schemalagt och appen bör alltid läsa från den egna databasen.

## Miljövariabler

```bash
FOOTBALL_DATA_API_TOKEN=din_api_nyckel
```

## Nästa steg

1. Koppla startsidans prototyp till D1-tabellerna.
2. Lägg till serverrutter för att spara tips och läsa tabellen.
3. Lägg till schemalagd resultatsynk mot `football-data.org`.
4. Lägg till inloggning eller familjekodsbaserad registrering beroende på hur appen ska publiceras.
5. Bygg adminvy för manuella korrigeringar.
