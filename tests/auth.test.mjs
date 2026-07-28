import assert from "node:assert/strict";
import test from "node:test";

import { hashPin, validateMemberInput, verifyPin } from "../lib/server-auth.ts";

test("hashes PIN codes and verifies only the correct PIN", async () => {
  const hash = await hashPin("2468");

  assert.match(hash, /^pbkdf2\$100000\$/);
  assert.notEqual(hash, "2468");
  assert.equal(await verifyPin("2468", hash), true);
  assert.equal(await verifyPin("1357", hash), false);
});

test("accepts simple numeric PIN codes and rejects invalid input", () => {
  assert.deepEqual(validateMemberInput("  Ada  Lovelace ", "1234"), {
    displayName: "Ada Lovelace",
    pinCode: "1234",
  });
  assert.throws(() => validateMemberInput("Ada", "12ab"), /4 till 8 siffror/);
  assert.throws(() => validateMemberInput("", "1234"), /Namnet/);
});
