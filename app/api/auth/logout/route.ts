import { clearSessionCookie, deleteSession, getDatabase } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const db = await getDatabase();
    await deleteSession(db, request);
  } catch {
    // Clearing the browser cookie is enough even if the database is temporarily unavailable.
  }

  return Response.json(
    { ok: true },
    {
      headers: { "Set-Cookie": clearSessionCookie() },
    },
  );
}
