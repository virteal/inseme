import assert from "node:assert/strict";
import test from "node:test";
import { resolveIdentity } from "../edge/identity.js";

test("Ophelia identity resolves Corte civic twin persona correctly", () => {
  const runtime = {
    getConfig: (key) => {
      const map = {
        OPHELIA_NAME: "Ophélia",
        city_name: "Corte",
        party_name: "Le Petit Parti (PP)",
      };
      return map[key] || null;
    },
  };

  const identity = resolveIdentity(runtime);
  assert.equal(identity.name, "Ophélia");
  assert.equal(identity.city, "Corte");
  assert.equal(identity.organization, "Le Petit Parti (PP)");

  const systemMsg = identity.toSystemMessage();
  assert.match(systemMsg, /Ophélia/);
  assert.match(systemMsg, /Corte/);
  assert.match(systemMsg, /CONATUS/);
});
