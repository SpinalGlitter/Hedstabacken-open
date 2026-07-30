# Hedstabacken Open

Familjeapp för tippning av Premier League med 1, X och 2.

## Första versionen

- Separata familjemedlemmar i gränssnittet.
- Enkel inloggning med namn och PIN-kod.
- Admin kan skapa användare och återställa deras PIN-koder.
- Omgångsväljare för Premier League.
- Tips per match med 1, X eller 2.
- Slumpa endast tomma matcher eller slumpa hela öppna omgången.
- Matcher låses vid avspark eller när de är färdigspelade.
- Andras tips visas först när matchen är låst.
- Den inloggade användaren kan bara ändra sin egen rad.
- Totalställning räknas från färdigspelade matcher.
- Varje match har en pott på 100 poäng som delas mellan dem som tippat rätt.
- Den som tar flest matchpoäng i en färdigspelad omgång vinner en bonuspott på 50 poäng. Vid delad seger delas potten och avrundas nedåt.
- Admin kan aktivera automatiska SMS med omgångsvinnare, flest rätt och totalledare.
- Databasschema för användare, säsonger, matcher, tips och manuella korrigeringar.
- Hela Premier League-säsongen 2026/27 hämtas från `football-data.org` och sparas i D1.

Startsidan visar det riktiga spelschemat. Resultaten kontrolleras varje timme och även när någon öppnar appen om den senaste synkningen är äldre än femton minuter.

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
ELKS_API_USERNAME=ditt_api_användarnamn
ELKS_API_PASSWORD=ditt_api_lösenord
ELKS_SMS_FROM=HedstaOpen
APP_PUBLIC_URL=https://hedstabacken-open.jompen.chatgpt.site
```

## Nästa steg

1. Bygg adminvy för manuella resultatkorrigeringar.
