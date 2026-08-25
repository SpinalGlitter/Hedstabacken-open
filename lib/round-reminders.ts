import { buildRoundReminderSms, isRoundReminderDue } from "@/lib/reminder-sms";
import { sendSms, smsConfiguration } from "@/lib/sms";

type MemberRow = {
  id: number;
  phone_number: string;
};

type RoundRow = {
  matchday: number;
  first_kickoff: string;
};

type ReminderRow = {
  id: number;
  status: "pending" | "processing" | "sent";
};

type DeliveryRow = {
  id: number;
  phone_number: string;
};

async function ensureReminder(
  db: D1Database,
  seasonId: number,
  round: RoundRow,
  message: string,
  recipients: MemberRow[],
) {
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO round_reminders
          (season_id, matchday, first_kickoff, message)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(seasonId, round.matchday, round.first_kickoff, message),
    ...recipients.map((member) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO round_reminder_deliveries
            (reminder_id, member_id, phone_number)
           SELECT id, ?, ? FROM round_reminders
           WHERE season_id = ? AND matchday = ?`,
        )
        .bind(member.id, member.phone_number, seasonId, round.matchday),
    ),
  ]);

  const reminder = await db
    .prepare(
      `SELECT id, status FROM round_reminders
       WHERE season_id = ? AND matchday = ? LIMIT 1`,
    )
    .bind(seasonId, round.matchday)
    .first<ReminderRow>();

  if (!reminder) {
    throw new Error("Påminnelsen kunde inte skapas.");
  }

  return reminder;
}

async function processReminder(
  db: D1Database,
  reminder: ReminderRow,
  configuration: NonNullable<ReturnType<typeof smsConfiguration>>,
) {
  if (reminder.status === "sent") {
    return { sent: 0, failed: 0 };
  }

  const claimed = await db
    .prepare(
      `UPDATE round_reminders
       SET status = 'processing', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (
         status = 'pending' OR
         (status = 'processing' AND updated_at < datetime('now', '-2 hours'))
       )`,
    )
    .bind(reminder.id)
    .run();
  if (!claimed.meta.changes) {
    return { sent: 0, failed: 0 };
  }

  const reminderMessage = await db
    .prepare("SELECT message FROM round_reminders WHERE id = ?")
    .bind(reminder.id)
    .first<{ message: string }>();
  const deliveries = await db
    .prepare(
      `SELECT id, phone_number FROM round_reminder_deliveries
       WHERE reminder_id = ? AND status != 'sent'
       ORDER BY id`,
    )
    .bind(reminder.id)
    .all<DeliveryRow>();

  if (!reminderMessage) {
    throw new Error("Påminnelsetexten kunde inte hittas.");
  }

  for (const delivery of deliveries.results) {
    try {
      const result = await sendSms(configuration, delivery.phone_number, reminderMessage.message);
      await db
        .prepare(
          `UPDATE round_reminder_deliveries
           SET status = 'sent', provider_message_id = ?, attempt_count = attempt_count + 1,
             last_error = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(result.id, delivery.id)
        .run();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Okänt SMS-fel.";
      await db
        .prepare(
          `UPDATE round_reminder_deliveries
           SET status = 'failed', attempt_count = attempt_count + 1,
             last_error = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(message.slice(0, 500), delivery.id)
        .run();
    }
  }

  const counts = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM round_reminder_deliveries WHERE reminder_id = ?`,
    )
    .bind(reminder.id)
    .first<{ sent: number | null; failed: number | null }>();
  const sent = counts?.sent ?? 0;
  const failed = counts?.failed ?? 0;
  const status = failed === 0 ? "sent" : "pending";

  await db
    .prepare(
      `UPDATE round_reminders
       SET status = ?, sent_count = ?, failed_count = ?, updated_at = CURRENT_TIMESTAMP,
         completed_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = ?`,
    )
    .bind(status, sent, failed, status, reminder.id)
    .run();

  return { sent, failed };
}

export async function processRoundReminders(env: Cloudflare.Env, now = Date.now()) {
  const configuration = smsConfiguration(env);
  if (!configuration || !env.DB) {
    return { configured: false, reminders: 0, sent: 0, failed: 0 };
  }

  const season = await env.DB
    .prepare("SELECT id FROM seasons ORDER BY start_year DESC, id DESC LIMIT 1")
    .first<{ id: number }>();
  if (!season) {
    return { configured: true, reminders: 0, sent: 0, failed: 0 };
  }

  const [roundResult, memberResult] = await Promise.all([
    env.DB
      .prepare(
        `SELECT matchday, MIN(utc_date) AS first_kickoff
         FROM fixtures
         WHERE season_id = ? AND status NOT IN ('POSTPONED', 'SUSPENDED', 'CANCELLED')
         GROUP BY matchday
         ORDER BY matchday`,
      )
      .bind(season.id)
      .all<RoundRow>(),
    env.DB
      .prepare(
        `SELECT id, phone_number
         FROM family_members
         WHERE sms_opt_in = 1 AND phone_number IS NOT NULL
         ORDER BY created_at, id`,
      )
      .all<MemberRow>(),
  ]);

  const dueRounds = roundResult.results.filter((round) => isRoundReminderDue(round.first_kickoff, now));
  if (dueRounds.length === 0 || memberResult.results.length === 0) {
    return { configured: true, reminders: 0, sent: 0, failed: 0 };
  }

  const siteUrl = env.APP_PUBLIC_URL?.trim() || "https://hedstabacken-open.jompen.chatgpt.site";
  let reminders = 0;
  let sent = 0;
  let failed = 0;

  for (const round of dueRounds) {
    const message = buildRoundReminderSms(round.matchday, siteUrl);
    const reminder = await ensureReminder(env.DB, season.id, round, message, memberResult.results);
    const result = await processReminder(env.DB, reminder, configuration);
    if (result.sent > 0 || result.failed > 0) {
      reminders += 1;
      sent += result.sent;
      failed += result.failed;
    }
  }

  return { configured: true, reminders, sent, failed };
}
