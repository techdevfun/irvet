import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeVerdict, evaluateDossier } from "../dist/vet.js";
import { reconcileInvoice } from "../dist/invoice.js";
import { diffVets } from "../dist/diff.js";
import { INCIDENT_SUMMARY, RULES, findRule } from "../dist/rules.js";
import { DEFAULT_CONFIG, loadConfig } from "../dist/config.js";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const EXAMPLES = join(ROOT, "examples");

function loadFixture(name) {
  return JSON.parse(readFileSync(join(EXAMPLES, name, "vendor.json"), "utf8"));
}

function omit(obj, key) {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

function failing(result) {
  return result.rules.filter((r) => r.status === "FAIL").map((r) => r.id);
}

function statusOf(result, id) {
  return result.rules.find((r) => r.id === id).status;
}

const CLEAN = loadFixture("clean-vendor");

test("verdict: all PASS is HIRE", () => {
  assert.equal(evaluateDossier(CLEAN, "clean.json").verdict, "HIRE");
});

test("verdict: reconstructed fixture is DO-NOT-HIRE with exactly V1,V2,V3,V4,V5,V7 failing", () => {
  const r = evaluateDossier(
    loadFixture("ransomwarehelp-reconstructed"),
    "rh.json",
  );
  assert.equal(r.verdict, "DO-NOT-HIRE");
  assert.deepEqual(failing(r), ["V1", "V2", "V3", "V4", "V5", "V7"]);
  assert.equal(statusOf(r, "V8"), "MISSING");
  assert.equal(statusOf(r, "V6"), "PASS");
});

test("verdict: conditional fixture is CONDITIONAL with only V7 failing", () => {
  const r = evaluateDossier(loadFixture("conditional-vendor"), "cond.json");
  assert.equal(r.verdict, "CONDITIONAL");
  assert.deepEqual(failing(r), ["V7"]);
});

test("verdict precedence: HIGH fail beats MISSING, MISSING beats MEDIUM fail", () => {
  const highFail = evaluateDossier(
    loadFixture("ransomwarehelp-reconstructed"),
    "x",
  );
  assert.equal(highFail.verdict, "DO-NOT-HIRE");
  const onlyMissing = evaluateDossier({}, "empty.json");
  assert.equal(onlyMissing.verdict, "NEEDS-EVIDENCE");
  const mediumOnly = evaluateDossier(loadFixture("conditional-vendor"), "c");
  assert.equal(mediumOnly.verdict, "CONDITIONAL");
  assert.equal(
    computeVerdict([
      { id: "V1", severity: "HIGH", status: "PASS" },
      { id: "V8", severity: "MEDIUM", status: "MISSING" },
    ]),
    "NEEDS-EVIDENCE",
  );
  assert.equal(
    computeVerdict([
      { id: "V1", severity: "HIGH", status: "PASS" },
      { id: "V7", severity: "MEDIUM", status: "FAIL" },
    ]),
    "CONDITIONAL",
  );
});

test("V1: generic 'proprietary cryptography' with no per-strain method fails", () => {
  const d = {
    ...CLEAN,
    method: {
      description: "Our proprietary cryptography restores everything.",
      perStrain: [],
      proprietaryClaim: true,
    },
  };
  const r = evaluateDossier(d, "x");
  assert.equal(statusOf(r, "V1"), "FAIL");
});

test("V1: proprietary claim on a strain with a public decryptor fails unless the public one is named", () => {
  const base = {
    ...CLEAN,
    method: {
      description: "Per-strain recovery.",
      perStrain: [{ strain: "LockBit 3.0", method: "our own tool" }],
      proprietaryClaim: true,
    },
    knownPublicDecryptors: ["LockBit 3.0"],
  };
  assert.equal(statusOf(evaluateDossier(base, "x"), "V1"), "FAIL");
  const named = {
    ...base,
    method: {
      ...base.method,
      perStrain: [
        {
          strain: "LockBit 3.0",
          method: "public decryptor from No More Ransom, verified first",
        },
      ],
    },
  };
  assert.equal(statusOf(evaluateDossier(named, "x"), "V1"), "PASS");
});

test("V1: missing method section is MISSING, not FAIL", () => {
  const d = omit(CLEAN, "method");
  assert.equal(statusOf(evaluateDossier(d, "x"), "V1"), "MISSING");
});

test("V2: silent contract fails; 'never pay' with no clause fails", () => {
  const silent = {
    ...CLEAN,
    contract: { ...CLEAN.contract, paymentClause: "silent" },
  };
  assert.equal(statusOf(evaluateDossier(silent, "x"), "V2"), "FAIL");
  const claimOnly = {
    ...CLEAN,
    contract: { ...CLEAN.contract, paymentClause: "never-pay-no-clause" },
  };
  assert.equal(statusOf(evaluateDossier(claimOnly, "x"), "V2"), "FAIL");
});

test("V3: no audit right or no itemised invoice fails", () => {
  const noAudit = {
    ...CLEAN,
    contract: { ...CLEAN.contract, auditRight: false },
  };
  assert.equal(statusOf(evaluateDossier(noAudit, "x"), "V3"), "FAIL");
  const lumpSum = {
    ...CLEAN,
    contract: { ...CLEAN.contract, itemisedInvoice: false },
  };
  assert.equal(statusOf(evaluateDossier(lumpSum, "x"), "V3"), "FAIL");
});

test("V4: vendor deleting the ransom note fails; exclusive channel fails", () => {
  const deletes = {
    ...CLEAN,
    contract: { ...CLEAN.contract, ransomNoteHandling: "vendor-deletes" },
  };
  assert.equal(statusOf(evaluateDossier(deletes, "x"), "V4"), "FAIL");
  const exclusive = {
    ...CLEAN,
    contract: {
      ...CLEAN.contract,
      ransomNoteHandling: "vendor-exclusive-channel",
    },
  };
  assert.equal(statusOf(evaluateDossier(exclusive, "x"), "V4"), "FAIL");
});

test("V5: unsupervised remote access fails", () => {
  const d = {
    ...CLEAN,
    contract: { ...CLEAN.contract, remoteAccess: "unsupervised" },
  };
  assert.equal(statusOf(evaluateDossier(d, "x"), "V5"), "FAIL");
});

test("V6: anonymous-only references fail; no references section is MISSING", () => {
  const anon = { ...CLEAN, references: [{ name: "", contact: "" }] };
  assert.equal(statusOf(evaluateDossier(anon, "x"), "V6"), "FAIL");
  const d = omit(CLEAN, "references");
  assert.equal(statusOf(evaluateDossier(d, "x"), "V6"), "MISSING");
});

test("V6: minReferences=2 with one verifiable reference fails", () => {
  // Use the second reference (no insurer panel) so the panel shortcut cannot pass it.
  const d = { ...CLEAN, references: [CLEAN.references[1]] };
  assert.equal(statusOf(evaluateDossier(d, "x", 2), "V6"), "FAIL");
  assert.equal(statusOf(evaluateDossier(d, "x", 1), "V6"), "PASS");
});

test("V7: absolute recovery claims fail; '100% uptime SLA' does not", () => {
  const bad = { ...CLEAN, marketingClaims: ["100% recovery, guaranteed"] };
  assert.equal(statusOf(evaluateDossier(bad, "x"), "V7"), "FAIL");
  const bad2 = {
    ...CLEAN,
    marketingClaims: ["guaranteed decrypt of every strain"],
  };
  assert.equal(statusOf(evaluateDossier(bad2, "x"), "V7"), "FAIL");
  const sla = { ...CLEAN, marketingClaims: ["100% uptime SLA, 24/7 support"] };
  assert.equal(statusOf(evaluateDossier(sla, "x"), "V7"), "PASS");
  const rate = { ...CLEAN, marketingClaims: ["99%+ success rate"] };
  assert.equal(statusOf(evaluateDossier(rate, "x"), "V7"), "PASS");
});

test("V8: no OFAC statement fails; missing ofac section is MISSING", () => {
  const d = { ...CLEAN, ofac: { screeningStatement: false } };
  assert.equal(statusOf(evaluateDossier(d, "x"), "V8"), "FAIL");
  const d2 = omit(CLEAN, "ofac");
  assert.equal(statusOf(evaluateDossier(d2, "x"), "V8"), "MISSING");
});

test("HIRE output carries the no-false-assurance note in the result", () => {
  const r = evaluateDossier(CLEAN, "clean.json");
  assert.equal(r.rules.length, 8);
  assert.ok(r.rules.every((x) => x.status === "PASS"));
  assert.deepEqual(r.missingEvidence, []);
});

test("invoice: markup fixture flags exactly 2 findings", () => {
  const invoice = JSON.parse(
    readFileSync(join(EXAMPLES, "invoice-markup", "invoice.json"), "utf8"),
  );
  const contract = JSON.parse(
    readFileSync(join(EXAMPLES, "invoice-markup", "contract.json"), "utf8"),
  );
  const r = reconcileInvoice(
    invoice,
    contract,
    "invoice.json",
    "contract.json",
  );
  assert.equal(r.findings.length, 2);
  assert.deepEqual(r.findings.map((f) => f.kind).sort(), [
    "MARKUP",
    "NO-PAYMENT-CLAUSE",
  ]);
  assert.equal(r.lineTotal, 16010);
  assert.equal(r.totalMatches, true);
  assert.equal(r.flagged, true);
  assert.match(r.findings[0].detail, /\$6,000/);
  assert.match(r.findings[0].detail, /\$13,260/);
});

test("invoice: clean invoice has no findings; total mismatch and unknown line are flagged", () => {
  const clean = {
    lines: [{ description: "Diagnostic fee", amount: 1000, kind: "service" }],
    total: 1000,
  };
  const contract = {
    noRansomPayment: true,
    passThroughAtCost: true,
    allowedDescriptions: ["Diagnostic fee"],
  };
  const ok = reconcileInvoice(clean, contract, "i", "c");
  assert.equal(ok.findings.length, 0);
  assert.equal(ok.flagged, false);
  const mismatch = { ...clean, total: 999 };
  assert.equal(
    reconcileInvoice(mismatch, contract, "i", "c").findings[0].kind,
    "TOTAL-MISMATCH",
  );
  const unknown = {
    lines: [{ description: "Mystery fee", amount: 500, kind: "service" }],
    total: 500,
  };
  assert.equal(
    reconcileInvoice(unknown, contract, "i", "c").findings[0].kind,
    "NOT-IN-CONTRACT",
  );
  const atCost = {
    lines: [
      {
        description: "Ransom pass-through",
        amount: 6000,
        kind: "pass-through",
        passThroughCost: 6000,
      },
    ],
    total: 6000,
  };
  assert.equal(reconcileInvoice(atCost, contract, "i", "c").findings.length, 1);
});

test("diff: PASS to FAIL is a regression; FAIL to PASS is not", () => {
  const clean = evaluateDossier(CLEAN, "clean.json");
  const bad = evaluateDossier(
    loadFixture("ransomwarehelp-reconstructed"),
    "rh.json",
  );
  const reg = diffVets(clean, bad, "clean.json", "rh.json");
  assert.equal(reg.regression, true);
  assert.ok(
    reg.changes.some(
      (c) => c.rule === "V1" && c.from === "PASS" && c.to === "FAIL",
    ),
  );
  const fixed = diffVets(bad, clean, "rh.json", "clean.json");
  assert.equal(fixed.regression, false);
  const same = diffVets(clean, clean, "a", "b");
  assert.equal(same.regression, false);
  assert.deepEqual(same.changes, []);
});

test("rules: 8 rules, case-insensitive lookup, anchors name the case and date", () => {
  assert.equal(RULES.length, 8);
  assert.equal(findRule("v1").id, "V1");
  assert.equal(findRule("V8").title, "OFAC-SCREENING");
  assert.equal(findRule("V9"), undefined);
  assert.ok(
    RULES.every((r) => r.anchor.includes("Krebs") || r.anchor.includes("OFAC")),
  );
  assert.match(INCIDENT_SUMMARY.join(" "), /20\/11\/2026/);
  assert.match(INCIDENT_SUMMARY.join(" "), /indicted/i);
  assert.match(INCIDENT_SUMMARY.join(" "), /not convicted/i);
});

test("config: defaults are sane and loadConfig falls back on bad input", () => {
  assert.equal(DEFAULT_CONFIG.minReferences, 1);
  assert.equal(
    loadConfig(join(ROOT, "examples", "clean-vendor")).minReferences,
    1,
  );
});
