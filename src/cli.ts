#!/usr/bin/env node
/**
 * irvet CLI: vet a ransomware recovery vendor from local evidence
 * before you sign. Dossier in, verdict out.
 *
 * Commands: init, vet, check, invoice, explain, diff. All support --json.
 * vet/check/invoice/diff/explain are 100% local and offline.
 * irvet never asks for a credential, token, or password, and never
 * prints one. Amounts in invoice output are the user's own data.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { defaultConfigJson, defaultDossierJson, loadConfig } from "./config.js";
import { diffVets } from "./diff.js";
import {
  loadInvoice,
  loadInvoiceContract,
  reconcileInvoice,
} from "./invoice.js";
import {
  renderDiff,
  renderGate,
  renderInvoice,
  renderVet,
  toJson,
} from "./report.js";
import { INCIDENT_SUMMARY, RULES, findRule } from "./rules.js";
import type { VetResult } from "./types.js";
import { VERSION } from "./types.js";
import { evaluateDossier, exitForVerdict, loadDossier } from "./vet.js";

const USAGE = `irvet ${VERSION} - vet a ransomware recovery vendor before you sign.

Usage:
  irvet init [dir]                          scaffold vendor.json + irvet.config.json
  irvet vet <dossier> [--json]              audit a dossier (exit 0/1/2)
  irvet check <dossier> [--json]            CI gate: 1-line verdict + exit code
  irvet invoice <invoice.json> --contract <contract.json> [--json]
                                            reconcile invoice vs contract
  irvet diff --baseline <baseline.json> <dossier> [--json]
                                            exit 1 on a rule regression
  irvet explain [rule]                      list rules, or explain one (try: V1, ransomwarehelp)

Exit codes: 0 HIRE, 1 DO-NOT-HIRE or CONDITIONAL (or diff regression),
2 input error or NEEDS-EVIDENCE.
A verdict is about the DOSSIER provided, not about the vendor.
irvet is not legal advice.`;

interface Flags {
  json: boolean;
  contract?: string;
  baseline?: string;
  positional: string[];
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = { json: false, positional: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") flags.json = true;
    else if (a === "--contract") flags.contract = args[++i];
    else if (a === "--baseline") flags.baseline = args[++i];
    else if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (a.startsWith("-")) {
      console.error(`unknown flag: ${a}`);
      console.error(USAGE);
      process.exit(2);
    } else {
      flags.positional.push(a);
    }
  }
  return flags;
}

function cmdInit(dir: string): number {
  const abs = resolve(dir);
  mkdirSync(abs, { recursive: true });
  const dossierTarget = join(abs, "vendor.json");
  const configTarget = join(abs, "irvet.config.json");
  if (existsSync(dossierTarget) || existsSync(configTarget)) {
    console.error(
      `vendor.json or irvet.config.json already exists in ${dir} - not overwriting`,
    );
    return 2;
  }
  writeFileSync(dossierTarget, defaultDossierJson());
  writeFileSync(configTarget, defaultConfigJson());
  console.log(`created ${join(dir, "vendor.json")}`);
  console.log(`created ${join(dir, "irvet.config.json")}`);
  console.log(
    "Next: fill in the vendor's real claims, then run 'irvet vet vendor.json'.",
  );
  return 0;
}

function cmdExplain(arg: string | undefined): number {
  if (!arg) {
    console.log("irvet rules (run 'irvet explain <rule>' for detail):");
    for (const r of RULES) {
      console.log(`  ${r.id} - ${r.title} (${r.severity})`);
    }
    console.log(
      "  ransomwarehelp - the 20/11/2026 case this tool is built around",
    );
    return 0;
  }
  if (arg.toLowerCase() === "ransomwarehelp") {
    console.log("The RansomwareHelp case (facts as of 27/11/2026):");
    for (const line of INCIDENT_SUMMARY) {
      console.log(`- ${line}`);
    }
    return 0;
  }
  const rule = findRule(arg);
  if (!rule) {
    console.error(`unknown rule: ${arg}`);
    console.error(
      "known rules: " + RULES.map((r) => r.id).join(", ") + ", ransomwarehelp",
    );
    return 2;
  }
  console.log(`${rule.id} - ${rule.title} (${rule.severity})`);
  console.log("");
  console.log(`What: ${rule.what}`);
  console.log("");
  console.log(`Evidence needed: ${rule.evidence}`);
  console.log("");
  console.log(`Fix: ${rule.fix}`);
  console.log("");
  console.log(`Why it matters: ${rule.anchor}`);
  return 0;
}

function runVet(dossierPath: string): VetResult {
  const dossier = loadDossier(dossierPath);
  const config = loadConfig(resolve(dossierPath, ".."));
  return evaluateDossier(dossier, dossierPath, config.minReferences);
}

async function main(): Promise<number> {
  const [, , command, ...rest] = process.argv;
  if (!command || command === "--help" || command === "-h") {
    console.log(USAGE);
    return 0;
  }
  if (command === "init") {
    const flags = parseFlags(rest);
    return cmdInit(flags.positional[0] ?? ".");
  }
  if (command === "explain") {
    const flags = parseFlags(rest);
    if (flags.json) {
      const arg = flags.positional[0];
      if (arg && arg.toLowerCase() === "ransomwarehelp") {
        console.log(JSON.stringify({ incident: INCIDENT_SUMMARY }, null, 2));
        return 0;
      }
      const rule = arg ? findRule(arg) : undefined;
      if (arg && !rule) {
        console.error(`unknown rule: ${arg}`);
        return 2;
      }
      console.log(JSON.stringify(rule ?? RULES, null, 2));
      return 0;
    }
    return cmdExplain(flags.positional[0]);
  }
  if (command === "vet" || command === "check") {
    const flags = parseFlags(rest);
    const dossierPath = flags.positional[0];
    if (!dossierPath) {
      console.error(`${command} requires a dossier file`);
      console.error(USAGE);
      return 2;
    }
    let result: VetResult;
    try {
      result = runVet(dossierPath);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return 2;
    }
    if (flags.json) console.log(toJson(result));
    else if (command === "vet") console.log(renderVet(result));
    else console.log(renderGate(result));
    return exitForVerdict(result.verdict);
  }
  if (command === "invoice") {
    const flags = parseFlags(rest);
    const invoicePath = flags.positional[0];
    if (!invoicePath || !flags.contract) {
      console.error(
        "invoice requires <invoice.json> and --contract <contract.json>",
      );
      console.error(USAGE);
      return 2;
    }
    let result;
    try {
      const invoice = loadInvoice(invoicePath);
      const contract = loadInvoiceContract(flags.contract);
      result = reconcileInvoice(invoice, contract, invoicePath, flags.contract);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return 2;
    }
    if (flags.json) console.log(toJson(result));
    else console.log(renderInvoice(result));
    return result.flagged ? 1 : 0;
  }
  if (command === "diff") {
    const flags = parseFlags(rest);
    if (!flags.baseline) {
      console.error("diff requires --baseline <file>");
      return 2;
    }
    const dossierPath = flags.positional[0];
    if (!dossierPath) {
      console.error("diff requires a dossier file");
      console.error(USAGE);
      return 2;
    }
    let baseline: VetResult;
    try {
      baseline = JSON.parse(readFileSync(flags.baseline, "utf8")) as VetResult;
    } catch {
      console.error(`could not read baseline file: ${flags.baseline}`);
      return 2;
    }
    let current: VetResult;
    try {
      current = runVet(dossierPath);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      return 2;
    }
    const d = diffVets(baseline, current, flags.baseline, dossierPath);
    if (flags.json) console.log(JSON.stringify(d, null, 2));
    else console.log(renderDiff(d));
    return d.regression ? 1 : 0;
  }
  console.error(`unknown command: ${command}`);
  console.error(USAGE);
  return 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  });
