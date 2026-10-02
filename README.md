# Bad Driver

A local cooperative driving experiment. Build 006 adds an alternative Everyone drives scheme and a forest fork to the 1,191-metre main route. The original Split wheels scheme, tuning and sabotage powers remain available.

## Courses

Use the **Course** dropdown in the top bar. Changing courses restarts practice;
it is disabled during a timed round. Both courses support both control schemes,
bots, and controllers.

- **Sunny Side Highlands**: the original village/traffic course, unchanged.
- **Pinewater Pass**: a roughly 3 km mountain-lake course. Dense forest hides a
  return-to-start loop; two solid tunnels connect the upper and lower shores;
  a concealed turnaround and a shoreline loop make the choices less obvious.
  Cross the bridge to the island and stop at the flag to finish. Timed runs allow
  ten minutes. This first version has no traffic and hides the route overview
  to preserve the surprise. The practice jump buttons can skip to scenic sections.

Pinewater can be linked directly with `?map=pinewater` (also on GitHub Pages).
Its hand-placed landmarks and comments are in `src/pinewater.js`; the original
course is preserved in `src/sunnyside.js`. To inspect scenery without driving,
open `/tests/pinewater.html?map=pinewater` on the local server.

## Everyone drives experiment

Select **Everyone drives**, choose 2–4 players, and adjust individual weights if desired. Every seat has full steering, accelerator and brake/reverse. The final active seat is the known saboteur and uses ordinary controls rather than ability buttons.

| Seat | Gas | Brake / reverse | Steer |
| --- | --- | --- | --- |
| P1 | W | S | A / D |
| P2 | Up | Down | Left / Right |
| P3 | I | K | J / L |
| P4 | T | G | F / H |

Presets: four seats = .5 / .5 / .5 / .5; three = .8 / .8 / .6; two = 1.4 / .7. Inputs are summed, not averaged: three .5 inputs versus one opposing .5 input produce exactly normal strength. Above ±1, a soft limit approaches ±1.35. Gas and opposing brake cancel in the same signed drive channel; hold net braking through a stop to reverse. Steering is speed-sensitive desired yaw, with supported-car stabilization. No stationary pivoting; reverse reverses steering. Collisions briefly release stabilization and airborne rotation remains physical. Arcade handling uses a separate fixed baseline (.1-second power response, turning 1, grip 1), leaving the original handling knobs unchanged; camera distance is shared.

**Solo rehearsal** uses WASD at weight 1, ignores every other seat and bypasses crew weights. It is labeled in results. This is for handling tests, not a simulated party. Keyboard rollover can prevent some simultaneous combinations; separate gamepads avoid this limitation. Click the driving view after editing inputs. Scheme, count, weights and rehearsal are locked during timed rounds.

**Try the forest fork** jumps to the choice: straight follows the wide loop, left takes a shorter seven-metre cut-through lined with solid posts. Both rejoin before the same village gate, preserving checkpoint order and unique round credit. The shortcut is marked gold on the mini-map. This is one fixed risk/distance tradeoff; equally good alternatives and changing route hazards are future course experiments.

## Peppier handling and controllers

Everyone drives currently uses a 0.10-second throttle response, a 0.07-second steering response, arcade motor force 21 and lower drag. Its turning multiplier is 1.5, with a low-speed steering-rate cap of 1.375 rad/s. These values were tuned for quick shared-keyboard play; Split wheels keeps its original physics tuning. Driver bots target up to 11.5 m/s on clear road and slow for corners and hazards, leaving players room to go faster.

Connect a standard-mapped gamepad and press a button while the page is focused. In Everyone drives, choose **Controller N** in a seat's dropdown. Left stick or D-pad steers; RT/R2 accelerates; LT/L2 brakes then reverses. Analog triggers and a 15% stick dead zone are supported. Each controller occupies one seat; keyboards, controllers and bots can mix. Controller assignments lock during rounds, disconnects pause the game, and controls must be released after assignment, recovery or resume before driving. Solo rehearsal is still WASD-only. Unmapped devices are detected but not offered until custom mapping support is added. Browser discovery follows the [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API).

## Testing with bots

In **Everyone drives**, click **Me + bots · WASD**. You keep P1; the other active seats become driver bots, with a saboteur bot in the final seat. Each seat can also be switched independently between Keyboard, Bot and connected controllers. Bots use the same weights and ordinary gas/brake/steering inputs as people—no extra grip or position corrections. Original Split wheels is unchanged.

Driver bots update their controls every 0.2–0.35 seconds, slow for sharp turns, narrow/elevated roads and nearby traffic, and brake toward the finish. At the forest fork they guess a route for one second, release both inputs for one second, then guess again until the car commits to either route. A human can persuade them onto the other branch.

Saboteur bots drive normally on safe road. Near traffic, an edge or an elevated section, they choose helping or sabotage with equal probability every 0.5–1.5 seconds. Sabotage aims toward traffic or outwards off the road. **Reveal bot decisions** exposes their current mode for testing; it is hidden by default. Bots pause with the game, reset their decisions after recovery, and are bypassed in Solo rehearsal. Controller choices lock during timed rounds. This is an intentionally imperfect, map-aware prototype, not obstacle-complete AI: it can still get stuck after a bad collision. Reset or use a practice shortcut if necessary.

## Run locally

Requires Node.js 20+ and a modern browser with WebGL. Install with `npm install` (or `pnpm install`), then `npm start`. Open http://127.0.0.1:4173. The server only listens on your own computer. No account or backend is required. All game rendering assets are generated locally; Google Fonts is optional and has system-font fallbacks.

## Publish with GitHub Pages

In the GitHub repository, open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**. Push to `main` (or manually run **Deploy demo to GitHub Pages** from the Actions tab). The workflow installs locked dependencies, runs tests, builds the static game, then deploys it. No personal token or server is needed for the workflow.

For this repository, the expected address after a successful deployment is **https://mmkazi.github.io/bad_driver/**. The Actions deployment result provides the actual published URL. Future pushes to `main` update the demo automatically. This is shared-keyboard play on one computer, not online multiplayer.

`npm run build` creates an ignored `dist/` directory containing only the playable HTML, game modules/styles, browser dependencies and their licenses. Relative asset URLs work at `/bad_driver/` or another subdirectory. Source, test pages, Git metadata and the development server are not deployed. Local `npm start` remains unchanged; visit `/dist/index.html` on the local server to preview the packaged version.

## Controls

| Action | Shared driving | Solo test |
| --- | --- | --- |
| Left wheel power | W / S | W / S, adjusted by A / D |
| Right wheel power | Up / Down | W / S, adjusted by A / D |
| Reset car and practice gates | R | R |
| Pause / resume | Escape | Escape |

Accelerate / brake-reverse buttons request positive / negative power. Actual power ramps gradually. Equal wheel power drives straight; more left power turns right. Solo mode mixes the same two wheel inputs, so tuning carries over. The car pauses when the browser loses focus; inputs clear to prevent stuck throttle. Some keyboards limit simultaneous keys: use solo mode for individual testing if your keyboard drops shared input combinations.

Follow nine mint arches in order: climb the ridge, cross the narrow wooden bridge, wind through the woodland and village, then climb Orchard Hill and descend to the finish box. The bridge narrows to 7 metres; the village widens to 16 metres. A mini-map highlights checkpoints, the player and traffic.

**Clifftop**, **Bridge start**, and **Village traffic** skip to practice sections. **R** restarts the course. Slow before corners, match wheel power on the bridge, and keep right through the village.

Traffic uses two depot-to-depot routes with curved entry and exit roads. Up to six cars share a recycled pool, spawning at least 45 metres from the player and disappearing only inside an exit depot more than 35 metres away. Cars target 8 m/s, brake for vehicles ahead, show brake lights, and physically collide. Their lane-following rigid proxies are stabilized vertically, not full suspension vehicles; they do not yet overtake, signal, or navigate around blockages. Depot walls and roofs, tree trunks, and village shops have player collision proxies. Traffic freezes with pause/help/results and resets with practice shortcuts and new rounds.

The chase camera follows the car's heading with a level horizon during tumbles. Its distance is adjustable alongside response lag, turning, and grip. The HUD shows height above the yard and tire contact.

Cannon-es simulates a compound rigid chassis with four suspension rays and surface-projected tire forces. Grounded steering assistance keeps the differential controls approachable. Airborne cars retain angular momentum and can pitch, roll, bounce, and land. A settled overturned car automatically returns to its last safe checkpoint after 1.8 seconds; an upright landing remains playable on the lower ground. Water falls damp motion and recover to the last checkpoint after brief submersion. The lake has a recessed bed, not an invisible driveable surface. Camera motion does not rotate with chassis roll.

Road widths and lake bounds are shared between rendering and physics. The bridge has open edges with no railings or invisible side barriers. This is an arcade handling prototype, not a full tire or drivetrain simulation. Cones use lightweight knock-over effects; the car, road, barriers, trunks, and building proxies participate in physics. Tree foliage, gate arches, and support pillars remain decorative. Mountains are distant backdrops placed wholly beyond the fenced play area; driveable hillside terrain is deferred. Practice completion has no score or timer yet.

## Three-player playtest

Two drivers share the car; player three uses **J** (left-wheel surge), **L** (right-wheel surge), and **K** (slippery tires), or clicks the matching buttons. Sabotage also works in practice and alongside solo driving. Some keyboards may drop simultaneous keys; the saboteur can use the mouse instead.

Surges cost 35 energy, warn for 1.2 seconds, and last 1.8 seconds. Slippery tires cost 55, warn for 1.4 seconds, and last 3 seconds. The meter starts at 70, caps at 100, and regenerates 8 per second. Left/right surges share a 6-second cooldown; slippery tires have a 10-second cooldown. Cooldowns begin when requested. Only one pending or active effect is allowed. Brake the affected side to oppose a surge; ease off and correct early when grip drops. Airborne cars still receive no tire forces.

Start a **4-minute round** for a full run. The first three seconds are protected. Recovery cancels attacks without refund and provides four seconds of protection. Practice shortcuts, mode switching, reset, and handling adjustments are locked during a round. Pause/help/focus loss freeze physics, traffic, the clock, warnings, effects, cooldowns, and regeneration.

Finish, timeout, or **End run** opens results: unique gates reached, elapsed time, crashes, recoveries, and sabotage requests used. Crashes count contact impacts above a threshold with a 1.5-second debounce; they are not attributed to the saboteur. These are playtest metrics, not balanced team scores. Replay starts fresh; swap roles manually between rounds. The existing tuning controls are under **Find your chaos · handling & camera**.

## Verification

Run `npm test` for physics and gate checks. Dynamics use a fixed 120 Hz update independent of the rendering frame rate.

With the server running, open http://127.0.0.1:4173/tests/browser.html and click **Run checks** for browser integration checks. Keep that tab active while it drives up the hill and across the bridge and checks controls, tuning, shortcuts, pause, sabotage and rounds. Node tests cover all nine gates, recovery physics, traffic lifecycle, spawn/despawn proximity, braking and collisions. Scripted checks do not replace a group handling playtest.

Next uncertainties: driving-role design, physical-controller compatibility and a group fun/handling playtest. Balanced scoring, drawbridge and tunnel/overpass sections remain open; see MILESTONES.md.

For visual regression checks, open `/tests/scenery.html`: inspect the downhill finish, orchard bend and garage wall joints, optionally with an orbiting camera. Scenery unit tests guard mountain clearance, non-overlapping garage geometry, trunk collisions, and rotated garage entrances/back walls.
