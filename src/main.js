import "./style.css";
import { Renderer } from "./render.js";
import { Match, MATCH_SECONDS } from "./match.js";
import { Input } from "./input.js";
import {
  newCareer,
  loadCareer,
  saveCareer,
  overall,
  standings,
  opponent,
  finishMatch,
  upgrade,
  nextSeason,
} from "./career.js";

const $ = (selector) => document.querySelector(selector);
const screen = $("#screen"),
  hud = $("#hud");
const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}
let career = storage ? loadCareer(storage) : null;
let settings = { quality: "high", sound: true, touch: "auto" };
try {
  const saved = JSON.parse(storage?.getItem("mini-fc-settings"));
  if (saved)
    settings = {
      quality: saved.quality === "low" ? "low" : "high",
      sound: saved.sound !== false,
      touch: ["auto", "on"].includes(saved.touch) ? saved.touch : "auto",
    };
} catch {
  /* Defaults remain usable when storage is unavailable. */
}
let renderer;
try {
  renderer = new Renderer($("#game"), settings.quality);
} catch {
  screen.innerHTML =
    '<section class="panel"><span class="eyebrow">MINI FC</span><h1>A pitch needs a little power.</h1><p>WebGL could not start. Enable hardware acceleration, close other tabs, then reload Safari or your desktop browser.</p><button onclick="location.reload()">TRY AGAIN</button></section>';
  throw new Error("WebGL is unavailable.");
}
let mode = "main",
  match = new Match({ demo: true }),
  careerMatch = false,
  opponentName = "Rival FC";
let announcementUntil = 0,
  toastTimer,
  audio;
const input = new Input((force) => pause(force));
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4500);
}
function persist() {
  try {
    if (!storage) throw new Error();
    saveCareer(storage, career);
    return true;
  } catch {
    toast(
      "Save unavailable. Progress is kept in this tab only. Allow browser storage to save it.",
    );
    return false;
  }
}
function saveSettings() {
  try {
    storage?.setItem("mini-fc-settings", JSON.stringify(settings));
  } catch {
    toast("Settings cannot be saved in this browser.");
  }
}
function applyTouch() {
  document.body.classList.toggle(
    "touch",
    settings.touch === "on" ||
      navigator.maxTouchPoints > 0 ||
      matchMedia("(pointer: coarse)").matches,
  );
}
applyTouch();
function unlockAudio() {
  if (!settings.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {
    /* Audio is optional. */
  }
}
function tone(frequency, length = 0.1, type = "sine", volume = 0.035) {
  if (!settings.sound || !audio || audio.state !== "running") return;
  const osc = audio.createOscillator(),
    gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + length);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + length);
}
document.addEventListener("pointerdown", unlockAudio, { passive: true });
document.addEventListener("keydown", unlockAudio);
function shell(content, wide = false) {
  screen.hidden = false;
  screen.className = wide ? "wide-screen" : "";
  screen.innerHTML = content
    .replaceAll(
      "↗",
      '<svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14"/></svg>',
    )
    .replaceAll(
      "←",
      '<svg class="arrow-icon back-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4m7-7-7 7 7 7"/></svg>',
    );
  input.active = false;
  input.reset();
}
function button(id, label, style = "") {
  return `<button id="${id}" class="${style}">${label}</button>`;
}
function bind(id, fn) {
  document.getElementById(id)?.addEventListener("click", fn);
}
function header(kicker, title, subtitle = "") {
  return `<span class="eyebrow">${kicker}</span><h1>${title}</h1>${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}`;
}
function goMain() {
  mode = "main";
  hud.hidden = true;
  input.reset();
  match = new Match({ demo: true });
  careerMatch = false;
  shell(
    `<div class="home-layout"><section class="home-copy"><div class="brand"><span class="brand-mark">M<span>F</span></span> MINI FC <small>THE SMALL-SIDED GAME</small></div><span class="eyebrow">EVERY TOUCH COUNTS</span><h1>Small pitch.<br>Big <em>moments.</em></h1><p>Three a side. Two minutes.<br>Your next great goal is one touch away.</p><div class="home-actions">${button("play", "<span>01</span> PLAY <b>↗</b>", "primary")}${button("career", "<span>02</span> CAREER <b>↗</b>")}${button("settings", "<span>03</span> SETTINGS <b>↗</b>", "subtle")}</div><div class="home-foot"><span class="live-dot"></span> OFFLINE CAREER · NO SIGN-IN · JUST FOOTBALL</div></section><aside class="match-card"><div class="eyebrow">WELCOME TO THE NEIGHBORHOOD</div><div class="match-card-score"><span class="club-badge">M</span><small>VS</small><span class="club-badge rival">R</span></div><b>MINI FC <span>vs</span> RIVAL FC</b><p>FLOODLIGHT PARK / 3V3</p><div class="card-rule"></div><span>Made for quick matches.<br>Built for the long career.</span></aside></div><div class="bottom-line"><span>MINI FC / VOL. 01</span><span>KEYBOARD + TOUCH</span></div>`,
  );
  bind("play", () => startMatch(false));
  bind("career", careerMenu);
  bind("settings", () => settingsMenu("main"));
}
function createMenu() {
  mode = "career";
  shell(
    `<section class="panel creation">${header("YOUR STORY STARTS HERE", "Make your mark.", "Create your captain. All three attributes start at 60.")}<form id="create-form"><label for="player-name">PLAYER NAME</label><input id="player-name" name="name" maxlength="20" placeholder="Your name" value="Captain" required autocomplete="off"><label for="position">PREFERRED POSITION</label><select id="position"><option>Striker</option><option>Midfielder</option><option>Defender</option></select><p class="fine">Position is your player identity. Every position can move, pass, shoot, and lead the team.</p>${button("create-career", "SIGN FOR MINI FC ↗", "primary")}</form>${button("back", "← MAIN MENU", "subtle")}</section>`,
  );
  $("#create-form").addEventListener("submit", (e) => {
    e.preventDefault();
    career = newCareer($("#player-name").value, $("#position").value);
    persist();
    careerMenu();
  });
  bind("back", goMain);
}
function shirt() {
  return '<div class="shirt"><div class="shirt-number">7</div><div class="shirt-club">MINI FC</div></div>';
}
function careerMenu() {
  if (!career) return createMenu();
  mode = "career";
  hud.hidden = true;
  const c = career,
    complete = c.seasonMatch === 5,
    table = standings(c),
    rank = table.findIndex((r) => r.name === "Mini FC") + 1;
  shell(
    `<section class="career-layout"><header class="page-heading"><div>${header(`PLAYER CAREER / SEASON ${c.season}`, "The next chapter.", "Build your player. Bring the title home.")}</div>${button("back", "← MAIN MENU", "subtle")}</header><div class="career-grid"><article class="player-card"><div class="player-card-top"><b>${overall(c)}<small>OVR</small></b><span>${escapeHTML(c.position.toUpperCase())}</span></div>${shirt()}<h2>${escapeHTML(c.name)}</h2><span class="eyebrow">MINI FC · CAPTAIN</span><div class="attributes">${Object.entries(
      c.attributes,
    )
      .map(
        ([k, v]) =>
          `<div><b>${v}</b><span>${k.toUpperCase().slice(0, 3)}</span></div>`,
      )
      .join(
        "",
      )}</div></article><div class="career-center"><article class="tile next-fixture"><span class="eyebrow">${complete ? "SEASON COMPLETE" : `NEXT FIXTURE / ${c.seasonMatch + 1} OF 5`}</span><h2>${complete ? (rank === 1 ? "Champions." : "A season to build on.") : `Mini FC <span>vs</span><br>${opponent(c)}`}</h2><p>${complete ? `You finished ${rank}${rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th"}. ${rank === 1 ? "Championship bonus: 3 upgrade points." : "A new season is a fresh start."}` : "Two minutes to make a difference."}</p>${button("fixture", complete ? "START NEXT SEASON ↗" : "PLAY MATCH ↗", "primary")}</article><article class="tile progression"><div><span class="eyebrow">PLAYER DEVELOPMENT</span><h3>${c.points} upgrade point${c.points === 1 ? "" : "s"}</h3></div>${button("upgrades", "TRAIN ↗")}<div class="xp-track"><span style="width:${c.xp % 100}%"></span></div><small>${c.xp} TOTAL XP · ${100 - (c.xp % 100)} XP TO NEXT POINT</small></article><div class="stat-strip"><div><b>${c.played}</b><span>PLAYED</span></div><div><b>${c.wins}</b><span>WINS</span></div><div><b>${c.goals}</b><span>YOUR GOALS</span></div><div><b>${c.championships}</b><span>TITLES</span></div></div><p class="fine career-record">ALL TIME · ${c.wins} WINS / ${c.draws} DRAWS / ${c.losses} LOSSES</p></div><article class="tile league"><span class="eyebrow">NEIGHBORHOOD LEAGUE</span><h3>Season ${c.season} standings</h3><table><thead><tr><th>CLUB</th><th>P</th><th>GD</th><th>PTS</th></tr></thead><tbody>${table.map((r, i) => `<tr class="${r.name === "Mini FC" ? "your-club" : ""}"><td><small>${i + 1}</small>${r.name}</td><td>${r.played}</td><td>${r.gf - r.ga}</td><td><b>${r.points}</b></td></tr>`).join("")}</tbody></table><p class="fine">Win 3 pts · Draw 1 pt<br>Ties: goal difference, goals scored, club name.</p><p class="fine">60 XP per match · 80 per win<br>40 per goal you score · 30 per draw<br>100 XP = 1 point · 1 point = +3 attribute</p></article></div></section>`,
    true,
  );
  bind("back", goMain);
  bind("upgrades", upgradeMenu);
  bind("fixture", () => {
    if (complete) {
      nextSeason(career);
      persist();
      careerMenu();
    } else startMatch(true);
  });
}
function upgradeMenu() {
  mode = "upgrades";
  shell(
    `<section class="panel upgrades-panel">${header("TRAINING GROUND", "Earn it. Improve it.", `${career.points} upgrade points available · Overall ${overall(career)}`)}<div class="upgrade-list">${Object.entries(
      career.attributes,
    )
      .map(
        ([k, v]) =>
          `<article class="upgrade-row"><div><h3>${k[0].toUpperCase() + k.slice(1)}</h3><small>${k === "pace" ? "Movement and sprint speed" : k === "shooting" ? "Shot speed and accuracy" : "Pass travel speed"}</small><div class="attribute-bar"><span style="width:${v}%"></span></div></div><b>${v}</b><button data-upgrade="${k}" ${career.points < 1 || v >= 99 ? "disabled" : ""}>${v >= 99 ? "MAX" : "+3 / 1 PT"}</button></article>`,
      )
      .join(
        "",
      )}</div><p class="fine">Upgrades apply to your squad in career matches. Attributes cap at 99.</p>${button("back", "← CAREER", "primary")}</section>`,
  );
  document.querySelectorAll("[data-upgrade]").forEach((b) =>
    b.addEventListener("click", () => {
      if (upgrade(career, b.dataset.upgrade)) {
        persist();
        tone(650);
        upgradeMenu();
      }
    }),
  );
  bind("back", careerMenu);
}
function settingsMenu(from) {
  mode = "settings";
  shell(
    `<section class="panel settings-panel">${header("MAKE IT YOUR GAME", "Settings.")}<div class="setting-row"><div><b>Graphics</b><small>Lower resolution can improve battery life.</small></div><select id="quality"><option value="high">High</option><option value="low">Battery saver</option></select></div><div class="setting-row"><div><b>Match sound</b><small>Procedural kicks, goals, and whistles.</small></div><select id="sound"><option value="on">On</option><option value="off">Off</option></select></div><div class="setting-row"><div><b>Touch controls</b><small>Automatic on iPad and touch devices.</small></div><select id="touch"><option value="auto">Automatic</option><option value="on">Always show</option></select></div><div class="control-guide"><h3>The playbook</h3><p><b>WASD</b> Move <b>SHIFT</b> Sprint <b>SPACE</b> Pass <b>J</b> Shoot</p><p>On iPad, drag the stick and tap the action buttons. Hold SPRINT to run faster. Play in landscape for more room.</p><p>You attack the far goal ↑. Run near an opponent to tackle. Control follows possession and switches to the pass receiver. Shots aim at goal. Touchline boards keep the ball in play.</p><p>Career goals count shots you take. AI teammate goals help the team score. Quitting or restarting an unfinished match earns no rewards.</p></div>${button("back", "← BACK", "primary")}${career ? button("reset-career", "RESET CAREER", "danger subtle") : ""}<div id="reset-confirm"></div></section>`,
  );
  $("#quality").value = settings.quality;
  $("#sound").value = settings.sound ? "on" : "off";
  $("#touch").value = settings.touch;
  $("#quality").onchange = (e) => {
    settings.quality = e.target.value;
    renderer.setQuality(settings.quality);
    saveSettings();
  };
  $("#sound").onchange = (e) => {
    settings.sound = e.target.value === "on";
    unlockAudio();
    saveSettings();
  };
  $("#touch").onchange = (e) => {
    settings.touch = e.target.value;
    applyTouch();
    saveSettings();
  };
  bind("back", from === "pause" ? showPause : goMain);
  bind("reset-career", () => {
    $("#reset-confirm").innerHTML =
      `<p>Delete your saved player and all career progress?</p>${button("delete-career", "YES, DELETE CAREER", "danger")}`;
    bind("delete-career", () => {
      try {
        storage?.removeItem("mini-fc-career-v1");
      } catch {
        toast("Could not delete the saved career.");
        return;
      }
      career = null;
      goMain();
      toast("Career reset.");
    });
  });
}
function startMatch(isCareer) {
  if (isCareer && (!career || career.seasonMatch >= 5)) return careerMenu();
  careerMatch = isCareer;
  opponentName = isCareer ? opponent(career) : "Rival FC";
  match = new Match({
    attributes: isCareer ? { ...career.attributes } : undefined,
  });
  mode = "playing";
  screen.hidden = true;
  hud.hidden = false;
  input.reset();
  input.active = true;
  $("#away-label").textContent = opponentName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  announce("KICK OFF", "GOLD ATTACKS ↑");
  updateHUD();
  unlockAudio();
  tone(850, 0.18);
}
function pause(force = false) {
  if (mode === "playing") {
    input.reset();
    showPause();
  } else if (mode === "pause" && !force) resume();
}
function showPause() {
  mode = "pause";
  shell(
    `<section class="panel pause-panel">${header("TAKE A BREATHER", "Match paused.", `${match.score[0]} – ${match.score[1]} · ${formatTime(MATCH_SECONDS - match.elapsed)} remaining`)}${button("resume", "RESUME MATCH ↗", "primary")}${button("restart", "RESTART MATCH")}${button("settings", "SETTINGS", "subtle")}${button("quit", "RETURN TO MAIN MENU", "subtle")}<p class="fine">Unfinished matches do not award XP or count toward your season.</p></section>`,
  );
  bind("resume", resume);
  bind("restart", () => startMatch(careerMatch));
  bind("settings", () => settingsMenu("pause"));
  bind("quit", goMain);
}
function resume() {
  mode = "playing";
  screen.hidden = true;
  input.reset();
  input.active = true;
}
function announce(title, sub = "") {
  $("#announcement").innerHTML = `<strong>${title}</strong><span>${sub}</span>`;
  announcementUntil = performance.now() + 2100;
  $("#announcement").classList.add("visible");
}
function formatTime(seconds) {
  seconds = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function updateHUD() {
  $("#score").textContent = `${match.score[0]} : ${match.score[1]}`;
  $("#timer").textContent = formatTime(MATCH_SECONDS - match.elapsed);
  $("#player-label").textContent =
    `${match.controlled + 7} · ${careerMatch ? career.name.toUpperCase() : "MINI FC"}`;
  $("#stamina span").style.width =
    `${match.players[match.controlled].stamina * 100}%`;
}
function results() {
  mode = "results";
  input.active = false;
  input.reset();
  hud.hidden = true;
  let reward = null;
  if (careerMatch) {
    reward = finishMatch(career, match.score, match.stats);
    persist();
  }
  const [a, b] = match.score,
    title =
      a > b ? "Made it count." : a === b ? "Honours even." : "We go again.";
  shell(
    `<section class="panel results-panel">${header("FULL TIME / FLOODLIGHT PARK", title)}<div class="result-score"><div><span class="club-badge">M</span><b>MINI FC</b></div><strong>${a}<span>:</span>${b}</strong><div><span class="club-badge rival">R</span><b>${escapeHTML(opponentName.toUpperCase())}</b></div></div><div class="stat-strip"><div><b>${match.stats.goals}</b><span>YOUR GOALS</span></div><div><b>${match.stats.shots}</b><span>YOUR SHOTS</span></div><div><b>${match.stats.completedPasses}/${match.stats.passes}</b><span>PASSES MADE</span></div></div>${reward ? `<div class="reward"><b>+${reward.xp} XP</b><span>+${reward.points} upgrade point${reward.points === 1 ? "" : "s"}${reward.champion ? " · LEAGUE CHAMPIONS!" : ""}</span></div>` : '<p class="fine">Take your game further. Start a career to earn XP and improve your squad.</p>'}${button("next", careerMatch ? "BACK TO CAREER ↗" : "PLAY AGAIN ↗", "primary")}${button("main", "MAIN MENU", "subtle")}</section>`,
  );
  tone(740, 0.25, "triangle");
  bind("next", careerMatch ? careerMenu : () => startMatch(false));
  bind("main", goMain);
}
bind("pause", () => pause());
window.addEventListener("mini-context-lost", () => {
  pause(true);
  toast("Graphics interrupted. Waiting for the browser to restore the pitch.");
});
let last = performance.now(),
  accumulator = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  accumulator += dt;
  while (accumulator >= 1 / 60) {
    if (mode === "playing") {
      match.step(1 / 60, input.read());
      for (const event of match.takeEvents()) {
        if (event.type === "goal") {
          announce(
            event.team === 0 ? "GOOOAL!" : "RIVAL GOAL",
            `${match.score[0]} – ${match.score[1]}`,
          );
          tone(event.team === 0 ? 660 : 230, 0.5, "triangle");
        }
        if (event.type === "shot") tone(110, 0.11, "triangle", 0.06);
        if (event.type === "pass") tone(190, 0.07, "sine");
        if (event.type === "fulltime") results();
      }
    } else if (
      mode === "main" ||
      mode === "career" ||
      mode === "upgrades" ||
      (mode === "settings" && !careerMatch && hud.hidden)
    ) {
      match.step(1 / 60);
      match.takeEvents();
      if (match.finished) match = new Match({ demo: true });
    }
    accumulator -= 1 / 60;
  }
  if (mode === "playing") updateHUD();
  if (now > announcementUntil) $("#announcement").classList.remove("visible");
  renderer.draw(match, dt, hud.hidden);
  requestAnimationFrame(frame);
}
goMain();
requestAnimationFrame(frame);
// Explicit opt-in harness for automated production-browser checks; absent in normal play.
if (new URLSearchParams(location.search).has("test"))
  window.__miniFC = {
    get match() {
      return match;
    },
    get career() {
      return career;
    },
    get mode() {
      return mode;
    },
    input,
    renderer,
    startMatch,
    pause,
    results,
    careerMenu,
  };
