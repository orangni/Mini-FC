import test from "node:test";
import assert from "node:assert/strict";
import { Match, TEAM_IDS } from "../src/match.js";
import { shotGesture } from "../src/input.js";
import {
  CLUB_DATABASE,
  getClub,
  searchClubs,
  selectKits,
  colourDistance,
  ROSTER_STATUS,
} from "../src/clubs.js";
import {
  newCareer,
  finishMatch,
  nextSeason,
  saveCareer,
  loadCareer,
  SAVE_KEY,
} from "../src/career.js";
const tick = (m, t, input = {}) => {
  for (let i = 0; i < t * 60; i++) m.step(1 / 60, input);
};
function clearMatch(options = {}) {
  const m = new Match({ random: () => 0.5, ...options });
  m.kickoffWait = 0;
  m.players.forEach((p, i) => {
    p.x = i % 2 ? 20 : -20;
    p.z = 15;
    p.cooldown = 5;
  });
  Object.assign(m.players[0], { x: 0, z: -16, dx: 0, dz: -1, cooldown: 0 });
  Object.assign(m.ball, { owner: 0, x: 0, z: -17 });
  return m;
}
test("6v6 has exactly five outfielders and one automatic keeper on each side", () => {
  const m = new Match();
  assert.equal(m.players.length, 12);
  for (const team of [0, 1]) {
    const players = m.players.filter((p) => p.team === team);
    assert.equal(players.length, 6);
    assert.equal(players.filter((p) => p.role === "goalkeeper").length, 1);
    assert.equal(players.filter((p) => p.role !== "goalkeeper").length, 5);
    assert.equal(new Set(TEAM_IDS[team]).size, 6);
  }
  assert.notEqual(m.nearest(0, m.players[8]).role, "goalkeeper");
});
test("keeper tracks the ball within the goal area and returns after a dive", () => {
  const m = new Match();
  m.kickoffWait = 0;
  const keeper = m.players[11];
  keeper.x = -4;
  keeper.action = "dive";
  keeper.actionTime = 0.5;
  Object.assign(m.players[0], { x: 17, z: -10 });
  m.ball.owner = 0;
  tick(m, 1);
  assert.ok(keeper.x > 0);
  assert.ok(keeper.z < -30 && keeper.z > -34);
  assert.equal(keeper.action, "");
});
test("keeper catches a slow shot and distributes to an outfielder", () => {
  const m = clearMatch();
  const keeper = m.players[11];
  Object.assign(keeper, { x: 0, z: -32.4, saveCooldown: 0 });
  Object.assign(m.ball, {
    owner: null,
    x: 0,
    z: -31.3,
    y: 1,
    vx: 0,
    vz: -15,
    vy: 0,
  });
  m.step(1 / 60);
  assert.equal(m.ball.owner, 11);
  assert.equal(m.stats.saves[1], 1);
  assert.ok(m.takeEvents().some((e) => e.type === "save" && e.catch));
  tick(m, 1);
  assert.notEqual(m.ball.owner, 11);
  assert.equal(m.controlled, 0);
});
test("keeper parries a fast shot back into play with a rebound", () => {
  const m = clearMatch({ random: () => 0.95 }),
    keeper = m.players[11];
  Object.assign(keeper, { x: 0, z: -32.4, action: "dive", actionTime: 0.7 });
  Object.assign(m.ball, {
    owner: null,
    x: 1,
    z: -31.6,
    y: 1.7,
    vx: 0,
    vz: -34,
    vy: 0,
  });
  m.step(1 / 60);
  assert.equal(m.stats.saves[1], 1);
  assert.equal(m.ball.owner, null);
  assert.ok(m.ball.vz > 0);
  assert.ok(m.ball.vy > 0);
  assert.ok(m.takeEvents().some((e) => e.type === "save" && !e.catch));
});
test("normal, charged power, chip and finesse shots have distinct trajectories", () => {
  const normal = clearMatch(),
    power = clearMatch(),
    chip = clearMatch(),
    finesse = clearMatch();
  normal.shoot(0, true);
  power.shoot(0, true, { type: "power", power: 1 });
  chip.shoot(0, true, { type: "chip" });
  finesse.shoot(0, true, { type: "finesse" });
  assert.ok(
    Math.hypot(power.ball.vx, power.ball.vz) >
      Math.hypot(normal.ball.vx, normal.ball.vz) + 8,
  );
  assert.ok(chip.ball.vy > normal.ball.vy + 3);
  assert.notEqual(finesse.ball.curve, 0);
  assert.equal(normal.ball.curve, 0);
  tick(chip, 0.4);
  tick(normal, 0.4);
  assert.ok(chip.ball.y > normal.ball.y + 0.6);
  const previous = finesse.ball.vx;
  finesse.step(1 / 60);
  assert.notEqual(finesse.ball.vx, previous);
});
test("accuracy responds to stats, pressure, distance and angle", () => {
  const high = clearMatch({
    attributes: { pace: 60, passing: 60, shooting: 99 },
    random: () => 0.8,
  });
  const low = clearMatch({
    attributes: { pace: 60, passing: 60, shooting: 60 },
    random: () => 0.8,
  });
  high.shoot(0, true, { aimX: 0 });
  low.shoot(0, true, { aimX: 0 });
  assert.ok(
    Math.abs(high.ball.vx / high.ball.vz) < Math.abs(low.ball.vx / low.ball.vz),
  );
  const pressured = clearMatch({ random: () => 0.8 });
  Object.assign(pressured.players[3], { x: 2, z: -16 });
  pressured.shoot(0, true, { aimX: 0 });
  assert.ok(
    Math.abs(pressured.ball.vx / pressured.ball.vz) >
      Math.abs(low.ball.vx / low.ball.vz),
  );
});
test("short, through and lobbed passes differ in target and loft", () => {
  const a = clearMatch(),
    b = clearMatch(),
    c = clearMatch();
  a.pass(0);
  b.pass(0, "through");
  c.pass(0, "lob");
  assert.ok(c.ball.vy > a.ball.vy + 3);
  assert.ok(b.pendingPass.target.z < a.pendingPass.target.z);
  assert.equal(a.stats.passes, 1);
});
test("standing and sliding tackles transfer or knock possession, with recovery cooldowns", () => {
  for (const slide of [false, true]) {
    const m = clearMatch();
    m.ball.owner = 3;
    Object.assign(m.players[3], { x: 0, z: -17, cooldown: 0 });
    Object.assign(m.players[0], {
      x: 0,
      z: -16,
      dx: 0,
      dz: -1,
      tackleCooldown: 0,
    });
    assert.equal(m.tackle(0, slide), true);
    assert.equal(m.stats.tackles, 1);
    assert.ok(m.players[0].tackleCooldown > 0);
    if (slide) {
      assert.equal(m.ball.owner, null);
      assert.ok(m.players[0].slideTime > 0);
    } else assert.equal(m.ball.owner, 0);
    assert.equal(m.tackle(0, slide), false);
  }
});
test("shielding and feints protect possession and have a real movement/cooldown effect", () => {
  const m = clearMatch();
  Object.assign(m.players[3], { x: 0, z: -17, cooldown: 0 });
  m.players[0].shield = true;
  assert.equal(m.tackle(3), false);
  m.players[0].shield = false;
  m.players[3].tackleCooldown = 0;
  assert.equal(m.skill(0), true);
  assert.ok(Math.abs(m.players[0].x) > 1);
  assert.ok(m.players[0].protected > 0);
  assert.equal(m.skill(0), false);
});
test("career control stays on the captain, while Kick Off can switch and follow passes", () => {
  const m = clearMatch({ career: true });
  m.pass(0);
  assert.equal(m.controlled, 0);
  assert.equal(m.switchPlayer(), false);
  m.ball.owner = 1;
  m.step(1 / 60);
  assert.equal(m.controlled, 0);
  const kick = clearMatch();
  const before = kick.controlled;
  assert.equal(kick.switchPlayer(), true);
  assert.notEqual(kick.controlled, before);
  assert.notEqual(kick.players[kick.controlled].role, "goalkeeper");
});
test("career position changes formation slot and upgrades only affect the created player", () => {
  const m = new Match({
    career: true,
    position: "Defender",
    attributes: { pace: 99, passing: 99, shooting: 99 },
  });
  assert.equal(m.players[0].role, "defender");
  assert.equal(m.players[0].slot, 3);
  assert.equal(m.attributesFor(m.players[0]).pace, 99);
  assert.notEqual(m.attributesFor(m.players[1]).pace, 99);
});
test("first touch cushions a fast ball better with improved passing/control", () => {
  const a = clearMatch({ attributes: { pace: 60, shooting: 60, passing: 60 } }),
    b = clearMatch({ attributes: { pace: 60, shooting: 60, passing: 99 } });
  for (const m of [a, b]) {
    m.players[0].dx = 1;
    m.players[0].dz = 0;
    m.ball.vx = 35;
    m.acquire(m.players[0]);
  }
  assert.ok(a.players[0].x > b.players[0].x);
  assert.ok(a.players[0].cooldown > b.players[0].cooldown);
});
test("a captain pass followed by a teammate goal awards an assist and match rating", () => {
  const m = clearMatch({ career: true });
  Object.assign(m.players[1], { x: 2, z: -24, dx: 0, dz: -1 });
  m.pass(0, "short", 1);
  m.acquire(m.players[1]);
  m.shoot(1, false);
  tick(m, 0.6);
  assert.equal(m.score[0], 1);
  assert.equal(m.stats.goals, 0);
  assert.equal(m.stats.assists, 1);
  assert.ok(m.rating() > 6);
});
test("touch taps, holds and swipes produce normal, power, chip and finesse commands", () => {
  assert.equal(shotGesture(80).shotType, "normal");
  assert.equal(shotGesture(1000).shotType, "power");
  assert.ok(shotGesture(1000).power > 0.8);
  assert.equal(shotGesture(100, 0, -50).shotType, "chip");
  assert.equal(shotGesture(100, 60, 0).shotType, "finesse");
});
test("user-supplied club database contains all 50 requested clubs and no invented remaining nine", () => {
  assert.equal(CLUB_DATABASE.length, 50);
  assert.equal(new Set(CLUB_DATABASE.map((c) => c.id)).size, 50);
  assert.deepEqual(
    Object.fromEntries(
      ["PL", "BL", "SA", "FR"].map((l) => [
        l,
        CLUB_DATABASE.filter((c) => c.league === l).length,
      ]),
    ),
    { PL: 20, BL: 9, SA: 20, FR: 1 },
  );
  assert.equal(getClub("coventry").league, "PL");
  assert.equal(getClub("hull").league, "PL");
  assert.equal(getClub("venezia").league, "SA");
  assert.equal(getClub("psg").league, "FR");
  assert.equal(ROSTER_STATUS.verified, false);
  for (const c of CLUB_DATABASE) {
    assert.ok(c.name && c.formation);
    for (const k of ["home", "away"])
      for (const field of ["shirt", "secondary", "shorts", "socks"])
        assert.match(c[k][field], /^#[a-f0-9]{6}$/i);
    for (const v of Object.values(c.ratings)) assert.ok(v >= 1 && v <= 99);
  }
  assert.equal(searchClubs("city", "PL").length, 3);
  assert.equal(searchClubs("leverkusen", "BL")[0].id, "leverkusen");
});
test("automatic alternate kits avoid colour clashes, including identical-club matches", () => {
  for (const a of CLUB_DATABASE)
    for (const b of CLUB_DATABASE) {
      const kits = selectKits(a, b);
      assert.ok(colourDistance(kits.home.shirt, kits.away.shirt) >= 130);
    }
  assert.equal(
    selectKits(getClub("arsenal"), getClub("arsenal")).awayAlternate,
    true,
  );
});
test("new club careers retain five-match seasons and select opponents from the same league", () => {
  for (const id of ["arsenal", "bayern", "inter"]) {
    const c = newCareer("A", "Striker", id);
    const league = getClub(id).league;
    assert.equal(c.table[0].name, getClub(id).name);
    assert.ok(
      c.table.every(
        (r) => CLUB_DATABASE.find((x) => x.name === r.name)?.league === league,
      ),
    );
    for (let i = 0; i < 5; i++)
      finishMatch(c, [4, 0], { goals: 1, assists: 1, rating: 8 });
    assert.equal(c.assists, 5);
    assert.equal(c.ratingTotal, 40);
    assert.equal(nextSeason(c), true);
    assert.equal(c.clubId, id);
  }
});
test("original v1 saves migrate without losing XP, attributes, season or league progress", () => {
  const original = newCareer("Original", "Midfielder");
  original.version = 1;
  delete original.clubId;
  delete original.assists;
  delete original.ratingTotal;
  delete original.lastRating;
  finishMatch(original, [2, 0], { goals: 1 });
  delete original.assists;
  delete original.ratingTotal;
  delete original.lastRating;
  const data = new Map([[SAVE_KEY, JSON.stringify(original)]]),
    storage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
    };
  const migrated = loadCareer(storage);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.clubId, "mini-fc");
  assert.equal(migrated.xp, original.xp);
  assert.equal(migrated.seasonMatch, 1);
  assert.deepEqual(migrated.table, original.table);
  assert.deepEqual(migrated.attributes, original.attributes);
  saveCareer(storage, migrated);
  assert.equal(data.get(SAVE_KEY + "-backup-v1"), JSON.stringify(original));
  assert.deepEqual(loadCareer(storage), migrated);
});
test("pressing adds a supporting defender, while a missed slide imposes recovery", () => {
  const m = clearMatch();
  m.ball.owner = 3;
  Object.assign(m.players[3], { x: 0, z: 0, cooldown: 5 });
  Object.assign(m.players[0], { x: 0, z: -10 });
  m.step(1 / 60, { press: true, z: 1 });
  assert.equal(m.pressing, true);
  assert.ok(m.players[0].moving > 10);
  assert.ok(m.players[0].stamina < 1);
  const miss = clearMatch();
  miss.ball.owner = 3;
  assert.equal(miss.tackle(0, true), false);
  assert.ok(miss.players[0].tackleCooldown > 2);
  assert.ok(miss.players[0].slideTime > 0);
});
test("coincident players separate without NaNs and stay within pitch boards", () => {
  const m = new Match({ demo: true });
  m.kickoffWait = 0;
  m.players.forEach((p) => {
    p.x = 0;
    p.z = 0;
  });
  tick(m, 1);
  assert.equal(
    new Set(m.players.map((p) => `${p.x.toFixed(2)}:${p.z.toFixed(2)}`)).size,
    12,
  );
  assert.ok(
    m.players.every(
      (p) =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.z) &&
        Math.abs(p.x) <= 22 &&
        Math.abs(p.z) <= 33.5,
    ),
  );
});
