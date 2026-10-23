# Episode 8: evidence and supported handling

Investigation: 23 October 2026. The earlier updater rejected the Decision Dagger as an unsupported decision, treated “Tie” as an unknown banishment, and consequently could not prove that Miranda’s murder preceded the unresolved voting. This was a source-adapter/event-model limitation, not a scoring-validation or Pages failure.

## Evidence

The reproducible source is [Wikipedia revision 1381636096](https://en.wikipedia.org/w/index.php?oldid=1381636096), timestamp 2026-10-23 20:23:27 UTC. `automation/fixtures/episode8-facts.json` records normalized factual rows; tests use paraphrased footnotes, not a copied article.

- The Dagger footnote says its holder’s vote counts twice and identifies Kenny as its recipient. The episode description separately explains the double vote. Kenny’s voting cell links to the same footnote. This is one chosen target counted twice, not two independently chosen ordinary votes.
- The initial weighted tally is 4–4–1–1–1. Joanne and Sharon each receive four votes, including Kenny’s doubled Sharon vote. Ten voters cast eleven weighted votes.
- The linked tie procedure calls for a second vote excluding the tied contestants and restricted to those contestants as targets. These columns form one Round Table, not two scoring events.
- Seven re-votes are published: Sharon receives four and Joanne three. Kenny’s re-vote is TBC; its linked footnote says his second double vote is unrevealed at the episode cliffhanger. The final tally and banishment cell are empty. A tie is not an elimination.
- Miranda’s cast finish says murdered in Episode 8. Her voting row says murdered in Episode 8 in both ballot columns. Those independent structured assertions establish her elimination before this table, without assuming a standard episode order.
- Historical events establish Maya, James Acaster and Kenny as the active Traitors. No further recruitment or role change is established in Episode 8. All published voting targets are Faithful at this table.

Contemporary cross-checks: [PA’s Miranda murder report](https://pressassociation.com/wire/good-detective-killed-off-in-emotional-murder-in-celebrity-156953a5-ec8a-45c2-ad8d-f3f4ebcdeb24) identifies the three murderers; [Goss’s cliffhanger recap](https://goss.ie/featured/celebrity-traitors-viewers-left-in-shock-at-dramatic-cliffhanger-with-joanne-mcnally-490394) describes the unrevealed deciding double vote. These research cross-checks do not expand the automatic BBC/Wikipedia allowlist. No accessible BBC Episode 8 recap was found by the existing source retrieval. Two agreeing sections of one Wikipedia revision are structured corroboration, not independent publishers; the configured verification policy remains unchanged.

## Imported facts and pending dependencies

Import Miranda’s murder and a partial, stably identified Round Table (`ep8-table-1`). The former awards ten survival points and three murder points in total. The latter currently awards zero points: no known vote targets a Traitor, voting is incomplete, and no elimination is confirmed. Miranda remains on 25 raw points / 50 contributed points; Ava becomes Joanne’s 20 + Miranda’s 50 = 70.

Expected totals from this revision: Talia 44, Joe 75, Alex 67, Apala 77, Reuben 44, Julian 68, Ava 70. Previously scored Episodes 1–7 and the draw are unchanged.

The exact missing facts are Kenny’s final re-vote (and its duplicated ballot), the complete final tally, and the announced outcome/banished contestant and role if applicable. A permitted source publishing those facts with consistent cast/voting evidence can resolve the same event on a subsequent scheduled check. Until then no zero-vote, banishment, related team or elimination-survival points are awarded. The pending outcome blocks later dependent state changes; unrelated facts may still be retained. The workflow report records both the missing per-round voter and outcome dependency.

## Implementation and limits

`powered-voting.cjs` recognises explicit linked double-vote evidence and weighted tied voting columns generically, without Episode 8 or contestant-name branches. Extra ballots, re-votes and the pending/final outcome have separate fields. Stable table identities allow monotonic backfill, preserve recorded ballots and prevent duplicate bonuses. Scoring caps correct-Traitor votes at +2 per table across all ballots using historical roles. Extra ballots affect received votes; incomplete records withhold zero-vote bonuses. Unknown/negated powers, unexpected outcomes and conflicting historical ballots remain pending. The rules tab and existing vote-history dialog explain/display these facts without changing the league table or Round Table layout.

This does not establish universal extraction reliability. Other powers, missing footnotes, unknown attendance/tie procedures and source reorganisations still require explicit adapters or manual verified evidence. A continuation recorded under a different episode, rather than filling the original table columns, may require verified cross-episode identity/chronology evidence; this adapter does not invent that relationship. Synthetic tests of a later completed tally prove backfilling for the supported source structure, not the real cliffhanger result.

Regression coverage includes all ballot/role combinations, weighted tallies and ties, partial scoring, missing extra ballots, stable resolution and duplicates, source regression, later-event dependencies and a simulated future episode. Golden replay fixtures were computed with the engine from commit `d00d4b3` before modifications and compare all contestants’ categories, raw/contributed scores, roles and statuses through each of Episodes 1–7. Production data is imported by the live workflow, not hand-edited from a test fixture.
