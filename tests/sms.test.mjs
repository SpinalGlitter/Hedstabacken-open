import assert from "node:assert/strict";
import test from "node:test";

import { estimateSmsParts, normalizeSwedishMobile } from "../lib/sms.ts";
import { validateCustomSms } from "../lib/custom-sms-input.ts";
import { buildRoundSms } from "../lib/sms-summary.ts";
import { buildRoundReminderSms, isRoundReminderDue } from "../lib/reminder-sms.ts";

test("normalizes Swedish mobile numbers to E.164", () => {
  assert.equal(normalizeSwedishMobile("070-123 45 67"), "+46701234567");
  assert.equal(normalizeSwedishMobile("0046 70 123 45 67"), "+46701234567");
  assert.equal(normalizeSwedishMobile("+46 70 123 45 67"), "+46701234567");
  assert.equal(normalizeSwedishMobile(""), null);
  assert.throws(() => normalizeSwedishMobile("08-123 45 67"), /svenskt nummer/);
});

test("estimates GSM and Unicode SMS parts", () => {
  assert.equal(estimateSmsParts("Hej familjen!"), 1);
  assert.equal(estimateSmsParts("a".repeat(160)), 1);
  assert.equal(estimateSmsParts("a".repeat(161)), 2);
  assert.equal(estimateSmsParts("⚽".repeat(71)), 2);
});

test("validates and deduplicates a custom SMS request", () => {
  const requestId = "123e4567-e89b-12d3-a456-426614174000";
  assert.deepEqual(
    validateCustomSms({ message: "  Hej familjen!  ", recipientIds: [2, "2", 3], requestId }),
    { message: "Hej familjen!", recipientIds: [2, 3], requestId },
  );
  assert.throws(() => validateCustomSms({ message: "", recipientIds: [2], requestId }), /mellan 1 och 480/);
  assert.throws(() => validateCustomSms({ message: "Hej", recipientIds: [], requestId }), /minst en/);
  assert.throws(() => validateCustomSms({ message: "Hej", recipientIds: [2], requestId: "nope" }), /ID/);
});

test("keeps the custom SMS route admin-only", async () => {
  const route = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../app/api/custom-sms/route.ts", import.meta.url), "utf8"),
  );

  assert.match(route, /requireAdmin\(db, request\)/);
});

test("builds a concise round summary with winners and most correct picks", () => {
  const names = new Map([
    ["anna", "Anna"],
    ["erik", "Erik"],
  ]);
  const message = buildRoundSms({
    round: {
      matchday: 12,
      winnerIds: ["anna"],
      maxMatchPoints: 284,
      mostCorrectIds: ["erik"],
      maxCorrect: 8,
      bonusPerWinner: 50,
    },
    names,
    leaderIds: ["anna"],
    leaderPoints: 1842,
  });

  assert.match(message, /Grattis Anna/);
  assert.match(message, /vann omgång 12 på 284p/);
  assert.match(message, /Flest rätt: Erik \(8\)/);
  assert.match(message, /Totalledare: Anna \(1842p\)/);
  assert.ok(message.length <= 160);
});

test("keeps shared-winner summaries within one SMS part", () => {
  const names = new Map([
    ["anna", "Anna Med Ett Väldigt Långt Namn"],
    ["erik", "Erik Med Ett Väldigt Långt Namn"],
    ["johan", "Johan Med Ett Väldigt Långt Namn"],
  ]);
  const message = buildRoundSms({
    round: {
      matchday: 38,
      winnerIds: ["anna", "erik", "johan"],
      maxMatchPoints: 333,
      mostCorrectIds: ["anna", "erik", "johan"],
      maxCorrect: 9,
      bonusPerWinner: 16,
    },
    names,
    leaderIds: ["anna", "erik", "johan"],
    leaderPoints: 9999,
  });

  assert.match(message, /3 delade vinnare/);
  assert.ok(message.length <= 160);
});

test("sends a round reminder in the hour before the first kickoff", () => {
  const kickoff = "2026-08-29T14:00:00.000Z";

  assert.equal(isRoundReminderDue(kickoff, Date.parse("2026-08-29T13:00:00.000Z")), true);
  assert.equal(isRoundReminderDue(kickoff, Date.parse("2026-08-29T13:10:00.000Z")), true);
  assert.equal(isRoundReminderDue(kickoff, Date.parse("2026-08-29T12:55:00.000Z")), true);
  assert.equal(isRoundReminderDue(kickoff, Date.parse("2026-08-29T12:54:59.000Z")), false);
  assert.equal(isRoundReminderDue(kickoff, Date.parse("2026-08-29T13:40:00.000Z")), false);
  assert.equal(isRoundReminderDue("invalid", Date.parse("2026-08-29T13:00:00.000Z")), false);
});

test("keeps the scheduled notification endpoint secret-protected", async () => {
  const route = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../app/api/cron/route.ts", import.meta.url), "utf8"),
  );

  assert.match(route, /env\.CRON_SECRET/);
  assert.match(route, /authorization !== `Bearer \$\{secret\}`/);
  assert.match(route, /status: 401/);
});

test("builds a concise round reminder with the site link", () => {
  const message = buildRoundReminderSms(3, "https://hedstabacken-open.jompen.chatgpt.site/");

  assert.match(message, /Omgång 3 börjar om ungefär en timme/);
  assert.match(message, /Kom ihåg att lämna in dina tips/);
  assert.match(message, /https:\/\/hedstabacken-open\.jompen\.chatgpt\.site$/);
  assert.equal(estimateSmsParts(message), 1);
});
