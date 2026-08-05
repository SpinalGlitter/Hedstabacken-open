"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { calculateCompetition, type ScoringPredictionBook } from "@/lib/scoring";
import { teamAbbreviation } from "@/lib/teams";

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
  role: "admin" | "player";
};

type AdminMember = FamilyMember & {
  phoneNumber: string | null;
  smsOptIn: boolean;
};

type FamilyResponse = {
  members: FamilyMember[];
  currentMember: FamilyMember | null;
  needsSetup: boolean;
  error?: string;
};

type PredictionsResponse = {
  predictions: ScoringPredictionBook;
  error?: string;
};

type SaveNotice = {
  kind: "neutral" | "dirty" | "saving" | "saved" | "error";
  message: string;
};

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

async function fetchPredictionBook() {
  const response = await fetch("/api/predictions", { cache: "no-store" });
  const data = (await response.json()) as PredictionsResponse;

  if (!response.ok) {
    throw new Error(data.error ?? "Tipsen kunde inte hämtas.");
  }

  return data.predictions;
}

export default function Home() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [loginMemberId, setLoginMemberId] = useState("");
  const [pin, setPin] = useState("");
  const [loginMessage, setLoginMessage] = useState("Laddar familjekonton...");
  const [familyLoading, setFamilyLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupPin, setSetupPin] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPin, setNewMemberPin] = useState("");
  const [resetPins, setResetPins] = useState<Record<string, string>>({});
  const [adminMessage, setAdminMessage] = useState("Här kan du lägga till familjemedlemmar och byta deras PIN.");
  const [smsMembers, setSmsMembers] = useState<AdminMember[]>([]);
  const [smsConfigured, setSmsConfigured] = useState(false);
  const [smsMessage, setSmsMessage] = useState("Laddar SMS-inställningar...");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [seasonLabel, setSeasonLabel] = useState("2026/27");
  const [syncMessage, setSyncMessage] = useState("Hämtar matcher...");
  const [selectedMatchday, setSelectedMatchday] = useState(1);
  const [predictions, setPredictions] = useState<ScoringPredictionBook>({});
  const [predictionLoadError, setPredictionLoadError] = useState<string | null>(null);
  const [saveNotices, setSaveNotices] = useState<Record<number, SaveNotice>>({});
  const [activeView, setActiveView] = useState<"predictions" | "standings">("predictions");
  const [selectedTipsMemberId, setSelectedTipsMemberId] = useState("");

  const currentMember = familyMembers.find((member) => member.id === currentMemberId) ?? null;
  const selectedTipsMember = familyMembers.find((member) => member.id === selectedTipsMemberId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadFamily() {
      try {
        const response = await fetch("/api/family", { cache: "no-store" });
        const data = (await response.json()) as FamilyResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Familjekontona kunde inte hämtas.");
        }

        if (cancelled) {
          return;
        }

        setFamilyMembers(data.members);
        setCurrentMemberId(data.currentMember?.id ?? null);
        setNeedsSetup(data.needsSetup);
        setLoginMemberId(data.currentMember?.id ?? data.members[0]?.id ?? "");
        setSelectedTipsMemberId(data.currentMember?.id ?? data.members[0]?.id ?? "");
        setLoginMessage(
          data.currentMember
            ? `Inloggad som ${data.currentMember.name}.`
            : data.needsSetup
              ? "Skapa den första administratören."
              : "Logga in med namn och PIN-kod.",
        );
      } catch (error) {
        if (!cancelled) {
          setLoginMessage(error instanceof Error ? error.message : "Familjekontona kunde inte hämtas.");
        }
      } finally {
        if (!cancelled) {
          setFamilyLoading(false);
        }
      }
    }

    void loadFamily();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSmsAdmin() {
      if (currentMember?.role !== "admin") {
        setSmsMembers([]);
        return;
      }

      try {
        const [membersResponse, statusResponse] = await Promise.all([
          fetch("/api/members", { cache: "no-store" }),
          fetch("/api/notifications", { cache: "no-store" }),
        ]);
        const membersData = (await membersResponse.json()) as { members?: AdminMember[]; error?: string };
        const statusData = (await statusResponse.json()) as { configured?: boolean; error?: string };

        if (!membersResponse.ok || !membersData.members) {
          throw new Error(membersData.error ?? "Mobilnumren kunde inte hämtas.");
        }
        if (!statusResponse.ok) {
          throw new Error(statusData.error ?? "SMS-status kunde inte hämtas.");
        }
        if (!cancelled) {
          setSmsMembers(membersData.members);
          setSmsConfigured(statusData.configured === true);
          setSmsMessage(
            statusData.configured
              ? "SMS-tjänsten är ansluten. Testa varje nummer innan första omgången."
              : "SMS-tjänsten väntar på API-uppgifterna från 46elks.",
          );
        }
      } catch (error) {
        if (!cancelled) {
          setSmsMessage(error instanceof Error ? error.message : "SMS-inställningarna kunde inte hämtas.");
        }
      }
    }

    void loadSmsAdmin();
    return () => {
      cancelled = true;
    };
  }, [currentMember?.role]);

  useEffect(() => {
    let cancelled = false;

    async function loadPredictions() {
      try {
        const predictionBook = await fetchPredictionBook();
        if (!cancelled) {
          setPredictions(predictionBook);
          setPredictionLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setPredictionLoadError(error instanceof Error ? error.message : "Tipsen kunde inte hämtas.");
        }
      }
    }

    void loadPredictions();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const savedPredictionCount = currentMember
    ? roundFixtures.filter((fixture) => predictions[currentMember.id]?.[fixture.id]).length
    : 0;
  const saveNotice = saveNotices[selectedMatchday] ?? (predictionLoadError
    ? { kind: "error" as const, message: predictionLoadError }
    : {
        kind: "neutral" as const,
        message: currentMember
          ? savedPredictionCount > 0
            ? `${savedPredictionCount} sparade tips visas i omgången. Ändringar måste sparas på nytt.`
            : "Välj 1, X eller 2 och tryck sedan på Spara tips."
          : "Logga in för att lägga dina tips.",
      });
  const savePanelTitle = saveNotice.kind === "dirty"
    ? "Tipsen är inte sparade"
    : saveNotice.kind === "saving"
      ? "Sparar tipsen"
      : saveNotice.kind === "saved"
        ? "Tipsen är sparade"
        : saveNotice.kind === "error"
          ? "Något behöver åtgärdas"
          : currentMember
            ? savedPredictionCount > 0
              ? "Sparade tips finns"
              : "Inga tips sparade ännu"
            : "Logga in för att tippa";

  const competition = useMemo(
    () => calculateCompetition(familyMembers, fixtures, predictions),
    [familyMembers, fixtures, predictions],
  );

  function setSaveNotice(notice: SaveNotice, matchday = selectedMatchday) {
    setSaveNotices((current) => ({ ...current, [matchday]: notice }));
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginMessage("Loggar in...");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: loginMemberId, pin }),
      });
      const data = (await response.json()) as { member?: FamilyMember; error?: string };

      if (!response.ok || !data.member) {
        throw new Error(data.error ?? "Inloggningen misslyckades.");
      }

      setCurrentMemberId(data.member.id);
      setLoginMemberId(data.member.id);
      setSelectedTipsMemberId(data.member.id);
      setPin("");
      setLoginMessage(`Inloggad som ${data.member.name}.`);
      setSaveNotices({});

      try {
        setPredictions(await fetchPredictionBook());
        setPredictionLoadError(null);
      } catch (error) {
        setSaveNotice({
          kind: "error",
          message: error instanceof Error ? error.message : "Dina sparade tips kunde inte hämtas.",
        });
      }
    } catch (error) {
      setLoginMessage(
        error instanceof Error ? `${error.message} Be admin byta koden om den är glömd.` : "Inloggningen misslyckades.",
      );
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setCurrentMemberId(null);
    setLoginMessage("Logga in med namn och PIN-kod.");
    setSaveNotices({});
    setPredictions(await fetchPredictionBook().catch(() => ({})));
  }

  async function createFirstAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginMessage("Skapar administratören...");

    try {
      const response = await fetch("/api/family/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: setupName, pin: setupPin }),
      });
      const data = (await response.json()) as { member?: FamilyMember; error?: string };

      if (!response.ok || !data.member) {
        throw new Error(data.error ?? "Administratören kunde inte skapas.");
      }

      setFamilyMembers([data.member]);
      setCurrentMemberId(data.member.id);
      setLoginMemberId(data.member.id);
      setSelectedTipsMemberId(data.member.id);
      setNeedsSetup(false);
      setSetupName("");
      setSetupPin("");
      setLoginMessage(`Administratören ${data.member.name} är skapad och inloggad.`);
      setSaveNotices({});
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "Administratören kunde inte skapas.");
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdminMessage("Lägger till användaren...");

    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMemberName, pin: newMemberPin }),
      });
      const data = (await response.json()) as { member?: FamilyMember; error?: string };

      if (!response.ok || !data.member) {
        throw new Error(data.error ?? "Användaren kunde inte skapas.");
      }

      setFamilyMembers((members) => [...members, data.member as FamilyMember]);
      setNewMemberName("");
      setNewMemberPin("");
      setAdminMessage(`${data.member.name} är tillagd och kan nu logga in.`);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Användaren kunde inte skapas.");
    }
  }

  async function resetMemberPin(member: FamilyMember) {
    setAdminMessage(`Byter PIN för ${member.name}...`);

    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: resetPins[member.id] ?? "" }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "PIN-koden kunde inte bytas.");
      }

      setResetPins((current) => ({ ...current, [member.id]: "" }));
      setAdminMessage(`PIN-koden för ${member.name} är bytt. Personen behöver logga in igen.`);

      if (member.id === currentMemberId) {
        setCurrentMemberId(null);
        setLoginMemberId(member.id);
        setLoginMessage("Din PIN är bytt. Logga in igen med den nya koden.");
      }
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "PIN-koden kunde inte bytas.");
    }
  }

  function updateSmsMember(memberId: string, changes: Partial<AdminMember>) {
    setSmsMembers((members) =>
      members.map((member) => (member.id === memberId ? { ...member, ...changes } : member)),
    );
  }

  async function saveSmsMember(member: AdminMember) {
    setSmsMessage(`Sparar SMS-inställningar för ${member.name}...`);

    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: member.phoneNumber ?? "", smsOptIn: member.smsOptIn }),
      });
      const data = (await response.json()) as {
        member?: { id: string; phoneNumber: string | null; smsOptIn: boolean };
        error?: string;
      };
      if (!response.ok || !data.member) {
        throw new Error(data.error ?? "SMS-inställningen kunde inte sparas.");
      }

      updateSmsMember(member.id, data.member);
      setSmsMessage(`SMS-inställningarna för ${member.name} är sparade.`);
    } catch (error) {
      setSmsMessage(error instanceof Error ? error.message : "SMS-inställningen kunde inte sparas.");
    }
  }

  async function sendSmsTest(member: AdminMember) {
    setSmsMessage(`Skickar test-SMS till ${member.name}...`);

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", memberId: member.id }),
      });
      const data = (await response.json()) as { parts?: number; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Testmeddelandet kunde inte skickas.");
      }

      setSmsMessage(`Test-SMS skickat till ${member.name}${data.parts ? ` (${data.parts} SMS-del)` : ""}.`);
    } catch (error) {
      setSmsMessage(error instanceof Error ? error.message : "Testmeddelandet kunde inte skickas.");
    }
  }

  async function runSmsCheck() {
    setSmsMessage("Kontrollerar färdigspelade omgångar...");

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      const data = (await response.json()) as {
        rounds?: number;
        sent?: number;
        failed?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Omgångarna kunde inte kontrolleras.");
      }

      setSmsMessage(
        data.rounds
          ? `${data.sent ?? 0} SMS skickades${data.failed ? `, ${data.failed} misslyckades` : ""}.`
          : "Det finns ingen ny färdigspelad omgång att skicka.",
      );
    } catch (error) {
      setSmsMessage(error instanceof Error ? error.message : "Omgångarna kunde inte kontrolleras.");
    }
  }

  function setPrediction(fixture: Fixture, prediction: Prediction) {
    if (!currentMember) {
      setSaveNotice({ kind: "error", message: "Logga in först." });
      return;
    }

    if (isLocked(fixture)) {
      setSaveNotice({ kind: "neutral", message: "Matchen är låst eftersom den har startat." }, fixture.matchday);
      return;
    }

    setPredictions((current) => ({
      ...current,
      [currentMember.id]: {
        ...current[currentMember.id],
        [fixture.id]: prediction,
      },
    }));
    setSaveNotice({
      kind: "dirty",
      message: `Du har ändrat ${currentMember.name}s rad. Tryck på Spara tips för att behålla ändringen.`,
    }, fixture.matchday);
  }

  function randomizeRound(onlyEmpty: boolean) {
    if (!currentMember) {
      setSaveNotice({ kind: "error", message: "Logga in först." });
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
    setSaveNotice({
      kind: "dirty",
      message: onlyEmpty
        ? "De tomma matcherna är slumpade men ännu inte sparade."
        : "Omgångens öppna matcher är slumpade men ännu inte sparade.",
    });
  }

  async function savePredictions() {
    if (!currentMember) {
      setSaveNotice({ kind: "error", message: "Logga in först." });
      return;
    }

    const roundPredictions = roundFixtures.flatMap((fixture) => {
      const pick = predictions[currentMember.id]?.[fixture.id];
      return pick && !isLocked(fixture) && fixture.status !== "POSTPONED"
        ? [{ fixtureId: fixture.id, pick }]
        : [];
    });

    if (roundPredictions.length === 0) {
      setSaveNotice({ kind: "neutral", message: "Det finns inga öppna tips att spara i omgången." });
      return;
    }

    setSaveNotice({ kind: "saving", message: "Sparar tipsen..." });
    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predictions: roundPredictions }),
      });
      const data = (await response.json()) as { saved?: number; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Tipsen kunde inte sparas.");
      }

      setSaveNotice({
        kind: "saved",
        message: `${data.saved ?? roundPredictions.length} tips för ${currentMember.name} är sparade. Du kan ändra dem fram till respektive matchstart.`,
      });
    } catch (error) {
      setSaveNotice({
        kind: "error",
        message: error instanceof Error ? error.message : "Tipsen kunde inte sparas.",
      });
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#17231d]">
      <section className="border-b border-[#d6decf] bg-[#eaf0e4]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#3f6f5a]">Hedstabacken Open</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-bold leading-tight text-[#112019] sm:text-5xl">
                Familjens Premier League-tips
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#4b5d51]">
                Logga in med ditt namn, tippa din egen rad och låt appen räkna tabellen när resultaten synkas.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#ccd8c4] bg-white p-3 shadow-sm sm:gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-[#66736b]">Säsong</p>
                <p className="mt-1 text-base font-bold sm:text-lg">{seasonLabel}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#66736b]">Matcher</p>
                <p className="mt-1 text-base font-bold sm:text-lg">10/omg.</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#66736b]">Import</p>
                <p className="mt-1 text-base font-bold sm:text-lg">{fixtures.length > 0 ? "API aktiv" : "Laddar"}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            {familyLoading ? (
              <div className="login-panel" aria-live="polite">
                <span className="field-label">Logga in med namn och PIN</span>
                <span className="text-sm font-semibold text-[#43544a]">Laddar familjekonton...</span>
              </div>
            ) : needsSetup ? (
              <form className="login-panel" onSubmit={createFirstAdmin}>
                <label className="field-label" htmlFor="setup-name">
                  Administratörens namn
                </label>
                <input
                  autoComplete="name"
                  className="field-input"
                  id="setup-name"
                  maxLength={40}
                  onChange={(event) => setSetupName(event.target.value)}
                  placeholder="Namn"
                  value={setupName}
                />
                <label className="field-label" htmlFor="setup-pin">
                  PIN
                </label>
                <input
                  autoComplete="new-password"
                  className="field-input"
                  id="setup-pin"
                  inputMode="numeric"
                  maxLength={8}
                  onChange={(event) => setSetupPin(event.target.value.replace(/\D/g, ""))}
                  pattern="[0-9]{4,8}"
                  placeholder="4-8 siffror"
                  type="password"
                  value={setupPin}
                />
                <button className="primary-button" type="submit">
                  Skapa administratör
                </button>
              </form>
            ) : currentMember ? (
              <div className="login-panel">
                <span className="field-label">Inloggad användare</span>
                <strong>{currentMember.name}</strong>
                <span className="text-sm text-[#5b6b61]">
                  {currentMember.role === "admin" ? "Administratör" : "Familjemedlem"}
                </span>
                <button className="control-button" onClick={logout} type="button">
                  Logga ut
                </button>
              </div>
            ) : (
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
                  autoComplete="current-password"
                  className="field-input"
                  id="pin"
                  inputMode="numeric"
                  maxLength={8}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                  pattern="[0-9]{4,8}"
                  placeholder="4-8 siffror"
                  type="password"
                  value={pin}
                />
                <button className="primary-button" type="submit">
                  Logga in
                </button>
              </form>
            )}

            <div className="mobile-actions">
              <button className="control-button" onClick={() => randomizeRound(true)} type="button">
                Slumpa ej tippade matcher
              </button>
              <button className="control-button" onClick={() => randomizeRound(false)} type="button">
                Slumpa alla matcher i omgången
              </button>
            </div>
          </div>

          <p className="text-sm font-semibold text-[#43544a]">{loginMessage}</p>
        </div>
      </section>

      <section className="page-grid mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="min-w-0 lg:col-span-2">
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
              aria-pressed={activeView === "standings"}
              className={`view-tab ${activeView === "standings" ? "view-tab-active" : ""}`}
              onClick={() => setActiveView("standings")}
              type="button"
            >
              Poängtabell
            </button>
          </div>
        </div>

        <div className={activeView === "predictions" ? "min-w-0 space-y-4 sm:space-y-5" : "hidden"}>
          <div className="sm:hidden">
            <label className="field-label" htmlFor="matchday">
              Välj omgång
            </label>
            <select
              className="field-input mt-1"
              id="matchday"
              onChange={(event) => setSelectedMatchday(Number(event.target.value))}
              value={selectedMatchday}
            >
              {matchdays.map((matchday) => (
                <option key={matchday} value={matchday}>
                  Omgång {matchday}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden min-w-0 gap-2 overflow-x-auto pb-1 sm:flex" aria-label="Välj omgång">
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

          <div className="min-w-0 overflow-hidden rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
            <div className="hidden grid-cols-[150px_minmax(0,1fr)_88px_120px] border-b border-[#e5eadf] bg-[#fbfcf8] px-4 py-3 text-xs font-bold uppercase text-[#66736b] sm:grid">
              <span>Avspark</span>
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
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 border-b border-[#edf1e8] px-4 py-4 last:border-b-0 sm:grid-cols-[150px_minmax(0,1fr)_88px_120px] sm:gap-3"
                  key={fixture.id}
                >
                  <div className="hidden text-sm text-[#5b6b61] sm:block">
                    <p className="font-semibold text-[#24362c]">{formatKickoff(fixture.kickoff)}</p>
                    <p>{statusLabel(fixture.status)}</p>
                  </div>
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <p className="text-sm text-[#5b6b61] sm:hidden">{formatKickoff(fixture.kickoff)}</p>
                    <h2 className="text-base font-bold text-[#17231d]">
                      <span className="sm:hidden">
                        {teamAbbreviation(fixture.homeTeam)} - {teamAbbreviation(fixture.awayTeam)}
                      </span>
                      <span className="hidden sm:inline">
                        {fixture.homeTeam} - {fixture.awayTeam}
                      </span>
                    </h2>
                    <p className="mt-1 text-sm text-[#65736a]">
                      {locked ? "Låst vid avspark" : fixture.status === "POSTPONED" ? "Inväntar ny tid" : "Öppen för tips"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold text-[#24362c] sm:block">
                    <span className="text-xs font-bold uppercase text-[#66736b] sm:hidden">Resultat</span>
                    <span>{fixture.score ?? "-"}</span>
                  </div>
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

            <div className={`save-panel save-panel-${saveNotice.kind}`} role="status" aria-live="polite">
              <div className="min-w-0">
                <p className="save-panel-title">
                  {savePanelTitle}
                </p>
                <p className="mt-1 text-sm leading-5">{saveNotice.message}</p>
              </div>
              <button
                className="primary-button save-predictions-button"
                disabled={!currentMember || saveNotice.kind === "saving"}
                onClick={savePredictions}
                type="button"
              >
                {saveNotice.kind === "saving" ? "Sparar..." : "Spara tips"}
              </button>
            </div>
          </div>

          <section className="min-w-0 rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
            <div className="border-b border-[#e5eadf] px-4 py-3">
              <h2 className="text-lg font-bold">Allas tips i omgång {selectedMatchday}</h2>
            </div>
            <div className="p-4 sm:hidden">
              <label className="field-label" htmlFor="tips-member">
                Visa tips för
              </label>
              <select
                className="field-input mt-1"
                id="tips-member"
                onChange={(event) => setSelectedTipsMemberId(event.target.value)}
                value={selectedTipsMemberId}
              >
                {familyMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>

              {selectedTipsMember ? (
                <div className="mt-4 divide-y divide-[#edf1e8] border-y border-[#e5eadf]">
                  {roundFixtures.map((fixture) => {
                    const canReveal = isLocked(fixture);
                    const pick = predictions[selectedTipsMember.id]?.[fixture.id];
                    const isOwnPick = currentMember?.id === selectedTipsMember.id;

                    return (
                      <div className="flex items-center justify-between gap-3 py-3" key={fixture.id}>
                        <span className="font-semibold text-[#24362c]">
                          {teamAbbreviation(fixture.homeTeam)} - {teamAbbreviation(fixture.awayTeam)}
                        </span>
                        <span className={`pick-pill ${canReveal && pick === fixture.result ? "pick-pill-correct" : ""}`}>
                          {canReveal || isOwnPick ? pick ?? "-" : "Dold"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm font-medium text-[#5b6b61]">Inga familjemedlemmar är tillagda ännu.</p>
              )}
            </div>

            <div className="mobile-table-scroll hidden sm:block">
              <table className="tips-table w-full min-w-[680px] border-collapse text-sm">
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
                        <span className="sm:hidden">
                          {teamAbbreviation(fixture.homeTeam)} - {teamAbbreviation(fixture.awayTeam)}
                        </span>
                        <span className="hidden sm:inline">
                          {fixture.homeTeam} - {fixture.awayTeam}
                        </span>
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

        <aside className={activeView === "predictions" ? "min-w-0 space-y-4 sm:space-y-5" : "hidden"}>
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
                        {member.matchPoints} matchpoäng + {member.roundBonus} bonus
                      </p>
                      <p className="text-xs font-semibold text-[#52635a]">
                        {member.correct} rätt · {member.roundWins} {member.roundWins === 1 ? "omgångsvinst" : "omgångsvinster"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-[#1d513d]">{member.total}</span>
                    <p className="text-xs font-bold uppercase text-[#66736b]">poäng</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {currentMember?.role === "admin" ? (
            <section className="rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
              <div className="border-b border-[#e5eadf] px-4 py-3">
                <h2 className="text-lg font-bold">Hantera användare</h2>
              </div>
              <div className="space-y-5 p-4 text-sm text-[#4f6157]">
                <form className="grid gap-3" onSubmit={addMember}>
                  <div>
                    <label className="field-label" htmlFor="new-member-name">
                      Namn
                    </label>
                    <input
                      autoComplete="off"
                      className="field-input mt-1 w-full"
                      id="new-member-name"
                      maxLength={40}
                      onChange={(event) => setNewMemberName(event.target.value)}
                      placeholder="Familjemedlemmens namn"
                      value={newMemberName}
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="new-member-pin">
                      Enkel PIN
                    </label>
                    <input
                      autoComplete="new-password"
                      className="field-input mt-1 w-full"
                      id="new-member-pin"
                      inputMode="numeric"
                      maxLength={8}
                      onChange={(event) => setNewMemberPin(event.target.value.replace(/\D/g, ""))}
                      pattern="[0-9]{4,8}"
                      placeholder="4-8 siffror"
                      type="password"
                      value={newMemberPin}
                    />
                  </div>
                  <button className="primary-button justify-center" type="submit">
                    Lägg till användare
                  </button>
                </form>

                <div className="border-t border-[#e5eadf] pt-4">
                  <h3 className="font-bold text-[#24362c]">Byt glömd PIN</h3>
                  <div className="mt-3 grid gap-3">
                  {familyMembers.map((member) => (
                    <div className="rounded-md bg-[#f5f7f2] p-3" key={member.id}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="font-semibold text-[#24362c]">{member.name}</span>
                        <span className="text-xs font-bold uppercase text-[#66736b]">
                          {member.role === "admin" ? "Admin" : "Spelare"}
                        </span>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <input
                          aria-label={`Ny PIN för ${member.name}`}
                          autoComplete="new-password"
                          className="field-input min-w-0 flex-1"
                          inputMode="numeric"
                          maxLength={8}
                          onChange={(event) =>
                            setResetPins((current) => ({
                              ...current,
                              [member.id]: event.target.value.replace(/\D/g, ""),
                            }))
                          }
                          pattern="[0-9]{4,8}"
                          placeholder="Ny PIN"
                          type="password"
                          value={resetPins[member.id] ?? ""}
                        />
                        <button className="control-button shrink-0" onClick={() => resetMemberPin(member)} type="button">
                          Byt PIN
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>

                <div className="border-t border-[#e5eadf] pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-[#24362c]">SMS efter omgången</h3>
                      <p className="mt-1 text-xs leading-5 text-[#66736b]">
                        Nummer sparas i svenskt format. Aktivera bara SMS för deltagare som vill få utskicken.
                      </p>
                    </div>
                    <button
                      className="control-button"
                      disabled={!smsConfigured}
                      onClick={runSmsCheck}
                      type="button"
                    >
                      Kontrollera nu
                    </button>
                  </div>

                  <div className="mt-3 divide-y divide-[#e5eadf] border-y border-[#e5eadf]">
                    {smsMembers.map((member) => (
                      <div className="space-y-3 py-4" key={member.id}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-[#24362c]">{member.name}</span>
                          <label className="flex items-center gap-2 font-semibold text-[#43544a]">
                            <input
                              checked={member.smsOptIn}
                              className="h-5 w-5 accent-[#1d513d]"
                              onChange={(event) => updateSmsMember(member.id, { smsOptIn: event.target.checked })}
                              type="checkbox"
                            />
                            Få SMS
                          </label>
                        </div>
                        <input
                          aria-label={`Mobilnummer för ${member.name}`}
                          autoComplete="tel"
                          className="field-input w-full"
                          inputMode="tel"
                          onChange={(event) => updateSmsMember(member.id, { phoneNumber: event.target.value })}
                          placeholder="0701234567"
                          type="tel"
                          value={member.phoneNumber ?? ""}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <button className="control-button justify-center" onClick={() => saveSmsMember(member)} type="button">
                            Spara
                          </button>
                          <button
                            className="control-button justify-center"
                            disabled={!smsConfigured || !member.smsOptIn || !member.phoneNumber}
                            onClick={() => sendSmsTest(member)}
                            type="button"
                          >
                            Skicka test
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p aria-live="polite" className="mt-3 font-semibold text-[#43544a]">
                    {smsMessage}
                  </p>
                </div>

                <p aria-live="polite" className="font-semibold text-[#43544a]">
                  {adminMessage}
                </p>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-[#d9e0d5] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">API-status</h2>
            <div className="mt-4 space-y-3 text-sm text-[#4f6157]">
              <p>{syncMessage}</p>
              <p>Spelschema och resultat hämtas från football-data.org och sparas i appens databas.</p>
              <p>Appen kontrollerar resultaten automatiskt varje timme och även när någon öppnar den.</p>
            </div>
          </section>
        </aside>

        <div className={activeView === "standings" ? "min-w-0 space-y-4 sm:space-y-5 lg:col-span-2" : "hidden"}>
          <section className="overflow-hidden rounded-lg border border-[#d9e0d5] bg-white shadow-sm">
            <div className="border-b border-[#e5eadf] px-4 py-3">
              <h2 className="text-lg font-bold">Poängtabell</h2>
              <p className="mt-1 text-sm leading-6 text-[#5b6b61]">
                Varje match har en pott på 100 poäng som delas mellan dem som tippat rätt. Omgångens 50 bonuspoäng delas mellan dem som tagit flest matchpoäng i omgången.
              </p>
            </div>
            <div className="sm:hidden">
              <table aria-label="Kompakt totalställning" className="w-full table-fixed border-collapse text-sm">
                <thead>
                  <tr className="bg-[#fbfcf8] text-left text-[11px] font-bold uppercase text-[#66736b]">
                    <th className="w-9 px-2 py-3 text-center">#</th>
                    <th className="px-2 py-3">Deltagare</th>
                    <th className="w-16 px-2 py-3 text-center">Poäng</th>
                  </tr>
                </thead>
                <tbody>
                  {competition.standings.map((member, index) => (
                    <tr className="border-t border-[#edf1e8]" key={member.memberId}>
                      <td className="px-2 py-3 text-center font-bold">{index + 1}</td>
                      <td className="min-w-0 px-2 py-3">
                        <p className="break-words font-bold">{member.name}</p>
                        <p className="mt-0.5 text-xs text-[#66736b]">
                          {member.correct} rätt · {member.roundBonus} bonus
                        </p>
                      </td>
                      <td className="px-2 py-3 text-center text-base font-bold text-[#1d513d]">{member.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-table-scroll hidden sm:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#fbfcf8] text-left text-xs uppercase text-[#66736b]">
                    <th className="px-4 py-3">Placering</th>
                    <th className="px-4 py-3">Deltagare</th>
                    <th className="px-4 py-3">Antal rätt</th>
                    <th className="px-4 py-3">Matchpoäng</th>
                    <th className="px-4 py-3">Omgångsbonus</th>
                    <th className="px-4 py-3">Totalpoäng</th>
                  </tr>
                </thead>
                <tbody>
                  {competition.standings.map((member, index) => (
                    <tr className="border-t border-[#edf1e8]" key={member.memberId}>
                      <td className="px-4 py-3 font-bold">{index + 1}</td>
                      <td className="px-4 py-3 font-bold">{member.name}</td>
                      <td className="px-4 py-3">{member.correct}</td>
                      <td className="px-4 py-3">{member.matchPoints}</td>
                      <td className="px-4 py-3">{member.roundBonus}</td>
                      <td className="px-4 py-3 text-base font-bold text-[#1d513d]">{member.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
