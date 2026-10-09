# Celebrity Traitors UK — Friends & Family Sweepstake

## Automatic source-age deferral

The automated checker requires Wikipedia's pinned revision to be at least 30 minutes old. A valid but younger revision now finishes successfully with `outcome: deferred`, leaves data.js and the public site unchanged, and records the revision timestamp, exact age and earliest eligible `retryAfter` time in the run report. The next scheduled check retries automatically (Thursday/Friday 23:00 or Saturday 10:00 Europe/London). A manual run with `deploy_current` unchecked can retry sooner after that time; any newer Wikipedia edit restarts the waiting period. `retryAfter` is an eligibility time, not an additional scheduled run.

Missing, malformed, impossible or future timestamps still fail closed. UTC timestamp validation does not depend on BST/GMT, and source chronology, voting and scoring validation still run after the age gate. See `automation/tests/revision-age.test.cjs` for the failed-run regression and boundary/safe-deferral tests.

Open **index.html** in a current Chrome, Edge, Firefox or Safari browser. No installation, server, account, API key or internet connection is needed. Unzip the entire package first, keeping its folders together.

## What is included

- The reference dashboard’s Round Table artwork, clickable contestant cards, elimination coffin, scoreboard, management controls and optional episode countdown.
- Seven participant rankings, joint ranks, individual scoring columns, prominent participant totals, and episode histories including incremental survival points.
- Event editing, ordering and removal; full voting and re-vote records; recruitment, successful/failed murders, Shield saves, other exits and final winners.
- Editable allocations, starting roles, multipliers and optional air times. Miranda Hart starts at ×2 for Ava.
- Browser-local storage, validated data.js export, JSON/data.js import and reset to packaged defaults.
- Responsive layout, local system fonts, keyboard-accessible cards and horizontally scrollable scoring tables.

## Confirmed draw and discrepancies

The supplied PowerPoint slide 4 agrees with the brief’s allocations. Slide 3 confirms the Claudia rule: double one of the two drawn contestants. The brief, rather than the slide, confirms Miranda as Ava’s selection.

The allocation list contains **20 competing celebrities plus Claudia’s special slot**, not 21 allocated celebrities. Amol Rajan is required by the initial events but is absent from the draw. He is included as contestant 21 and marked **Unassigned**, with no invented participant allocation. He appears at the table, in the elimination list and in his points history, but is not an eighth leaderboard participant. Assign him in Manage if the intended recipient is subsequently confirmed. Claudia is never a contestant and earns no points.

The incremental survival rule and “all winners reach 21” are inconsistent when there are multiple winners. This implementation follows the explicit formula: start at 1, gain 1 per elimination outlasted. A sole survivor reaches 21; two co-winners reach 20 each. Every actual winner gets a separate +5 bonus. The final does not fabricate an elimination or survival point.

The only packaged events are Amol’s murder followed by James Acaster’s accepted recruitment, recorded in episode 2 as in the supplied reference dataset. Richard E. Grant and Maya Jama start as Traitors. These are user-supplied starting facts, not independently verified broadcast results. No later results or unverified broadcast schedule are added.

Initial participant totals: Julian **8**; Joe and Talia **7**; Alex, Apala, Ava and Reuben **6**. Miranda’s raw score is **2**, contributing **4** to Ava, alongside Joanne’s **2**.

## Enter results after an episode

1. Click **Manage** (or press **M**). Add events in the order they occurred and set their episode number. The arrows reorder events; × removes an event. Changes remain a draft until Save.
2. **Murder:** choose the victim for a successful murder. For a Shield prevention, leave Victim empty and select the contestant actually targeted under **Target saved by Shield**. Holding a Shield alone is not an event. Leave both blank for a failed/no murder with no Shield reward.
3. **Round Table:** mark absentees, enter known individual votes, add re-votes if needed, and select the confirmed banished contestant. The fill control helps enter bulk votes; complete the target’s own vote separately. Keep **Full voting record confirmed** unchecked while any eligible vote or voting round is unknown. Known correct votes and confirmed banishments still score, but zero-vote points are withheld from everyone until the complete record is confirmed. Re-votes may contain only eligible voters. A contestant earns the correct-vote bonus once if any round targets a Traitor; the zero-vote bonus requires zero votes across every round.
4. **Recruitment:** select the Faithful and accepted/declined. Accepted recruitment gives +2 once and changes the role only for subsequent events.
5. **Left the game:** record other eliminations. Each elimination awards +1 survival to everyone still active.
6. **The Final:** record all non-winners’ exits first, then tick the actual winner(s). No later events can follow the final. An active Traitor on the murder team gets +1 per successful murder; faction banishment bonuses apply to all active members of the rewarded faction, including Round Table absentees.
7. Click **Save** to recalculate and save in this browser. Invalid timelines or a false completeness claim are rejected with an explanation. Click a celebrity for their cumulative and episode scores. Use **Round Table vote history** to review the public vote record. Editing votes or attendance clears the voting-completeness confirmation. Direct game-log changes create an episode revision and mark episode coverage partial until reviewed.

Under **Draw & starting roles**, edit allocations or multipliers using the dropdowns. Participant names must be unique. The optional random draw replaces allocations after a confirmation; use it only if you intend a new draw. A multiplier is applied once to the complete raw score, including the winner bonus. Starting-role changes replay the entire timeline; accepted recruitment belongs in the event log.

Optional air times are ISO timestamps, one per line, in order, for example `2026-10-08T20:00:00+01:00`. Enter confirmed times only; the countdown displays UK time. These timestamps do not create scoring events.

## Save, back up and restore

**Save** persists only in this browser profile at this file location or site address. It does not publish changes. If browser storage is blocked or full, an alert tells you to export instead. Moving the folder, changing browser, private browsing or clearing site data can remove access to local changes.

**Export data.js** exports the current validated management draft, including unsaved edits. Keep that file as a backup. To make it the packaged default, replace the project’s existing `data.js` with the downloaded file (rename `data (1).js` to `data.js` if necessary). **Import data** accepts that file or an equivalent JSON dataset and saves it locally after confirmation. Imports are parsed as JSON and are never executed as JavaScript. **Reset to data.js** discards this browser’s changes and reloads the packaged defaults.

If the packaged dataset changes, it takes precedence over an older browser-local copy. Export local edits before updating the project. Public visitors with an old browser cache may need to refresh the page to load the new data.js.

## Publish on GitHub Pages

1. Create a **new, separate repository**; do not change the reference repository.
2. Upload `index.html`, `styles.css`, `app.js`, `scoring.js`, `validation.js`, `episode-updates.js`, `episode-sources.js`, `episode-ui.js`, `data.js`, `.nojekyll`, and the complete `images` folder to its root. The README, examples and tests can also be included.
3. In the repository’s **Settings → Pages**, select deployment from a branch, your main branch, and the root folder. Save and use the site address GitHub provides when deployment finishes.
4. After each episode, update results in Manage, Save, Export data.js, and commit the exported file over the repository’s `data.js`. Wait for Pages deployment and refresh the published site.

GitHub Pages serves static files. It cannot automatically commit visitors’ local changes to the repository. Manage is a local editor, not an authenticated admin service; visitors can edit their own copy without changing anyone else’s scores. Only a repository update changes the published defaults. This package has been tested at a local HTTP subdirectory to match Pages relative-path hosting, but has not been deployed to a GitHub account.

## Files and verification

```text
index.html              Dashboard and dialogs
styles.css              Theme and mobile layouts
data.js                 Packaged starting dataset / replace after each episode
scoring.js              Deterministic event replay and scoring history
validation.js           Dataset and chronology checks, safe import parser
app.js                  Rendering, editor, storage, import/export
episode-updates.js       Episode snapshots, validation, score previews and revision history
episode-sources.js       Optional Wikipedia API retrieval and conservative table extraction
episode-ui.js            Episode editor and approval workflow
examples/               Episode 1, Episode 2 and blank episode JSON examples
episode-tests.cjs        Episode import/scoring regression tests
episode-browser-tests.cjs Browser tests for episode updates and online retrieval
images/table.webp       Local Round Table artwork
.nojekyll               Static hosting marker
tests.cjs               Automated scoring and data validation tests
browser-tests.cjs       Automated Chrome browser integration tests
test-results/           Browser report and desktop/mobile screenshots
README.md               These instructions
SOURCES.txt             Reference and supplied-data attribution
```

The website needs no Node.js. Developers can run scoring tests with `node tests.cjs`. Browser tests use Node.js 22+ with Chrome running headlessly on debugging port 9223 and an isolated temporary profile; run `node browser-tests.cjs`. Tests reset only that profile’s dashboard storage. Browser tests include actual offline opening, saving/reloading, export/import, mobile layout and HTTP subdirectory hosting. Test report and screenshots are supplied. The source PowerPoint remains unchanged in the working folder and is not needed to run the site.

Keyboard shortcuts retained from the reference: **M** opens Manage; **L** switches views. URL options `?view=table`, `?view=board`, `?rotate=30` and `?projector` are supported.

## Update Episode: the recommended after-episode workflow

1. Click **Update Episode**. Select an episode number (1–100) and **Load episode**. Previously recorded events are loaded for correction; future episodes start empty. Loading another episode discards the unapproved draft after confirmation.
2. When online, click **Fetch Latest Results**. The app requests Wikipedia’s public MediaWiki API once, with `origin=*`, no account or API key. The received page revision, source link and retrieval time appear under **Retrieved proposal and source links**. Nothing is scored or saved yet. Requests time out after 20 seconds; network failures leave the manual/import workflow available.
3. Review the retrieved proposal. Fetch preserves existing manual events, skips matching observations and flags conflicting versions. It never replaces a saved episode automatically. Check **Notes**, sources, attendance, event order and missing events. Use the structured event editor to correct results, add missing events, reorder them, or remove an incorrect event. An unknown value must remain unknown: do not guess votes.
4. Choose **Partial** while results are incomplete. For every Round Table, leave its full-record confirmation unchecked until every eligible initial vote and re-vote has been verified. When all scoring events and votes are known, mark the episode **Complete**. Episode coverage and voting completeness are separate confirmations.
5. Click **Review score changes**. See every participant’s before/after total and delta, warnings, and the existing/proposed event comparison. An historical change recalculates later scoring using the same scoring engine. A correction that makes a later event invalid is blocked; fix the conflicting later event in Manage first. No later event is silently dropped.
6. Tick the review confirmation and click **Approve episode update**. Only then are the episode snapshot, sources and revision history saved locally and the leaderboard updated. Any further edit invalidates the preview and requires a fresh review. A repeat import of the identical episode is a no-op; it cannot append duplicate events.
7. Open **Manage → Export data.js** and publish that file to the separate GitHub Pages repository. Approval is not public synchronisation. Other visitors see the update only after publication and refresh.

Closing the episode dialog discards its unapproved draft. Use **Download episode JSON** to keep a draft for later; download validates its format, whereas the full chronological validation runs at Review. Reset to data.js restores the packaged events and removes local episode revisions together with local edits.

### What online retrieval can and cannot infer

Investigated on **8 October 2026**:

- **Wikipedia:** the public API returned HTTP 200 with cross-origin access permitted. A genuine browser request from a local HTTP subdirectory returned the two known Episode 2 events. The adapter understands episode columns with merged cells, explicitly labelled murder/recruit decisions, unambiguous banishment names, individual vote cells and repeated voting columns. Full names are resolved with explicit aliases for James A., James B. and Kenny. Unknown/ambiguous names are not guessed. [Series 2 article](https://en.wikipedia.org/wiki/The_Celebrity_Traitors_series_2), [MediaWiki cross-site requests](https://www.mediawiki.org/wiki/API:Cross-site_requests).
- **TraitorBase:** its public season page is structured HTML, but the inspected response is spoiler-filtered. No supported public episode export contract was established. Its published terms restrict repeated automated extraction, so this package does not use it as an automated feed. This is not a claim that its CORS headers prohibit access. [Season page](https://traitorbase.com/uk/celebrity-season-2), [terms](https://traitorbase.com/terms).
- **Recaps:** The Standard’s Episode 2 report corroborates Amol’s murder and James’s recruitment but is prose, not a complete machine-readable vote ledger. It is useful as a human cross-check. [Episode 2 recap](https://www.standard.co.uk/culture/tvfilm/celebrity-traitors-2026-james-acaster-amol-rajan-b1299378.html).

The Wikipedia adapter is intentionally a **proposal generator**, not a complete series-results API. It does not infer recruitment from present-day affiliation colours, treat a Shield holder as a saved murder target, guess missing votes, derive winners from ambiguous finish labels, or assume the source is complete. A specifically labelled Shield save can be imported; ordinary Shield possession is only an observation. Final winners, unusual exits, unsupported role changes and special twists should be entered manually or supplied in JSON. Current-role changes happen via recruitment at the correct event position; original-role corrections belong in Manage.

Every fetched voting record starts incomplete. Merged table columns can represent multiple decisions, re-votes or distinct Round Tables; the administrator must verify their grouping. Multiple banishment names in one episode are flagged rather than automatically grouped into a single table. Unrecognised layouts stop extraction with an explanation. A listed future episode with no recognised results produces a warning, not a claim that nothing happened. No web page HTML is inserted into the dashboard, and no fetched result is automatically approved.

### Historical Episodes 1 and 2

The app adds lightweight episode records around existing data without changing `data.js` or discarding saved browser edits. Episode 1 contains the starting roles and initial survival points, but no completed scoring event. Episode 2 retains Amol’s murder followed by James’s recruitment. The sources checked show the Episode 2 ending before a completed Round Table vote; no empty table or zero-vote award is added. The examples below can be imported to mark these episodes complete after review, without changing their existing scores.

### Episode JSON: external tools and AI-generated files

Use **Import episode JSON** in Update Episode, not Manage’s full-dataset import. Files are parsed as JSON, never executed. The file may describe any historical or future episode, but must contain the **complete desired snapshot for that one episode**, not just the additions. Omitting an existing event proposes its removal; Review displays that change and requires approval. All other episodes remain intact. Approved versions retain the previous events in **Episode revision history**, also included in full data.js exports.

Start with `examples/episode-template.json`. The working examples `examples/episode-1.json` and `examples/episode-2.json` use the confirmed historical baseline and source links. No fictitious future results are preloaded.

Top-level fields:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Must be `1` |
| `series` | Must be `"celebrity-traitors-uk-2"` |
| `episode` | Integer 1–100 |
| `date` | `YYYY-MM-DD`, or `""` if unknown |
| `status` | `"partial"` or `"complete"` |
| `notes` | Plain text describing unknowns and decisions |
| `sources` | Array of `{ "title": "...", "url": "https://..." }`; optional retrieval/revision metadata is retained |
| `events` | Ordered array of events belonging only to this episode |

Each event uses the same model as the existing scoring engine:

| Type | Required/optional event fields |
| --- | --- |
| `murder` | `victim` for successful murder, OR `shielded` for an actually prevented murder; never both. Neither means no successful murder and no Shield points. |
| `recruit` | `who`, `accepted` (boolean) |
| `roundtable` | `votes` object mapping full voter names to full target names; `revotes` array of the same objects; `absent` array; `banished` full name or null; `votingComplete` boolean |
| `exit` | `who` — an elimination by another mechanism |
| `final` | `winners` array of actual winners; record remaining non-winners’ exits first |

All events also carry `ep` matching the package episode and a stable `id` such as `ep3-roundtable-1`. Omitted IDs are generated, but externally generated corrections should retain stable IDs. IDs must start with the episode prefix and use letters, digits, underscores or dashes. Duplicate IDs and duplicate event contents within one episode are rejected. Exact duplicate events in a snapshot are not treated as separate occurrences; review the intended event sequence instead. Unknown contestants and invalid timelines are rejected. Claudia remains a multiplier rule, not a contestant.

For incomplete voting, include only known entries in `votes`/`revotes`, retain the actual eligible participants, and set `votingComplete: false`. Do not mark an unknown voter absent just because their vote is missing. Full first-round voting is structurally required when confirming completeness; re-vote eligibility is explicitly confirmed by the administrator because tied candidates may not re-vote. Omitted completeness in episode JSON defaults to false. Legacy full-dataset records with a full first round and no re-votes remain supported; legacy re-votes require explicit completeness confirmation before zero-vote bonuses resume.

Suggested instruction for another AI agent: “Produce schemaVersion 1 episode JSON for Celebrity Traitors UK Series 2 using the documented event model and the exact contestant names from data.js. Cite source URLs, preserve event order and existing confirmed events, mark unknown votes incomplete, and never invent results. Do not output computed scores. The administrator will review the snapshot before approval.”

### Episode feature tests

Run `node episode-tests.cjs` for snapshot replacement, duplicate prevention, chronology, partial/complete voting, role bonuses, multiplier and data roundtrip checks. Run `node episode-browser-tests.cjs` with the same isolated Chrome debugging profile used by `browser-tests.cjs`. Add `--live` for an actual Wikipedia request. Browser tests exercise approval, historical JSON imports, repeat import no-op, offline failure fallback, mobile layout, parser fixtures and HTTP subdirectory hosting. Real-source fixture tests additionally use the temporary API response when available; no full article is bundled with the project. Reports and screenshots are in `test-results/`.
