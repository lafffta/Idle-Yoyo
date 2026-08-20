# Attempts are never automated

## Amendment: Performances were superseded

ADR 0017 supersedes the repeatable Performance design in ADR 0015. The standing rule in this ADR survives: Attempts remain player-initiated and are never automated. The presence-bonus analysis below is retained as the reason for the original decision, but it no longer governs the active layer because successful Attempts Land new content rather than pay rate.

No Kit, no Gear and no future machine ever performs a Trick on the player's behalf. Attempting is the one thing in the game that stays manual forever.

This is a standing rule rather than a description of the current build, and it is written down because the game's own internal logic argues for the opposite. ADR 0006 makes automation the thing Kit does — "automation is a one-way door" — and `CONTEXT.md` says of the Auto-Thrower that "owning one is what makes the game idle rather than active". A Kit item that Attempted for you would look entirely consistent with both. It would also be a mistake, and one that would look like a natural extension right up until it shipped.

The reason is that ADR 0015 makes the Trick ladder the answer to "why would I be present". If a machine ever Performs, the active layer closes and the game is back to the finding at #72 — a loop with nothing in it but waiting — except one Yoyo tier later, with content built on top of the assumption that the layer stayed open. The ladder is content, and automating content means never seeing it.

## Bonus for presence, never penalty for absence

The rule above says what may not be automated. This one bounds what the active layer is allowed to be worth, and it is the constraint that keeps ADR 0002 honest now that a present player can out-earn an absent one (ADR 0015).

**The passive baseline stays the thing the game is balanced around.** Gear and the permanent Trick multipliers carry progression; performance income is a topping that a present player enjoys. A player who takes the game at its word and leaves for eight hours must come back to exactly what the simulation said they would earn, and must not find they have fallen behind a schedule the game set for them. Someone who sat and played gets a little extra. Nobody is punished for the absence an idle game exists to make safe.

ADR 0002 calls the moment the game stops being a clicker and becomes an idler "deliberate and worth protecting". Automating Attempts would protect it by emptying the game. This is how to protect it while leaving something there.

## Considered Options

- **A very late Kit item that Performs for you** — the school of thought that the final reward for mastering a system is being freed from it, and the option most consistent with ADR 0006 read on its own. Rejected because the Trick ladder is content rather than a chore, and because it would reopen #72's finding one tier up rather than resolving it. Recorded rather than dismissed: it is a legitimate design position, and this ADR is the place where it was declined on purpose.
- **A player-set policy — "always perform the biggest that fits"** — much less clicking and honest to the genre. Rejected because it is this same automation by the back door, and because ADR 0015's decision is the partition rather than the selection, which a single policy line cannot express anyway.
- **Leaving it undecided until it comes up** — rejected because it comes up as a natural-looking feature request at exactly the moment the active layer starts to feel repetitive, which is the worst moment to be reasoning about it for the first time.

## Consequences

The gap between a present and an absent player is permanent and grows with the ladder. It must therefore be sized deliberately at every tier rather than allowed to emerge, and the tuning harness is where that is checked — the premium sweep ADR 0015 requires is also the measurement of this gap.

An absent player is never the wrong way to play. Any future readout, summary or shop copy that frames absence as a loss contradicts this ADR, including the Absence summary, which reports what was earned and should never report what was missed.
