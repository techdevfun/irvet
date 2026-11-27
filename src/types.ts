/**
 * Types for irvet 0.1.0.
 *
 * A dossier is a JSON file the user supplies. irvet only reads it;
 * it never contacts the vendor, never runs vendor code, and never
 * asks for a credential, token, or password.
 */

export const VERSION = "0.1.0";

export type RuleStatus = "PASS" | "FAIL" | "MISSING";
export type Severity = "HIGH" | "MEDIUM";
export type Verdict = "HIRE" | "CONDITIONAL" | "DO-NOT-HIRE" | "NEEDS-EVIDENCE";

export interface RuleResult {
  id: string;
  title: string;
  severity: Severity;
  status: RuleStatus;
  /** Human-readable reason for FAIL or MISSING. Empty on PASS. */
  detail: string;
  /** Evidence the user must add to move this rule to PASS. */
  evidenceNeeded: string;
}

export interface VetResult {
  tool: "irvet";
  version: string;
  dossier: string;
  vendorName: string;
  verdict: Verdict;
  rules: RuleResult[];
  missingEvidence: string[];
  checkedAt: string;
}

export interface StrainMethod {
  strain: string;
  method: string;
}

export interface DossierMethod {
  description?: string;
  perStrain?: StrainMethod[];
  proprietaryClaim?: boolean;
}

export interface DossierContract {
  paymentClause?: "explicit" | "silent" | "never-pay-no-clause";
  paymentApprovalRequired?: boolean;
  auditRight?: boolean;
  itemisedInvoice?: boolean;
  ransomNoteHandling?:
    "kept-by-victim" | "vendor-deletes" | "vendor-exclusive-channel";
  remoteAccess?: "supervised" | "supervised-limited" | "unsupervised";
}

export interface DossierReference {
  name?: string;
  contact?: string;
  insurerPanel?: boolean;
}

export interface DossierOfac {
  screeningStatement?: boolean;
  sanctionedCounterpartyProcess?: boolean;
}

export interface Dossier {
  vendor?: { name?: string; website?: string };
  method?: DossierMethod;
  marketingClaims?: string[];
  contract?: DossierContract;
  references?: DossierReference[];
  ofac?: DossierOfac;
  /** Strains with a public decryptor (e.g. No More Ransom). */
  knownPublicDecryptors?: string[];
  /** Optional free-text provenance note for reconstructed fixtures. */
  provenance?: string;
}

export interface InvoiceLine {
  description: string;
  amount: number;
  kind: "service" | "pass-through" | "diagnostic";
  /** What the vendor actually paid a third party, if this line passes it on. */
  passThroughCost?: number;
}

export interface Invoice {
  vendor?: string;
  invoiceId?: string;
  lines: InvoiceLine[];
  total?: number;
}

export interface InvoiceContract {
  noRansomPayment?: boolean;
  passThroughAtCost?: boolean;
  allowedDescriptions?: string[];
}

export interface InvoiceFinding {
  line: string;
  kind: "MARKUP" | "NO-PAYMENT-CLAUSE" | "NOT-IN-CONTRACT" | "TOTAL-MISMATCH";
  detail: string;
}

export interface InvoiceResult {
  tool: "irvet";
  version: string;
  invoice: string;
  contract: string;
  lineTotal: number;
  statedTotal: number | null;
  totalMatches: boolean;
  findings: InvoiceFinding[];
  flagged: boolean;
}
