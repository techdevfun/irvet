import test from "node:test";
import assert from "node:assert/strict";

/**
 * Live smoke: the public fact sources the blueprint was built on.
 * Soft-skips on 403/429/network failure. The org repo assertion
 * accepts 404 OR 200, so CI stays green after the repo flips public
 * (carbonbill/adrgate pattern).
 */
async function check(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return res.status;
  } catch {
    return null;
  }
}

function softSkip(t, status, label) {
  if (status === null || status === 403 || status === 429) {
    t.skip(`${label}: network unavailable or rate-limited (status ${status})`);
    return true;
  }
  return false;
}

test("live: Krebs article on the RansomwareHelp indictment is reachable", async (t) => {
  const status = await check(
    "https://krebsonsecurity.com/2026/11/cto-of-ransomwarehelp-indicted-for-wire-fraud/",
  );
  if (softSkip(t, status, "Krebs")) return;
  assert.equal(status, 200, `Krebs article must be 200, got ${status}`);
  const text = await (
    await fetch(
      "https://krebsonsecurity.com/2026/11/cto-of-ransomwarehelp-indicted-for-wire-fraud/",
    )
  ).text();
  assert.match(text, /Palacio/);
});

test("live: TechCrunch article on the indictment is reachable", async (t) => {
  const url =
    "https://techcrunch.com/2026/11/25/doj-accuses-former-cyber-executive-of-defrauding-ransomware-victims-by-secretly-paying-hackers/";
  const status = await check(url);
  if (softSkip(t, status, "TechCrunch")) return;
  assert.equal(status, 200, `TechCrunch article must be 200, got ${status}`);
});

test("live: No More Ransom is reachable (V1 cross-check source)", async (t) => {
  const status = await check("https://www.nomoreransom.org/en/index.html");
  if (softSkip(t, status, "No More Ransom")) return;
  assert.equal(status, 200, `nomoreransom.org must be 200, got ${status}`);
});

test("live: npm irvet is still unclaimed (404) or published (200)", async (t) => {
  const status = await check("https://registry.npmjs.org/irvet");
  if (softSkip(t, status, "npm registry")) return;
  assert.ok(
    status === 404 || status === 200,
    `npm irvet must be 404 or 200, got ${status}`,
  );
});

test("live: org repo techdevfun/irvet is 404 (private) or 200 (public)", async (t) => {
  const status = await check("https://api.github.com/repos/techdevfun/irvet");
  if (softSkip(t, status, "api.github.com")) return;
  assert.ok(
    status === 404 || status === 200,
    `org repo must be 404 or 200, got ${status}`,
  );
});
