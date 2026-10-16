# Mini FC

**Small pitch. Big moments.** A complete, free, six-a-side arcade football game (five outfielders and an automatic goalkeeper per team) for desktop browsers and iPad Safari. Built with Three.js, JavaScript, and Vite. Everything in the stadium is procedural; there are no downloaded models, textures, accounts, API keys, or backend services.

## Play on Windows

Install [Node.js](https://nodejs.org/) **22.12 or newer** (Node 22 LTS recommended), then open PowerShell in this repository:

```powershell
npm install
npm run dev
```

Open the address Vite prints in your desktop browser. For the optimized version:

```powershell
npm run build
npm run preview
```

Use an HTTP server; double-clicking `index.html` does not run the game. The first visit needs network access to load the site. There is no offline service-worker installation.

## Play on iPad through GitHub Pages

No Mac, Xcode, native app, or iOS build is needed.

1. Commit and push this project to the **main** branch of `orangni/Mini-FC`. If your local branch is named `work`, use `git push origin HEAD:main` after checking the remote has no newer changes.
2. In the GitHub repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Open **Actions → Test and deploy Mini FC**. The push triggers the workflow; you can also select **Run workflow** on `main` after enabling Pages. It runs tests, builds, and deploys `dist/`.
4. Use the successful deployment's actual URL on the workflow or Pages settings page. For this repository, the expected URL is **https://orangni.github.io/Mini-FC/**. This is an expected address, not a claim that deployment has happened.
5. Open the deployed HTTPS URL in iPad Safari and rotate to landscape. Optionally use **Share → Add to Home Screen** for more screen space.

Vite uses `base: './'`, so generated assets work under `/Mini-FC/`, another repository subpath, or a custom domain. The game has no client-side routes requiring a server fallback. Pull requests run validation without deploying. Deployment requires GitHub Pages to be enabled and the repository/organization to allow the included Actions.

For same-network development, Vite listens on the Windows computer's network interfaces. You can visit its printed network URL from the iPad if both devices are on the same Wi-Fi and Windows Firewall permits Node on your private network. GitHub Pages avoids needing a running PC.

## Controls

**Simple controls are now the default**, including existing saves without a control preference. Use movement and two action buttons; sprint is optional.

| Action                 | Desktop       | iPad / touch                                                           |
| ---------------------- | ------------- | ---------------------------------------------------------------------- |
| Move                   | WASD / arrows | Floating left stick                                                    |
| Pass / call for a pass | Space or Z    | PASS; executes when pressed                                            |
| Shoot                  | J or X        | SHOOT; executes when pressed, with goal aiming assistance              |
| Tackle while defending | Space or Z    | TACKLE                                                                 |
| Assisted defence       | Hold J or X   | Hold PRESS to approach and tackle; moving manually overrides the chase |
| Sprint (optional)      | Hold Shift    | Hold SPRINT                                                            |
| Pause / resume         | Escape        | Pause / Resume                                                         |

Simple mode brakes sooner, turns faster and keeps dribble touches closer. Shots aim towards goal independently of movement, with reduced placement error; position, pressure and attributes still matter. Aim a pass with movement, or release movement for an automatic target; a green ring previews the receiver. Tapping just before reception buffers an action for up to 500ms. A career captain automatically steps towards an incoming pass when movement is released. In Kick Off, starting PRESS when your defender is more than eight metres away deliberately selects a closer defender once; holding it does not repeatedly switch. **Career always stays locked to your created player.**

Settings → Controls → **Advanced** restores all techniques and the original momentum, directional shooting and charge gestures. The choice persists and can be changed while paused.

| Advanced action                   | Desktop                  | iPad / touch                                      |
| --------------------------------- | ------------------------ | ------------------------------------------------- |
| Move                              | WASD / arrows            | Floating left stick; touch the left movement area |
| Sprint                            | Hold Shift               | Hold right-hand SPRINT                            |
| Short pass / call for a pass      | Space                    | Tap PASS                                          |
| Through ball                      | E                        | THROUGH                                           |
| Lobbed pass                       | L                        | Hold PASS for over 350 ms                         |
| Normal / charged power shot       | Tap / hold and release J | Tap / hold and release SHOOT                      |
| Chip shot                         | K                        | CHIP, or swipe SHOOT upwards                      |
| Finesse shot                      | F                        | Swipe SHOOT sideways                              |
| Skill / body feint                | C                        | Tap SKILL                                         |
| Shield                            | Hold V                   | Hold SKILL                                        |
| Standing tackle                   | R                        | TACKLE                                            |
| Sliding tackle                    | X                        | SLIDE                                             |
| Press with teammate support       | Hold P                   | Hold PRESS                                        |
| Switch outfielder (Kick Off only) | Q                        | SWITCH while defending                            |
| Pause / resume                    | Escape                   | Pause button / Resume                             |

You always attack the far goal, towards the top of the screen. The gold ring and marker show your player regardless of kit colour. In Simple, the right-hand buttons show PASS / SPRINT / SHOOT or TACKLE / SPRINT / PRESS, using just one row. In Advanced, the touch buttons change with possession: attacking shows PASS, THROUGH, SHOOT, CHIP and SKILL; defending shows TACKLE, SLIDE, PRESS and (in Kick Off) SWITCH. PASS/TACKLE, SPRINT and SHOOT have fixed lower-row positions. Default tablet targets are 104 × 104 CSS pixels (previously 72 × 72), with larger text and 14px gaps. Compact landscape screens retain at least 64px targets. Movement and actions support simultaneous pointers and release/cancellation; captured buttons remain visible until released. The floating stick starts neutral even at the edge and filters small thumb tremors. Settings → Touch Layout changes button size, opacity and distance from the edge; these settings persist.

Kick Off follows possession and switches to the pass receiver. Select another outfielder with Q. **Player Career stays locked to your created player**, including when a teammate has the ball. Use PASS to call for a pass; goalkeepers always remain automatic. Position chooses your formation role. AI teammates create passing options and forward runs; defenders mark opponents and intercept loose passes. Two separation sweeps prevent coincident footballers from stacking.

Short passes aim at a teammate, through balls lead a run, and lobbed passes travel on a lofted trajectory. Shots have distinct speed, loft and curve. Accuracy depends on Shooting, distance, angle, opponent pressure and power. Chip shots rise above normal shots, finesse shots curve, and overpowered shots sacrifice accuracy. First-touch error and dribbling distance improve with Passing. Shielding slows movement and makes tackles harder; a feint moves the ball carrier sideways, briefly protects possession and has a cooldown. Sliding tackles reach further and knock the ball loose, but leave recovery time if missed. Close-contact tackles require a facing approach to the exposed ball; merely standing nearby does not retry random steals. Deliberate standing tackles have more reach. Shielding protects the back, and missed slides commit movement and recovery. A user first touch has 800ms of contact protection (550ms for AI); winning a standing tackle protects possession for 750ms. Kickoffs leave opponents six metres clear with 1.1 active seconds of protection. In Advanced, early attacking taps buffer up to 350ms for the selected player; aim is sampled with the command. Defensive selection changes only on a deliberate Q/SWITCH press or a new Simple PRESS hold, with a 500ms repeat guard. Career control is always the created captain, even before movement is processed. Exhausted sprint recovers to 24% stamina before sprinting again; normal jogging stays responsive.

Matches last **120 seconds of active play** on a compact 70 × 46 pitch. Kickoffs and pauses stop the clock, including nested touch-layout and asset settings. There is one goalkeeper and five outfield players per side in a 2-2-1 formation. Keepers track shooting angles, anticipate shots, dive, catch slower balls, parry harder shots into rebounds, return to position and distribute possession, favouring open teammates. A keeper holding a catch cannot be tackled or pushed by player separation. Saves cannot cancel a ball that has already crossed the goal line. Side/end boards keep the ball in play. There are no throw-ins, corners, fouls, penalties or offsides.

## Gameplay feel and difficulty

Live matches use a close ball-centered camera (landscape height 33, portrait 40) with smooth tracking. Distance from the career captain never zooms the view out; the captain remains your only controllable player even off-screen. Kick Off retains pass/possession following, but defending requires Q/SWITCH or an explicit Simple PRESS hold to change players and repeated SWITCH taps have a 500ms guard.

Advanced movement accelerates and brakes with a short coast; Simple has quicker braking and turning. Sprint turns cost speed; low-speed and shielding touches keep the ball close, while sprinting takes longer touches. Feints move through velocity rather than teleporting the player. The ball follows damped touches around the carrier, and rendered movement is interpolated between fixed 60 Hz simulation steps.

Aim passes with the movement stick or WASD. Through balls lead a runner into an open lane; receivers anticipate the ball and Kick Off assists a selected receiver when you release movement. In Advanced, direction also biases shot placement; finesse swipes explicitly choose placement. Shots and deliberate tackles reward position/timing. Goalkeepers and tackles use actual contact/reach rather than random save/steal success rolls.

Settings → **Difficulty** offers Easy, Normal (default) and Hard. The preset adjusts opponent decisions, positioning, anticipation, pressure and keeper reaction rather than multiplying running speed. Changes persist and can apply during pause. AI teammates keep passing lanes, make role-specific runs and cover dangerous space. Power shots show a charge/wind-up, and tackles/goals have lightweight procedural feedback.

See [the gameplay report](docs/GAMEPLAY_OVERHAUL.md) for per-file changes, before/after balance measurements, test details and limitations. Raw seeded results are in [gameplay-balance.json](docs/gameplay-balance.json). To reproduce 12 matches per preset, run `npm run balance -- 12` (add `normal` to test just that preset).

## Player career

- Create a named captain, choose Striker, Midfielder or Defender, and choose a starting club. Mini FC retains the original neighbourhood career. Position determines the formation slot without restricting free movement or techniques.
- Start at **60 overall**. Pace improves movement; Shooting improves shot speed and accuracy; Passing improves passes, dribbling distance and first-touch control. Upgrades affect your own footballer; AI teammates use their club ratings.
- Earn **60 XP** per completed match, **80 XP** per win, **30 XP** per draw and **40 XP** per goal from your own shot. AI teammate goals help the team score, without counting as personal goals.
- Every **100 cumulative XP** earns one point. One point buys **+3** to an attribute, capped at 99. Overall is the mean of the three attributes.
- Track your goals, assists, last match rating and lifetime average rating. An assist requires your pass to a teammate who scores before possession is lost or the assist window expires.
- Play five matches in a six-club season group. All six clubs play a complete round robin. Real-club careers choose five opponents from the same league. PSG plays a European invitation group because only PSG is included from France. Other fixtures resolve when you complete your match. Win 3 points, draw 1; tiebreakers are goal difference, goals scored, then club name.
- Win the league for **three bonus upgrade points** and a championship. New seasons preserve your upgrades and lifetime statistics.
- Saves occur after creation, results, upgrades and season transitions. An unfinished match restarts from the career menu after a refresh without rewards or a recorded result. Restarting or quitting never grants XP.

Progress stays in this browser's **LocalStorage**, using the existing `mini-fc-career-v1` key. It does not sync between devices, domains or browser profiles. Clearing site data deletes it; blocked storage produces a visible save-failure message. Settings has a separately confirmed career reset.

**Original saves remain compatible.** Version-1 JSON migrates to version 2 without changing XP, points, attributes, records or current season standings. The first successful migrated save also preserves the original JSON at `mini-fc-career-v1-backup-v1`. Existing careers remain at Mini FC. Historical match ratings, which were not stored in v1, start at a neutral 6.0 baseline. New goals/assists/ratings continue normally. Resetting the career also removes this recovery backup.

## Clubs, roster provenance, and local licensed assets

The database contains **70 real clubs** from the user's supplied 2026/27 list: **20 Premier League, 9 Bundesliga, 20 Serie A, 20 La Liga, and PSG**. The user explicitly requested omitting the other nine Bundesliga clubs. Original Mini FC and Rival FC remain available. Kick Off includes searchable club selection and league filtering. Every club has a stable ID, name, league, home/away colours and pattern, shorts, socks, attack/midfield/defence/goalkeeper ratings and a preferred formation.

Official league sites returned HTTP 403 in this environment. Membership is labelled **user-provided**, not independently verified. Coventry, Hull and Ipswich follow the user's English list; Frosinone, Venezia and Monza follow the supplied Italian list. These have not silently been replaced with a 2025/26 list. Sources to consult when access is available: [Premier League](https://www.premierleague.com/en/clubs), [Bundesliga](https://www.bundesliga.com/de/bundesliga/clubs), [Serie A](https://en.legaseriea.it/serie-a/teams).

The requested Spanish roster includes Barcelona, Real Madrid, Atlético, Betis, Athletic, Sociedad, Sevilla, Villarreal, Espanyol, Valencia, Celta, Alavés, Rayo, Getafe, Osasuna, Levante, Elche, Racing Santander, Deportivo and Málaga. These follow the user's list rather than an independently verified membership list. All 20 have explicit home and away shirt/trim/shorts/socks definitions; Barcelona stripes, Rayo's sash and Elche's chest band use the existing procedural kit renderer. Korean aliases and accent-insensitive search are available for these clubs. New Spanish careers draw their five opponents from the same La Liga roster.

Kits use **recognizable traditional colours and procedural patterns**. Exact 2026/27 kits, sponsors, crests and real-world ratings are **not verified or reproduced**. Ratings are gameplay estimates. Alternate-kit selection uses colour distance; an emergency neutral broadcast kit handles cases where both away choices would clash. No official graphics or scraped images are bundled.

Settings → Local Kit / Crest Assets (also in club selection) accepts your locally licensed PNG/JPEG/WebP files, up to 2 MB each. A crest appears in club selection; a jersey image maps to the shared torso. Images stay in this tab, never uploaded or committed, and reset on refresh. Keepers use contrasting procedural jerseys. An emergency contrast kit can override an away texture to keep teams readable.

## One HTML file

The complete prebuilt game is checked into [`downloads/Mini-FC.html`](downloads/Mini-FC.html) for direct GitHub downloads. On GitHub, open that file and choose **Download raw file**. It includes all 70 clubs and needs no separate assets. To regenerate this downloadable copy after changing the game, run `npm run build:single -- downloads/Mini-FC.html`.

```powershell
npm run build:single
```

This writes `standalone/Mini-FC.html`, embedding the game, Three.js, CSS and icon. Recipients need no package installation, CDN or external assets. On desktop, save it and open in Chrome/Edge. iPad Files/Quick Look can restrict JavaScript; hosting the same file over HTTPS and opening it in Safari is the reliable iPad route. This does not remove iOS file-preview restrictions. Local-file save behaviour depends on the browser; HTTP/HTTPS hosting provides normal per-origin storage.

The cloud's managed Chromium blocks `file://` navigation by administrator policy. Standalone validation therefore uses HTTP while blocking every additional asset request; the HTML itself remains a single self-contained file.

## Performance and compatibility

Modern WebGL2 is required. Players use low-poly geometry, shared box geometry, reusable kit materials, simple lighting and procedural action animations. The crowd uses instancing. There are no shadow maps, postprocessing or external 3D downloads. Pixel ratio caps at 1.7 (1 with Battery saver). The fixed simulation runs at 60 Hz. Lost focus and hidden tabs pause live matches. Touch actions prevent unwanted gameplay scrolling and selection, support pointer capture/cancellation and account for safe-area insets. Portrait works; landscape is recommended.

The aim is 60 FPS on capable devices. Actual iPad Safari hardware and frame rate have **not** been tested; Chromium tablet emulation does not establish real Safari performance. Use Settings → Graphics → Battery saver if needed.

## Tests

```powershell
npm ci
npm test
npm run build
npm run build:single
```

The **85 Node tests** retain all original scenarios, with the player-count expectation and pass fixture updated for 6v6. Added coverage includes keeper catches/parries/distribution/positioning, shot trajectories and accuracy, all pass types, tackle recovery, shielding, feints, pressing, first touch, assists, captain control, role/attribute ownership, exact 70-club membership and kit clashes across every club pair, league opponents, save migration and the v1 recovery backup.

Optional production-browser integration checks require Python Playwright only for testing:

```powershell
python -m pip install playwright
python -m playwright install chromium
npm run build
npm run preview -- --port 4173
# In a second terminal:
python tests/browser_simple.py
python tests/browser_smoke.py
python tests/browser_upgrade.py
python tests/browser_laliga.py
python tests/browser_mobile.py
python tests/browser_gameplay.py
# After npm run build:single:
python tests/browser_single.py
```

Set `MINI_FC_BROWSER` to an existing Chromium executable, `MINI_FC_URL` for another server URL including the trailing slash, and `MINI_FC_ARTIFACTS` for screenshots. The Simple script checks default settings, immediate keyboard/touch actions without release or repetition, pass previews, compact layouts, simultaneous movement/action touches, assisted defending, career lock and persistent control preferences. The smoke script checks keyboard play, goals, pause/resume/restart, results, career XP/upgrades/refresh, full seasons, next season and simultaneous touch movement/sprint. The upgrade script adds search/filtering, alternate kits, local image inputs, charge/swipe shots, lob/through/chip/skill controls, a floating multi-touch stick, contextual tackling, captain lock, a close ball-centered career camera without distance-driven zoom-out and persistent touch layout. The La Liga script checks the 20 Spanish clubs, Korean search, actual rendered home/away patterns and shorts/socks, Spanish career opponents and refresh persistence. The mobile regression script checks six viewport/size combinations, target overlap, joystick neutrality/deadzone, a held shot across possession changes, fixed sprint placement and cancellation ownership. Fairness unit tests cover tackle retry intervals, shielding, catches under pressure, first-touch/kickoff protection, buffered/expired actions, manual switches, sprint recovery and goal-line precedence. Subpath checks can run under `/Mini-FC/` using a static server with `dist` mounted there.

The gameplay browser script adds difficulty persistence and live changes, velocity acceleration/braking, directional input sampling, simultaneous movement and charged aiming, brush rejection, real pointer ownership and orientation pause.

Time and selected season scores are accelerated through the explicit `?test=1` harness. Goal detection and input actions still use the simulation. Some isolated input fixtures freeze AI to prevent an opponent stealing the ball during a touch-gesture assertion. No test global is exposed during normal play.

## Project layout

- `src/match.js` — football simulation, techniques, AI and goalkeepers
- `src/render.js` — procedural pitch, stadium, kits, footballers, animations and camera
- `src/input.js` — keyboard, multi-touch, charge and directional shot gestures
- `src/clubs.js` — supplied club roster, kit definitions, search and colour conflict selection
- `src/career.js` — progression, fixtures, stats, upgrades and save migration
- `src/main.js` — menus, match lifecycle, local asset inputs, audio and settings
- `tools/build-single.mjs` — reproducible self-contained HTML packaging
- `tests/` — simulation/career/upgrade tests and browser integration checks
- `.github/workflows/deploy.yml` — unchanged validation and GitHub Pages deployment

Mini FC includes real club names and the original fictional clubs, with original procedural graphics. It is independent and has no affiliation with EA Sports or the named football organizations. No licensed official graphics are distributed.
