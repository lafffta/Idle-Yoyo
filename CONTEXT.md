# Idle Yoyo

An idle game in which the player throws a yoyo and earns Style while it spins at the end of the string. The theme is literal rather than decorative: a sleeping yoyo is the idle mechanic.

## Language

**Throw**:
The player action that starts a Sleeper. Sets the yoyo's Spin to its starting value.
_Avoid_: Launch, drop, cast

**Sleeper**:
A yoyo spinning at the end of a fully extended string rather than returning to the hand. The state in which the yoyo earns.
_Avoid_: Spinning, idling, hanging

**Spin**:
The rotational energy remaining in a Sleeper. Decays over the life of the Sleeper.
_Avoid_: Energy, charge, RPM, momentum

**Dead Yoyo**:
A yoyo whose Spin has reached zero. Earns nothing until the next Throw.
_Avoid_: Stopped, expired, asleep

## Loop

**Rewind**:
The period after a Dead Yoyo during which the string is wound back up. Earns nothing.
_Avoid_: Recovery, cooldown, downtime

**Throw Cycle**:
One full Throw, Sleeper, Dead Yoyo and Rewind, from one Throw to the next.
_Avoid_: Round, loop, iteration

**Uptime**:
The fraction of a Throw Cycle spent as a Sleeper rather than in Rewind. The ceiling on sustained earnings.
_Avoid_: Efficiency, duty cycle, activity

## Earning

**Style**:
The currency a Sleeper earns, at a rate proportional to its current Spin. The game's only currency — there is no second economy and no prestige currency.
_Avoid_: Points, score, coins, cash, money

**Sustained Style**:
Style per second averaged over a whole Throw Cycle: peak rate multiplied by Uptime. The headline figure on screen, and the number every purchase decision turns on.
_Avoid_: Income, SPS, DPS, average rate, earnings

## Gear

Gear belongs to the current Yoyo. It is bought with Style and lost on Retire.

**Throw Power**:
The Spin a Throw starts with. The player's primary measure of strength.
_Avoid_: Strength, force, launch power

**Bearing**:
The component governing how quickly a Sleeper loses Spin. A better Bearing keeps the yoyo alive longer.
_Avoid_: Friction, decay, axle

**Rewind Speed**:
How quickly the string is wound back up after the yoyo dies. Together with the Bearing, it governs Uptime.
_Avoid_: Reel speed, recovery rate

## Kit

**Kit**:
Equipment belonging to the player rather than to any one Yoyo. Kit survives every Retire. The distinction from Gear is load-bearing, not cosmetic: see ADR 0006.
_Avoid_: Inventory, tools, permanent upgrades

**Auto-Thrower**:
A machine that performs a Throw on the player's behalf when the yoyo dies. Owning one is what makes the game idle rather than active. Kit, not Gear — automation is a one-way door.
_Avoid_: Auto-clicker, automation, bot

## Tricks

**Trick**:
A named manoeuvre performed during a Sleeper. Landing one for the first time multiplies Style permanently, online and offline alike, and survives every Retire.
_Avoid_: Skill, move, combo, ability, perk

**Attempt**:
Starting a Trick on a live Sleeper. Drains Spin for the Trick's duration; the outcome is fully determined at the moment of the Attempt, never random.
_Avoid_: Try, activate, cast, roll

**Land**:
To finish an Attempt with Spin still remaining, learning the Trick. An Attempt whose Spin runs out instead produces a Dead Yoyo early and teaches nothing.
_Avoid_: Complete, succeed, unlock, acquire

**Division**:
A family of Tricks, named for the real competition divisions: 1A, 2A, 3A, 4A, 5A. Each Division is its own linear ladder, opened by reaching a given Yoyo.
_Avoid_: Style (taken by the currency), category, branch, tier

**Structural Trick**:
An uncommon Trick that changes the shape of the Throw Cycle rather than multiplying Style. Constrained by ADR 0003: a Structural Trick may never touch Uptime.
_Avoid_: Special, unique, modifier, mutator

## Retirement

**Retire**:
Trading the current Yoyo for the next one up. Clears Style and Gear; keeps Tricks and Kit. The game's only prestige action.
_Avoid_: Prestige, ascend, rebirth, reset, reincarnate

**Yoyo**:
The instrument currently in hand, one of twelve tiers. Sets the base values that Gear builds on, and gates which Divisions are open.
_Avoid_: Level, rank, stage, prestige level
