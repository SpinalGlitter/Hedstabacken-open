import { listCustomSmsHistory, sendCustomSms } from "@/lib/custom-sms";
import { getDatabase, requireAdmin } from "@/lib/server-auth";

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env;
}

export async function GET(request: Request) {
  try {
    const db = await getDatabase();
    await requireAdmin(db, request);
    return Response.json({ history: await listCustomSmsHistory(db) });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return Response.json({ error: "Endast administratören kan se SMS-historiken." }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "SMS-historiken kunde inte hämtas.";
    return Response.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await getDatabase();
    const admin = await requireAdmin(db, request);

    const body = (await request.json().catch(() => ({}))) as {
      message?: unknown;
      recipientIds?: unknown;
      requestId?: unknown;
    };
    const result = await sendCustomSms(await runtimeEnv(), db, Number(admin.id), body);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return Response.json({ error: "Endast administratören kan skicka SMS." }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "SMS-utskicket misslyckades.";
    return Response.json({ error: message }, { status: 400 });
  }
}
