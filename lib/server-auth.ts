const SESSION_COOKIE = "hedstabacken_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const PIN_ITERATIONS = 100_000;

export type PublicMember = {
  id: string;
  name: string;
  role: "admin" | "player";
};

export type AdminMember = PublicMember & {
  phoneNumber: string | null;
  smsOptIn: boolean;
};

type MemberRow = {
  id: number;
  display_name: string;
  role: "admin" | "player";
};

type AdminMemberRow = MemberRow & {
  phone_number: string | null;
  sms_opt_in: number;
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) {
    throw new Error("Ogiltigt hashformat.");
  }

  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function randomToken(size: number) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(size)));
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function loginNameFor(name: string) {
  return normalizeName(name).toLocaleLowerCase("sv-SE");
}

function memberFromRow(row: MemberRow): PublicMember {
  return {
    id: String(row.id),
    name: row.display_name,
    role: row.role,
  };
}

export function validateMemberInput(name: unknown, pin: unknown) {
  const displayName = typeof name === "string" ? normalizeName(name) : "";
  const pinCode = typeof pin === "string" ? pin.trim() : "";

  if (displayName.length < 1 || displayName.length > 40) {
    throw new Error("Namnet måste vara mellan 1 och 40 tecken.");
  }

  if (!/^\d{4,8}$/.test(pinCode)) {
    throw new Error("PIN-koden måste bestå av 4 till 8 siffror.");
  }

  return { displayName, pinCode };
}

export function validatePin(pin: unknown) {
  const pinCode = typeof pin === "string" ? pin.trim() : "";

  if (!/^\d{4,8}$/.test(pinCode)) {
    throw new Error("PIN-koden måste bestå av 4 till 8 siffror.");
  }

  return pinCode;
}

export async function getDatabase() {
  const { env } = await import("cloudflare:workers");

  if (!env.DB) {
    throw new Error("Användardatabasen är inte tillgänglig.");
  }

  return env.DB;
}

export async function hashPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PIN_ITERATIONS },
    key,
    256,
  );

  return `pbkdf2$${PIN_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

export async function verifyPin(pin: string, storedHash: string) {
  const [algorithm, iterationsText, saltHex, expectedHex] = storedHash.split("$");
  const iterations = Number.parseInt(iterationsText, 10);

  if (algorithm !== "pbkdf2" || !Number.isSafeInteger(iterations) || iterations < 1) {
    return false;
  }

  try {
    const salt = hexToBytes(saltHex);
    const expected = hexToBytes(expectedHex);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
    const actual = new Uint8Array(
      await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, expected.length * 8),
    );

    if (actual.length !== expected.length) {
      return false;
    }

    let difference = 0;
    for (let index = 0; index < actual.length; index += 1) {
      difference |= actual[index] ^ expected[index];
    }
    return difference === 0;
  } catch {
    return false;
  }
}

export async function listMembers(db: D1Database) {
  const result = await db
    .prepare("SELECT id, display_name, role FROM family_members ORDER BY created_at, id")
    .all<MemberRow>();

  return result.results.map(memberFromRow);
}

export async function listAdminMembers(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT id, display_name, role, phone_number, sms_opt_in
       FROM family_members ORDER BY created_at, id`,
    )
    .all<AdminMemberRow>();

  return result.results.map<AdminMember>((row) => ({
    ...memberFromRow(row),
    phoneNumber: row.phone_number,
    smsOptIn: row.sms_opt_in === 1,
  }));
}

export async function hasMembers(db: D1Database) {
  const row = await db.prepare("SELECT COUNT(*) AS count FROM family_members").first<{ count: number }>();
  return (row?.count ?? 0) > 0;
}

export async function createMember(
  db: D1Database,
  input: { name: unknown; pin: unknown; role: "admin" | "player" },
) {
  const { displayName, pinCode } = validateMemberInput(input.name, input.pin);
  const loginName = loginNameFor(displayName);
  const pinHash = await hashPin(pinCode);
  const email = `${crypto.randomUUID()}@hedstabacken.local`;

  try {
    await db
      .prepare(
        "INSERT INTO family_members (display_name, login_name, email, pin_code, role) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(displayName, loginName, email, pinHash, input.role)
      .run();
  } catch (error) {
    if (error instanceof Error && /unique|constraint/i.test(error.message)) {
      throw new Error("Det finns redan en användare med det namnet.");
    }
    throw error;
  }

  const created = await db
    .prepare("SELECT id, display_name, role FROM family_members WHERE login_name = ? LIMIT 1")
    .bind(loginName)
    .first<MemberRow>();

  if (!created) {
    throw new Error("Användaren kunde inte skapas.");
  }

  return memberFromRow(created);
}

function cookieValue(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return match?.slice(SESSION_COOKIE.length + 1) ?? null;
}

export async function currentMember(db: D1Database, request: Request) {
  const token = cookieValue(request);
  if (!token) {
    return null;
  }

  const tokenHash = await sha256(token);
  const row = await db
    .prepare(
      `SELECT family_members.id, family_members.display_name, family_members.role
       FROM member_sessions
       JOIN family_members ON family_members.id = member_sessions.member_id
       WHERE member_sessions.token_hash = ? AND member_sessions.expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, new Date().toISOString())
    .first<MemberRow>();

  return row ? memberFromRow(row) : null;
}

export async function createSession(db: D1Database, memberId: string) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();

  await db.prepare("DELETE FROM member_sessions WHERE expires_at <= ?").bind(new Date().toISOString()).run();
  await db
    .prepare("INSERT INTO member_sessions (member_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .bind(Number(memberId), tokenHash, expiresAt)
    .run();

  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
}

export async function deleteSession(db: D1Database, request: Request) {
  const token = cookieValue(request);
  if (token) {
    await db.prepare("DELETE FROM member_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
  }
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function requireAdmin(db: D1Database, request: Request) {
  const member = await currentMember(db, request);
  if (!member || member.role !== "admin") {
    throw new Error("ADMIN_REQUIRED");
  }
  return member;
}
