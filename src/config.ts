/**
 * irvet.config.json: thresholds for the vet. The rule set is fixed
 * (V1-V8); the config only tunes how strict the evidence check is.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Config {
  /** Minimum number of verifiable references for V6 (default 1). */
  minReferences: number;
}

export const DEFAULT_CONFIG: Config = { minReferences: 1 };

export function defaultConfigJson(): string {
  return (
    JSON.stringify(
      {
        minReferences: 1,
        comment:
          "irvet config. Rule set V1-V8 is fixed; only minReferences is tunable in v0.1.0.",
      },
      null,
      2,
    ) + "\n"
  );
}

export function defaultDossierJson(): string {
  return (
    JSON.stringify(
      {
        vendor: { name: "Example Recovery Co", website: "https://example.com" },
        method: {
          description:
            "Per-strain method in writing. Replace with the vendor's actual method.",
          perStrain: [
            {
              strain: "LockBit 3.0",
              method:
                "Public decryptor from No More Ransom where available; otherwise flaw-based recovery documented per case.",
            },
          ],
          proprietaryClaim: false,
        },
        marketingClaims: ["24/7 response, average first contact under 1 hour"],
        contract: {
          paymentClause: "explicit",
          paymentApprovalRequired: true,
          auditRight: true,
          itemisedInvoice: true,
          ransomNoteHandling: "kept-by-victim",
          remoteAccess: "supervised-limited",
        },
        references: [
          {
            name: "Example Client Ltd",
            contact: "ciso@example-client.com",
            insurerPanel: false,
          },
        ],
        ofac: {
          screeningStatement: true,
          sanctionedCounterpartyProcess: true,
        },
        knownPublicDecryptors: ["LockBit 3.0"],
      },
      null,
      2,
    ) + "\n"
  );
}

export function loadConfig(dir: string): Config {
  const path = join(dir, "irvet.config.json");
  if (!existsSync(path)) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<Config>;
    return {
      minReferences:
        typeof parsed.minReferences === "number" && parsed.minReferences >= 1
          ? Math.floor(parsed.minReferences)
          : 1,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
