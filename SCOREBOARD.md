The scoreboard is one league table, with seven calculated participant totals and
competition ranks (1, 2, 2, 4). All 20 allocated celebrities are always visible below
their participant's header. Nine scoring columns contain cumulative POINTS directly
from the existing engine's categories, grouped as Shared, Faithful and Traitor.
Each row also shows the raw total/latest gain and participant contribution. Miranda's
×2 applies once, to her full raw score. Participant gains sum raw episode awards times
each allocation multiplier. Eliminated celebrities retain earned points and have
explicit, muted status labels. Recruited players retain both earlier Faithful and
later Traitor points. Celebrity names open the complete existing detail dialog.

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
  320, 375, 390, 430 and 1440px; category sums, raw/multiplied episode gains, all rows,
  horizontal table scrolling, opaque sticky names and participant headers, dialogs,
  rules tabs, administration/import compatibility, focus restoration and screenshots.
- `node mobile-browser-tests.cjs`: unchanged Round Table checks, including all 21
  contestant taps, expanded view and desktop geometry. `DESKTOP_BASELINE_URL` can
  compare it with the currently published site before deploying.

Browser scripts require a separate Playwright installation (`PLAYWRIGHT_MODULE`),
browser cache (`PLAYWRIGHT_BROWSERS_PATH`) and optionally `CHROME_PATH`. They add no
production dependencies. `TEST_BASE_URL` checks the rendered published dashboard
instead of the local server. Screenshots/reports are written under `test-results/`.
These are emulated browser checks, not physical iPhone/Android device tests.

Bonus facts and its public panel have been removed, including its rules reference.
The legacy pure facts helper remains regression-tested and is not called by the UI.
No source extraction or scoring rules have been added.

Zero presentation is conservative. Complete historical coverage through the player's
exit/current episode establishes a verified zero, shown as “—”. Missing/seeded episode
coverage, partial voting or pending events cannot establish eligible zero categories;
these show “?” while the numeric awarded value remains zero for reconciliation. A
role-ineligible category can show a dash when the role history is established by
complete or supplied baseline records without pending changes. An eliminated player
cannot earn a winner bonus. Positive cells always show actual awarded points.
The supplied Episodes 1–2 baseline is not independently complete coverage, so some
eligible zero categories remain “?” even though subsequent episodes are complete.

The Sweepstake rules tab separates show mechanics from sweepstake points and matches
the existing engine. No discrepancy was found. No prize arrangement or tie-break rule
has been introduced. Tabs support arrow keys/Home/End and dialogs restore focus.
Mobile uses the same table. Its scroll region supports touch and arrow keys, sticky
opaque celebrity cells, and participant strips pinned to the available viewport.
