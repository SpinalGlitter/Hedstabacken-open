"use client";

import { useMemo, useState } from "react";

type Prediction = "1" | "X" | "2";
type MatchStatus = "SCHEDULED" | "IN_PLAY" | "FINISHED" | "POSTPONED";

type Fixture = {
  id: number;
  matchday: number;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  status: MatchStatus;
  result?: Prediction;
  score?: string;
};

type FamilyMember = {
  id: string;
  name: string;
};

type PredictionBook = Record<string, Record<number, Prediction | undefined>>;

const familyMembers: FamilyMember[] = [
  { id: "johan", name: "Johan" },
  { id: "anna", name: "Anna" },
  { id: "elsa", name: "Elsa" },
  { id: "max", name: "Max" },
];

const fixtures: Fixture[] = [
  {
    id: 101,
    matchday: 1,
    kickoff: "2026-08-15T11:30:00Z",
    homeTeam: "Liverpool",
    awayTeam: "Bournemouth",
    status: "FINISHED",
    result: "1",
    score: "2-0",
  },
  {
    id: 102,
    matchday: 1,
    kickoff: "2026-08-15T14:00:00Z",
    homeTeam: "Arsenal",
    awayTeam: "Everton",
    status: "FINISHED",
    result: "X",
    score: "1-1",
  },
  {
    id: 103,
    matchday: 1,
    kickoff: "2026-08-16T15:30:00Z",
    homeTeam: "Chelsea",
    awayTeam: "Tottenham",
    status: "FINISHED",
    result: "2",
    score: "0-1",
  },
  {
    id: 201,
    matchday: 2,
    kickoff: "2026-08-22T11:30:00Z",
    homeTeam: "Manchester City",
    awayTeam: "Brighton",
    status: "SCHEDULED",
  },
  {
    id: 202,
    matchday: 2,
    kickoff: "2026-08-22T14:00:00Z",
    homeTeam: "Newcastle",
    awayTeam: "Aston Villa",
    status: "SCHEDULED",
  },
  {
    id: 203,
    matchday: 2,
    kickoff: "2026-08-23T15:30:00Z",
    homeTeam: "Manchester United",
    awayTeam: "West Ham",
    status: "SCHEDULED",
  },
  {
    id: 301,
    matchday: 3,
    kickoff: "2026-08-29T11:30:00Z",
    homeTeam: "Crystal Palace",
    awayTeam: "Fulham",
    status: "SCHEDULED",
  },
  {
    id: 302,
    matchday: 3,
    kickoff: "2026-08-29T14:00:00Z",
    homeTeam: "Leeds",
    awayTeam: "Nottingham Forest",
    status: "POSTPONED",
  },
  {
    id: 303,
    matchday: 3,
    kickoff: "2026-08-30T15:30:00Z",
    homeTeam: "Wolves",
    awayTeam: "Brentford",
    status: "SCHEDULED",
  },
];

const initialPredictions: PredictionBook = {
  johan: {
    101: "1",
    102: "X",
    103: "1",
    201: "1",
  },
  anna: {
    101: "2",
    102: "X",
    103: "2",
    201: "X",
    202: "1",
  },
  elsa: {
    101: "1",
    102: "1",
    103: "2",
  },
  max: {
    101: "1",
    102: "X",
    103: "2",
    203: "2",
  },
};

const predictionOptions: Prediction[] = ["1", "X", "2"];
const now = new Date("2026-08-21T18:00:00Z");

function randomPrediction(): Prediction {
  return predictionOptions[Math.floor(Math.random() * predictionOptions.length)];
}

function isLocked(fixture: Fixture) {
  return fixture.status === "FINISHED" || fixture.status === "IN_PLAY" || new Date(fixture.kickoff) <= now;
}

function formatKickoff(kickoff: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(kickoff));
}

function statusLabel(status: MatchStatus) {
  const labels: Record<MatchStatus, string> = {
    SCHEDULED: "Kommande",
    IN_PLAY: "Pågår",
    FINISHED: "Klar",
    POSTPONED: "Uppskjuten",
  };

  return labels[status];
}

export default function Home() {
  const [activeMember, setActiveMember] = useState(familyMembers[0].id);
  const [selectedMatchday, setSelectedMatchday] = useState(2);
  const [predictions, setPredictions] = useState<PredictionBook>(initialPredictions);
  const [saveState, setSaveState] = useState("Alla ändringar sparas i prototypen.");

  const matchdays = useMemo(
    () => Array.from(new Set(fixtures.map((fixture) => fixture.matchday))),
    [],
  );

  const roundFixtures = useMemo(
    () => fixtures.filter((fixture) => fixture.matchday === selectedMatchday),
    [selectedMatchday],
  );

  const standings = useMemo(() => {
    return familyMembers
      .map((member) => {
        const points = fixtures.reduce((total, fixture) => {
          const pick = predictions[member.id]?.[fixture.id];
          return total + (fixture.status === "FINISHED" && pick === fixture.result ? 1 : 0);
        }, 0);

        const submitted = fixtures.filter((fixture) => predictions[member.id]?.[fixture.id]).length;

        return { ...member, points, submitted };
      })
      .sort((a, b) => b.points - a.points || b.submitted - a.submitted || a.name.localeCompare(b.name));
  }, [predictions]);

  function setPrediction(fixture: Fixture, prediction: Prediction) {
    if (isLocked(fixture)) {
      setSaveState("Matchen är låst eftersom den har startat.");
      return;
    }

    setPredictions((current) => ({
      ...current,
      [activeMember]: {
        ...current[activeMember],
        [fixture.id]: prediction,
      },
    }));
    setSaveState("Osparade ändringar i aktuell omgång.");
  }

  function randomizeRound(onlyEmpty: boolean) {
    setPredictions((current) => {
      const memberPredictions = { ...current[activeMember] };

      for (const fixture of roundFixtures) {
        if (isLocked(fixture) || fixture.status === "POSTPONED") {
          continue;
        }

        if (!onlyEmpty || !memberPredictions[fixture.id]) {
          memberPredictions[fixture.id] = randomPrediction();
        }
      }

      return {
        ...current,
        [activeMember]: memberPredictions,
      };
    });
    setSaveState(onlyEmpty ? "Tomma matcher slumpades." : "Omgångens öppna matcher slumpades.");
  }

  function savePredictions() {
    setSaveState("Tipsen är sparade och låses automatiskt vid avspark.");
  }

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#17231d]">
      <section className="border-b border-[#d6decf] bg-[#eaf0e4]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#3f6f5a]">Hedstabacken Open</p>
              <h1 className="mt-2 max-w-3xl text-4xl font-bold text-[#112019] sm:text-5xl">
                Familjens Premier League-tips
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#4b5d51]">
                Tippa varje match med 1, X eller 2, slumpa en hel omgång när känslan saknas och följ tabellen efter
                resultaten synkas.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-[#ccd8c4] bg-white p-3 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-[#66736b]">Säsong</p>
                <p className="mt-1 text-lg font-bold">2026/27</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#66736b]">Matcher</p>
                <p className="mt-1 text-lg font-bold">380</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#66736b]">Källa</p>
                <p className="mt-1 text-lg font-bold">API</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2" aria-label="Välj familjemedlem">
              {familyMembers.map((member) => (
                <button
                  className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                    activeMember === member.id
                      ? "border-[#1d513d] bg-[#1d513d] text-white"
                      : "border-[#c5d0bd] bg-white text-[#26362d] hover:border-[#1d513d]"
                  }`}
                  key={member.id}
                  onClick={() => setActiveMember(member.id)}
                  type="button"
                >
                  {member.name}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="control-button" onClick={() => randomizeRound(true)} type="button">
                Slumpa tomma
              </button>
              <button className="control-button" onClick={() => randomizeRound(false)} type="button">
                Slumpa omgången
              </button>
              <button className="primary-button" onClick={savePredictions} type="button">
                Spara tips
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="space-y-5">
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Välj omgång">
            {matchdays.map((matchday) => (
              <button
                className={`round-tab ${selectedMatchday === matchday ? "round-tab-active" : ""}`}
                key={matchday}
                onClick={() => setSelectedMatchday(matchday)}
                type="button"
              >
                Omgång {matchday}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
            <div className="grid grid-cols-[1fr_88px_120px] border-b border-[#e5eadf] bg-[#fbfcf8] px-4 py-3 text-xs font-bold uppercase text-[#66736b] sm:grid-cols-[150px_1fr_88px_120px]">
              <span className="hidden sm:block">Avspark</span>
              <span>Match</span>
              <span>Resultat</span>
              <span>Ditt tips</span>
            </div>

            {roundFixtures.map((fixture) => {
              const locked = isLocked(fixture);
              const currentPrediction = predictions[activeMember]?.[fixture.id];

              return (
                <article
                  className="grid grid-cols-[1fr_88px_120px] items-center gap-3 border-b border-[#edf1e8] px-4 py-4 last:border-b-0 sm:grid-cols-[150px_1fr_88px_120px]"
                  key={fixture.id}
                >
                  <div className="hidden text-sm text-[#5b6b61] sm:block">
                    <p className="font-semibold text-[#24362c]">{formatKickoff(fixture.kickoff)}</p>
                    <p>{statusLabel(fixture.status)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#5b6b61] sm:hidden">{formatKickoff(fixture.kickoff)}</p>
                    <h2 className="text-base font-bold text-[#17231d]">
                      {fixture.homeTeam} - {fixture.awayTeam}
                    </h2>
                    <p className="mt-1 text-sm text-[#65736a]">
                      {locked ? "Låst vid avspark" : fixture.status === "POSTPONED" ? "Inväntar ny tid" : "Öppen för tips"}
                    </p>
                  </div>
                  <div className="text-sm font-bold text-[#24362c]">{fixture.score ?? "-"}</div>
                  <div className="prediction-group" aria-label={`Tips för ${fixture.homeTeam} mot ${fixture.awayTeam}`}>
                    {predictionOptions.map((option) => (
                      <button
                        aria-pressed={currentPrediction === option}
                        className={`prediction-button ${currentPrediction === option ? "prediction-button-active" : ""}`}
                        disabled={locked || fixture.status === "POSTPONED"}
                        key={option}
                        onClick={() => setPrediction(fixture, option)}
                        type="button"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <p className="rounded-md border border-[#d8e1d0] bg-white px-4 py-3 text-sm font-medium text-[#45564b]">
            {saveState}
          </p>

          <section className="rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
            <div className="border-b border-[#e5eadf] px-4 py-3">
              <h2 className="text-lg font-bold">Allas tips i omgång {selectedMatchday}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[#fbfcf8] text-left text-xs uppercase text-[#66736b]">
                    <th className="px-4 py-3">Match</th>
                    {familyMembers.map((member) => (
                      <th className="px-4 py-3" key={member.id}>
                        {member.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roundFixtures.map((fixture) => (
                    <tr className="border-t border-[#edf1e8]" key={fixture.id}>
                      <td className="px-4 py-3 font-semibold">
                        {fixture.homeTeam} - {fixture.awayTeam}
                      </td>
                      {familyMembers.map((member) => {
                        const canReveal = isLocked(fixture);
                        const pick = predictions[member.id]?.[fixture.id];

                        return (
                          <td className="px-4 py-3" key={member.id}>
                            <span className={`pick-pill ${canReveal && pick === fixture.result ? "pick-pill-correct" : ""}`}>
                              {canReveal ? pick ?? "-" : member.id === activeMember ? pick ?? "-" : "Dold"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
            <div className="border-b border-[#e5eadf] px-4 py-3">
              <h2 className="text-lg font-bold">Totalställning</h2>
            </div>
            <ol className="divide-y divide-[#edf1e8]">
              {standings.map((member, index) => (
                <li className="flex items-center justify-between px-4 py-4" key={member.id}>
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-[#e9f0e3] text-sm font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-bold">{member.name}</p>
                      <p className="text-sm text-[#66736b]">{member.submitted} tips lagda</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-[#1d513d]">{member.points}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-lg border border-[#d9e0d5] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Synkflöde</h2>
            <div className="mt-4 space-y-3 text-sm text-[#4f6157]">
              <p>
                Säsongens matcher hämtas från football-data.org och sparas i databasen med matchdag, avspark, lag,
                status och resultat.
              </p>
              <p>
                Ett schemalagt jobb kan uppdatera matcher oftare på matchdagar och översätta API:ets vinnare till 1,
                X eller 2.
              </p>
              <p>Admin kan korrigera uppskjutna matcher eller resultat manuellt om datakällan skulle halka efter.</p>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
