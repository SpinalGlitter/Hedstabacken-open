import { calculateCompetition, type RoundResult, type ScoringPredictionBook } from "@/lib/scoring";
import { sendSms, smsConfiguration } from "@/lib/sms";
import { buildRoundSms } from "@/lib/sms-summary";

type MemberRow = {
  id: number;
  display_name: string;
  phone_number: string | null;
  sms_opt_in: number;
};

type FixtureRow = {
  id: number;
  matchday: number;
  status: string;
  winner: "HOME_TEAM" | "DRAW" | "AWAY_TEAM" | null;
};

type PredictionRow = {
  member_id: number;
  fixture_id: number;
  pick: "1" | "X" | "2";
};

type NotificationRow = {
  id: number;
  status: "pending" | "processing" | "sent";
};

type DeliveryRow = {
  id: number;
  phone_number: string;
};

function winnerToPick(winner: FixtureRow["winner"]) {
  if (winner === "HOME_TEAM") return "1" as const;
  if (winner === "DRAW") return "X" as const;
  if (winner === "AWAY_TEAM") return "2" as const;
  return undefined;
}

async function loadCompetition(db: D1Database, seasonId: number) {
  const [memberResult, fixtureResult, predictionResult] = await Promise.all([
    db
      .prepare(
        `SELECT id, display_name, phone_number, sms_opt_in
         FROM family_members
         ORDER BY created_at, id`,
      )
      .all<MemberRow>(),
    db
      .prepare(
        `SELECT id, matchday, status, winner
         FROM fixtures
         WHERE season_id = ?
         ORDER BY matchday, utc_date, id`,
      )
      .bind(seasonId)
      .all<FixtureRow>(),
    db
      .prepare(
        `SELECT predictions.member_id, predictions.fixture_id, predictions.pick
         FROM predictions
         JOIN fixtures ON fixtures.id = predictions.fixture_id
         WHERE fixtures.season_id = ?`,
      )
      .bind(seasonId)
      .all<PredictionRow>(),
  ]);

  const members = memberResult.results.map((member) => ({
    id: String(member.id),
    name: member.display_name,
  }));
  const fixtures = fixtureResult.results.map((fixture) => ({
    id: fixture.id,
    matchday: fixture.matchday,
    status: fixture.status,
    result: winnerToPick(fixture.winner),
  }));
  const predictions: ScoringPredictionBook = {};
  for (const prediction of predictionResult.results) {
    const memberId = String(prediction.member_id);
    predictions[memberId] ??= {};
    predictions[memberId][prediction.fixture_id] = prediction.pick;
  }

  return { memberRows: memberResult.results, members, fixtures, predictions };
}

async function ensureNotification(
  db: D1Database,
  seasonId: number,
  round: RoundResult,
  message: string,
  recipients: MemberRow[],
) {
  const inserted = await db
    .prepare(
      `INSERT OR IGNORE INTO round_notifications (season_id, matchday, message)
       VALUES (?, ?, ?)`,
    )
    .bind(seasonId, round.matchday, message)
    .run();
  const notification = await db
    .prepare(
      `SELECT id, status FROM round_notifications
       WHERE season_id = ? AND matchday = ? LIMIT 1`,
    )
    .bind(seasonId, round.matchday)
    .first<NotificationRow>();

  if (!notification) {
    throw new Error("SMS-utskicket kunde inte skapas.");
  }

  if (inserted.meta.changes && recipients.length > 0) {
    await db.batch(
      recipients.map((member) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO sms_deliveries
              (notification_id, member_id, phone_number)
             VALUES (?, ?, ?)`,
          )
          .bind(notification.id, member.id, member.phone_number),
      ),
    );
  }

  return notification;
}

async function processNotification(
  db: D1Database,
  notification: NotificationRow,
  configuration: NonNullable<ReturnType<typeof smsConfiguration>>,
) {
  if (notification.status === "sent") {
    return { sent: 0, failed: 0 };
  }

  const claimed = await db
    .prepare(
      `UPDATE round_notifications
       SET status = 'processing', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (
         status = 'pending' OR
         (status = 'processing' AND updated_at < datetime('now', '-2 hours'))
       )`,
    )
    .bind(notification.id)
    .run();
  if (!claimed.meta.changes) {
    return { sent: 0, failed: 0 };
  }

  const notificationMessage = await db
    .prepare("SELECT message FROM round_notifications WHERE id = ?")
    .bind(notification.id)
    .first<{ message: string }>();
  const deliveries = await db
    .prepare(
      `SELECT id, phone_number FROM sms_deliveries
       WHERE notification_id = ? AND status != 'sent'
       ORDER BY id`,
    )
    .bind(notification.id)
    .all<DeliveryRow>();

  if (!notificationMessage) {
    throw new Error("SMS-texten kunde inte hittas.");
  }

  for (const delivery of deliveries.results) {
    try {
      const result = await sendSms(configuration, delivery.phone_number, notificationMessage.message);
      await db
        .prepare(
          `UPDATE sms_deliveries
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
          `UPDATE sms_deliveries
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
       FROM sms_deliveries WHERE notification_id = ?`,
    )
    .bind(notification.id)
    .first<{ sent: number | null; failed: number | null }>();
  const sent = counts?.sent ?? 0;
  const failed = counts?.failed ?? 0;
  const status = failed === 0 ? "sent" : "pending";

  await db
    .prepare(
      `UPDATE round_notifications
       SET status = ?, sent_count = ?, failed_count = ?, updated_at = CURRENT_TIMESTAMP,
         completed_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = ?`,
    )
    .bind(status, sent, failed, status, notification.id)
    .run();

  return { sent, failed };
}

export async function processRoundNotifications(env: Cloudflare.Env) {
  const configuration = smsConfiguration(env);
  if (!configuration || !env.DB) {
    return { configured: false, rounds: 0, sent: 0, failed: 0 };
  }

  const season = await env.DB
    .prepare("SELECT id FROM seasons ORDER BY start_year DESC, id DESC LIMIT 1")
    .first<{ id: number }>();
  if (!season) {
    return { configured: true, rounds: 0, sent: 0, failed: 0 };
  }

  const data = await loadCompetition(env.DB, season.id);
  const recipients = data.memberRows.filter(
    (member) => member.sms_opt_in === 1 && member.phone_number,
  );
  if (recipients.length === 0) {
    return { configured: true, rounds: 0, sent: 0, failed: 0 };
  }

  const competition = calculateCompetition(data.members, data.fixtures, data.predictions);
  const names = new Map(data.members.map((member) => [member.id, member.name]));
  let sent = 0;
  let failed = 0;
  let rounds = 0;

  for (const round of competition.roundResults) {
    const throughRound = calculateCompetition(
      data.members,
      data.fixtures.filter((fixture) => fixture.matchday <= round.matchday),
      data.predictions,
    );
    const leaderPoints = throughRound.standings[0]?.total ?? 0;
    const leaderIds = throughRound.standings
      .filter((standing) => standing.total === leaderPoints)
      .map((standing) => standing.memberId);
    const message = buildRoundSms({
      round,
      names,
      leaderIds,
      leaderPoints,
      siteUrl: env.APP_PUBLIC_URL,
    });
    const notification = await ensureNotification(env.DB, season.id, round, message, recipients);
    const result = await processNotification(env.DB, notification, configuration);
    if (result.sent > 0 || result.failed > 0) {
      rounds += 1;
      sent += result.sent;
      failed += result.failed;
    }
  }

  return { configured: true, rounds, sent, failed };
}

export async function sendTestSms(env: Cloudflare.Env, db: D1Database, memberId: number) {
  const configuration = smsConfiguration(env);
  if (!configuration) {
    throw new Error("SMS-tjänstens API-uppgifter saknas.");
  }

  const member = await db
    .prepare(
      `SELECT phone_number, sms_opt_in FROM family_members WHERE id = ? LIMIT 1`,
    )
    .bind(memberId)
    .first<{ phone_number: string | null; sms_opt_in: number }>();
  if (!member?.phone_number || member.sms_opt_in !== 1) {
    throw new Error("Spara ett mobilnummer och slå på SMS innan du testar.");
  }

  return sendSms(configuration, member.phone_number, "Test från Hedstabacken Open. SMS-utskicken fungerar.");
}
