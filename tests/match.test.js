import test from "node:test";
import assert from "node:assert/strict";
import { Match, MATCH_SECONDS } from "../src/match.js";

const tick = (m, seconds, input = {}) => {
  for (let i = 0; i < seconds * 60; i++) m.step(1 / 60, input);
};
function clearShot(team = 0) {
  const m = new Match({ random: () => 0.5 });
  m.kickoffWait = 0;
  m.players.forEach((p, i) => {
    p.x = i % 2 ? 17 : -17;
    p.z = 0;
    p.cooldown = 10;
    p.protected = 0;
  });
  for (const id of [6, 7]) {
    m.players[id].x = 20;
    m.players[id].z = 25;
  }
  const p = m.players[team === 0 ? 0 : 3];
  p.x = 0;
  p.z = team === 0 ? -24 : 24;
  p.dx = 0;
  p.dz = team === 0 ? -1 : 1;
  Object.assign(m.ball, { x: 0, z: p.z + p.dz, owner: p.id });
  m.controlled = 0;
  return m;
}
test("twelve players, two teams, kickoff possession, and two-minute clock", () => {
  const m = new Match();
  assert.equal(m.players.length, 12);
  assert.equal(m.players.filter((p) => p.team === 0).length, 6);
  assert.equal(m.ball.owner, 0);
  tick(m, 1);
  assert.equal(m.elapsed, 0);
  tick(m, 1);
  assert.ok(m.elapsed > 0);
});
test("keyboard-equivalent movement, diagonal normalization, sprint and stamina", () => {
  const straight = new Match(),
    diagonal = new Match(),
    sprint = new Match();
  for (const m of [straight, diagonal, sprint]) {
    m.kickoffWait = 0;
    m.players.slice(1).forEach((p) => {
      p.x = 20;
      p.z = -30;
    });
  }
  tick(straight, 0.5, { x: 1 });
  tick(diagonal, 0.5, { x: 1, z: -1 });
  tick(sprint, 0.5, { x: 1, sprint: true });
  assert.ok(
    Math.abs(
      Math.hypot(diagonal.players[0].x, diagonal.players[0].z - 1) -
        straight.players[0].x,
    ) < 0.05,
  );
  assert.ok(sprint.players[0].x > straight.players[0].x * 1.3);
  assert.ok(sprint.players[0].stamina < 1);
  assert.ok(Math.abs(straight.ball.x - straight.players[0].x) < 1.65);
});
test("a user shot crosses the goal line, scores once, and gives rivals kickoff", () => {
  const m = clearShot();
  assert.equal(m.shoot(0, true), true);
  tick(m, 0.5);
  assert.deepEqual(m.score, [1, 0]);
  assert.equal(m.stats.goals, 1);
  assert.equal(m.stats.shots, 1);
  assert.equal(m.ball.owner, 3);
  tick(m, 0.5);
  assert.deepEqual(m.score, [1, 0]);
  assert.equal(m.takeEvents().filter((e) => e.type === "goal").length, 1);
});
test("opponent goal and high/wide shots are detected correctly", () => {
  const m = clearShot(1);
  m.shoot(3);
  tick(m, 0.5);
  assert.deepEqual(m.score, [0, 1]);
  assert.equal(m.stats.goals, 0);
  for (const [x, y] of [
    [8, 0.4],
    [0, 5],
  ]) {
    const wide = new Match();
    wide.kickoffWait = 0;
    Object.assign(wide.ball, {
      owner: null,
      x,
      y,
      z: -34.9,
      vz: -15,
      vx: 0,
      vy: 0,
    });
    wide.step(1 / 60);
    assert.deepEqual(wide.score, [0, 0]);
    assert.ok(wide.ball.vz > 0);
  }
});
test("passing releases ball, switches control, and can complete to receiver", () => {
  const m = clearShot();
  const p = m.players[0];
  p.x = -10;
  p.z = 0;
  Object.assign(m.ball, { x: -10, z: -0.9 });
  m.players[1].x = 0;
  m.players[1].z = -5;
  m.players[2].x = 20;
  m.players[2].z = 20;
  assert.equal(m.pass(0), true);
  assert.equal(m.controlled, 1);
  assert.equal(m.ball.owner, null);
  assert.equal(m.stats.passes, 1);
  tick(m, 0.7);
  assert.equal(m.ball.owner, 1);
  assert.equal(m.stats.completedPasses, 1);
});
test("automatic tackle transfers possession without immediate steal-back", () => {
  const m = clearShot();
  m.players[0].cooldown = 0;
  m.players[3].cooldown = 0;
  m.players[3].x = 0;
  m.players[3].z = -25.3;
  m.players[3].dz = 1;
  m.players[3].vz = 3;
  m.step(1 / 60);
  assert.equal(m.ball.owner, 3);
  m.step(1 / 60);
  assert.equal(m.ball.owner, 3);
});
test("AI completes a full match, moves, passes/shoots and produces goals", () => {
  let seed = 123456;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const m = new Match({ demo: true, random });
  let shots = 0,
    passes = 0;
  for (let i = 0; i < 60 * 170 && !m.finished; i++) {
    m.step(1 / 60);
    const events = m.takeEvents();
    shots += events.filter((e) => e.type === "shot").length;
    passes += events.filter((e) => e.type === "pass").length;
    for (const p of m.players)
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
  }
  assert.equal(m.finished, true);
  assert.equal(m.elapsed, MATCH_SECONDS);
  assert.ok(shots > 3);
  assert.ok(m.score[0] + m.score[1] > 0);
  assert.ok(passes > 0);
  const before = [...m.score];
  tick(m, 5, { shoot: true });
  assert.deepEqual(m.score, before);
});
test("full-time is emitted once and no actions work afterward", () => {
  const m = clearShot();
  m.elapsed = 119.99;
  m.step(1 / 60);
  assert.equal(m.finished, true);
  assert.equal(m.takeEvents().filter((e) => e.type === "fulltime").length, 1);
  m.step(1 / 60);
  assert.equal(m.takeEvents().length, 0);
  assert.equal(m.shoot(0), false);
  assert.equal(m.pass(0), false);
});
test("touchline boards rebound a loose ball and keep it in bounds", () => {
  const m = new Match();
  m.kickoffWait = 0;
  Object.assign(m.ball, { owner: null, x: 22.65, z: 10, y: 2, vx: 20 });
  m.step(1 / 60);
  assert.ok(m.ball.vx < 0);
  assert.ok(m.ball.x <= 22.7);
});
