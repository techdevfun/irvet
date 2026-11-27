import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const CLI = join(ROOT, "dist", "cli.js");
const EXAMPLES = join(ROOT, "examples");

function run(args, cwd = ROOT) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd,
  });
}

function tmp() {
  return mkdtempSync(join(tmpdir(), "irvet-e2e-"));
}

test("e2e: --help lists all six commands", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  for (const cmd of ["init", "vet", "check", "invoice", "explain", "diff"]) {
    assert.match(r.stdout, new RegExp(cmd));
  }
});

test("e2e: init scaffolds vendor.json + irvet.config.json, second init refuses", () => {
  const dir = tmp();
  const r = run(["init", dir]);
  assert.equal(r.status, 0);
  assert.ok(existsSync(join(dir, "vendor.json")));
  assert.ok(existsSync(join(dir, "irvet.config.json")));
  const dossier = JSON.parse(readFileSync(join(dir, "vendor.json"), "utf8"));
  assert.ok(dossier.contract);
  assert.equal(run(["init", dir]).status, 2);
  // The scaffold itself vets HIRE (it is a clean template).
  assert.equal(run(["vet", join(dir, "vendor.json")]).status, 0);
});

test("e2e: vet clean-vendor is HIRE exit 0", () => {
  const r = run(["vet", join(EXAMPLES, "clean-vendor", "vendor.json")]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /VERDICT: HIRE/);
  assert.match(r.stdout, /does not prove the vendor is honest/);
});

test("e2e: vet ransomwarehelp-reconstructed is DO-NOT-HIRE exit 1", () => {
  const r = run([
    "vet",
    join(EXAMPLES, "ransomwarehelp-reconstructed", "vendor.json"),
  ]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /VERDICT: DO-NOT-HIRE/);
  for (const id of ["V1", "V2", "V3", "V4", "V5", "V7"]) {
    assert.match(r.stdout, new RegExp(id));
  }
  assert.match(r.stdout, /evidence needed:/);
});

test("e2e: vet conditional-vendor is CONDITIONAL exit 1", () => {
  const r = run(["vet", join(EXAMPLES, "conditional-vendor", "vendor.json")]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /VERDICT: CONDITIONAL/);
});

test("e2e: vet --json parses and carries the verdict", () => {
  const r = run([
    "vet",
    "--json",
    join(EXAMPLES, "clean-vendor", "vendor.json"),
  ]);
  assert.equal(r.status, 0);
  const d = JSON.parse(r.stdout);
  assert.equal(d.verdict, "HIRE");
  assert.equal(d.rules.length, 8);
  assert.equal(d.tool, "irvet");
});

test("e2e: vet missing file and invalid JSON exit 2", () => {
  assert.equal(run(["vet", join(EXAMPLES, "nope.json")]).status, 2);
  const dir = tmp();
  const bad = join(dir, "bad.json");
  writeFileSync(bad, "{not json");
  assert.equal(run(["vet", bad]).status, 2);
  assert.match(run(["vet", bad]).stderr, /not valid JSON/);
});

test("e2e: check is a one-line gate: clean passes, reconstructed fails, empty needs evidence", () => {
  const clean = run(["check", join(EXAMPLES, "clean-vendor", "vendor.json")]);
  assert.equal(clean.status, 0);
  assert.match(clean.stdout, /VERDICT: HIRE/);
  assert.match(clean.stdout, /GATE PASSED/);
  const bad = run([
    "check",
    join(EXAMPLES, "ransomwarehelp-reconstructed", "vendor.json"),
  ]);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /GATE FAILED/);
  const dir = tmp();
  const empty = join(dir, "empty.json");
  writeFileSync(empty, "{}");
  const need = run(["check", empty]);
  assert.equal(need.status, 2);
  assert.match(need.stdout, /VERDICT: NEEDS-EVIDENCE/);
});

test("e2e: invoice markup flags 2 findings exit 1; clean invoice passes", () => {
  const r = run([
    "invoice",
    join(EXAMPLES, "invoice-markup", "invoice.json"),
    "--contract",
    join(EXAMPLES, "invoice-markup", "contract.json"),
  ]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /findings: 2/);
  assert.match(r.stdout, /MARKUP/);
  assert.match(r.stdout, /NO-PAYMENT-CLAUSE/);
  assert.match(r.stdout, /FLAGGED/);
  const dir = tmp();
  const inv = join(dir, "inv.json");
  const con = join(dir, "con.json");
  writeFileSync(
    inv,
    JSON.stringify({
      lines: [{ description: "Diagnostic fee", amount: 1000, kind: "service" }],
      total: 1000,
    }),
  );
  writeFileSync(
    con,
    JSON.stringify({
      noRansomPayment: true,
      passThroughAtCost: true,
      allowedDescriptions: ["Diagnostic fee"],
    }),
  );
  const ok = run(["invoice", inv, "--contract", con]);
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /no findings/);
  assert.equal(run(["invoice", inv]).status, 2);
});

test("e2e: explain V1 names the anchor; explain ransomwarehelp states indicted-not-convicted", () => {
  const v1 = run(["explain", "V1"]);
  assert.equal(v1.status, 0);
  assert.match(v1.stdout, /METHOD-IN-WRITING/);
  assert.match(v1.stdout, /20\/11\/2026/);
  const list = run(["explain"]);
  assert.equal(list.status, 0);
  assert.match(list.stdout, /V8 - OFAC-SCREENING/);
  const rh = run(["explain", "ransomwarehelp"]);
  assert.equal(rh.status, 0);
  assert.match(rh.stdout, /indicted/i);
  assert.match(rh.stdout, /\$16,010/);
  assert.match(rh.stdout, /\$438,880/);
  assert.equal(run(["explain", "V9"]).status, 2);
});

test("e2e: diff detects a regression clean-to-reconstructed and no regression the other way", () => {
  const dir = tmp();
  const baseline = join(dir, "baseline.json");
  const v = run([
    "vet",
    "--json",
    join(EXAMPLES, "clean-vendor", "vendor.json"),
  ]);
  writeFileSync(baseline, v.stdout);
  const reg = run([
    "diff",
    "--baseline",
    baseline,
    join(EXAMPLES, "ransomwarehelp-reconstructed", "vendor.json"),
  ]);
  assert.equal(reg.status, 1);
  assert.match(reg.stdout, /REGRESSION/);
  assert.match(reg.stdout, /V1: PASS -> FAIL/);
  const ok = run([
    "diff",
    "--baseline",
    baseline,
    join(EXAMPLES, "clean-vendor", "vendor.json"),
  ]);
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /no regressions/);
  assert.equal(
    run(["diff", join(EXAMPLES, "clean-vendor", "vendor.json")]).status,
    2,
  );
});

test("e2e: unknown command and unknown flag exit 2", () => {
  assert.equal(run(["frobnicate"]).status, 2);
  assert.equal(run(["vet", "--nope"]).status, 2);
});
