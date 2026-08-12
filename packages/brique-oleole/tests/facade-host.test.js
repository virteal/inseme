import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isOleoleFacadeHost,
  isOleoleCanonicalHost,
  classifyOleoleHost,
  OLEOLE_CANONICAL_HOST,
  OLEOLE_JHN_FACET_HOST,
  OLEOLE_PUBLISHER,
} from "../src/lib/facade-host.js";

describe("oleole dual host façade", () => {
  it("treats acorsica as canonical public host", () => {
    const c = classifyOleoleHost("oleole.acorsica.org", "");
    assert.equal(c.isOleole, true);
    assert.equal(c.role, "canonical");
    assert.equal(isOleoleCanonicalHost("oleole.acorsica.org"), true);
    assert.equal(OLEOLE_CANONICAL_HOST, "oleole.acorsica.org");
    assert.equal(OLEOLE_PUBLISHER.short_name, "C.O.R.S.I.C.A.");
  });

  it("treats oleole.jhn.baronsmariani.org as same façade (jhn facet)", () => {
    const f = classifyOleoleHost("oleole.jhn.baronsmariani.org", "");
    assert.equal(f.isOleole, true);
    assert.equal(f.role, "jhn_facet");
    assert.equal(isOleoleFacadeHost(OLEOLE_JHN_FACET_HOST, ""), true);
    assert.equal(isOleoleCanonicalHost(OLEOLE_JHN_FACET_HOST), false);
  });

  it("rejects plain jhn host without query", () => {
    assert.equal(isOleoleFacadeHost("jhn.baronsmariani.org", ""), false);
    assert.equal(isOleoleFacadeHost("jhn.baronsmariani.org", "?facade=oleole"), true);
  });
});
