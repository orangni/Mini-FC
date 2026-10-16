import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../src/match.js";

function isolated(options = {}) {
  const m = new Match({ random: () => 0.5, ...options });
  m.kickoffWait = 0;
  m.ai = () => {};
  m.players.forEach((p, i) =>
    Object.assign(p, {
      x: i % 2 ? 20 : -20,
      z: 20,
      cooldown: 0,
      protected: 0,
      tackleCooldown: 0,
      stunned: 0,
    }),
  );
  Object.assign(m.players[0], { x: 0, z: 0, dx: 0, dz: -1 });
  Object.assign(m.ball, { owner: 0, x: 0, z: -0.95, y: 0.35 });
  return m;
}
const tick = (m, seconds, input = {}) => {
  for (let i = 0; i < seconds * 60; i++) m.step(1 / 60, input);
};

test("standing next to a carrier neither steals nor retries random tackle rolls", () => {
  let rolls = 0;
  const m = isolated({
    random: () => {
      rolls++;
      return 0.99;
    },
  });
  Object.assign(m.players[3], { x: 0, z: -1.3, dx: 0, dz: 1 });
  tick(m, 1);
  assert.equal(m.ball.owner, 0);
  assert.equal(rolls, 0);
  m.players[3].vz = 2;
  assert.equal(m.tackle(3, false, true), true);
  assert.equal(m.ball.owner, 3);
  assert.equal(rolls, 0);
});

test("shielding blocks a deliberate challenge from behind until released", () => {
  const m = isolated();
  Object.assign(m.players[3], { x: 0, z: 1.2, dx: 0, dz: -1 });
  tick(m, 0.6, { shield: true });
  assert.equal(m.ball.owner, 0);
  assert.equal(m.tackle(3), false);
  m.players[3].tackleCooldown = 0;
  m.players[0].shield = false;
  assert.equal(m.tackle(3), true);
  assert.equal(m.ball.owner, 3);
});

test("a caught keeper ball cannot be taken by any standing, sliding or automatic tackle", () => {
  for (const team of [0, 1])
    for (const mode of ["standing", "slide", "automatic"]) {
      const m = isolated({ random: () => 0 });
      const keeper = m.players[team ? 11 : 8],
        attacker = m.players[team ? 0 : 3];
      Object.assign(keeper, {
        x: 0,
        z: team ? -32 : 32,
        protected: 0,
        cooldown: 0,
      });
      Object.assign(attacker, { x: 0, z: keeper.z + (team ? 1 : -1) });
      Object.assign(m.ball, { owner: keeper.id, x: 0, z: keeper.z, y: 0.35 });
      assert.equal(
        m.tackle(attacker.id, mode === "slide", mode === "automatic"),
        false,
      );
      assert.equal(m.ball.owner, keeper.id);
      const { x, z } = keeper;
      attacker.x = x;
      attacker.z = z;
      tick(m, 0.6);
      assert.equal(m.ball.owner, keeper.id);
      assert.equal(keeper.x, x);
      assert.equal(keeper.z, z);
      assert.equal(m.ball.y, 1.6);
    }
});

test("keepers retain possession under pressure and then distribute normally", () => {
  const m = isolated();
  m.ai = (p, dt) => {
    if (p.role === "goalkeeper") m.goalkeeper(p, dt);
  };
  Object.assign(m.players[8], { x: 0, z: 32 });
  Object.assign(m.players[3], { x: 0, z: 30.7 });
  Object.assign(m.ball, { owner: 8, x: 0, z: 32, y: 1.6 });
  tick(m, 0.75);
  assert.equal(m.ball.owner, 8);
  tick(m, 0.15);
  assert.notEqual(m.ball.owner, 8);
  assert.ok(m.takeEvents().some((e) => e.type === "pass"));
});

test("first touch gives time to turn or pass before contact tackles resume", () => {
  const m = isolated({ random: () => 0 });
  Object.assign(m.players[3], { x: 0, z: -1.3, dx: 0, dz: 1 });
  m.acquire(m.players[0]);
  tick(m, 0.65);
  assert.equal(m.ball.owner, 0);
  tick(m, 0.25);
  assert.equal(m.tackle(3), true);
  assert.equal(m.ball.owner, 3);
});

test("kickoffs keep opponents clear and give their owner initial protection", () => {
  for (const team of [0, 1]) {
    const m = new Match();
    m.kickoff(team);
    const owner = m.players[m.ball.owner];
    assert.ok(owner.protected >= 1);
    for (const p of m.players.filter((p) => p.team !== team))
      assert.ok(Math.hypot(p.x - owner.x, p.z - owner.z) >= 6);
    tick(m, 1);
    assert.ok(owner.protected >= 1);
    assert.equal(m.elapsed, 0);
  }
});

test("a shot tapped just before a reception executes once on the receiving player", () => {
  const m = isolated();
  Object.assign(m.ball, { owner: null, x: 0, z: -2, vx: 0, vz: 5, vy: 0 });
  m.step(1 / 60, { shoot: true });
  assert.equal(m.stats.shots, 0);
  tick(m, 0.2);
  assert.equal(m.stats.shots, 1);
  tick(m, 0.5);
  assert.equal(m.stats.shots, 1);
});

test("an early action expires and does not fire after an unrelated late reception", () => {
  const m = isolated();
  Object.assign(m.ball, { owner: null, x: 10, z: 0, vx: 0, vz: 0 });
  m.step(1 / 60, { shoot: true });
  tick(m, 0.4);
  m.acquire(m.players[0]);
  m.step(1 / 60);
  assert.equal(m.stats.shots, 0);
});

test("defensive selection remains until an intentional switch, with repeat protection", () => {
  const m = isolated();
  Object.assign(m.players[3], { x: 0, z: -20, cooldown: 10 });
  Object.assign(m.players[1], { x: 0, z: -20 });
  Object.assign(m.players[2], { x: 15, z: 20 });
  Object.assign(m.ball, { owner: 3, x: 0, z: -20 });
  m.controlled = 1;
  assert.equal(m.switchPlayer(), true);
  const selected = m.controlled;
  assert.equal(m.switchPlayer(), false);
  tick(m, 0.6);
  assert.equal(m.controlled, selected);
  tick(m, 1);
  assert.equal(m.controlled, selected);
  assert.equal(m.switchPlayer(), true);
  assert.equal(m.controlled, 1);
});

test("a keeper cannot save a ball that has already crossed the goal line", () => {
  const m = isolated();
  Object.assign(m.players[11], {
    x: 0,
    z: -33.5,
    action: "dive",
    actionTime: 1,
  });
  Object.assign(m.ball, { owner: null, x: 0, z: -34.99, y: 1, vx: 0, vz: -15 });
  m.step(1 / 60);
  assert.deepEqual(m.score, [1, 0]);
  assert.equal(m.stats.saves[1], 0);
});

test("holding sprint with depleted stamina recovers smoothly instead of flickering each frame", () => {
  const m = isolated(),
    p = m.players[0];
  p.stamina = 0.05;
  const speeds = [];
  for (let i = 0; i < 60; i++) {
    m.move(p, 1, 0, true, 1 / 60);
    speeds.push(p.moving);
  }
  assert.ok(speeds.every((s) => s < 10));
  assert.ok(p.stamina > 0.17);
  for (let i = 0; i < 40; i++) m.move(p, 1, 0, true, 1 / 60);
  assert.ok(p.moving > 10);
});

test("career rejects reassignment before movement and never drives a teammate", () => {
  const m = isolated({ career: true });
  Object.assign(m.players[1], { x: 10, z: 0 });
  m.controlled = 1;
  assert.equal(m.controlled, 0);
  m.step(1 / 60, { x: 1, switch: true });
  assert.equal(m.controlled, 0);
  assert.ok(m.players[0].vx > 0);
  assert.equal(m.players[1].vx, 0);
  assert.equal(m.players[1].x, 10);
  for (const owner of [1, 8, 3, 11]) {
    m.ball.owner = owner;
    m.controlled = owner;
    m.step(1 / 60, { switch: true, z: -1 });
    assert.equal(m.controlled, 0);
  }
});
