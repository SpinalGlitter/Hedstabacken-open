import { currentMember, getDatabase, hasMembers, listMembers } from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const db = await getDatabase();
    const [members, signedInMember, membersExist] = await Promise.all([
      listMembers(db),
      currentMember(db, request),
      hasMembers(db),
    ]);

    return Response.json({
      members,
      currentMember: signedInMember,
      needsSetup: !membersExist,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Familjekontona kunde inte hämtas.";
    return Response.json({ error: message }, { status: 503 });
  }
}
