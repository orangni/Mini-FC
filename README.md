# Mini FC

**Small pitch. Big moments.** A complete, free, three-a-side arcade football game for desktop browsers and iPad Safari. Built with Three.js, JavaScript, and Vite. Everything in the stadium is procedural; there are no downloaded models, textures, accounts, API keys, or backend services.

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

| Action         | Desktop                 | iPad / touch               |
| -------------- | ----------------------- | -------------------------- |
| Move           | WASD (or arrow keys)    | Drag the left analog stick |
| Sprint         | Hold Shift              | Hold SPRINT while moving   |
| Pass           | Space                   | Tap PASS                   |
| Shoot          | J                       | Tap SHOOT                  |
| Pause / resume | Escape, or pause button | Pause button, then Resume  |

Gold always attacks the far goal, toward the top of the screen. The gold ring and arrow identify your controlled player. Dribble by moving with the ball. Run near an opponent to tackle automatically. Passes select a teammate and switch your control to the receiver; control follows your team's possession. When defending, control switches to a nearer defender if the current player is far from the ball. Shots automatically aim toward the opposing goal, making the game playable with two thumbs. Sprint consumes the active player's stamina, which recovers when not sprinting.

Matches last **120 seconds of active play**. Kickoff celebrations and pauses stop the match clock. Side and end boards rebound the ball, so there are no throw-ins, corners, fouls, penalties, or offsides. There are three outfield players per side and no dedicated goalkeeper. The broadcast camera tracks the ball. Teammates find space, meet passes, defend, tackle, and shoot; opponents do the same.

## Player career

- Create a named captain and select Striker, Midfielder, or Defender. Position is an identity choice, without restricting movement or abilities.
- Start with **60 overall**. Pace affects speed, Shooting affects shot speed and accuracy, and Passing affects pass speed. In this arcade career, upgrades benefit the squad as you switch between players.
- Earn **60 XP** for a completed match, **80 XP** for a win, **30 XP** for a draw, and **40 XP** for each goal from your own shot. AI teammate goals count toward the team score, but not your personal goals.
- Each **100 cumulative XP** earns one upgrade point. Spend one point for **+3** to an attribute, capped at 99. Overall is the average of the three attributes.
- Play five matches per season against five clubs. All six clubs play a complete round robin. Other fixtures resolve when you finish your match. Wins earn three league points, draws earn one. Ties use goal difference, goals scored, then club name.
- Win the league for **three bonus upgrade points** and a championship. Start a new season while keeping attributes, XP, points, and lifetime records.
- Saves are automatic after career creation, completed matches, upgrades, and season transitions. Refreshing resumes your career. An unfinished match restarts from the career menu without rewards or a recorded result. Restarting and quitting never award XP.

Progress is stored only in this browser's **LocalStorage** under `mini-fc-career-v1`. It does not sync between Windows and iPad, between domains, or between Safari profiles. Clearing site data deletes the save. Private browsing or blocked storage may prevent persistence; a visible message reports save failures. Settings includes a separately confirmed career reset.

## Performance and compatibility

WebGL2 and a modern browser are required. Three.js renders low-poly geometry with simple lighting, an instanced crowd, no shadow maps or postprocessing, and a device pixel ratio cap of 1.7 (1 in Battery saver). Simulation uses a fixed 60 Hz step. Hidden tabs and lost focus pause active matches. Multi-touch pointer controls handle release, cancellation, and simultaneous joystick/action input. The page prevents gameplay scrolling and accounts for display safe areas. Portrait is supported, but landscape gives more space.

Aim: smooth 60 FPS on capable devices. Frame rate depends on the device; real iPad hardware performance has **not** been measured. Use Settings → Graphics → Battery saver if needed. Browser smoke testing uses Chromium with tablet/touch emulation; it is not real iPad Safari testing.

## Tests

```powershell
npm ci
npm test
npm run build
```

The dependency-free Node test suite covers movement, sprinting, dribbling, passing and completion, tackling, shots and goals on both ends, wide/high rebounds, a complete AI match, clock/full-time behavior, XP, upgrades, a full season, championship rewards, next season, persistence, and corrupted saves.

An optional production-browser test is included. It requires Python and Playwright only for testing, not playing or building:

```powershell
python -m pip install playwright
python -m playwright install chromium
npm run build
npm run preview -- --port 4173
# In a second terminal:
python tests/browser_smoke.py
```

Set `MINI_FC_BROWSER` to use an existing Chromium executable, `MINI_FC_URL` for a different server URL (include its trailing slash), and `MINI_FC_ARTIFACTS` to choose the screenshot directory. The script exercises keyboard movement and shooting, real goal detection, paused timers, restart, focus loss, career creation, full-time rewards, upgrade and refresh persistence, season completion, and simultaneous joystick/sprint plus touch pass/shoot and cancellation. Time and selected fixture scores are accelerated through the opt-in `?test=1` harness; the test does not wait ten real minutes for a season. The harness is absent from the global object in normal play.

## Project layout

- `src/match.js` — rendering-independent football simulation and AI
- `src/render.js` — procedural Three.js pitch, stadium, footballers, and camera
- `src/input.js` — keyboard and multi-touch pointer input
- `src/career.js` — progression, league fixtures, upgrades, save validation
- `src/main.js` — menus, match lifecycle, audio, settings, and game loop
- `tests/` — simulation/career tests and optional browser integration test
- `.github/workflows/deploy.yml` — validation and GitHub Pages deployment

Mini FC uses fictional clubs and original procedural graphics. It is an independent arcade game with no affiliation to EA Sports or licensed football organizations.
