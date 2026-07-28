import { createMember, getDatabase, requireAdmin } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const db = await getDatabase();
    await requireAdmin(db, request);
    const body = (await request.json()) as { name?: unknown; pin?: unknown };
    const member = await createMember(db, { name: body.name, pin: body.pin, role: "player" });
    return Response.json({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return Response.json({ error: "Endast administratören kan lägga till användare." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Användaren kunde inte skapas.";
    return Response.json({ error: message }, { status: 400 });
  }
}
