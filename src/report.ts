/**
 * Text rendering for vet / check / invoice / diff output.
 * Lines are kept short so the demo GIF stays readable.
 */
import type { InvoiceResult, VetResult } from "./types.js";
import type { DiffResult } from "./diff.js";

export const HIRE_NOTE =
  "No red flags in the dossier provided - this does not prove the vendor is honest.";

export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

export function renderVet(result: VetResult): string {
  const lines: string[] = [];
  lines.push(
    `irvet ${result.version} - vendor vetting (dossier: ${result.dossier})`,
  );
  lines.push(`vendor: ${result.vendorName}`);
  lines.push("");
  lines.push("rule  severity  status    detail");
  for (const r of result.rules) {
    const detail = r.status === "PASS" ? "-" : r.detail;
    lines.push(
      `${pad(r.id, 5)} ${pad(r.severity, 8)}  ${pad(r.status, 8)}  ${detail}`,
    );
  }
  lines.push("");
  lines.push(`VERDICT: ${result.verdict}`);
  if (result.verdict === "HIRE") lines.push(HIRE_NOTE);
  if (result.missingEvidence.length > 0) {
    lines.push("evidence needed:");
    for (const e of result.missingEvidence) lines.push(`  - ${e}`);
  }
  lines.push("Verdict is about the dossier provided, not about the vendor.");
  return lines.join("\n");
}

export function renderGate(result: VetResult): string {
  const lines: string[] = [];
  lines.push(`VERDICT: ${result.verdict} (${result.vendorName})`);
  if (result.verdict === "HIRE") lines.push(HIRE_NOTE);
  const failed = result.rules.filter((r) => r.status === "FAIL");
  if (failed.length > 0) {
    lines.push(`failed rules: ${failed.map((r) => r.id).join(", ")}`);
  }
  const missing = result.rules.filter((r) => r.status === "MISSING");
  if (missing.length > 0) {
    lines.push(`missing evidence: ${missing.map((r) => r.id).join(", ")}`);
  }
  if (result.verdict === "DO-NOT-HIRE") {
    lines.push(
      "GATE FAILED: do not hire on this dossier - see 'irvet explain <rule>'",
    );
  } else if (result.verdict === "CONDITIONAL") {
    lines.push("GATE FAILED: conditional - fix the failed rules first");
  } else if (result.verdict === "NEEDS-EVIDENCE") {
    lines.push("GATE FAILED: evidence missing - cannot conclude yet");
  } else {
    lines.push("GATE PASSED");
  }
  return lines.join("\n");
}

export function renderInvoice(result: InvoiceResult): string {
  const lines: string[] = [];
  lines.push(`irvet invoice check (invoice: ${result.invoice})`);
  lines.push(
    `line total: $${result.lineTotal.toLocaleString("en-US")}` +
      (result.statedTotal !== null
        ? ` | stated total: $${result.statedTotal.toLocaleString("en-US")} ` +
          `(${result.totalMatches ? "matches" : "MISMATCH"})`
        : ""),
  );
  lines.push("");
  if (result.findings.length === 0) {
    lines.push(
      "no findings: every line matches the contract and the totals agree.",
    );
  } else {
    lines.push(`findings: ${result.findings.length}`);
    for (const f of result.findings) {
      lines.push(`  [${f.kind}] ${f.line}`);
      lines.push(`    ${f.detail}`);
    }
  }
  lines.push("");
  lines.push(
    result.flagged ? "FLAGGED: review before paying." : "OK: nothing flagged.",
  );
  return lines.join("\n");
}

export function renderDiff(d: DiffResult): string {
  const lines: string[] = [];
  lines.push(
    `irvet diff - baseline: ${d.baseline} (verdict ${d.baselineVerdict})`,
  );
  lines.push(`current: ${d.current} (verdict ${d.currentVerdict})`);
  if (d.changes.length === 0) {
    lines.push("no rule status changes");
  } else {
    for (const c of d.changes) {
      lines.push(`  ${c.rule}: ${c.from} -> ${c.to}`);
    }
  }
  lines.push(
    d.regression
      ? "REGRESSION: a rule moved from PASS to FAIL (or MISSING)"
      : "no regressions",
  );
  return lines.join("\n");
}
