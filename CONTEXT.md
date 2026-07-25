# Idle Yoyo

An idle game in which the player throws a yoyo and earns value while it spins at the end of the string. The theme is literal rather than decorative: a sleeping yoyo is the idle mechanic.

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

## Gear

**Throw Power**:
The Spin a Throw starts with. The player's primary measure of strength.
_Avoid_: Strength, force, launch power

**Bearing**:
The component governing how quickly a Sleeper loses Spin. A better Bearing keeps the yoyo alive longer.
_Avoid_: Friction, decay, axle
