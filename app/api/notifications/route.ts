import { processRoundNotifications, sendTestSms } from "@/lib/round-notifications";
import { processRoundReminders } from "@/lib/round-reminders";
import { getDatabase, requireAdmin } from "@/lib/server-auth";
import { smsConfiguration } from "@/lib/sms";

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env;
}

export async function GET(request: Request) {
  try {
    const db = await getDatabase();
    await requireAdmin(db, request);
    const env = await runtimeEnv();
    const history = await db
      .prepare(
        `SELECT matchday, status, sent_count, failed_count, completed_at
         FROM round_notifications
         ORDER BY matchday DESC LIMIT 5`,
      )
      .all<{
        matchday: number;
        status: string;
        sent_count: number;
        failed_count: number;
        completed_at: string | null;
      }>();

    return Response.json({ configured: smsConfiguration(env) !== null, history: history.results });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return Response.json({ error: "Endast administratören kan se SMS-status." }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "SMS-status kunde inte hämtas.";
    return Response.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDatabase();
    await requireAdmin(db, request);
    const body = (await request.json().catch(() => ({}))) as { action?: unknown; memberId?: unknown };
    const env = await runtimeEnv();

    if (body.action === "test") {
      const memberId = Number(body.memberId);
      if (!Number.isSafeInteger(memberId) || memberId < 1) {
        return Response.json({ error: "Ogiltig användare." }, { status: 400 });
      }
      const result = await sendTestSms(env, db, memberId);
      return Response.json({ ok: true, parts: result.parts });
    }

    if (body.action === "run") {
      const [reminders, summaries] = await Promise.all([
        processRoundReminders(env),
        processRoundNotifications(env),
      ]);
      return Response.json({ reminders, summaries });
    }

    return Response.json({ error: "Ogiltig SMS-åtgärd." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return Response.json({ error: "Endast administratören kan skicka SMS." }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "SMS:et kunde inte skickas.";
    return Response.json({ error: message }, { status: 400 });
  }
}
