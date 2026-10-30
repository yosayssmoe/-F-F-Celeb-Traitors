# Episode 9 investigation — 30 October 2026

The scheduled morning run [41042265890](https://github.com/yosayssmoe/-F-F-Celeb-Traitors/actions/runs/41042265890) checked through Episode 10 but changed pending metadata rather than scores. The requested fresh retrieval [41054619610](https://github.com/yosayssmoe/-F-F-Celeb-Traitors/actions/runs/41054619610), dispatched with `deploy_current=false`, reproduced the failure. The public dataset matched the committed data: this was an evidence-adapter limitation, not a missed Pages deployment.

The initial-tie expression did not recognise “results in a tie”. More substantially, the adapter deliberately left a re-vote published under a later episode unassociated. That left the Episode 8 outcome pending and blocked dependent scoring. The Episode 9 chronology graph also lacked the relationship between Joanne's banishment and Sharon's subsequent murder. Repeating the existing checker could not resolve these gaps.

## Evidence and supported fix

Pinned Wikipedia revisions [1382740076](https://en.wikipedia.org/w/index.php?oldid=1382740076) and [1382810873](https://en.wikipedia.org/w/index.php?oldid=1382810873) agree on the extracted scoring facts. The latter corrects the description of James Acaster's unshown ballot; the parser treats that ballot as unknown under both descriptions. The [BBC Episode 9 recap](https://www.bbc.co.uk/news/articles/ckr5y12r081zo) independently describes the deciding doubled vote, Joanne's departure, the subsequent turret visit and Sharon's murder, followed by James's confession and unanimous banishment. The normal 30-minute maturity policy and configured corroboration policy remain in force.

The generic continuation adapter requires a linked footnote naming the original episode, destination episode and power holder; the verified initial weighted tie; linked second-vote restrictions for both tied contestants; consistent final weighted tally; and agreement between banishment and cast finish. Adjacent columns alone cannot establish a continuation. Attendance at the deciding vote establishes that a subsequently murdered player was alive at that table. No prose mention order is used as chronology.

The completed table is scored once in the episode where its outcome is revealed (Episode 9), retaining its original `ep8-table-1` identity, event ID, original ballots and explicit `outcome.startedEpisode: 8`. A migration requires the existing table to remain pending and last in the scored history, with no manual protection or changed published ballots. Its previous record is retained in the audit. Later dependent history prevents automatic migration. Repeated imports are unchanged. The scoring engine, allocations, historical roles, Miranda multiplier and dashboard layout are unchanged.

## Results and remaining gaps

Newly verified: Joanne McNally's banishment after Kenny's doubled deciding vote (5–4); Sharon Rooney's subsequent murder; James Acaster's banishment and seven known votes. The first table contains ten original ballots, eight re-votes and Kenny's extra ballot in each round. Both rounds form one table and cannot duplicate correct-vote bonuses.

| Participant | Before | After | Change |
| --- | ---: | ---: | ---: |
| Talia | 44 | 44 | 0 |
| Joe | 75 | 89 | +14 |
| Alex | 67 | 83 | +16 |
| Apala | 77 | 92 | +15 |
| Reuben | 44 | 44 | 0 |
| Julian | 68 | 81 | +13 |
| Ava | 70 | 70 | 0 |

All historical episodes are reparsed by the live checker. Episodes 1–7 retain their published events and votes; Miranda's Episode 8 murder is unchanged. Episode 8 becomes complete, and Episode 9 remains partial: James Acaster's own ballot was not shown, and there is no independently verified exemption from voting. No ballot or exemption is invented. The seven known votes and confirmed elimination score, but every zero-vote bonus at that table is withheld. Miranda remains 25 raw points ×2 = 50 contributed points. Episode 10 has no confirmed published results at the time of this investigation; no murder, winner or final outcome is inferred.

## Validation

15 scoring/data tests, 13 episode-update tests and 121 automation tests pass. New regressions cover real normalized source facts, negative/missing continuation evidence, weighted tallies, manual protection, historical ballot preservation, later dependent history, future episode numbers, incomplete voting, safe synthetic backfill and repeat-import idempotence. The fixture stores normalized table facts and attributed verification footnotes, with paraphrased test prose; synthetic corrections are explicitly labelled.

The live dry run selected mature revision 1382740076 only after confirming identical extracted facts and chronology against latest revision 1382810873. It proposed the three verified additions/backfills and the totals above while retaining the James ballot and Episode 10 gaps. Production imports and public verification are recorded in the final workflow report and browser verification artifact.
