import test from "node:test";
import assert from "node:assert/strict";
import {
  transformWikiRow,
  transformPropositionRow,
  transformVoteRow,
  transformDelegationRow,
} from "./migrate-survey-to-pertitellu.js";

const PERTITELLU_INSTANCE_ID = "00000000-0000-0000-0000-000000000010";

test("transformWikiRow scopes to pertitellu instance and preserves UUID", () => {
  const legacy = {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "Histoire-De-Corte",
    title: "Histoire de Corte",
    content: "Contenu historique...",
    author_id: "22222222-2222-2222-2222-222222222222",
  };
  const transformed = transformWikiRow(legacy);
  assert.equal(transformed.id, legacy.id);
  assert.equal(transformed.instance_id, PERTITELLU_INSTANCE_ID);
  assert.equal(transformed.slug, "histoire-de-corte");
  assert.equal(transformed.title, legacy.title);
  assert.equal(transformed.author_id, legacy.author_id);
});

test("transformVoteRow maps legacy booleans/strings to canonical values", () => {
  const legacyTrue = {
    id: "33333333-3333-3333-3333-333333333333",
    user_id: "22222222-2222-2222-2222-222222222222",
    proposition_id: "44444444-4444-4444-4444-444444444444",
    vote_value: true,
  };
  const transformedTrue = transformVoteRow(legacyTrue);
  assert.equal(transformedTrue.vote_value, "approve");
  assert.equal(transformedTrue.instance_id, PERTITELLU_INSTANCE_ID);

  const legacyFalse = { ...legacyTrue, vote_value: false };
  assert.equal(transformVoteRow(legacyFalse).vote_value, "disapprove");

  const legacyFor = { ...legacyTrue, vote_value: "for" };
  assert.equal(transformVoteRow(legacyFor).vote_value, "approve");
});

test("transformDelegationRow preserves delegator and delegate IDs", () => {
  const legacy = {
    id: "55555555-5555-5555-5555-555555555555",
    delegator_id: "22222222-2222-2222-2222-222222222222",
    delegate_id: "66666666-6666-6666-6666-666666666666",
    tag_id: "77777777-7777-7777-7777-777777777777",
    status: "active",
  };
  const transformed = transformDelegationRow(legacy);
  assert.equal(transformed.id, legacy.id);
  assert.equal(transformed.instance_id, PERTITELLU_INSTANCE_ID);
  assert.equal(transformed.delegator_id, legacy.delegator_id);
  assert.equal(transformed.delegate_id, legacy.delegate_id);
});
