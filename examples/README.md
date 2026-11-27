# Examples

- `ransomwarehelp-reconstructed/` - **RECONSTRUCTED, not a real dossier.**
  Rebuilt from public facts in the indictment reporting (Krebs on
  Security, 20/11/2026; TechCrunch, 25/11/2026). The CTO was INDICTED
  (accused, not convicted). `irvet vet` gives DO-NOT-HIRE: V1, V2, V3,
  V4, V5, V7 fail (6 rules) and V8 is missing. Amounts are the published
  figures ($16,010 billed in the June 2026 FBI sting; $438,880 was a
  quote in a 2024 case, not an amount paid).
- `clean-vendor/` - synthetic vendor that passes every rule. HIRE.
- `conditional-vendor/` - same dossier as clean-vendor except the
  marketing material promises "100% recovery guaranteed", so V7 fails.
  CONDITIONAL (one MEDIUM rule).
- `invoice-markup/` - invoice + contract rebuilding the sting pattern:
  a $6,000 pass-through billed as a $13,260 "decryption fee" plus a
  $2,750 diagnostic fee. `irvet invoice` flags 2 findings.

No fixture names a real operating vendor, and no fixture is a real
dossier or a real invoice.
