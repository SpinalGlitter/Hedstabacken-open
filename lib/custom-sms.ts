import { sendSms, smsConfiguration } from "@/lib/sms";
import { validateCustomSms } from "@/lib/custom-sms-input";

type CustomSmsMessageRow = {
  id: number;
  message: string;
  status: "pending" | "processing" | "sent" | "partial";
  recipient_count: number;
  sent_count: number;
  failed_count: number;
};

type RecipientRow = {
  id: number;
  phone_number: string;
};

type DeliveryRow = {
  id: number;
  phone_number: string;
};

async function messageByRequest(db: D1Database, adminMemberId: number, requestId: string) {
  return db
    .prepare(
      `SELECT id, message, status, recipient_count, sent_count, failed_count
       FROM custom_sms_messages
       WHERE request_key = ? AND admin_member_id = ? LIMIT 1`,
    )
    .bind(requestId, adminMemberId)
    .first<CustomSmsMessageRow>();
}

function resultFromMessage(message: CustomSmsMessageRow) {
  return {
    id: message.id,
    recipients: message.recipient_count,
    sent: message.sent_count,
    failed: message.failed_count,
  };
}

export async function sendCustomSms(
  env: Cloudflare.Env,
  db: D1Database,
  adminMemberId: number,
  input: { message?: unknown; recipientIds?: unknown; requestId?: unknown },
) {
  const { message, recipientIds, requestId } = validateCustomSms(input);
  const configuration = smsConfiguration(env);
  if (!configuration) {
    throw new Error("SMS-tjänstens API-uppgifter saknas.");
  }

  let customMessage = await messageByRequest(db, adminMemberId, requestId);
  if (!customMessage) {
    const placeholders = recipientIds.map(() => "?").join(", ");
    const recipients = await db
      .prepare(
        `SELECT id, phone_number
         FROM family_members
         WHERE id IN (${placeholders}) AND sms_opt_in = 1 AND phone_number IS NOT NULL
         ORDER BY created_at, id`,
      )
      .bind(...recipientIds)
      .all<RecipientRow>();

    if (recipients.results.length !== recipientIds.length) {
      throw new Error("En eller flera mottagare saknar aktiverat SMS eller mobilnummer.");
    }

    await db.batch([
      db
        .prepare(
          `INSERT OR IGNORE INTO custom_sms_messages
            (request_key, admin_member_id, message, recipient_count)
           VALUES (?, ?, ?, ?)`,
        )
        .bind(requestId, adminMemberId, message, recipients.results.length),
      ...recipients.results.map((recipient) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO custom_sms_deliveries
              (message_id, member_id, phone_number)
             SELECT id, ?, ? FROM custom_sms_messages
             WHERE request_key = ? AND admin_member_id = ?`,
          )
          .bind(recipient.id, recipient.phone_number, requestId, adminMemberId),
      ),
    ]);
    customMessage = await messageByRequest(db, adminMemberId, requestId);

    if (!customMessage) {
      throw new Error("SMS-utskicket kunde inte skapas.");
    }

  }

  if (customMessage.status === "sent" || customMessage.status === "partial") {
    return resultFromMessage(customMessage);
  }

  const claimed = await db
    .prepare(
      `UPDATE custom_sms_messages
       SET status = 'processing', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (
         status = 'pending' OR
         (status = 'processing' AND updated_at < datetime('now', '-2 hours'))
       )`,
    )
    .bind(customMessage.id)
    .run();
  if (!claimed.meta.changes) {
    return resultFromMessage(customMessage);
  }

  const deliveries = await db
    .prepare(
      `SELECT id, phone_number FROM custom_sms_deliveries
       WHERE message_id = ? AND status != 'sent'
       ORDER BY id`,
    )
    .bind(customMessage.id)
    .all<DeliveryRow>();

  for (const delivery of deliveries.results) {
    try {
      const result = await sendSms(configuration, delivery.phone_number, customMessage.message);
      await db
        .prepare(
          `UPDATE custom_sms_deliveries
           SET status = 'sent', provider_message_id = ?, parts = ?,
             attempt_count = attempt_count + 1, last_error = NULL,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(result.id, result.parts, delivery.id)
        .run();
    } catch (error) {
      const failure = error instanceof Error ? error.message : "Okänt SMS-fel.";
      await db
        .prepare(
          `UPDATE custom_sms_deliveries
           SET status = 'failed', attempt_count = attempt_count + 1,
             last_error = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
        )
        .bind(failure.slice(0, 500), delivery.id)
        .run();
    }
  }

  const counts = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM custom_sms_deliveries WHERE message_id = ?`,
    )
    .bind(customMessage.id)
    .first<{ sent: number | null; failed: number | null }>();
  const sent = counts?.sent ?? 0;
  const failed = counts?.failed ?? 0;
  const status = failed === 0 ? "sent" : "partial";

  await db
    .prepare(
      `UPDATE custom_sms_messages
       SET status = ?, sent_count = ?, failed_count = ?,
         updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(status, sent, failed, customMessage.id)
    .run();

  return { id: customMessage.id, recipients: customMessage.recipient_count, sent, failed };
}

export async function listCustomSmsHistory(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT id, message, status, recipient_count, sent_count, failed_count, created_at
       FROM custom_sms_messages
       ORDER BY created_at DESC, id DESC LIMIT 8`,
    )
    .all<{
      id: number;
      message: string;
      status: string;
      recipient_count: number;
      sent_count: number;
      failed_count: number;
      created_at: string;
    }>();

  return result.results.map((row) => ({
    id: row.id,
    message: row.message,
    status: row.status,
    recipients: row.recipient_count,
    sent: row.sent_count,
    failed: row.failed_count,
    createdAt: row.created_at,
  }));
}
