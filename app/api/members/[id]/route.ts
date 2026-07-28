import { getDatabase, hashPin, requireAdmin, validatePin } from "@/lib/server-auth";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    await requireAdmin(db, request);
    const { id } = await context.params;
    const memberId = Number.parseInt(id, 10);
    const body = (await request.json()) as { pin?: unknown };
    const pin = validatePin(body.pin);

    if (!Number.isSafeInteger(memberId) || memberId < 1) {
      return Response.json({ error: "Ogiltig användare." }, { status: 400 });
    }

    const result = await db
      .prepare("UPDATE family_members SET pin_code = ? WHERE id = ?")
      .bind(await hashPin(pin), memberId)
      .run();

    if (!result.meta.changes) {
      return Response.json({ error: "Användaren finns inte." }, { status: 404 });
    }

    await db.prepare("DELETE FROM member_sessions WHERE member_id = ?").bind(memberId).run();
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return Response.json({ error: "Endast administratören kan byta PIN-koder." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "PIN-koden kunde inte bytas.";
    return Response.json({ error: message }, { status: 400 });
  }
}
