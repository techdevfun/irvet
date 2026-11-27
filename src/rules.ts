/**
 * Rules V1-V8 (blueprint section 4) and the incident anchor they come from.
 *
 * Every fact below is public and dated. The RansomwareHelp CTO was
 * INDICTED (grand jury, Rhode Island, 18/11/2026) - an indictment is an
 * accusation, not a conviction. irvet never states guilt.
 */
import type { Severity } from "./types.js";

export interface RuleDef {
  id: string;
  title: string;
  severity: Severity;
  what: string;
  evidence: string;
  fix: string;
  anchor: string;
}

export const RULES: RuleDef[] = [
  {
    id: "V1",
    title: "METHOD-IN-WRITING",
    severity: "HIGH",
    what: "The recovery method is written down, per ransomware strain: which decryptor, flaw, or negotiation step applies to each strain. A generic claim is not a method.",
    evidence:
      "method.description plus method.perStrain entries (strain + concrete method) for every strain in scope.",
    fix: "Ask for the method in writing, per strain. If the vendor claims a proprietary decryptor for a strain that already has a public decryptor (see No More Ransom), ask why the public one is not used.",
    anchor:
      "RansomwareHelp advertised 'advanced cryptographic tools' and 'proprietary cryptography' while allegedly paying the ransom in secret (Krebs on Security, 20/11/2026).",
  },
  {
    id: "V2",
    title: "NO-PAYMENT-CLAUSE",
    severity: "HIGH",
    what: "The contract states in writing whether ransom is ever paid, under what conditions, and that the victim approves any payment in writing first.",
    evidence:
      "contract.paymentClause set to 'explicit' and contract.paymentApprovalRequired true.",
    fix: "Add a clause: ransom is paid only with the victim's written approval, or never paid at all - and get it in the signed contract, not in a sales deck.",
    anchor:
      "RansomwareHelp advertised 'never promote, intermediate or pay ransom' but the contract had no clause stopping the alleged secret payments (Krebs, 20/11/2026).",
  },
  {
    id: "V3",
    title: "PAYMENT-TRAIL-AUDIT",
    severity: "HIGH",
    what: "You can audit the payment trail: the invoice separates pass-through costs from service fees, and transaction confirmations can be matched against the invoice.",
    evidence: "contract.auditRight and contract.itemisedInvoice both true.",
    fix: "Add an audit right and an itemised-invoice requirement to the contract before signing. Refuse a lump-sum 'decryption fee' with no breakdown.",
    anchor:
      "In the June 2026 FBI sting, about $6,000 in BTC was allegedly negotiated down and the fake victim was billed $16,010: $2,750 diagnostic plus a $13,260 'decryption fee' (Krebs, 20/11/2026).",
  },
  {
    id: "V4",
    title: "RANSOM-NOTE-KEPT",
    severity: "HIGH",
    what: "The ransom note and the attacker contact channel stay in the victim's hands. The vendor must never ask for the note to be deleted or demand an exclusive channel to the attacker.",
    evidence: "contract.ransomNoteHandling set to 'kept-by-victim'.",
    fix: "Keep a copy of the ransom note and the attacker contact details yourself before the vendor touches anything. Put it in the contract.",
    anchor:
      "In a 2024 case, the vendor allegedly deleted the ransom note so the victim could not contact the attacker directly (Krebs, 20/11/2026, reported by Paul Ihme of Soteria).",
  },
  {
    id: "V5",
    title: "SUPERVISED-ACCESS",
    severity: "MEDIUM",
    what: "Remote access is supervised, scoped, time-limited, and revocable. Unsupervised, unlimited remote access is a red flag.",
    evidence:
      "contract.remoteAccess set to 'supervised' or 'supervised-limited'.",
    fix: "Require a named operator, a session window, a scope list, and a kill switch. Watch the session live.",
    anchor:
      "In the same 2024 case the vendor demanded unsupervised remote access via AnyDesk for a $438,880 LockBit quote (Krebs, 20/11/2026).",
  },
  {
    id: "V6",
    title: "REFERENCES-VERIFIABLE",
    severity: "MEDIUM",
    what: "At least one reference can be verified independently: a named organisation, a contact channel, or insurer-panel membership. Anonymous testimonials do not count.",
    evidence:
      "references with at least one entry carrying a name and a contact, or insurerPanel true.",
    fix: "Ask for one reference you can call, and one insurer panel the vendor sits on. Call the reference before signing.",
    anchor:
      "RansomwareHelp advertised '28 years experience', '80 experts', and a '99%+ success rate' with no verifiable names behind the numbers (Krebs, 20/11/2026).",
  },
  {
    id: "V7",
    title: "NO-ABSOLUTE-GUARANTEE",
    severity: "MEDIUM",
    what: "No absolute claims in recovery, decryption, or payment ('100% recovery', 'guaranteed decrypt'). An uptime SLA such as '100% uptime' is not a recovery claim and does not fail this rule.",
    evidence:
      "marketingClaims free of absolute recovery/decryption/payment guarantees.",
    fix: "Ask the vendor to replace the guarantee with a written method and a written failure plan. A guarantee without a method is a sales line.",
    anchor:
      "RansomwareHelp advertised '100% recovery' and '99%+ success rate' (Krebs, 20/11/2026). No recovery vendor can guarantee decryption of every strain.",
  },
  {
    id: "V8",
    title: "OFAC-SCREENING",
    severity: "MEDIUM",
    what: "The vendor states it screens payments against sanctions lists (OFAC) and has a process for a sanctioned counterparty.",
    evidence:
      "ofac.screeningStatement true (and sanctionedCounterpartyProcess true where the vendor handles payments).",
    fix: "Ask for the screening statement in writing before any payment is authorised. This is an advisory, not legal advice - ask a lawyer for the legal position.",
    anchor:
      "OFAC advisory 2020 (updated 2021): facilitating a ransom payment to a sanctioned entity can draw civil penalties even without knowledge of the counterparty (via Security Arsenal, 21/11/2026).",
  },
];

export function findRule(id: string): RuleDef | undefined {
  const norm = id.trim().toUpperCase();
  return RULES.find((r) => r.id === norm);
}

export const INCIDENT_SUMMARY: string[] = [
  "Juan Ricardo Palacio Escobar, 52, CTO and co-founder of RansomwareHelp (ransomwarehelp.com, Florida), was indicted for wire fraud by a Rhode Island grand jury on 18/11/2026: 3 counts, up to 20 years each. Indicted means accused, not convicted.",
  "The alleged scheme ran about 10/2020-06/2026. The firm advertised 'advanced cryptographic tools', '100% recovery', 'never promote, intermediate or pay ransom', '28 years experience', '80 experts', and a '99%+ success rate'.",
  "In a June 2026 FBI sting, the FBI posed as both the victim and a fake ransomware group. The fake group asked 0.2 BTC (about $13,000); Palacio allegedly negotiated it down to about $6,000 in BTC, then billed the fake victim $16,010: a $2,750 diagnostic fee plus a $13,260 decryption fee.",
  "In a 2024 case reported by Paul Ihme (co-founder, Soteria), the firm quoted $438,880 to a small accounting firm hit by LockBit, demanded unsupervised remote access via AnyDesk, and allegedly deleted the ransom note.",
  "The same DOJ pattern in 10-11/2026: MonsterCloud CEO Zohar Pinhasi, 50, indicted for wire fraud and conspiracy - allegedly paid about $8 million and billed clients $19 million (one case: paid $8,200, billed $150,000). Edward Dubrovsky (Cybersteward) indicted for cyber extortion. Angelo Martino, 41, sentenced to 70 months in 07/2026 for passing client negotiation positions to BlackCat/ALPHV.",
  "CISA and the FBI advise against paying ransom. The OFAC advisory (2020, updated 2021) warns that facilitating payment to a sanctioned entity can draw civil penalties.",
  "Sources: Krebs on Security, 20/11/2026; TechCrunch, 25/11/2026; QUE.com, 23/11/2026; Security Arsenal, 21/11/2026. Facts verified 27/11/2026.",
];
