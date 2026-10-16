import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../src/match.js";
const tick = (m, t, input = {}) => {
  for (let i = 0; i < t * 60; i++) m.step(1 / 60, input);
};
function setup(assisted = true, career = false) {
  const m = new Match({ assisted, career, random: () => 0.5 });
  m.kickoffWait = 0;
  m.ai = () => {};
  m.players.forEach((p, i) =>
    Object.assign(p, {
      x: p.team ? 20 : -20,
      z: 15 + i * 0.6,
      protected: 0,
      cooldown: 0,
    }),
  );
  Object.assign(m.players[0], { x: 0, z: 0, dx: 0, dz: -1 });
  Object.assign(m.players[1], { x: -10, z: -8 });
  Object.assign(m.players[2], { x: 10, z: -8 });
  Object.assign(m.ball, { owner: 0, x: 0, z: -0.75, y: 0.35 });
  return m;
}
test("Simple controls stop sooner and respond faster without changing teammate movement", () => {
  const simple = setup(),
    advanced = setup(false);
  for (const m of [simple, advanced]) tick(m, 0.3, { x: 1 });
  assert.ok(simple.players[0].x > advanced.players[0].x);
  const sx = simple.players[0].x,
    ax = advanced.players[0].x;
  for (const m of [simple, advanced]) tick(m, 0.2);
  assert.ok(simple.players[0].x - sx < (advanced.players[0].x - ax) * 0.6);
  for (let i = 0; i < 30; i++) {
    simple.move(simple.players[1], 1, 0, false, 1 / 60);
    advanced.move(advanced.players[1], 1, 0, false, 1 / 60);
  }
  assert.equal(simple.players[1].moving, advanced.players[1].moving);
});
test("Simple shots aim at goal independently of a sideways movement direction", () => {
  const left = setup(),
    right = setup();
  for (const m of [left, right]) {
    m.players[0].z = -20;
    m.ball.z = -20.75;
  }
  left.shoot(0, true, { direction: { x: -1, z: 0 } });
  right.shoot(0, true, { direction: { x: 1, z: 0 } });
  assert.equal(left.ball.vx, right.ball.vx);
  assert.equal(left.ball.vz, right.ball.vz);
  assert.ok(Math.abs(left.ball.vx / left.ball.vz) < 0.3);
});
test("Simple still permits deliberate advanced placement instead of overriding explicit aim", () => {
  const left = setup(),
    right = setup();
  for (const m of [left, right]) {
    m.players[0].z = -20;
    m.ball.z = -20.75;
  }
  left.shoot(0, true, { aimX: -3 });
  right.shoot(0, true, { aimX: 3 });
  assert.ok(left.ball.vx < 0 && right.ball.vx > 0);
});
test("Simple keeps sprint touches closer than Advanced", () => {
  const simple = setup(),
    advanced = setup(false);
  for (const m of [simple, advanced]) tick(m, 0.8, { x: 1, sprint: true });
  const gap = (m) =>
    Math.hypot(m.ball.x - m.players[0].x, m.ball.z - m.players[0].z);
  assert.ok(gap(simple) < gap(advanced) - 0.15);
});
test("holding defence approaches and tackles while career identity stays locked", () => {
  const m = setup(true, true);
  Object.assign(m.players[3], { x: 0, z: -7, dx: 0, dz: 1 });
  Object.assign(m.ball, { owner: 3, x: 0, z: -7, y: 0.35 });
  tick(m, 1, { press: true });
  assert.equal(m.controlled, 0);
  assert.ok(m.players[0].z < -3);
  assert.equal(m.ball.owner, 0);
  assert.ok(m.stats.tackles > 0);
});
test("movement overrides the assisted defensive chase", () => {
  const m = setup(true, true);
  Object.assign(m.players[3], { x: 0, z: -7 });
  Object.assign(m.ball, { owner: 3, x: 0, z: -7 });
  tick(m, 0.4, { x: 1, press: true });
  assert.ok(m.players[0].x > 2);
  assert.ok(Math.abs(m.players[0].z) < 0.1);
});
test("career receive assistance moves only the created receiver", () => {
  const m = setup(true, true);
  Object.assign(m.players[1], { x: -6, z: -6 });
  m.ball.owner = 1;
  m.pass(1, "short", 0);
  tick(m, 0.15);
  assert.equal(m.controlled, 0);
  assert.ok(m.players[0].moving > 0);
});
test("pressing selects a nearby defender only on explicit intent in Kick Off, never career", () => {
  for (const career of [false, true]) {
    const m = setup(true, career);
    Object.assign(m.players[3], { x: 0, z: -20, dx: 0, dz: 1 });
    Object.assign(m.players[1], { x: 0, z: -17 });
    Object.assign(m.ball, { owner: 3, x: 0, z: -19 });
    m.step(1 / 60);
    assert.equal(m.controlled, 0);
    m.step(1 / 60, { press: true });
    assert.equal(m.controlled, career ? 0 : 1);
  }
});
