import { processRoundNotifications } from "@/lib/round-notifications";
import { processRoundReminders } from "@/lib/round-reminders";

async function runtimeEnv() {
  const { env } = await import("cloudflare:workers");
  return env;
}

export async function POST(request: Request) {
  const env = await runtimeEnv();
  const secret = env.CRON_SECRET?.trim();
  const authorization = request.headers.get("Authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ error: "Obehörigt schemalagt anrop." }, { status: 401 });
  }

  const [reminders, summaries] = await Promise.all([
    processRoundReminders(env),
    processRoundNotifications(env),
  ]);

  return Response.json({ ok: true, reminders, summaries });
}
