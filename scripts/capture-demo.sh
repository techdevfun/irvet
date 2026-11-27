#!/usr/bin/env bash
# Capture the demo transcript from the REAL CLI (no hand-edited output).
# Runs from inside a scratch dir with relative paths, so the transcript
# never contains the builder's absolute paths.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRATCH=/tmp/irvet-demo
BIN="$SCRATCH/bin"
rm -rf "$SCRATCH"
mkdir -p "$BIN" "$ROOT/demo"
ln -sf "$ROOT/dist/cli.js" "$BIN/irvet"
chmod +x "$ROOT/dist/cli.js"
export PATH="$BIN:$PATH"

OUT="$ROOT/demo/transcript.txt"
cd "$ROOT"
{
  echo "# irvet demo - real CLI output"
  echo "# (ransomwarehelp-reconstructed is a RECONSTRUCTED fixture from"
  echo "#  public indictment reporting - Krebs 20/11/2026, TechCrunch 25/11/2026;"
  echo "#  the CTO was INDICTED, which means accused, not convicted)"
  echo ""
  echo "$ irvet init demo-vendor"
  (cd "$SCRATCH" && irvet init demo-vendor)
  echo ""
  echo "$ irvet vet examples/ransomwarehelp-reconstructed/vendor.json"
  irvet vet examples/ransomwarehelp-reconstructed/vendor.json || echo "exit: $?"
  echo ""
  echo "$ irvet vet examples/clean-vendor/vendor.json"
  irvet vet examples/clean-vendor/vendor.json || echo "exit: $?"
  echo ""
  echo "$ irvet invoice examples/invoice-markup/invoice.json --contract examples/invoice-markup/contract.json"
  irvet invoice examples/invoice-markup/invoice.json --contract examples/invoice-markup/contract.json || echo "exit: $?"
} > "$OUT" 2>&1

echo "transcript written: $OUT ($(wc -l < "$OUT") lines)"
