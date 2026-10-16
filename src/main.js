import "./style.css";
import { Renderer } from "./render.js";
import { Match, MATCH_SECONDS } from "./match.js";
import { Input } from "./input.js";
import {
  OUTFIELD_SKILLS,
  getSkill,
  skillLabel,
  skillDescription,
} from "./skills.js";
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

import { translateText, localize } from "./i18n.js";

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
  difficulty: "normal",
  controls: "balanced",
  language: navigator.language?.startsWith("ko") ? "ko" : "en",
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
      controls: saved.controls === "advanced" ? "advanced" : "balanced",
      language: ["en", "ko"].includes(saved.language)
        ? saved.language
        : settings.language,
      difficulty: ["easy", "normal", "hard"].includes(saved.difficulty)
        ? saved.difficulty
        : "normal",
      quality: saved.quality === "low" ? "low" : "high",
      sound: saved.sound !== false,
      touch: ["auto", "on"].includes(saved.touch) ? saved.touch : "auto",
    };
} catch {
  /* Defaults remain usable when storage is unavailable. */
}
const t = (text) => translateText(text, settings.language);
const skillName = (skill) => skillLabel(skill, settings.language);
const skillInfo = (skill) => skillDescription(skill, settings.language);
let renderer;
try {
  renderer = new Renderer($("#game"), settings.quality);
} catch {
  screen.innerHTML =
    '<section class="panel"><span class="eyebrow">MINI FC</span><h1>A pitch needs a little power.</h1><p>WebGL could not start. Enable hardware acceleration, close other tabs, then reload Safari or your desktop browser.</p><button onclick="location.reload()">TRY AGAIN</button></section>';
  localize(screen, settings.language);
  throw new Error("WebGL is unavailable.");
}
let mode = "main",
  match = new Match({ demo: true, difficulty: settings.difficulty }),
  careerMatch = false,
  opponentName = "Rival FC";
let announcementUntil = 0,
  toastTimer,
  audio;
const input = new Input((force) => pause(force));
function toast(message) {
  $("#toast").textContent = t(message);
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
function applyLanguage() {
  document.documentElement.lang = settings.language;
  document.body.dataset.language = settings.language;
  for (const [id, label] of Object.entries({
    "sprint-button": "SPRINT",
    "pass-button": "PASS",
    "shoot-button": "SHOOT",
    "through-button": "THROUGH",
    "chip-button": "CHIP",
    "skill-button": "SKILL",
    "tackle-button": "TACKLE",
    "slide-button": "SLIDE",
    "press-button": "PRESS",
    "switch-button": "SWITCH",
  }))
    $("#" + id).firstChild.textContent = t(label);
  $("#pass-button small").textContent = t("HOLD: LOB");
  $("#shoot-button small").textContent = t("HOLD: POWER");
  $("#match-hint>span:first-child").textContent = t("ATTACK ↑");
  $("#pause").setAttribute("aria-label", t("Pause match"));
  $("#joystick").setAttribute("aria-label", t("Floating movement joystick"));
  $("#game").setAttribute("aria-label", t("Mini FC football pitch"));
  document.title =
    settings.language === "ko"
      ? "Mini FC — 작은 경기장, 커다란 순간."
      : "Mini FC — Small pitch. Big moments.";
}
function applyTouch() {
  applyLanguage();
  input.assisted = settings.controls === "balanced";
  match.assisted = input.assisted;
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
  localize(screen, settings.language);
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
  match = new Match({ demo: true, difficulty: settings.difficulty });
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
    localize(screen, settings.language);
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
      )}</select><label for="signature-skill">SIGNATURE SKILL</label><select id="signature-skill">${OUTFIELD_SKILLS.map((s) => `<option value="${s.id}">${skillName(s)}</option>`).join("")}</select><div id="skill-preview" class="signature-card" aria-live="polite"></div><p class="fine">You control only your created footballer. Position sets your formation role. Use PASS to call for the ball when a teammate has it.</p>${button("create-career", "SIGN FOR MINI FC ↗", "primary")}</form>${button("back", "← MAIN MENU", "subtle")}</section>`,
  );
  const previewSkill = () => {
    const s = getSkill($("#signature-skill").value);
    $("#skill-preview").innerHTML =
      `<b>${skillName(s)}</b><p>${skillInfo(s)}</p><small>${t(`PC: C · TOUCH: tap SKILL · ${s.cooldown}s cooldown · Hold V / SKILL to shield.`)}</small>`;
  };
  $("#signature-skill").onchange = previewSkill;
  previewSkill();
  $("#create-form").addEventListener("submit", (e) => {
    e.preventDefault();
    career = newCareer(
      $("#player-name").value,
      $("#position").value,
      $("#starting-club").value,
      $("#signature-skill").value,
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
    `<section class="career-layout"><header class="page-heading"><div>${header(`PLAYER CAREER / SEASON ${c.season}`, "The next chapter.", "Build your player. Bring the title home.")}</div>${button("back", "← MAIN MENU", "subtle")}</header><div class="career-grid"><article class="player-card"><div class="player-card-top"><b>${overall(c)}<small>OVR</small></b><span>${escapeHTML(c.position.toUpperCase())}</span></div>${shirt(c.clubId)}<h2>${escapeHTML(c.name)}</h2><span class="eyebrow">${clubName} · CAPTAIN</span><div class="signature-card career-signature"><small>SIGNATURE</small><b>${skillName(getSkill(c.skillId))}</b><p>${skillInfo(getSkill(c.skillId))}</p></div><div class="attributes">${Object.entries(
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
    `<section class="panel settings-panel">${header("MAKE IT YOUR GAME", "Settings.")}<div class="setting-row"><div><b>Language</b><small>Choose one language for menus, skills and match controls.</small></div><select id="language"><option value="en">English</option><option value="ko">한국어</option></select></div><div class="setting-row"><div><b>Controls</b><small>Full techniques in both modes. Balanced adds light aiming and movement assistance.</small></div><select id="controls"><option value="balanced">Balanced · full techniques</option><option value="advanced">Manual · full techniques</option></select></div><div class="setting-row"><div><b>Difficulty</b><small>Decisions, positioning and keeper reactions. Applies immediately.</small></div><select id="difficulty"><option value="easy">Easy</option><option value="normal">Normal</option><option value="hard">Hard</option></select></div><div class="setting-row"><div><b>Graphics</b><small>Lower resolution can improve battery life.</small></div><select id="quality"><option value="high">High</option><option value="low">Battery saver</option></select></div><div class="setting-row"><div><b>Match sound</b><small>Procedural kicks, goals, and whistles.</small></div><select id="sound"><option value="on">On</option><option value="off">Off</option></select></div><div class="setting-row"><div><b>Touch controls</b><small>Automatic on iPad and touch devices.</small></div><select id="touch"><option value="auto">Automatic</option><option value="on">Always show</option></select></div>${button("touch-layout", "TOUCH LAYOUT ↗")}${button("local-assets", "LOCAL KIT / CREST ASSETS ↗", "subtle")}<div class="control-guide"><h3>The playbook</h3><p><b>WASD / ARROWS</b> Move <b>SHIFT</b> Sprint <b>SPACE / Z</b> Pass <b>J</b> Tap / hold and release to shoot <b>E</b> Through <b>L</b> Lob <b>K</b> Chip <b>F</b> Finesse <b>C</b> Signature skill <b>V</b> Shield <b>R</b> Tackle <b>X</b> Slide <b>P</b> Hold to press <b>Q</b> Switch</p><p>Balanced keeps every technique with light goal aiming assistance, responsive movement and a green pass receiver ring. Manual gives full directional aim and heavier momentum. On iPad, touch the left movement area for the floating stick. Tap PASS for a short pass or hold to lob; THROUGH leads a run. Tap SHOOT for a normal shot, hold for power, swipe up to chip or sideways for finesse. CHIP is also available directly. Tap SKILL to use your footballer’s signature move, hold to shield. See Pause → Player Skills for every player’s signature. Aim passes with movement. Hold PRESS to close down; your movement overrides the assisted chase. SPRINT is optional and stays in a fixed slot.</p><p>You attack the far goal ↑. Kick Off switches to the receiver; Q switches defenders. Career stays locked to your created player. Tap PASS to call for a teammate pass. Tackle at close range; missed slides leave recovery time. Touchline boards keep the ball in play.</p><p>Career goals count shots you take. AI teammate goals help the team score. Quitting or restarting an unfinished match earns no rewards.</p></div>${button("back", "← BACK", "primary")}${career ? button("reset-career", "RESET CAREER", "danger subtle") : ""}<div id="reset-confirm"></div></section>`,
  );
  bind("touch-layout", () => touchLayoutMenu(from));
  bind("local-assets", () => assetsMenu(() => settingsMenu(from)));
  $("#language").value = settings.language;
  $("#language").onchange = (e) => {
    settings.language = e.target.value;
    applyLanguage();
    saveSettings();
    settingsMenu(from);
  };
  $("#controls").value = settings.controls;
  $("#controls").onchange = (e) => {
    settings.controls = e.target.value;
    input.reset();
    applyTouch();
    saveSettings();
    settingsMenu(from);
  };
  $("#difficulty").value = settings.difficulty;
  $("#difficulty").onchange = (e) => {
    settings.difficulty = e.target.value;
    match.difficulty = settings.difficulty;
    match.players.forEach((p) => {
      p.thinkTime = 0;
    });
    saveSettings();
  };
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
    localize($("#reset-confirm"), settings.language);
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
    skillId: isCareer ? career.skillId : undefined,
    teams: [home, away],
    difficulty: settings.difficulty,
    assisted: settings.controls === "balanced",
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
    `<section class="panel pause-panel">${header("TAKE A BREATHER", "Match paused.", `${match.score[0]} – ${match.score[1]} · ${formatTime(MATCH_SECONDS - match.elapsed)} remaining`)}${button("resume", "RESUME MATCH ↗", "primary")}${button("restart", "RESTART MATCH")}${button("settings", "SETTINGS", "subtle")}${button("player-skills", "PLAYER SKILLS", "subtle")}${button("quit", "RETURN TO MAIN MENU", "subtle")}<p class="fine">Unfinished matches do not award XP or count toward your season.</p></section>`,
  );
  bind("resume", resume);
  bind("restart", () => startMatch(careerMatch));
  bind("settings", () => settingsMenu("pause"));
  bind("player-skills", playerSkillsMenu);
  bind("quit", goMain);
}
function playerSkillsMenu() {
  mode = "skills";
  shell(
    `<section class="panel skills-panel">${header("EVERY PLAYER HAS A SIGNATURE", "Player signatures", "C / tap SKILL activates the selected footballer's own move. Goalkeeper traits work automatically.")}${[
      0, 1,
    ]
      .map(
        (team) =>
          `<h3>${escapeHTML(match.teams?.[team]?.name || (team ? "Rivals" : "Mini FC"))}</h3><div class="skill-roster">${match.players
            .filter((p) => p.team === team)
            .map((p) => {
              const s = getSkill(p.skillId);
              return `<article data-player-skill="${p.id}" class="signature-card"><small>#${p.id + 7} · ${p.role.toUpperCase()}${careerMatch && p.id === 0 ? " · YOU" : ""}</small><b>${skillName(s)}</b><p>${skillInfo(s)}</p></article>`;
            })
            .join("")}</div>`,
      )
      .join("")}${button("back", "← BACK", "primary")}</section>`,
  );
  bind("back", showPause);
}
function resume() {
  mode = "playing";
  screen.hidden = true;
  input.reset();
  input.active = true;
}
function announce(title, sub = "") {
  $("#announcement").innerHTML =
    `<strong>${t(title)}</strong><span>${t(sub)}</span>`;
  // Fade out before the 1.2-second restart freeze ends, keeping live play visible.
  announcementUntil = performance.now() + 950;
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
    `${match.controlled + 7} · ${careerMatch ? career.name.toUpperCase() : match.teams?.[0].name.toUpperCase() || "MINI FC"}${careerMatch ? " · " + t("LOCKED") : ""}`;
  const owner =
    match.ball.owner === null ? null : match.players[match.ball.owner];
  input.setContext(
    owner ? owner.team === 0 : match.ball.lastTeam === 0,
    careerMatch,
  );
  const player = match.players[match.controlled],
    signature = getSkill(player.skillId);
  const skillReady =
    match.ball.owner === player.id &&
    player.skillCooldown <= 0 &&
    player.stamina >= 0.08 &&
    player.recovery <= 0 &&
    player.stunned <= 0;
  const cooldown =
    player.skillCooldown > 0
      ? player.skillCooldown.toFixed(1) +
        (settings.language === "ko" ? "초" : "s")
      : "";
  $("#signature-status").textContent =
    `${skillName(signature)} · ${cooldown || (skillReady ? t("READY") : t("ON THE BALL"))}`;
  $("#skill-button").firstChild.textContent = t(signature.short);
  $("#skill-button small").textContent =
    `${t("SKILL")} · ${cooldown || t("TAP")} / ${t("HOLD: SHIELD")}`;
  $("#skill-button").classList.toggle("cooling", player.skillCooldown > 0);
  $("#skill-button").setAttribute(
    "aria-label",
    `${skillName(signature)}, ${cooldown || t("READY")}`,
  );
  const charge = input.charge();
  match.passAim = input.direction();
  $("#desktop-help").textContent =
    settings.language === "ko"
      ? "WASD 이동 · SPACE 패스 · J 탭/길게 슛 · E 스루 · C 개인기 · V 볼 보호 · P 압박 · ESC 일시정지"
      : "WASD MOVE · SPACE PASS · J TAP / HOLD SHOT · E THROUGH · C SIGNATURE · V SHIELD · P PRESS · ESC PAUSE";
  $("#shot-power").classList.toggle("charging", charge > 0);
  $("#shot-power>span").style.width = `${charge * 100}%`;
  $("#shot-power small").textContent =
    settings.language === "ko"
      ? `${charge > 0 ? "슛 파워 " + Math.round(charge * 100) + "% · 떼면 슛 · " : ""}${document.body.classList.contains("touch") ? "위로 밀기: 칩슛 / 옆으로: 감아차기" : "K 칩슛 / F 감아차기"}`
      : `${charge > 0 ? "POWER " + Math.round(charge * 100) + "% · RELEASE TO SHOOT · " : ""}${document.body.classList.contains("touch") ? "SWIPE ↑ CHIP / SIDEWAYS FINESSE" : "K CHIP / F FINESSE"}`;
  $("#pass-button").firstChild.textContent = t(
    careerMatch && owner?.team === 0 && owner.id !== 0 ? "CALL PASS" : "PASS",
  );
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
          renderer.feedback("goal", 1);
          $(".scorebug").animate(
            [
              { boxShadow: "0 0 0px #f6ca6200" },
              { boxShadow: "0 0 30px #f6ca6288", offset: 0.3 },
              { boxShadow: "0 0 0px #f6ca6200" },
            ],
            { duration: 950 },
          );
          tone(event.team === 0 ? 880 : 180, 0.3, "sine", 0.04);
        }
        if (event.type === "shot") {
          tone(
            event.technique === "power" ? 75 : 110,
            event.technique === "power" ? 0.17 : 0.11,
            "triangle",
            0.06,
          );
          if (event.technique === "power")
            renderer.feedback("shot", event.power);
        }
        if (event.type === "tackle") {
          tone(event.slide ? 85 : 145, 0.1, "triangle", 0.035);
          renderer.feedback("tackle", 0.4);
        }
        if (event.type === "skill" && event.player === match.controlled)
          tone(330, 0.09, "sine", 0.025);
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
      if (match.finished)
        match = new Match({ demo: true, difficulty: settings.difficulty });
    }
    accumulator -= 1 / 60;
  }
  if (mode === "playing") updateHUD();
  if (now > announcementUntil) $("#announcement").classList.remove("visible");
  renderer.draw(
    match,
    dt,
    hud.hidden,
    mode === "playing" || (hud.hidden && match.demo && !match.finished)
      ? accumulator * 60
      : 1,
  );
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
