/**
 * Dossier vetting: rules V1-V8 plus the verdict.
 *
 * Verdict precedence (blueprint section 4):
 *   any HIGH FAIL        -> DO-NOT-HIRE
 *   else any MISSING     -> NEEDS-EVIDENCE (cannot conclude yet)
 *   else any MEDIUM FAIL -> CONDITIONAL
 *   else                 -> HIRE
 *
 * A verdict is about the DOSSIER provided, not about the vendor.
 * HIRE means "no red flags in the dossier provided - this does not
 * prove the vendor is honest".
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { RULES } from "./rules.js";
import type {
  Dossier,
  RuleResult,
  Severity,
  Verdict,
  VetResult,
} from "./types.js";
import { VERSION } from "./types.js";

const GENERIC_METHOD =
  /proprietary\s+(cryptograph|tool|technolog|method|decrypt)/i;
const GENERIC_METHOD_2 = /advanced\s+(cryptograph|tool)/i;

/** Absolute recovery/decryption/payment claims. Deliberately narrow:
 * "100% uptime SLA" must NOT match (see unit test). */
const ABSOLUTE_CLAIMS = [
  /100%\s*(recovery|success|decryption|decrypt)/i,
  /guaranteed\s+(decrypt|recovery|success|decryption)/i,
  /guarantee[sd]?\s+(decrypt|recovery|100%)/i,
  /never\s+pay.*guarantee/i,
  /guarantee.*never\s+pay/i,
];

function result(
  id: string,
  status: RuleResult["status"],
  detail: string,
  evidenceNeeded: string,
): RuleResult {
  const def = RULES.find((r) => r.id === id);
  const severity: Severity = def ? def.severity : "MEDIUM";
  return {
    id,
    title: def ? def.title : id,
    severity,
    status,
    detail,
    evidenceNeeded: status === "PASS" ? "" : evidenceNeeded,
  };
}

export function evaluateDossier(
  dossier: Dossier,
  dossierLabel: string,
  minReferences = 1,
): VetResult {
  const results: RuleResult[] = [];

  // V1 METHOD-IN-WRITING (HIGH)
  const method = dossier.method;
  if (!method || (method.description === undefined && !method.perStrain)) {
    results.push(
      result(
        "V1",
        "MISSING",
        "no method section in the dossier",
        "add method.description and method.perStrain (strain + concrete method)",
      ),
    );
  } else {
    const desc = method.description ?? "";
    const strains = method.perStrain ?? [];
    const specific = strains.filter(
      (s) => (s.method ?? "").trim().length >= 20,
    );
    const generic =
      (GENERIC_METHOD.test(desc) || GENERIC_METHOD_2.test(desc)) &&
      specific.length === 0;
    const publicDecryptors = dossier.knownPublicDecryptors ?? [];
    const conflict =
      Boolean(method.proprietaryClaim) &&
      strains.some(
        (s) =>
          publicDecryptors.includes(s.strain) &&
          !/public decryptor/i.test(s.method ?? ""),
      );
    if (generic) {
      results.push(
        result(
          "V1",
          "FAIL",
          "method is a generic claim ('proprietary cryptography' / 'advanced tools') with no per-strain method",
          "method in writing, per strain: decryptor, flaw, or negotiation step",
        ),
      );
    } else if (conflict) {
      results.push(
        result(
          "V1",
          "FAIL",
          "claims a proprietary decryptor for a strain with a public decryptor and does not name the public one",
          "name the public decryptor, or explain in writing why it is not used",
        ),
      );
    } else if (specific.length === 0 && strains.length === 0) {
      results.push(
        result(
          "V1",
          "FAIL",
          "no per-strain method given",
          "method in writing, per strain: decryptor, flaw, or negotiation step",
        ),
      );
    } else {
      results.push(result("V1", "PASS", "", ""));
    }
  }

  // V2 NO-PAYMENT-CLAUSE (HIGH)
  const contract = dossier.contract;
  if (!contract) {
    results.push(
      result(
        "V2",
        "MISSING",
        "no contract section in the dossier",
        "add the contract payment clause and approval requirement",
      ),
    );
  } else if (
    contract.paymentClause === "silent" ||
    contract.paymentClause === "never-pay-no-clause" ||
    contract.paymentClause === undefined
  ) {
    results.push(
      result(
        "V2",
        "FAIL",
        contract.paymentClause === "never-pay-no-clause"
          ? "claims 'never pay' in marketing but the contract has no payment clause"
          : "contract is silent on ransom payment",
        "a written payment clause: pay only with written victim approval, or never pay",
      ),
    );
  } else if (contract.paymentApprovalRequired === false) {
    results.push(
      result(
        "V2",
        "FAIL",
        "contract allows payment without the victim's written approval",
        "written victim approval before any payment",
      ),
    );
  } else {
    results.push(result("V2", "PASS", "", ""));
  }

  // V3 PAYMENT-TRAIL-AUDIT (HIGH)
  if (!contract) {
    results.push(
      result(
        "V3",
        "MISSING",
        "no contract section in the dossier",
        "add auditRight and itemisedInvoice to the contract",
      ),
    );
  } else if (
    contract.auditRight === false ||
    contract.itemisedInvoice === false
  ) {
    const missing = [
      contract.auditRight === false ? "no audit right" : "",
      contract.itemisedInvoice === false ? "no itemised invoice" : "",
    ]
      .filter(Boolean)
      .join("; ");
    results.push(
      result(
        "V3",
        "FAIL",
        missing,
        "audit right plus an itemised invoice (pass-through costs separate from service fees)",
      ),
    );
  } else if (
    contract.auditRight === undefined ||
    contract.itemisedInvoice === undefined
  ) {
    results.push(
      result(
        "V3",
        "MISSING",
        "audit right or itemised invoice not stated in the contract",
        "state auditRight and itemisedInvoice explicitly in the contract",
      ),
    );
  } else {
    results.push(result("V3", "PASS", "", ""));
  }

  // V4 RANSOM-NOTE-KEPT (HIGH)
  if (!contract) {
    results.push(
      result(
        "V4",
        "MISSING",
        "no contract section in the dossier",
        "state ransomNoteHandling as 'kept-by-victim' in the contract",
      ),
    );
  } else if (contract.ransomNoteHandling === "vendor-deletes") {
    results.push(
      result(
        "V4",
        "FAIL",
        "vendor asks for the ransom note to be deleted",
        "ransom note and attacker contact channel stay with the victim",
      ),
    );
  } else if (contract.ransomNoteHandling === "vendor-exclusive-channel") {
    results.push(
      result(
        "V4",
        "FAIL",
        "vendor demands an exclusive channel to the attacker",
        "ransom note and attacker contact channel stay with the victim",
      ),
    );
  } else if (contract.ransomNoteHandling === undefined) {
    results.push(
      result(
        "V4",
        "MISSING",
        "ransom-note handling not stated in the contract",
        "state ransomNoteHandling as 'kept-by-victim' in the contract",
      ),
    );
  } else {
    results.push(result("V4", "PASS", "", ""));
  }

  // V5 SUPERVISED-ACCESS (MEDIUM)
  if (!contract) {
    results.push(
      result(
        "V5",
        "MISSING",
        "no contract section in the dossier",
        "state remoteAccess as 'supervised' or 'supervised-limited'",
      ),
    );
  } else if (contract.remoteAccess === "unsupervised") {
    results.push(
      result(
        "V5",
        "FAIL",
        "vendor requires unsupervised remote access",
        "supervised, scoped, time-limited remote access with a kill switch",
      ),
    );
  } else if (contract.remoteAccess === undefined) {
    results.push(
      result(
        "V5",
        "MISSING",
        "remote access terms not stated in the contract",
        "state remoteAccess as 'supervised' or 'supervised-limited'",
      ),
    );
  } else {
    results.push(result("V5", "PASS", "", ""));
  }

  // V6 REFERENCES-VERIFIABLE (MEDIUM)
  const refs = dossier.references;
  if (refs === undefined) {
    results.push(
      result(
        "V6",
        "MISSING",
        "no references section in the dossier",
        "at least one verifiable reference (name + contact, or insurer-panel membership)",
      ),
    );
  } else {
    const verifiable = refs.filter(
      (r) => (r.name ?? "").trim() !== "" && (r.contact ?? "").trim() !== "",
    );
    const panel = refs.some((r) => r.insurerPanel === true);
    if (refs.length === 0 || (verifiable.length < minReferences && !panel)) {
      results.push(
        result(
          "V6",
          "FAIL",
          "only anonymous testimonials, or no references at all",
          "at least one verifiable reference (name + contact, or insurer-panel membership)",
        ),
      );
    } else {
      results.push(result("V6", "PASS", "", ""));
    }
  }

  // V7 NO-ABSOLUTE-GUARANTEE (MEDIUM)
  const claims = dossier.marketingClaims ?? [];
  const hit = claims.find((c) => ABSOLUTE_CLAIMS.some((re) => re.test(c)));
  if (hit !== undefined) {
    results.push(
      result(
        "V7",
        "FAIL",
        `absolute claim in marketing material: "${hit}"`,
        "remove the absolute guarantee; replace it with a written method and failure plan",
      ),
    );
  } else {
    results.push(result("V7", "PASS", "", ""));
  }

  // V8 OFAC-SCREENING (MEDIUM)
  const ofac = dossier.ofac;
  if (!ofac) {
    results.push(
      result(
        "V8",
        "MISSING",
        "no OFAC screening statement in the dossier",
        "a written sanctions-screening statement and a process for a sanctioned counterparty",
      ),
    );
  } else if (
    ofac.screeningStatement === false ||
    ofac.screeningStatement === undefined
  ) {
    results.push(
      result(
        "V8",
        "FAIL",
        "no sanctions-screening statement from the vendor",
        "a written sanctions-screening statement and a process for a sanctioned counterparty",
      ),
    );
  } else {
    results.push(result("V8", "PASS", "", ""));
  }

  const verdict = computeVerdict(results);
  return {
    tool: "irvet",
    version: VERSION,
    dossier: dossierLabel,
    vendorName: dossier.vendor?.name ?? basename(dossierLabel, ".json"),
    verdict,
    rules: results,
    missingEvidence: results
      .filter((r) => r.status !== "PASS")
      .map((r) => `${r.id}: ${r.evidenceNeeded}`),
    checkedAt: new Date().toISOString(),
  };
}

export function computeVerdict(results: RuleResult[]): Verdict {
  if (results.some((r) => r.severity === "HIGH" && r.status === "FAIL")) {
    return "DO-NOT-HIRE";
  }
  if (results.some((r) => r.status === "MISSING")) {
    return "NEEDS-EVIDENCE";
  }
  if (results.some((r) => r.severity === "MEDIUM" && r.status === "FAIL")) {
    return "CONDITIONAL";
  }
  return "HIRE";
}

export function loadDossier(path: string): Dossier {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`could not read dossier file: ${path}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`dossier is not valid JSON: ${path}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`dossier must be a JSON object: ${path}`);
  }
  return parsed as Dossier;
}

/** Exit code for vet/check: 0 HIRE, 1 DO-NOT-HIRE or CONDITIONAL, 2 input error or NEEDS-EVIDENCE. */
export function exitForVerdict(verdict: Verdict): number {
  if (verdict === "HIRE") return 0;
  if (verdict === "NEEDS-EVIDENCE") return 2;
  return 1;
}
