/**
 * Dossier drift: compare a vet --json baseline against a fresh vet.
 * A regression is any rule moving from PASS to FAIL (or PASS to
 * MISSING). Exit 1 on regression, 0 otherwise, 2 on input error.
 */
import type { VetResult } from "./types.js";

export interface RuleChange {
  rule: string;
  from: string;
  to: string;
}

export interface DiffResult {
  baseline: string;
  current: string;
  baselineVerdict: string;
  currentVerdict: string;
  changes: RuleChange[];
  regression: boolean;
}

export function diffVets(
  baseline: VetResult,
  current: VetResult,
  baselineLabel: string,
  currentLabel: string,
): DiffResult {
  const baseById = new Map(baseline.rules.map((r) => [r.id, r.status]));
  const changes: RuleChange[] = [];
  for (const r of current.rules) {
    const from = baseById.get(r.id);
    if (from !== undefined && from !== r.status) {
      changes.push({ rule: r.id, from, to: r.status });
    }
  }
  const regression = changes.some(
    (c) => c.from === "PASS" && (c.to === "FAIL" || c.to === "MISSING"),
  );
  return {
    baseline: baselineLabel,
    current: currentLabel,
    baselineVerdict: baseline.verdict,
    currentVerdict: current.verdict,
    changes,
    regression,
  };
}
