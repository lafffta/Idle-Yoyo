# Mounts open Divisions with soft forks

This decision supersedes ADR 0015's repeatable Performances. Landed Tricks remain non-repeatable content; ADR 0016's standing rule that Attempts are never automated remains in force.

A Division is an open arrangement of Tricks reached through Mounts, not one linear ladder. A Mount is the string configuration a yoyo is in, and determines which Tricks are reachable from it. Once a Mount is reachable, its Tricks may be Attempted in any order.

The opening 1A Tricks remain an ordered spine. Rock the Baby, Man on the Flying Trapeze and Brain Twister still teach the Attempt in sequence; Mounts open the Division only where there is a choice worth making.

A Mount is authored structure, not state the player enters. There is no commitment action and no hard lock. Which Mount a player is pursuing emerges from the Tricks they Land.

## Why open the ladder

A linear ladder combined with an exact preview does not offer a decision. Only one Trick is available, its outcome is known, and the player's correct move is to wait until it is safe and press Attempt. The playtest recorded in #72 established that comprehension was not the problem: players understood the Attempt and read a failed one as their own decision. What failed was that there was nothing to choose.

Mounts put several known outcomes in view at once. A Sleeper's finite Spin can reach some of what is offered but not all of it, so the player chooses which reachable Trick matters now rather than waiting for the next row to become safe.

## The fork is soft

The fork is enforced by time and the Gear cost curve, not by a rule or a resource. Tricks in different Mounts sit far enough up the curve that an early run can realistically work through about one Mount before Retire, but nothing forbids reaching another when a run lasts long enough.

No currency or per-run resource exists to enforce the choice. ADR 0005 keeps Idle Yoyo to one currency and rejects a prestige currency; inventing another resource whose only purpose is to say no would reopen that decision without adding play.

A soft fork is sufficient because Tricks are permanent and survive every Retire. A player can collect Tricks from a passed-over Mount on a later run, so the current run contains a meaningful choice without making that choice permanently regrettable.

This is not re-landing. ADR 0005 rejects resetting Tricks because repeating the same content each run would turn permanent progression into a chore. Mounts instead let successive runs Land different Tricks; a Trick already learned remains learned.

## Structural Tricks carry the choice

Fixed Spin-drain multipliers cannot keep a Mount meaningful across the game. Attempt cost falls with the Bearing's geometric reduction to decay while the Spin budget rises with Throw Power. At final Gear in the current tune, even the hardest existing Trick costs about three-tenths of one percent of a Throw. More rows built from the same multiplier would eventually stop gating anything.

Structural Tricks retain meaning because they change the shape of the Throw Cycle rather than adding another number that Gear can outgrow. The constraint in ADR 0003 remains binding: no structural effect may touch the Uptime lever. New effects refer to that decision rather than restating or weakening its argument.

## Consequences

- The 1A Division has an ordered spine for teaching and Mounts for choice.
- Several Tricks may be reachable at once, while exact previews and deterministic outcomes remain unchanged.
- The cost curve is responsible for making the fork meaningful; the tuning harness must measure whether it does.
- Mounts add no player state. Landed Tricks remain the permanent facts from which progression is derived.
- Later runs revisit passed-over Mounts to Land different Tricks, never to re-land old ones.
