/**
 * Invoice reconciliation: match every invoice line against the
 * contract and the payment trail.
 *
 * Flags (blueprint section 4):
 *   MARKUP           - a pass-through cost billed as a service fee above cost
 *   NO-PAYMENT-CLAUSE- a "decryption fee" while the contract says no ransom payment
 *   NOT-IN-CONTRACT  - a line the contract does not allow
 *   TOTAL-MISMATCH   - the stated total differs from the sum of the lines
 *
 * Amounts printed here are the user's own invoice data, supplied to
 * reconcile - irvet never asks for, reads, or prints a secret.
 */
import { readFileSync } from "node:fs";
import type {
  Invoice,
  InvoiceContract,
  InvoiceFinding,
  InvoiceResult,
} from "./types.js";
import { VERSION } from "./types.js";

function loadJson<T>(path: string, label: string): T {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`could not read ${label} file: ${path}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${label} is not valid JSON: ${path}`);
  }
}

export function loadInvoice(path: string): Invoice {
  const inv = loadJson<Invoice>(path, "invoice");
  if (!inv || typeof inv !== "object" || !Array.isArray(inv.lines)) {
    throw new Error(
      `invoice must be a JSON object with a lines array: ${path}`,
    );
  }
  return inv;
}

export function loadInvoiceContract(path: string): InvoiceContract {
  const c = loadJson<InvoiceContract>(path, "contract");
  if (!c || typeof c !== "object" || Array.isArray(c)) {
    throw new Error(`contract must be a JSON object: ${path}`);
  }
  return c;
}

export function reconcileInvoice(
  invoice: Invoice,
  contract: InvoiceContract,
  invoiceLabel: string,
  contractLabel: string,
): InvoiceResult {
  const findings: InvoiceFinding[] = [];
  const lineTotal = invoice.lines.reduce((sum, l) => sum + l.amount, 0);

  for (const line of invoice.lines) {
    if (
      line.passThroughCost !== undefined &&
      line.kind === "service" &&
      line.amount > line.passThroughCost
    ) {
      const markup = line.amount - line.passThroughCost;
      const pct = Math.round((markup / line.passThroughCost) * 100);
      findings.push({
        line: line.description,
        kind: "MARKUP",
        detail:
          `pass-through cost $${line.passThroughCost.toLocaleString("en-US")} billed as a ` +
          `$${line.amount.toLocaleString("en-US")} service fee ` +
          `(markup $${markup.toLocaleString("en-US")}, +${pct}%). ` +
          `Pass-through costs must be billed at cost when the contract says so.`,
      });
    }
    if (
      contract.noRansomPayment === true &&
      /decrypt/i.test(line.description)
    ) {
      findings.push({
        line: line.description,
        kind: "NO-PAYMENT-CLAUSE",
        detail:
          `a "${line.description}" line of $${line.amount.toLocaleString("en-US")} ` +
          `while the contract states no ransom payment. Ask what this fee pays for, in writing.`,
      });
    }
    if (
      contract.allowedDescriptions !== undefined &&
      !contract.allowedDescriptions.includes(line.description)
    ) {
      findings.push({
        line: line.description,
        kind: "NOT-IN-CONTRACT",
        detail: `line "${line.description}" is not in the contract's allowed descriptions.`,
      });
    }
  }

  const statedTotal = invoice.total ?? null;
  const totalMatches = statedTotal === null || statedTotal === lineTotal;
  if (!totalMatches && statedTotal !== null) {
    findings.push({
      line: "TOTAL",
      kind: "TOTAL-MISMATCH",
      detail:
        `stated total $${statedTotal.toLocaleString("en-US")} does not match ` +
        `the sum of the lines $${lineTotal.toLocaleString("en-US")}.`,
    });
  }

  return {
    tool: "irvet",
    version: VERSION,
    invoice: invoiceLabel,
    contract: contractLabel,
    lineTotal,
    statedTotal,
    totalMatches,
    findings,
    flagged: findings.length > 0,
  };
}
