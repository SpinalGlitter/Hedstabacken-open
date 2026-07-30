import { createMember, getDatabase, listAdminMembers, requireAdmin } from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const db = await getDatabase();
    await requireAdmin(db, request);
    return Response.json({ members: await listAdminMembers(db) });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return Response.json({ error: "Endast administratören kan se kontaktuppgifter." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Kontaktuppgifterna kunde inte hämtas.";
    return Response.json({ error: message }, { status: 503 });
  }
}

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
