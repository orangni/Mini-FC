# Gameplay overhaul

Follow-up accessibility change: Simple is now the default control scheme. Instant passes/shots, goal aiming assistance, a green pass-receiver ring, quicker braking/turning, closer dribbling, 500ms action buffering and hold-to-defend reduce input demands. The three touch buttons occupy one row. An explicit new PRESS hold can select a closer defender in Kick Off; career never switches. Advanced preserves the original techniques and movement described below. Eight additional simulation tests and `browser_simple.py` cover the new controls; the old charge/gesture browser fixtures explicitly select Advanced. The historical balance figures below were measured with Advanced physics, not human play in Simple mode.

Follow-up camera/control change: live matches now use a close, ball-centered view (landscape height 33, portrait 40), replacing the off-ball captain framing described below. Career control is enforced before movement and always stays on the created player. Kick Off defensive selection is manual, with a 500ms SWITCH repeat guard. The current suite has 85 tests; the balance results below describe the original overhaul checkpoint.

The overhaul improves the existing 6v6 game rather than rebuilding its menus, assets or career system. The 120-second clock, goalkeeper immunity, 70 clubs, kits, v1/v2 save compatibility and large touch controls remain supported.

## Implementation by file

- `src/match.js`: bounded velocity/acceleration and braking; gradual facing with sprint turning cost; Pace scaling; jog-friendly stamina; lateral feints without position teleporting; damped ball following with an orbit around the carrier and speed-dependent touches. Directional teammate selection, open-lane through balls, proper lob flight and receiver interception targets replace nearest-player passing. Normal/power/finesse/chip shots share distance/angle/pressure/attribute accuracy, with directional aim. Tackles depend on reach, facing, approach and shielding rather than dice rolls. First-touch and turnover protection remain.
- `src/match.js` AI: one retained presser and a distinct cover player, lane marking, forward runs, midfield support, deeper defenders, counterattack runs, teammate avoidance and pass/shot/dribble decisions. An AI power shot has a 550ms wind-up that can be interrupted by losing possession. Keepers track angle/curved trajectories, react after a preset delay, advance in uncovered one-on-ones, backpedal under chips and catch/parry according to speed and actual reach. Keepers cannot parry their own distribution or save after the goal line.
- `src/input.js`: movement direction is sampled with actions, so a key/finger release between simulation ticks does not erase aim. A charge retains its latest held direction. Independent pointer ownership, captured context buttons and immediate analog input remain; a swipe across SKILL does not trigger a feint. Orientation changes pause and clear held input.
- `src/render.js`: interpolation between fixed simulation steps, earlier camera tracking with bounded velocity look-ahead, retained off-ball career framing, reused camera vectors, running lean, shot wind-up, tackle posture and charge/tackle ring feedback. No extra stadium meshes, textures, postprocessing or paid assets.
- `src/main.js`: persistent Easy/Normal/Hard presets (also changeable while paused), visible charge percentage, distinct power/tackle sounds and goal-score pulse. Restart announcements fade before play resumes. Interpolation stops during pause/results. Career JSON and reward logic are unchanged.
- `tools/balance.mjs` and `tests/`: reproducible seeded football metrics and regression coverage, plus production browser touch/keyboard checks. `downloads/Mini-FC.html` embeds the final source, CSS and Three.js.

## Difficulty and controls

Normal is the default. Easy/Normal/Hard change decision intervals (roughly 580/340/190ms), positioning error, anticipation, pressure distance and keeper reaction (240/160/100ms). Player pace is not multiplied by difficulty. In a human match, the preset affects opponents; home AI uses Normal. In demo/balance matches both teams use the preset.

Aim passes with WASD/arrows or the left stick while passing. Left/right movement biases shot placement; a sideways SHOOT swipe explicitly places a finesse shot. Release SHOOT for the charge; full power trades accuracy for speed. Chip a committed keeper rather than automatically chipping a keeper who can retreat. Standing next to the ball does not repeatedly roll for a steal: face and approach the exposed touch, or deliberately time TACKLE. Holding SKILL shields the back; the front can still be challenged. A missed slide commits a lunge and recovery.

## Measured balance

Same LCG seeds `123456 + index * 7919`, 12 normal baseline matches at commit `73707c4`, and 12 matches per final preset. The baseline was measured before edits. All final 36 matches completed without nonfinite states or stuck carriers. Raw final matches and baseline summary are in [gameplay-balance.json](gameplay-balance.json).

| Metric                        | Before | Normal overhaul |
| ----------------------------- | -----: | --------------: |
| Goals / match                 |   1.00 |            2.25 |
| Shots / match                 |  13.58 |           11.75 |
| Pass attempts / match         | 113.83 |           89.58 |
| Pass completion               |  20.8% |           71.3% |
| Possession switches / match   | 131.75 |           43.92 |
| Tackles / match               |  31.00 |           10.33 |
| Pass interceptions / match    |  14.08 |           10.58 |
| Keeper saves / match          |   8.17 |            6.50 |
| Close teammate pairs / sample |   0.50 |            0.06 |

| Preset | Goals/match | Shots/match | Pass completion |
| ------ | ----------: | ----------: | --------------: |
| easy   |        4.00 |       11.17 |           83.6% |
| normal |        2.25 |       11.75 |           71.3% |
| hard   |        0.75 |        8.25 |           76.7% |

The improvement sought here is fewer arbitrary turnovers, viable combinations and less clustering, rather than forcing a fixed number of goals. The final normal set has fewer but more productive shots. Hard-vs-Hard remains more defensive and has more draws; these small samples do not establish human win rates.

Pass completion counts the next teammate receiving a pending pass; interceptions count opponents receiving it. Possession switches include changes on goal restarts. Clustering is the average number of same-team pairs within 2.5 metres, sampled every half-second of active play. Peak player displacement includes separation contacts, not just commanded running speed. Peak final ball speed stays below 47 m/s; the faster peak than baseline is the new AI power shot. Longest uninterrupted final hold was under 6.1 active seconds. Shot locations and technique counts are recorded, allowing future tuning without guessing.

## Validation

- Baseline: 49 Node tests and production build passed.
- Final: 76 Node tests, including full seeded matches on each difficulty, deterministic replay, movement/braking/Pace, ball orbit stability, directional and buffered aim, passes/lofts, shot placement/techniques, geometry tackles, AI spacing/roles, keeper one-on-ones, chips, parries, self-distribution and existing career migration/persistence.
- `npm ci --cache /tmp/mini-fc-npm-cache`, `npm test`, `npm run build`, and `npm run build:single -- downloads/Mini-FC.html` are the cloud validation commands. The cache override fixes the cloud machine's unwritable default cache; package integrity/TLS verification was retained and no dependency versions changed.
- Production browser scripts exercise the `/Mini-FC/` subpath: keyboard goals, match lifecycle, five-match careers and upgrades, existing touch techniques, six viewport/control-size combinations, difficulty persistence, acceleration/braking, directional passing, simultaneous stick/charge/aim, stray pointer cancellation, brush rejection, rotation pause and resumed live AI. Single-file checks block every extra resource request and verify scoring, XP and reload persistence.
- Chromium tablet emulation is not real iPad Safari. Actual iPad frame rate, thumb comfort and hardware audio have not been measured. There is no claim of 60 FPS hardware validation or equivalence to EA Sports FC.

## Delivery

The final code and regenerated HTML are committed on `work`. `main` was still the initial commit when inspected; its history was not overwritten. The included Pages workflow remains unchanged and deploys after a merge to `main` with Pages enabled. GitHub API access in this cloud returns `Forbidden` for the PR query, so an actual pull request cannot be verified/created here; use the prepared [main…work comparison](https://github.com/orangni/Mini-FC/compare/main...work?expand=1) and this report for review. Publishing the branch/HTML is separate from a successful GitHub Pages deployment.
