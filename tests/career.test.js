import test from "node:test";
import assert from "node:assert/strict";
import {
  newCareer,
  overall,
  finishMatch,
  upgrade,
  standings,
  nextSeason,
  saveCareer,
  loadCareer,
  SAVE_KEY,
  FIXTURES,
  opponent,
} from "../src/career.js";
const stats = { goals: 2 };
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
}
test("custom captain starts at 60 overall and requested position", () => {
  const c = newCareer("  Alex  ", "Midfielder");
  assert.equal(c.name, "Alex");
  assert.equal(c.position, "Midfielder");
  assert.equal(overall(c), 60);
  assert.equal(c.points, 0);
});
test("win, draw, loss and personal goals earn exact rewards", () => {
  const c = newCareer("Sam", "Defender");
  const reward = finishMatch(c, [3, 1], stats, () => 0.5);
  assert.equal(reward.xp, 220);
  assert.equal(c.points, 2);
  assert.equal(c.wins, 1);
  assert.equal(c.goals, 2);
  finishMatch(c, [1, 1], { goals: 0 });
  finishMatch(c, [0, 1], { goals: 0 });
  assert.equal(c.xp, 370);
  assert.equal(c.draws, 1);
  assert.equal(c.losses, 1);
  assert.equal(c.played, 3);
  assert.equal(c.points, 3);
});
test("upgrades consume points, persist, affect overall and cap at 99", () => {
  const c = newCareer("Sam", "Striker");
  assert.equal(upgrade(c, "pace"), false);
  c.points = 20;
  assert.equal(upgrade(c, "pace"), true);
  assert.equal(c.attributes.pace, 63);
  assert.equal(overall(c), 61);
  assert.equal(c.points, 19);
  for (let i = 0; i < 30; i++) upgrade(c, "pace");
  assert.equal(c.attributes.pace, 99);
  assert.equal(upgrade(c, "bad"), false);
  assert.equal(upgrade(c, "pace"), false);
});
test("five rounds play every unique fixture once and all clubs play five games", () => {
  const pairs = FIXTURES.flat().map((pair) => [...pair].sort().join("-"));
  assert.equal(new Set(pairs).size, 15);
  const c = newCareer("A", "Striker");
  const rivals = new Set();
  for (let i = 0; i < 5; i++) {
    rivals.add(opponent(c));
    finishMatch(c, [8, 0], { goals: 1 }, () => 0.5);
  }
  assert.equal(rivals.size, 5);
  assert.ok(c.table.every((r) => r.played === 5));
  assert.equal(standings(c)[0].name, "Mini FC");
  assert.equal(c.championships, 1);
  assert.equal(c.lastReward.champion, true);
  assert.equal(c.lastReward.points, 5);
  assert.throws(() => finishMatch(c, [1, 0], stats));
  const points = c.points;
  assert.equal(nextSeason(c), true);
  assert.equal(c.season, 2);
  assert.equal(c.seasonMatch, 0);
  assert.equal(c.points, points);
  assert.ok(c.table.every((r) => r.points === 0));
  assert.equal(nextSeason(c), false);
});
test("career round trip retains upgrades, standings, records and season", () => {
  const c = newCareer("<Captain>", "Striker"),
    storage = memoryStorage();
  finishMatch(c, [3, 0], stats);
  upgrade(c, "shooting");
  saveCareer(storage, c);
  assert.deepEqual(loadCareer(storage), c);
  assert.equal(loadCareer(storage).attributes.shooting, 63);
});
test("corrupt, incompatible and unavailable saves fail safely", () => {
  const storage = memoryStorage();
  assert.equal(loadCareer(storage), null);
  storage.setItem(SAVE_KEY, "broken");
  assert.equal(loadCareer(storage), null);
  const c = newCareer("A", "Striker");
  c.attributes.pace = 10000;
  saveCareer(storage, c);
  assert.equal(loadCareer(storage), null);
  assert.equal(
    loadCareer({
      getItem() {
        throw new Error("blocked");
      },
    }),
    null,
  );
});
