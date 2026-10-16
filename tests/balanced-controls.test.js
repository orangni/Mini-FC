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
test("Balanced controls stop sooner and respond faster without changing teammate movement", () => {
  const balanced = setup(),
    advanced = setup(false);
  for (const m of [balanced, advanced]) tick(m, 0.3, { x: 1 });
  assert.ok(balanced.players[0].x > advanced.players[0].x);
  const sx = balanced.players[0].x,
    ax = advanced.players[0].x;
  for (const m of [balanced, advanced]) tick(m, 0.2);
  assert.ok(balanced.players[0].x - sx < (advanced.players[0].x - ax) * 0.6);
  for (let i = 0; i < 30; i++) {
    balanced.move(balanced.players[1], 1, 0, false, 1 / 60);
    advanced.move(advanced.players[1], 1, 0, false, 1 / 60);
  }
  assert.equal(balanced.players[1].moving, advanced.players[1].moving);
});
test("Balanced aiming preserves both directions with gentler placement than Manual", () => {
  const projected = (assisted, x) => {
    const m = setup(assisted);
    m.players[0].z = -20;
    m.ball.z = -20.75;
    m.shoot(0, true, { direction: { x, z: 0 } });
    return m.ball.x + ((-36 - m.ball.z) * m.ball.vx) / m.ball.vz;
  };
  const left = projected(true, -1),
    right = projected(true, 1);
  assert.ok(
    left < 0 && right > 0,
    "left/right input must retain deliberate placement",
  );
  assert.ok(right - left < projected(false, 1) - projected(false, -1));
  assert.ok(Math.abs(left) < 5 && Math.abs(right) < 5);
});
test("Balanced preserves explicit finesse placement", () => {
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
test("Balanced keeps sprint touches closer than Manual", () => {
  const balanced = setup(),
    advanced = setup(false);
  for (const m of [balanced, advanced]) tick(m, 0.8, { x: 1, sprint: true });
  const gap = (m) =>
    Math.hypot(m.ball.x - m.players[0].x, m.ball.z - m.players[0].z);
  assert.ok(gap(balanced) < gap(advanced) - 0.15);
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

test("Balanced retains shot, passing and dribble techniques", () => {
  const shots = [];
  for (const type of ["normal", "power", "chip", "finesse"]) {
    const m = setup();
    m.players[0].z = -18;
    m.ball.z = -18.75;
    assert.equal(m.shoot(0, true, { type, power: 0.8, aimX: 2 }), true);
    assert.equal(m.events.at(-1).technique, type);
    shots.push({
      speed: Math.hypot(m.ball.vx, m.ball.vz),
      height: m.ball.vy,
      curve: m.ball.curve,
    });
  }
  assert.ok(shots[1].speed > shots[0].speed);
  assert.ok(shots[2].height > shots[0].height);
  assert.notEqual(shots[3].curve, 0);
  for (const type of ["short", "through", "lob"]) {
    const m = setup();
    assert.equal(m.pass(0, type), true);
    assert.equal(m.pendingPass.technique, type);
    assert.ok(m.ball.vy > (type === "lob" ? 3 : 0));
  }
  const m = setup();
  assert.equal(m.skill(0, -1), true);
  assert.ok(m.players[0].feintTime > 0 && m.players[0].vx > 0);
  m.step(1 / 60, { shield: true });
  assert.equal(m.players[0].shield, true);
});
test("first touch grants a small turning window and still permits a later challenge", () => {
  const m = setup();
  Object.assign(m.players[3], { x: 0, z: -1.3, dx: 0, dz: 1 });
  m.acquire(m.players[0]);
  tick(m, 0.82);
  assert.equal(m.tackle(3), false);
  m.players[3].tackleCooldown = 0;
  tick(m, 0.12);
  assert.equal(m.tackle(3), true);
});
test("Balanced sprint turns retain momentum but lose some speed", () => {
  const m = setup();
  const p = m.players[0];
  tick(m, 0.6, { z: -1, sprint: true });
  const speed = p.moving;
  m.step(1 / 60, { x: 1, sprint: true });
  assert.ok(p.vz < -1 && p.vx > 0);
  assert.ok(p.moving < speed && p.moving > speed * 0.6);
});
