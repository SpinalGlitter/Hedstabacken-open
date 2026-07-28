import { createMember, createSession, getDatabase, hasMembers } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const db = await getDatabase();
    if (await hasMembers(db)) {
      return Response.json({ error: "Familjen har redan en administratör." }, { status: 409 });
    }

    const body = (await request.json()) as { name?: unknown; pin?: unknown };
    const member = await createMember(db, { name: body.name, pin: body.pin, role: "admin" });
    const sessionCookie = await createSession(db, member.id);

    return Response.json(
      { member },
      {
        status: 201,
        headers: { "Set-Cookie": sessionCookie },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Administratören kunde inte skapas.";
    return Response.json({ error: message }, { status: 400 });
  }
}
