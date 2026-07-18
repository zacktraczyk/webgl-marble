# Marble local MVP

## Sitemap

| Screen        | Route                             | MVP responsibility                                                                                                                  |
| ------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Race library  | `/`                               | List races saved in this browser, preview the first leg, and open a race to edit or play.                                           |
| Race builder  | `/race-builder?race=:id`          | Name a race, choose its starting team count, add/order/duplicate/delete legs, and show whether the race can produce one winner.     |
| Leg builder   | `/leg-builder?race=:id&leg=:id`   | Load one serialized leg into the leg builder, save edits locally, and preview that leg with the race's marble rules and era finish plan. |
| Race view     | `/race?race=:id`                  | Play legs in order, eliminate the last marble after each leg, rebuild the remaining field in the next leg, and announce the winner. |
| Developer Lab | `/dev/`                           | Keep the original physics, collision, rendering, and race prototype screens available for local development.                        |

## MVP rules

- Race documents and leg geometry are stored in `localStorage` on the current device.
- A race begins with 2–12 teams and needs exactly one fewer leg than teams.
- Every race picks a starting marbles-per-team value from a fixed ladder (default 60). Later legs redistribute eliminated teams' marbles onto survivors.
- Each leg is a fresh physics simulation. Marble entity IDs and positions are not carried between stages; the next leg creates a new field for every remaining team.
- A leg ends when every marble except one has finished or left the course. The team that owns the remaining marble is eliminated.
- A manual **Skip leg** control lets the player move past an authored course that cannot finish; normal legs wait for the true one-marble elimination condition.
- Publishing, accounts, remote storage, deterministic replays, and social features are deliberately outside this MVP.
