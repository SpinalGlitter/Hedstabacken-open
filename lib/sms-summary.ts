const DEFAULT_SITE_URL = "https://hedstabacken-open.jompen.chatgpt.site";

type SmsRoundResult = {
  matchday: number;
  winnerIds: string[];
  maxMatchPoints: number | null;
  mostCorrectIds: string[];
  maxCorrect: number | null;
  bonusPerWinner: number;
};

function shortenName(name: string) {
  return name.length > 18 ? `${name.slice(0, 17)}.` : name;
}

function formatNames(ids: string[], names: Map<string, string>) {
  const values = ids.map((id) => shortenName(names.get(id) ?? "Okänd"));
  if (values.length <= 2) {
    return values.join(" och ");
  }
  return `${values[0]} +${values.length - 1}`;
}

export function buildRoundSms(input: {
  round: SmsRoundResult;
  names: Map<string, string>;
  leaderIds: string[];
  leaderPoints: number;
  siteUrl?: string;
}) {
  const { round, names, leaderIds, leaderPoints } = input;
  const siteUrl = (input.siteUrl || DEFAULT_SITE_URL).replace(/\/$/, "");
  const winners = formatNames(round.winnerIds, names);
  const mostCorrect = formatNames(round.mostCorrectIds, names);
  const leaders = formatNames(leaderIds, names);
  const winnerText = round.winnerIds.length === 1
    ? `${winners} vann på ${round.maxMatchPoints}p (+${round.bonusPerWinner})`
    : round.winnerIds.length > 1
      ? `${winners} delade segern på ${round.maxMatchPoints}p (+${round.bonusPerWinner} var)`
      : "ingen vinnare";
  const correctText = round.maxCorrect
    ? `${mostCorrect} (${round.maxCorrect})`
    : "ingen";
  const leaderText = leaderIds.length > 0 ? `${leaders} (${leaderPoints}p)` : "ingen";
  const full = `Omgång ${round.matchday}: ${winnerText}. Flest rätt: ${correctText}. Totalledare: ${leaderText}. ${siteUrl}`;

  if (full.length <= 160) {
    return full;
  }

  const compactWinners = round.winnerIds.length === 1
    ? winners
    : `${round.winnerIds.length} delade vinnare`;
  const compactCorrect = round.mostCorrectIds.length === 1
    ? mostCorrect
    : `${round.mostCorrectIds.length} personer`;
  const compact = `Omg ${round.matchday}: ${compactWinners} vann, ${round.maxMatchPoints}p (+${round.bonusPerWinner}). Flest rätt: ${compactCorrect} (${round.maxCorrect ?? 0}). ${siteUrl}`;

  if (compact.length <= 160) {
    return compact;
  }

  return `Omg ${round.matchday} klar. Vinnare: ${compactWinners}. Flest rätt: ${round.maxCorrect ?? 0}. ${siteUrl}`;
}
