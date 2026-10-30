# Verified finale import — 30 October 2026

The confirmed show winners are **Romesh Ranganathan and Sebastian Croft**, each receiving the existing +5 winner bonus. Sweepstake standings are **PROVISIONAL** because James Acaster's Episode 9 ballot remains unshown, with no verified voting exemption. All zero-vote bonuses at that table remain withheld. No other outstanding score-affecting event was found in the series review.

## Evidence

The [Guardian finale liveblog](https://www.theguardian.com/tv-and-radio/live/2026/oct/30/the-celebrity-traitors-finale-live) reports the individual contestant ballots and re-vote. Its [earlier entries](https://www.theguardian.com/tv-and-radio/live/2026/oct/30/the-celebrity-traitors-finale-live?page=with%3Ablock-6ae506298f08964d851bd5a1) cover Maya and Leigh-Anne. The [Sun's independent outcome report](https://www.thesun.co.uk/tv/40860902/celebrity-traitors-winners-romesh-ranganathan-bash-james-blunt/) corroborates both winners and the elimination sequence, including Kenny's tied vote and James Blunt's subsequent banishment. Its initial search excerpt was incomplete; the complete article confirms two winners, not three.

[Wikipedia revision 1382891180](https://en.wikipedia.org/w/index.php?oldid=1382891180), timestamp 21:25:31 UTC, independently records Michael's murder, Maya's six ballots and the remaining cast finishes. Its Episode 10 voting table is incomplete: later fire-pit ballots are taken from the explicitly reviewed live reporting, not inferred from the cast table. Official BBC finale reporting was sought but no accessible indexed finale result was available during this review. The [BBC Episode 9 recap](https://www.bbc.co.uk/news/articles/ckr5y12r081zo) and reporting of the BBC's welfare statement do not establish James Acaster's own ballot or an exemption; neither is invented.

The reproducible reviewed episode package is [examples/episode-10-verified.json](examples/episode-10-verified.json). It uses the existing episode import schema and replay engine. Its complete-episode status refers to Episode 10 alone, not the whole series. Importing it through `EpisodeUpdates.prepare` validates all chronology and records the previous dataset, source links and changes in the episode audit. The resulting episode is protected from automated replacement by Wikipedia's incomplete table. A protection notice in a workflow report is not itself a missing scoring event; unreviewed manual modifications/deletions and genuinely incomplete records still remain pending.

## Chronology and ballots

| Order | Verified event | Ballots and outcome |
| --- | --- | --- |
| 1 | Michael Sheen murdered | Before the final Round Table; Maya and Kenny are the active Traitors. |
| 2 | Maya Jama banished | Maya and Leigh-Anne vote Romesh; Sebastian, Romesh, James Blunt and Kenny vote Maya. 4–2. |
| 3 | Leigh-Anne Pinnock banished | Leigh-Anne votes Romesh; Kenny, Sebastian, Romesh and James Blunt vote Leigh-Anne. 4–1. |
| 4 | King Kenny banished | Romesh and Kenny initially vote James Blunt; James Blunt and Sebastian vote Kenny. 2–2 tie. Eligible re-voters Sebastian and Romesh then both vote Kenny. One table, one correct-vote award per eligible Faithful. |
| 5 | James Blunt banished | Romesh and Sebastian vote James Blunt; James Blunt votes Romesh. 2–1. |
| 6 | Romesh and Sebastian win | Both remaining players confirmed Faithful; +5 each. No invented elimination or survival point. |

End-game choices about ending play or banishing again are distinct from contestant-name ballots. They create no scoring event and earn no correct-Traitor-vote bonus. James Blunt's request to continue at the final three precedes his separate contestant-name ballot. The Kenny re-vote belongs to his tied table, while the Maya, Leigh-Anne and James Blunt banishments are separate tables. All four tables have complete relevant voting, so their zero-vote bonuses can safely score. No Dagger power is carried forward from its earlier table.

## Series review and reconciliation

Episodes 1 and 2 previously lacked coverage records. Their descriptions and the [BBC Episode 2 recap](https://www.bbc.co.uk/news/articles/czxe30796xno) confirm starting roles only in Episode 1, and the already recorded Amol murder/James recruitment in Episode 2, with the first banishment revealed in Episode 3. Coverage records are now explicit; every earlier scoring event, ballot, identifier, role, allocation and previously earned point is unchanged. Episode 3–8 coverage remains complete. Episode 9 remains partial solely for James's missing ballot.

| Participant | Before finale | Provisional after finale | Gain |
| --- | ---: | ---: | ---: |
| Alex | 83 | 116 | +33 |
| Julian | 81 | 103 | +22 |
| Joe | 89 | 99 | +10 |
| Apala | 92 | 97 | +5 |
| Ava | 70 | 70 | 0 |
| Reuben | 44 | 44 | 0 |
| Talia | 44 | 44 | 0 |

Romesh has 53 raw points and Sebastian 55; both include 20 survival points and +5 winner points. James Blunt has 43, Kenny 51, Maya 40, Leigh-Anne 38 and Michael 32. Miranda remains 25 raw ×2 = 50 contributed points. All celebrity category sums, history logs and participant contributions reconcile through the existing engine. The scoring engine, rules tab, artwork, league table and breakdown/history layout are unchanged; only the final/provisional label is added.

## Validation

15 scoring/data tests, 13 episode-update tests and 127 automation tests pass (155 total). Finale regressions cover the real reviewed ballots, chronological eligibility, category/contribution reconciliation, two co-winners, duplicate prevention, repeat-import idempotence, the Kenny re-vote cap, separate tables, rejection of continue/stop as contestant ballots, retained manual evidence, incomplete historical voting, and the FINAL/PROVISIONAL boundary. A completeness flag alone cannot make an actually missing ballot final. Synthetic complete-series coverage in tests is explicitly labelled and is not imported as a real result.

Local browser reports, the reviewed import report and public verification receipts are retained in `automation-output/finale-20261030/`; screenshots are under `test-results/`. Production deployment details follow after the workflow and public checks complete.
