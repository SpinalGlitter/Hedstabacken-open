import { getDatabase, hashPin, requireAdmin, validatePin } from "@/lib/server-auth";
import { normalizeSwedishMobile } from "@/lib/sms";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    await requireAdmin(db, request);
    const { id } = await context.params;
    const memberId = Number.parseInt(id, 10);
    const body = (await request.json()) as {
      pin?: unknown;
      phoneNumber?: unknown;
      smsOptIn?: unknown;
    };

    if (!Number.isSafeInteger(memberId) || memberId < 1) {
      return Response.json({ error: "Ogiltig användare." }, { status: 400 });
    }

    if (body.pin !== undefined) {
      const pin = validatePin(body.pin);
      const result = await db
        .prepare("UPDATE family_members SET pin_code = ? WHERE id = ?")
        .bind(await hashPin(pin), memberId)
        .run();

      if (!result.meta.changes) {
        return Response.json({ error: "Användaren finns inte." }, { status: 404 });
      }

      await db.prepare("DELETE FROM member_sessions WHERE member_id = ?").bind(memberId).run();
      return Response.json({ ok: true });
    }

    if (body.phoneNumber !== undefined || body.smsOptIn !== undefined) {
      const phoneNumber = normalizeSwedishMobile(body.phoneNumber);
      const smsOptIn = body.smsOptIn === true;
      if (smsOptIn && !phoneNumber) {
        return Response.json({ error: "Mobilnummer krävs när SMS är aktiverat." }, { status: 400 });
      }

      const result = await db
        .prepare("UPDATE family_members SET phone_number = ?, sms_opt_in = ? WHERE id = ?")
        .bind(phoneNumber, smsOptIn ? 1 : 0, memberId)
        .run();
      if (!result.meta.changes) {
        return Response.json({ error: "Användaren finns inte." }, { status: 404 });
      }

      return Response.json({
        ok: true,
        member: { id: String(memberId), phoneNumber, smsOptIn },
      });
    }

    return Response.json({ error: "Ingen ändring skickades." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return Response.json({ error: "Endast administratören kan byta PIN-koder." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Användaren kunde inte uppdateras.";
    return Response.json({ error: message }, { status: 400 });
  }
}
