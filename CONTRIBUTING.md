# Contributing to irvet

## Bug reports

Open an issue with:

- the irvet version (`irvet --help` prints it),
- the command and its full output,
- the dossier file that misbehaves (redact vendor names if you like -
  irvet only ever prints what is in the dossier you supply).

## Development

```sh
npm install
npm run build
npm test          # unit + e2e
npm run test:live # live smoke (needs network; soft-skips offline)
npm run lint      # eslint + prettier
node scripts/preflight.js
```

## Rules for contributors

- Zero runtime dependencies. Keep it that way.
- The tool is read-only: it never contacts a vendor, never runs vendor
  code, and never sends data anywhere.
- Never print, log, or store a credential, token, or password. irvet
  has no use for any of them.
- Public content is 100% ASCII English. No em dash - use a hyphen.
- A new rule needs a unit test, a fixture, and a line in the README
  only if it changes behavior users can see.
- Never write that a vendor "is guilty" or "is a fraud". The words are
  indicted, accused, allegedly. A verdict is about the dossier
  provided, not about the vendor.
- Never invent a dossier for a real operating vendor. Fixtures are
  synthetic or clearly labelled RECONSTRUCTED from public reporting.
