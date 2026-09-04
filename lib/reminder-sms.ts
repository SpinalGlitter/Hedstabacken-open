const REMINDER_WINDOW_MS = 90 * 60 * 1000;
const REMINDER_WINDOW_END_MS = 15 * 60 * 1000;

export function isRoundReminderDue(firstKickoff: string, now = Date.now()) {
  const kickoff = Date.parse(firstKickoff);
  if (!Number.isFinite(kickoff)) {
    return false;
  }

  const timeUntilKickoff = kickoff - now;
  return timeUntilKickoff <= REMINDER_WINDOW_MS && timeUntilKickoff > REMINDER_WINDOW_END_MS;
}

export function buildRoundReminderSms(matchday: number, siteUrl: string) {
  const normalizedUrl = siteUrl.replace(/\/$/, "");
  return `Påminnelse: Omgång ${matchday} börjar om ungefär en timme. Kom ihåg att lämna in dina tips! ${normalizedUrl}`;
}
