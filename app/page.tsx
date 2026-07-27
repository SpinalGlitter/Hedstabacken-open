"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { calculateCompetition, type ScoringPredictionBook } from "@/lib/scoring";

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

type FixturesResponse = {
  fixtures: Fixture[];
  seasonLabel: string;
  syncedAt: string | null;
  warning?: string;
};

type FamilyMember = {
  id: string;
  name: string;
  pin: string;
  role: "admin" | "player";
};

const familyMembers: FamilyMember[] = [
  { id: "johan", name: "Johan", pin: "1979", role: "admin" },
  { id: "anna", name: "Anna", pin: "2468", role: "player" },
  { id: "elsa", name: "Elsa", pin: "1357", role: "player" },
  { id: "max", name: "Max", pin: "8642", role: "player" },
];

const predictionOptions: Prediction[] = ["1", "X", "2"];

function randomPrediction(): Prediction {
  return predictionOptions[Math.floor(Math.random() * predictionOptions.length)];
}

function isLocked(fixture: Fixture) {
  return fixture.status === "FINISHED" || fixture.status === "IN_PLAY" || new Date(fixture.kickoff) <= new Date();
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
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [loginMemberId, setLoginMemberId] = useState(familyMembers[0].id);
  const [pin, setPin] = useState("");
  const [loginMessage, setLoginMessage] = useState("Logga in med namn och PIN-kod.");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [seasonLabel, setSeasonLabel] = useState("2026/27");
  const [syncMessage, setSyncMessage] = useState("Hämtar matcher...");
  const [selectedMatchday, setSelectedMatchday] = useState(1);
  const [predictions, setPredictions] = useState<ScoringPredictionBook>({});
  const [saveState, setSaveState] = useState("Logga in för att lägga dina tips.");
  const [activeView, setActiveView] = useState<"predictions" | "round-winners">("predictions");

  const currentMember = familyMembers.find((member) => member.id === currentMemberId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadFixtures() {
      try {
        const response = await fetch("/api/fixtures");
        const data = (await response.json()) as FixturesResponse & { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Matcherna kunde inte hämtas.");
        }

        if (cancelled) {
          return;
        }

        setFixtures(data.fixtures);
        setSeasonLabel(data.seasonLabel);

        const nextFixture = data.fixtures.find(
          (fixture) => fixture.status !== "FINISHED" && new Date(fixture.kickoff) > new Date(),
        );
        setSelectedMatchday(nextFixture?.matchday ?? data.fixtures.at(-1)?.matchday ?? 1);

        const syncTime = data.syncedAt
          ? new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Europe/Stockholm",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(data.syncedAt))
          : null;
        setSyncMessage(
          data.warning ?? `${data.fixtures.length} matcher hämtade${syncTime ? `, synkat ${syncTime}` : ""}.`,
        );
      } catch (error) {
        if (!cancelled) {
          setSyncMessage(error instanceof Error ? error.message : "Matcherna kunde inte hämtas.");
        }
      }
    }

    void loadFixtures();

    return () => {
      cancelled = true;
    };
  }, []);

  const matchdays = useMemo(() => Array.from(new Set(fixtures.map((fixture) => fixture.matchday))), [fixtures]);

  const roundFixtures = useMemo(
    () => fixtures.filter((fixture) => fixture.matchday === selectedMatchday),
    [fixtures, selectedMatchday],
  );

  const competition = useMemo(
    () => calculateCompetition(familyMembers, fixtures, predictions),
    [fixtures, predictions],
  );

  const roundWinStandings = useMemo(
    () =>
      [...competition.standings].sort(
        (a, b) => b.roundWins - a.roundWins || b.total - a.total || b.correct - a.correct || a.name.localeCompare(b.name),
      ),
    [competition.standings],
  );

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const member = familyMembers.find((candidate) => candidate.id === loginMemberId);

    if (!member || member.pin !== pin.trim()) {
      setLoginMessage("Fel PIN-kod. Be admin kontrollera eller byta koden.");
      return;
    }

    setCurrentMemberId(member.id);
    setPin("");
    setLoginMessage(`Inloggad som ${member.name}.`);
    setSaveState("Du kan bara ändra din egen rad.");
  }

  function logout() {
    setCurrentMemberId(null);
    setLoginMessage("Logga in med namn och PIN-kod.");
    setSaveState("Logga in för att lägga dina tips.");
  }

  function setPrediction(fixture: Fixture, prediction: Prediction) {
    if (!currentMember) {
      setSaveState("Logga in först.");
      return;
    }

    if (isLocked(fixture)) {
      setSaveState("Matchen är låst eftersom den har startat.");
      return;
    }

    setPredictions((current) => ({
      ...current,
      [currentMember.id]: {
        ...current[currentMember.id],
        [fixture.id]: prediction,
      },
    }));
    setSaveState(`Osparade ändringar för ${currentMember.name}.`);
  }

  function randomizeRound(onlyEmpty: boolean) {
    if (!currentMember) {
      setSaveState("Logga in först.");
      return;
    }

    setPredictions((current) => {
      const memberPredictions = { ...current[currentMember.id] };

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
        [currentMember.id]: memberPredictions,
      };
    });
    setSaveState(onlyEmpty ? "Tomma matcher slumpades." : "Omgångens öppna matcher slumpades.");
  }

  function savePredictions() {
    if (!currentMember) {
      setSaveState("Logga in först.");
      return;
    }

    setSaveState(`Tipsen för ${currentMember.name} är sparade i prototypen.`);
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
                Logga in med ditt namn, tippa din egen rad och låt appen räkna tabellen när resultaten synkas.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-[#ccd8c4] bg-white p-3 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-[#66736b]">Säsong</p>
                <p className="mt-1 text-lg font-bold">{seasonLabel}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#66736b]">Matcher</p>
                <p className="mt-1 text-lg font-bold">10/omg.</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#66736b]">Import</p>
                <p className="mt-1 text-lg font-bold">{fixtures.length > 0 ? "API aktiv" : "Laddar"}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <form className="login-panel" onSubmit={login}>
              <label className="field-label" htmlFor="member">
                Namn
              </label>
              <select
                className="field-input"
                id="member"
                onChange={(event) => setLoginMemberId(event.target.value)}
                value={loginMemberId}
              >
                {familyMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <label className="field-label" htmlFor="pin">
                PIN
              </label>
              <input
                className="field-input"
                id="pin"
                inputMode="numeric"
                onChange={(event) => setPin(event.target.value)}
                placeholder="Fyra siffror"
                type="password"
                value={pin}
              />
              <button className="primary-button" type="submit">
                Logga in
              </button>
              {currentMember ? (
                <button className="control-button" onClick={logout} type="button">
                  Logga ut
                </button>
              ) : null}
            </form>

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

          <p className="text-sm font-semibold text-[#43544a]">{loginMessage}</p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="lg:col-span-2">
          <div className="view-tabs" aria-label="Välj vy">
            <button
              aria-pressed={activeView === "predictions"}
              className={`view-tab ${activeView === "predictions" ? "view-tab-active" : ""}`}
              onClick={() => setActiveView("predictions")}
              type="button"
            >
              Tippa matcher
            </button>
            <button
              aria-pressed={activeView === "round-winners"}
              className={`view-tab ${activeView === "round-winners" ? "view-tab-active" : ""}`}
              onClick={() => setActiveView("round-winners")}
              type="button"
            >
              Omgångsvinnare
            </button>
          </div>
        </div>

        <div className={activeView === "predictions" ? "space-y-5" : "hidden"}>
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
              <span>{currentMember ? `${currentMember.name}s tips` : "Ditt tips"}</span>
            </div>

            {roundFixtures.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm font-medium text-[#5b6b61]">{syncMessage}</div>
            ) : null}

            {roundFixtures.map((fixture) => {
              const locked = isLocked(fixture);
              const currentPrediction = currentMember ? predictions[currentMember.id]?.[fixture.id] : undefined;

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
                        disabled={!currentMember || locked || fixture.status === "POSTPONED"}
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
                        const isOwnPick = currentMember?.id === member.id;

                        return (
                          <td className="px-4 py-3" key={member.id}>
                            <span className={`pick-pill ${canReveal && pick === fixture.result ? "pick-pill-correct" : ""}`}>
                              {canReveal || isOwnPick ? pick ?? "-" : "Dold"}
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

        <aside className={activeView === "predictions" ? "space-y-5" : "hidden"}>
          <section className="rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
            <div className="border-b border-[#e5eadf] px-4 py-3">
              <h2 className="text-lg font-bold">Totalställning</h2>
            </div>
            <ol className="divide-y divide-[#edf1e8]">
              {competition.standings.map((member, index) => (
                <li className="flex items-center justify-between px-4 py-4" key={member.memberId}>
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-md bg-[#e9f0e3] text-sm font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-bold">{member.name}</p>
                      <p className="text-sm text-[#66736b]">
                        {member.correct} rätt + {member.bonus} bonus
                      </p>
                      <p className="text-xs font-semibold text-[#52635a]">
                        {member.roundWins} {member.roundWins === 1 ? "omgångsvinst" : "omgångsvinster"}
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-[#1d513d]">{member.total}</span>
                </li>
              ))}
            </ol>
          </section>

          {currentMember?.role === "admin" ? (
            <section className="rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
              <div className="border-b border-[#e5eadf] px-4 py-3">
                <h2 className="text-lg font-bold">Admin</h2>
              </div>
              <div className="space-y-3 p-4 text-sm text-[#4f6157]">
                <p>PIN-koder i prototypen:</p>
                <div className="grid gap-2">
                  {familyMembers.map((member) => (
                    <div className="flex items-center justify-between rounded-md bg-[#f5f7f2] px-3 py-2" key={member.id}>
                      <span className="font-semibold">{member.name}</span>
                      <span className="font-mono font-bold">{member.pin}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-[#d9e0d5] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">API-status</h2>
            <div className="mt-4 space-y-3 text-sm text-[#4f6157]">
              <p>{syncMessage}</p>
              <p>Spelschema och resultat hämtas från football-data.org och sparas i appens databas.</p>
              <p>Appen kontrollerar efter uppdateringar ungefär var femtonde minut när någon öppnar den.</p>
            </div>
          </section>
        </aside>

        <div className={activeView === "round-winners" ? "space-y-5 lg:col-span-2" : "hidden"}>
          <section className="overflow-hidden rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
            <div className="border-b border-[#e5eadf] px-4 py-3">
              <h2 className="text-lg font-bold">Totalställning</h2>
              <p className="mt-1 text-sm text-[#5b6b61]">Två bonuspoäng delas ut till varje omgångsvinnare.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="bg-[#fbfcf8] text-left text-xs uppercase text-[#66736b]">
                    <th className="px-4 py-3">Placering</th>
                    <th className="px-4 py-3">Deltagare</th>
                    <th className="px-4 py-3">Antal rätt</th>
                    <th className="px-4 py-3">Bonuspoäng</th>
                    <th className="px-4 py-3">Totalpoäng</th>
                    <th className="px-4 py-3">Omgångsvinster</th>
                  </tr>
                </thead>
                <tbody>
                  {competition.standings.map((member, index) => (
                    <tr className="border-t border-[#edf1e8]" key={member.memberId}>
                      <td className="px-4 py-3 font-bold">{index + 1}</td>
                      <td className="px-4 py-3 font-bold">{member.name}</td>
                      <td className="px-4 py-3">{member.correct}</td>
                      <td className="px-4 py-3">{member.bonus}</td>
                      <td className="px-4 py-3 text-base font-bold text-[#1d513d]">{member.total}</td>
                      <td className="px-4 py-3 font-semibold">{member.roundWins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <section className="overflow-hidden rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
              <div className="border-b border-[#e5eadf] px-4 py-3">
                <h2 className="text-lg font-bold">Flest omgångsvinster</h2>
              </div>
              <ol className="divide-y divide-[#edf1e8]">
                {roundWinStandings.map((member, index) => (
                  <li className="flex items-center justify-between gap-4 px-4 py-4" key={member.memberId}>
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-md bg-[#e9f0e3] text-sm font-bold">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-bold">{member.name}</p>
                        <p className="text-sm text-[#66736b]">{member.total} totalpoäng</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold text-[#1d513d]">{member.roundWins}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="overflow-hidden rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
              <div className="border-b border-[#e5eadf] px-4 py-3">
                <h2 className="text-lg font-bold">Vinnare för varje spelad omgång</h2>
              </div>
              {competition.roundResults.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm font-medium text-[#5b6b61]">
                  Inga omgångar är färdigspelade ännu.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#fbfcf8] text-left text-xs uppercase text-[#66736b]">
                        <th className="px-4 py-3">Omgång</th>
                        <th className="px-4 py-3">Vinnare</th>
                        <th className="px-4 py-3">Antal rätt</th>
                        <th className="px-4 py-3">Bonus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {competition.roundResults.map((round) => {
                        const winnerNames = round.winnerIds.map(
                          (winnerId) => familyMembers.find((member) => member.id === winnerId)?.name ?? winnerId,
                        );

                        return (
                          <tr className="border-t border-[#edf1e8]" key={round.matchday}>
                            <td className="px-4 py-3 font-bold">{round.matchday}</td>
                            <td className="px-4 py-3 font-semibold">
                              {winnerNames.length > 0 ? winnerNames.join(", ") : "Ingen fullständig rad"}
                              {round.shared ? (
                                <span className="ml-2 inline-block rounded bg-[#eef2ea] px-2 py-1 text-xs font-bold text-[#43544a]">
                                  Delad
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">{round.maxCorrect ?? "-"}</td>
                            <td className="px-4 py-3">{winnerNames.length > 0 ? "+2 var" : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <p className="rounded-md border border-[#d8e1d0] bg-white px-4 py-3 text-sm font-medium text-[#45564b]">
            Bonus delas ut först när alla matcher i omgången är färdigspelade. Delad förstaplats ger två bonuspoäng och en omgångsvinst till samtliga vinnare.
          </p>
        </div>
      </section>
    </main>
  );
}
