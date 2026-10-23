The scoreboard is a presentation of the existing event ledger. `scoreboard-model.js`
calls `TraitorsScoring.compute` unchanged. It never writes game data or runs the updater.

The displayed episode is the greatest episode with an imported event or a complete
episode record (minimum Episode 1). Checks, pending future results and empty partial
records do not advance it. Explicitly complete episodes can have zero scoring events.

Previous scores replay the ledger through N−1, in its existing order. The engine's
starting survival point belongs to Episode 1: Episode 0 is zero. Corrections/backfills
therefore change their original episode and subsequent totals, rather than becoming
points in the latest episode. Missing event episode numbers produce “Unavailable”.
Partial episodes contain only awarded points and carry a partial label. An earlier
partial episode also labels the previous total as partial. These are totals of the
recorded awards, not predictions of unresolved outcomes.

Overall categories use the engine's category totals. Episode history uses its award
log, including zero-point episodes and effective recruitment changes. Miranda's raw
points are multiplied once for Ava's contribution. Unassigned Amol's raw points remain
in history and do not contribute to any participant. Episodes 1–2 remain the supplied
project baseline; the UI does not retrospectively claim independent verification.

Validation:

- `npm test`: existing scoring/update tests plus `automation/tests/scoreboard.test.cjs`.
- `node scoreboard-browser-tests.cjs`: Chromium/Android and WebKit/iPhone profiles at
  320, 375, 390, 430 and 1440px; totals, previous/current/contribution values, dialogs,
  category reconciliation, focus restoration, screenshots and no page overflow.
- `node mobile-browser-tests.cjs`: unchanged Round Table checks, including all 21
  contestant taps, expanded view and desktop geometry. `DESKTOP_BASELINE_URL` can
  compare it with the currently published site before deploying.

Browser scripts require a separate Playwright installation (`PLAYWRIGHT_MODULE`),
browser cache (`PLAYWRIGHT_BROWSERS_PATH`) and optionally `CHROME_PATH`. They add no
production dependencies. `TEST_BASE_URL` checks the rendered published dashboard
instead of the local server. Screenshots/reports are written under `test-results/`.
These are emulated browser checks, not physical iPhone/Android device tests.
