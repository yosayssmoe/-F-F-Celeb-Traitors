The scoreboard is one compact leaderboard with seven calculated participant totals
and competition ranks (1, 2, 2, 4). Celebrity sections start collapsed. Expand controls
reveal status badges, raw scores, latest-episode gains and concise breakdown controls.
Only multiplied allocations repeat a separate contribution. Miranda's ×2 applies
once, to her full raw score. Eliminated celebrities retain their earned points.

`scoreboard-model.js` calls `TraitorsScoring.compute` unchanged. It never writes game
data or runs the updater. Public countdown controls have been removed. Operational
reports and the episode editor remain available inside Manage. Automatic checks,
event imports, backfilling and GitHub Actions are unchanged.

The displayed episode is the greatest episode with an imported event or a complete
episode record (minimum Episode 1). Checks, pending future results and empty partial
records do not advance it. Explicitly complete episodes can have zero scoring events.

The gain beside each raw score sums engine award-log items belonging to the displayed
episode. Backfills/corrections update their original episode, not the latest gain.
Positive gains are green, zero gains neutral, negative gains signed and red. Partial
episodes carry a concise notice and show only awarded points. The engine's starting
survival point belongs to Episode 1. No previous-score column is displayed; historical
replay remains covered by regression tests.

Overall categories use the engine's category totals. Episode history uses its award
log, including zero-point episodes and effective recruitment changes. Miranda's raw
points are multiplied once for Ava's contribution. Unassigned Amol's raw points remain
in history and do not contribute to any participant. Episodes 1–2 remain the supplied
project baseline; the UI does not retrospectively claim independent verification.

Validation:

- `npm test`: existing scoring/update tests plus `automation/tests/scoreboard.test.cjs`.
- `node scoreboard-browser-tests.cjs`: Chromium/Android and WebKit/iPhone profiles at
  320, 375, 390, 430 and 1440px; totals, raw episode gains, collapse controls, dialogs,
  facts, rules tabs, administration/import compatibility, category reconciliation,
  focus restoration, screenshots and no page overflow.
- `node mobile-browser-tests.cjs`: unchanged Round Table checks, including all 21
  contestant taps, expanded view and desktop geometry. `DESKTOP_BASELINE_URL` can
  compare it with the currently published site before deploying.

Browser scripts require a separate Playwright installation (`PLAYWRIGHT_MODULE`),
browser cache (`PLAYWRIGHT_BROWSERS_PATH`) and optionally `CHROME_PATH`. They add no
production dependencies. `TEST_BASE_URL` checks the rendered published dashboard
instead of the local server. Screenshots/reports are written under `test-results/`.
These are emulated browser checks, not physical iPhone/Android device tests.

Bonus facts count recorded ballots, including re-votes, using the target's role in
the engine snapshot before each table. All eligible voters' ballots count as facts,
including ballots cast by Traitors; this does not change the Faithful-only scoring
bonus or its once-per-table limit. Eliminated and unassigned contestants are included.
Counts are exact only when all scored episodes and voting rounds have complete
coverage. Otherwise positive values say “At least N” and missing zeros say “Not fully
recorded”. The current initial-episode voting history is incomplete. Shield wins have
no separate structured records, so they are “Unavailable”; Shield saves never become
invented Shield wins. No new source extraction or scoring rules have been added.

The Sweepstake rules tab separates show mechanics from sweepstake points and matches
the existing engine. No discrepancy was found. No prize arrangement or tie-break rule
has been introduced. Tabs support arrow keys/Home/End, dialogs restore focus, and
expanded rows remain expanded when switching tabs or refreshing imported state.
