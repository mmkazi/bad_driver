# Bad Driver demo milestones

## Working direction

Build 006 experiment: **Everyone drives** gives 2–4 weighted full-control seats to drivers and the saboteur, now with bots, standard-mapped gamepads and peppier arcade handling. Original **Split wheels** stays selectable. A fixed narrow shortcut rejoins the broad forest loop before the village gate. Next playtest: physical controllers, whether disagreement feels controllable, whether the .5 / .5 / .5 / .5 weighting is fun, and whether players discuss the fork. Dynamic route advantages are not implemented yet. The earlier optional boost/handbrake role below is an older proposal, not the new mode.

A local 3–4 player party game: two players control left/right wheel power, an optional third driver controls boost and handbrake, and a known saboteur triggers trouble. Rotate roles between short rounds.

Platform: a browser-based, low-poly 3D game with a shared third-person chase camera. Begin with keyboard controls and add gamepads before the group playtest. Online multiplayer is outside the first demo.

Use an arcade-tuned rigid chassis with suspension: wheel-power requests ramp toward their target; left/right imbalance produces turning. In the air, preserve full pitch, roll, and angular momentum. Values are provisional until playtested.

## Build 002: perspective and elevation experiment

Implemented following feedback on the first sandbox, before racing/scoring:

- Perspective chase camera with adjustable distance, heading follow, and a level horizon during rolls.
- An eight-metre climb, an exposed elevated bend, and a descent to the braking challenge.
- Cannon-es rigid chassis, four suspension rays, physical road contacts, and airborne rotation.
- Automatic checkpoint recovery after a settled upside-down landing; upright falls remain playable.
- A clifftop shortcut and height/contact HUD for quick experiments.

The full direction remains exploratory. Next playtest should assess camera comfort, climbing, low-speed turning, and recoverability after a fall before committing to the full race course.

## Build 003: the scenic route

Implemented as the next course experiment:

- 577 metres of road and six ordered checkpoint gates.
- The existing elevated ridge followed by a lakeside left bend and a 54-metre wooden crossing.
- Road tapers from 14 metres to 7 metres on the bridge, with physical low rails and a water recovery zone underneath.
- Broad woodland bends and a gentle two-metre rise before the finish stopping box.
- Route mini-map, advance warning signs, dry checkpoint recovery, and a bridge practice shortcut.

Traffic, moving drawbridges, tunnels, scoring, and sabotage remain future milestones. Next playtest: whether the course stays readable from the chase camera and whether the narrow crossing adds useful coordination pressure.

## Build 005: meet the locals

- Extended course: 1,191 metres, nine gates, extra forest turns, village street and five-metre orchard hill with downhill finish.
- Light two-way traffic joins and exits using curved depot roads; six-car pool with distance-gated spawning/despawning.
- Lane-following rigid collision bodies, headway braking and brake lights. No overtaking or full NPC suspension yet.
- Village shops, orchard, windmill, depots and updated route map; Village traffic practice shortcut.
- Four-minute rounds for the longer route. Saboteur driving-role changes deferred until the user syncs with their friend.

## 1. Make shared driving fun

Status: implemented as a playable local sandbox; awaiting a two-person handling/fun playtest. Includes a solo mode, three guided practice challenges, and adjustable response, turning, and grip. Physics checks and browser integration checks are included in `tests/`.

- Build a flat practice area with cones, barriers, and one car.
- Implement independent left/right accelerate and brake/reverse inputs.
- Add a following camera, visible power gauges, reset, and adjustable handling values.
- Include a solo test mode that lets one person operate both sides.

Done when: two people can deliberately drive straight, turn, stop, and recover from an overcorrection, and can understand why they lost control.

## 2. Make it a race

- Build a short road loop with checkpoints, a finish, and a round timer.
- Add collisions, damage, off-road slowdown, and quick recovery from getting stuck.
- Track checkpoint progress once per round; add finish, time, and remaining-health bonuses.
- Add restart and a basic results screen.

Done when: a complete round can be played and restarted without developer intervention, with no repeatable checkpoint rewards.

## 3. Add the saboteur

Build 004 implements the first playtest: known third player, warned left/right power surges and temporary grip loss, regenerating energy, shared surge cooldown, recovery protection, three-minute rounds, and a basic results screen. Effects can also be tried in practice. Tire grip loss replaces placed oil slicks for this experiment. Scoring/attribution and the actual three-person fun/balance playtest remain open.

- Add a separate saboteur control panel, regenerating budget, and cooldowns.
- Start with a warned wheel-power surge and an oil slick.
- Add sabotage scoring with capped incident rewards so repeated contact cannot farm points.
- Tune warnings and durations to allow driver counterplay; protect recovery from immediate repeated hits.

Done when: three people can play a full round, sabotage requires timing, and drivers can sometimes save themselves.

## 4. Build the signature course

- Sequence a wide road with two-way traffic, a drawbridge, a tunnel, a climbing curve, an overpass, and a downhill finish.
- Add saboteur drawbridge activation with a warning and cooldown.
- Support real elevation and falling from the overpass onto an earlier road section.
- Keep the lost-progress section short; preserve earned checkpoints without allowing route skips or repeat rewards.

Done when: every section is drivable, the fall-and-redo route works, and the course takes roughly three minutes in an ordinary successful run.

## 5. Make it a party demo

- Add the optional boost/handbrake driver for four-player sessions.
- Add gamepad support, input assignment, readable role instructions, and role rotation.
- Compare individual totals after each player has had equal opportunities in each role.
- Add cartoon scenery, car lean, tire effects, collision sounds, and clear hazard cues.
- Verify three- and four-player sessions; retain keyboard and solo testing options.

Done when: friends can start, understand their roles, complete a full rotation, and replay without explanation from the developer.

## Scope and checkpoints

- Playtest after milestone 1 before expanding the course. Shared driving is the central uncertainty.
- Milestone 3 is the earliest demo worth showing the friend; milestone 5 is the polished demo.
- Defer hidden traitors, online multiplayer, multiple courses, realistic suspension, and progression systems.
- Revisit the optional third-driver role if boost/handbrake feels less engaging than left/right power.
