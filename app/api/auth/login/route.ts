import { createSession, getDatabase, validatePin, verifyPin } from "@/lib/server-auth";

type LoginRow = {
  id: number;
  display_name: string;
  pin_code: string;
  role: "admin" | "player";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { memberId?: unknown; pin?: unknown };
    const memberId = typeof body.memberId === "string" ? Number.parseInt(body.memberId, 10) : Number.NaN;
    const pin = validatePin(body.pin);

    if (!Number.isSafeInteger(memberId) || memberId < 1) {
      return Response.json({ error: "Välj en användare." }, { status: 400 });
    }

    const db = await getDatabase();
    const row = await db
      .prepare("SELECT id, display_name, pin_code, role FROM family_members WHERE id = ? LIMIT 1")
      .bind(memberId)
      .first<LoginRow>();

    if (!row || !(await verifyPin(pin, row.pin_code))) {
      return Response.json({ error: "Fel PIN-kod." }, { status: 401 });
    }

    const sessionCookie = await createSession(db, String(row.id));
    return Response.json(
      { member: { id: String(row.id), name: row.display_name, role: row.role } },
      { headers: { "Set-Cookie": sessionCookie } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inloggningen misslyckades.";
    return Response.json({ error: message }, { status: 400 });
  }
}
