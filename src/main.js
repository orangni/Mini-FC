import "./style.css";
import { Renderer } from "./render.js";
import { Match, MATCH_SECONDS } from "./match.js";
import { Input } from "./input.js";
import {
  CLUB_DATABASE,
  LEGACY_CLUBS,
  LEAGUES,
  getClub,
  searchClubs,
  selectKits,
} from "./clubs.js";
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
const bounded = (v, lo, hi, fall) =>
  Number.isFinite(Number(v)) ? Math.max(lo, Math.min(hi, Number(v))) : fall;
let settings = {
  quality: "high",
  sound: true,
  touch: "auto",
  touchSize: 100,
  touchOpacity: 85,
  touchInset: 24,
  home: "arsenal",
  away: "chelsea",
};
try {
  const saved = JSON.parse(storage?.getItem("mini-fc-settings"));
  if (saved)
    settings = {
      ...settings,
      touchSize: bounded(saved.touchSize, 80, 135, 100),
      touchOpacity: bounded(saved.touchOpacity, 35, 100, 85),
      touchInset: bounded(saved.touchInset, 12, 80, 24),
      home: getClub(saved.home || "arsenal").id,
      away: getClub(saved.away || "chelsea").id,
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
  document.documentElement.style.setProperty(
    "--control-size",
    settings.touchSize / 100,
  );
  document.documentElement.style.setProperty(
    "--control-opacity",
    settings.touchOpacity / 100,
  );
  document.documentElement.style.setProperty(
    "--control-inset",
    settings.touchInset + "px",
  );
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
    `<div class="home-layout"><section class="home-copy"><div class="brand"><span class="brand-mark">M<span>F</span></span> MINI FC <small>THE SMALL-SIDED GAME</small></div><span class="eyebrow">EVERY TOUCH COUNTS</span><h1>Small pitch.<br>Big <em>moments.</em></h1><p>Six a side. Two minutes.<br>Your next great goal is one touch away.</p><div class="home-actions">${button("play", "<span>01</span> PLAY <b>↗</b>", "primary")}${button("career", "<span>02</span> CAREER <b>↗</b>")}${button("settings", "<span>03</span> SETTINGS <b>↗</b>", "subtle")}</div><div class="home-foot"><span class="live-dot"></span> OFFLINE CAREER · NO SIGN-IN · JUST FOOTBALL</div></section><aside class="match-card"><div class="eyebrow">WELCOME TO THE NEIGHBORHOOD</div><div class="match-card-score"><span class="club-badge">M</span><small>VS</small><span class="club-badge rival">R</span></div><b>MINI FC <span>vs</span> RIVAL FC</b><p>FLOODLIGHT PARK / 6V6</p><div class="card-rule"></div><span>Made for quick matches.<br>Built for the long career.</span></aside></div><div class="bottom-line"><span>MINI FC / VOL. 02</span><span>KEYBOARD + TOUCH</span></div>`,
  );
  bind("play", kickoffMenu);
  bind("career", careerMenu);
  bind("settings", () => settingsMenu("main"));
}

function scoreColour(hex) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.45 + 255 * 0.55)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function abbreviation(name) {
  const words = name
    .replace(/\b(?:FC|AFC|AC|SC|SS|SSC|SV|US|TSG|VfB)\b/gi, "")
    .trim()
    .split(/\s+/);
  return (
    words.length === 1
      ? words[0].slice(0, 3)
      : words
          .map((w) => w[0])
          .join("")
          .slice(0, 3)
  ).toUpperCase();
}
function crest(club) {
  const local = renderer.localAssets.get(club.id)?.crest;
  return local
    ? `<img class="local-crest" src="${local}" alt="${escapeHTML(club.name)} crest">`
    : `<span class="mini-crest" style="background:${club.primary};color:${club.secondary}">${abbreviation(club.name)}</span>`;
}
function kickoffMenu() {
  mode = "clubs";
  hud.hidden = true;
  let side = 0;
  shell(
    `<section class="club-selection"><header class="page-heading"><div>${header("KICK OFF / 6V6", "Pick your colours.", `${CLUB_DATABASE.length} clubs from your supplied roster · traditional procedural kits`)}</div>${button("back", "← MAIN MENU", "subtle")}</header><div class="fixture-picker"><button id="choose-home"></button><b>VS</b><button id="choose-away"></button>${button("kickoff", "KICK OFF ↗", "primary")}</div><div class="club-tools"><input id="club-search" type="search" placeholder="Search clubs…" aria-label="Search clubs"><select id="league-filter" aria-label="Filter league"><option value="">All clubs</option>${Object.entries(
      LEAGUES,
    )
      .map(([k, v]) => `<option value="${k}">${v}</option>`)
      .join(
        "",
      )}</select>${button("assets", "LOCAL ASSETS", "subtle")}</div><div id="club-list" class="club-list"></div><p class="fine">2026/27 membership: user-provided list; official-site verification unavailable. Home/away colours are traditional approximations, not exact verified 2026/27 kits. ${CLUB_DATABASE.filter((c) => c.league === "BL").length}/18 Bundesliga clubs included by user preference.</p></section>`,
    true,
  );
  function refresh() {
    for (const [i, key] of ["home", "away"].entries()) {
      const c = getClub(settings[key]),
        b = $(`#choose-${key}`);
      b.innerHTML = `${crest(c)}<span><small>${i === 0 ? "YOUR CLUB" : "OPPONENT"}</small><b>${escapeHTML(c.name)}</b></span>`;
      b.classList.toggle("selected", side === i);
    }
    $("#club-list").innerHTML =
      searchClubs($("#club-search").value, $("#league-filter").value)
        .map(
          (c) =>
            `<button data-club="${c.id}">${crest(c)}<span><b>${escapeHTML(c.name)}</b><small>${LEAGUES[c.league]} · ${c.formation}</small></span></button>`,
        )
        .join("") || "<p>No matching clubs.</p>";
    document.querySelectorAll("[data-club]").forEach(
      (b) =>
        (b.onclick = () => {
          settings[side === 0 ? "home" : "away"] = b.dataset.club;
          side = side === 0 ? 1 : 0;
          saveSettings();
          refresh();
        }),
    );
  }
  bind("choose-home", () => {
    side = 0;
    refresh();
  });
  bind("choose-away", () => {
    side = 1;
    refresh();
  });
  $("#club-search").oninput = refresh;
  $("#league-filter").onchange = refresh;
  bind("kickoff", () => startMatch(false));
  bind("back", goMain);
  bind("assets", () => assetsMenu(kickoffMenu));
  refresh();
}
function touchLayoutMenu(from) {
  mode = "touch-layout";
  shell(
    `<section class="panel">${header("IPAD CONTROL ROOM", "Your touch. Your layout.", "Changes apply immediately and save in this browser.")}<div class="control-preview"><span class="preview-stick"></span><div><b>PASS</b><b>SHOOT</b></div></div>${[
      ["touchSize", "Button size", 80, 135],
      ["touchOpacity", "Opacity", 35, 100],
      ["touchInset", "Edge spacing", 12, 80],
    ]
      .map(
        ([key, label, min, max]) =>
          `<label for="${key}">${label} <output id="${key}-value">${settings[key]}${key === "touchInset" ? "px" : "%"}</output></label><input type="range" id="${key}" min="${min}" max="${max}" value="${settings[key]}">`,
      )
      .join(
        "",
      )}${button("reset-layout", "RESET LAYOUT", "subtle")}${button("back", "← SETTINGS", "primary")}</section>`,
  );
  for (const key of ["touchSize", "touchOpacity", "touchInset"])
    $("#" + key).oninput = (e) => {
      settings[key] = Number(e.target.value);
      $("#" + key + "-value").textContent =
        settings[key] + (key === "touchInset" ? "px" : "%");
      applyTouch();
      saveSettings();
    };
  bind("back", () => settingsMenu(from));
  bind("reset-layout", () => {
    Object.assign(settings, {
      touchSize: 100,
      touchOpacity: 85,
      touchInset: 24,
    });
    applyTouch();
    saveSettings();
    touchLayoutMenu(from);
  });
}
function assetsMenu(back) {
  mode = "assets";
  shell(
    `<section class="panel">${header("YOUR LOCAL ASSETS", "Make it personal.", "Choose licensed images from your device. Files stay in this tab and are never uploaded or committed.")}<label for="asset-club">CLUB</label><select id="asset-club">${[...LEGACY_CLUBS, ...CLUB_DATABASE].map((c) => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("")}</select><label for="asset-crest">CREST · PNG, JPEG OR WEBP</label><input id="asset-crest" type="file" accept="image/png,image/jpeg,image/webp"><label for="asset-kit">JERSEY TEXTURE · PNG, JPEG OR WEBP</label><input id="asset-kit" type="file" accept="image/png,image/jpeg,image/webp"><p class="fine">Maximum 2 MB per image. A flat jersey texture maps onto the procedural torso. Crests appear in club selection. Local assets reset on refresh; career progress remains saved. Automatic contrast kits can override an away texture to keep teams readable.</p>${button("back", "← BACK", "primary")}</section>`,
  );
  for (const kind of ["crest", "kit"])
    $("#asset-" + kind).onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 2 * 1024 * 1024
      ) {
        toast("Choose a PNG, JPEG or WebP image under 2 MB.");
        return;
      }
      const clubId = $("#asset-club").value,
        reader = new FileReader();
      reader.onload = () => {
        renderer.setLocalAsset(clubId, kind, reader.result);
        toast("Local " + kind + " applied to " + getClub(clubId).name + ".");
      };
      reader.onerror = () => toast("Could not read this image.");
      reader.readAsDataURL(file);
    };
  bind("back", back);
}
function createMenu() {
  mode = "career";
  shell(
    `<section class="panel creation">${header("YOUR STORY STARTS HERE", "Make your mark.", "Create your captain. All three attributes start at 60.")}<form id="create-form"><label for="player-name">PLAYER NAME</label><input id="player-name" name="name" maxlength="20" placeholder="Your name" value="Captain" required autocomplete="off"><label for="position">PREFERRED POSITION</label><select id="position"><option>Striker</option><option>Midfielder</option><option>Defender</option></select><label for="starting-club">STARTING CLUB</label><select id="starting-club"><option value="mini-fc">Mini FC · original career</option>${Object.keys(
      LEAGUES,
    )
      .filter((k) => k !== "LOCAL")
      .map(
        (k) =>
          `<optgroup label="${LEAGUES[k]}">${CLUB_DATABASE.filter(
            (c) => c.league === k,
          )
            .map(
              (c) => `<option value="${c.id}">${escapeHTML(c.name)}</option>`,
            )
            .join("")}</optgroup>`,
      )
      .join(
        "",
      )}</select><p class="fine">You control only your created footballer. Position sets your formation role. Use PASS to call for the ball when a teammate has it.</p>${button("create-career", "SIGN FOR MINI FC ↗", "primary")}</form>${button("back", "← MAIN MENU", "subtle")}</section>`,
  );
  $("#create-form").addEventListener("submit", (e) => {
    e.preventDefault();
    career = newCareer(
      $("#player-name").value,
      $("#position").value,
      $("#starting-club").value,
    );
    persist();
    careerMenu();
  });
  bind("back", goMain);
}
function shirt(clubId) {
  const c = getClub(clubId);
  return `<div class="shirt" style="background:linear-gradient(90deg,${c.primary} 0 45%,${c.secondary} 45% 55%,${c.primary} 55%)"><div class="shirt-number">7</div><div class="shirt-club">${abbreviation(c.name)}</div></div>`;
}
function careerMenu() {
  if (!career) return createMenu();
  mode = "career";
  hud.hidden = true;
  const c = career,
    complete = c.seasonMatch === 5,
    table = standings(c),
    rank = table.findIndex((r) => r.name === c.table[0].name) + 1;
  const clubName = escapeHTML(c.table[0].name);
  shell(
    `<section class="career-layout"><header class="page-heading"><div>${header(`PLAYER CAREER / SEASON ${c.season}`, "The next chapter.", "Build your player. Bring the title home.")}</div>${button("back", "← MAIN MENU", "subtle")}</header><div class="career-grid"><article class="player-card"><div class="player-card-top"><b>${overall(c)}<small>OVR</small></b><span>${escapeHTML(c.position.toUpperCase())}</span></div>${shirt(c.clubId)}<h2>${escapeHTML(c.name)}</h2><span class="eyebrow">${clubName} · CAPTAIN</span><div class="attributes">${Object.entries(
      c.attributes,
    )
      .map(
        ([k, v]) =>
          `<div><b>${v}</b><span>${k.toUpperCase().slice(0, 3)}</span></div>`,
      )
      .join(
        "",
      )}</div></article><div class="career-center"><article class="tile next-fixture"><span class="eyebrow">${complete ? "SEASON COMPLETE" : `NEXT FIXTURE / ${c.seasonMatch + 1} OF 5`}</span><h2>${complete ? (rank === 1 ? "Champions." : "A season to build on.") : `${clubName} <span>vs</span><br>${escapeHTML(opponent(c))}`}</h2><p>${complete ? `You finished ${rank}${rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th"}. ${rank === 1 ? "Championship bonus: 3 upgrade points." : "A new season is a fresh start."}` : "Two minutes to make a difference."}</p>${button("fixture", complete ? "START NEXT SEASON ↗" : "PLAY MATCH ↗", "primary")}</article><article class="tile progression"><div><span class="eyebrow">PLAYER DEVELOPMENT</span><h3>${c.points} upgrade point${c.points === 1 ? "" : "s"}</h3></div>${button("upgrades", "TRAIN ↗")}<div class="xp-track"><span style="width:${c.xp % 100}%"></span></div><small>${c.xp} TOTAL XP · ${100 - (c.xp % 100)} XP TO NEXT POINT</small></article><div class="stat-strip"><div><b>${c.played}</b><span>PLAYED</span></div><div><b>${c.wins}</b><span>WINS</span></div><div><b>${c.goals}</b><span>YOUR GOALS</span></div><div><b>${c.championships}</b><span>TITLES</span></div><div><b>${c.assists}</b><span>ASSISTS</span></div><div><b>${c.played ? (c.ratingTotal / c.played).toFixed(1) : "—"}</b><span>AVG RATING</span></div></div><p class="fine career-record">ALL TIME · ${c.wins} WINS / ${c.draws} DRAWS / ${c.losses} LOSSES</p></div><article class="tile league"><span class="eyebrow">${c.clubId === "mini-fc" ? "NEIGHBORHOOD LEAGUE" : getClub(c.clubId).league === "FR" ? "EUROPEAN INVITATION" : LEAGUES[getClub(c.clubId).league] + " · SIX-CLUB SEASON"}</span><h3>Season ${c.season} standings</h3><table><thead><tr><th>CLUB</th><th>P</th><th>GD</th><th>PTS</th></tr></thead><tbody>${table.map((r, i) => `<tr class="${r.name === c.table[0].name ? "your-club" : ""}"><td><small>${i + 1}</small>${escapeHTML(r.name)}</td><td>${r.played}</td><td>${r.gf - r.ga}</td><td><b>${r.points}</b></td></tr>`).join("")}</tbody></table><p class="fine">Win 3 pts · Draw 1 pt<br>Ties: goal difference, goals scored, club name.</p><p class="fine">60 XP per match · 80 per win<br>40 per goal you score · 30 per draw<br>100 XP = 1 point · 1 point = +3 attribute</p></article></div></section>`,
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
      )}</div><p class="fine">Upgrades improve your own footballer in career matches. Attributes cap at 99.</p>${button("back", "← CAREER", "primary")}</section>`,
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
    `<section class="panel settings-panel">${header("MAKE IT YOUR GAME", "Settings.")}<div class="setting-row"><div><b>Graphics</b><small>Lower resolution can improve battery life.</small></div><select id="quality"><option value="high">High</option><option value="low">Battery saver</option></select></div><div class="setting-row"><div><b>Match sound</b><small>Procedural kicks, goals, and whistles.</small></div><select id="sound"><option value="on">On</option><option value="off">Off</option></select></div><div class="setting-row"><div><b>Touch controls</b><small>Automatic on iPad and touch devices.</small></div><select id="touch"><option value="auto">Automatic</option><option value="on">Always show</option></select></div>${button("touch-layout", "TOUCH LAYOUT ↗")}${button("local-assets", "LOCAL KIT / CREST ASSETS ↗", "subtle")}<div class="control-guide"><h3>The playbook</h3><p><b>WASD</b> Move <b>SHIFT</b> Sprint <b>SPACE</b> Pass <b>J</b> Hold / release to shoot <b>E</b> Through <b>L</b> Lob <b>K</b> Chip <b>F</b> Finesse <b>C</b> Skill <b>V</b> Shield <b>R</b> Tackle <b>X</b> Slide <b>P</b> Press <b>Q</b> Switch</p><p>On iPad, touch anywhere in the left movement area to place the floating stick. Sprint is on the left. Hold SHOOT for power; swipe it up for a chip or sideways for finesse. Hold PASS to lob. Hold SKILL to shield. Controls change when possession changes.</p><p>You attack the far goal ↑. Kick Off switches to the receiver; Q switches defenders. Career stays locked to your created player. Tap PASS to call for a teammate pass. Tackle at close range; missed slides leave recovery time. Touchline boards keep the ball in play.</p><p>Career goals count shots you take. AI teammate goals help the team score. Quitting or restarting an unfinished match earns no rewards.</p></div>${button("back", "← BACK", "primary")}${career ? button("reset-career", "RESET CAREER", "danger subtle") : ""}<div id="reset-confirm"></div></section>`,
  );
  bind("touch-layout", () => touchLayoutMenu(from));
  bind("local-assets", () => assetsMenu(() => settingsMenu(from)));
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
        storage?.removeItem("mini-fc-career-v1-backup-v1");
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
  const home = getClub(isCareer ? career.clubId : settings.home);
  opponentName = isCareer ? opponent(career) : getClub(settings.away).name;
  const away = CLUB_DATABASE.find((c) => c.name === opponentName) || {
    ...getClub("rival-fc"),
    name: opponentName,
  };
  match = new Match({
    attributes: isCareer
      ? { ...career.attributes }
      : {
          pace: home.ratings.midfield * 0.78,
          shooting: home.ratings.attack,
          passing: home.ratings.midfield,
        },
    career: isCareer,
    position: isCareer ? career.position : "Striker",
    teams: [home, away],
  });
  const kits = selectKits(home, away);
  document.documentElement.style.setProperty(
    "--home-color",
    scoreColour(kits.home.shirt),
  );
  document.documentElement.style.setProperty(
    "--away-color",
    scoreColour(kits.away.shirt),
  );
  $("#home-label").textContent = abbreviation(home.name);
  mode = "playing";
  screen.hidden = true;
  hud.hidden = false;
  input.reset();
  input.active = true;
  $("#away-label").textContent = abbreviation(opponentName);
  announce("KICK OFF", "YOU ATTACK ↑");
  updateHUD();
  unlockAudio();
  tone(850, 0.18);
}
function pause(force = false) {
  if (mode === "playing") {
    match.queuedAction = null;
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
    `${match.controlled + 7} · ${careerMatch ? career.name.toUpperCase() : match.teams?.[0].name.toUpperCase() || "MINI FC"}${careerMatch ? " · LOCKED" : ""}`;
  const owner =
    match.ball.owner === null ? null : match.players[match.ball.owner];
  input.setContext(
    owner ? owner.team === 0 : match.ball.lastTeam === 0,
    careerMatch,
  );
  const charge = input.charge();
  $("#shot-power").classList.toggle("charging", charge > 0);
  $("#shot-power>span").style.width = `${charge * 100}%`;
  $("#pass-button").firstChild.textContent =
    careerMatch && owner?.team === 0 && owner.id !== 0 ? "CALL PASS" : "PASS";
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
    reward = finishMatch(career, match.score, {
      ...match.stats,
      rating: match.rating(),
    });
    persist();
  }
  const [a, b] = match.score,
    title =
      a > b ? "Made it count." : a === b ? "Honours even." : "We go again.";
  shell(
    `<section class="panel results-panel">${header("FULL TIME / FLOODLIGHT PARK", title)}<div class="result-score"><div><span class="club-badge">M</span><b>${escapeHTML(match.teams?.[0].name.toUpperCase() || "MINI FC")}</b></div><strong>${a}<span>:</span>${b}</strong><div><span class="club-badge rival">R</span><b>${escapeHTML(opponentName.toUpperCase())}</b></div></div><div class="stat-strip"><div><b>${match.stats.goals}</b><span>YOUR GOALS</span></div><div><b>${match.stats.shots}</b><span>YOUR SHOTS</span></div><div><b>${match.stats.completedPasses}/${match.stats.passes}</b><span>PASSES MADE</span></div><div><b>${match.stats.assists}</b><span>ASSISTS</span></div><div><b>${match.rating().toFixed(1)}</b><span>RATING</span></div></div>${reward ? `<div class="reward"><b>+${reward.xp} XP</b><span>+${reward.points} upgrade point${reward.points === 1 ? "" : "s"}${reward.champion ? " · LEAGUE CHAMPIONS!" : ""}</span></div>` : '<p class="fine">Take your game further. Start a career to earn XP and improve your squad.</p>'}${button("next", careerMatch ? "BACK TO CAREER ↗" : "PLAY AGAIN ↗", "primary")}${button("main", "MAIN MENU", "subtle")}</section>`,
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
        if (event.type === "save") {
          tone(260, 0.1);
        }
        if (event.type === "fulltime") results();
      }
    } else if (
      hud.hidden &&
      [
        "main",
        "career",
        "upgrades",
        "clubs",
        "assets",
        "touch-layout",
        "settings",
      ].includes(mode)
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
    get settings() {
      return settings;
    },
  };
