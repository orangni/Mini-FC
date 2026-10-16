import test from "node:test";
import assert from "node:assert/strict";
import { Match, DIFFICULTIES } from "../src/match.js";
const dt = 1 / 60;
const tick = (m, t, input = {}) => {
  for (let i = 0; i < t * 60; i++) m.step(dt, input);
};
function fixture(options = {}) {
  const m = new Match({ random: () => 0.5, ...options });
  m.kickoffWait = 0;
  m.ai = () => {};
  m.players.forEach((p, i) =>
    Object.assign(p, {
      x: p.team ? 19 : -19,
      z: 20 + i * 0.7,
      cooldown: 0,
      protected: 0,
      vx: 0,
      vz: 0,
    }),
  );
  Object.assign(m.players[0], { x: 0, z: 0, dx: 0, dz: -1 });
  Object.assign(m.players[1], { x: -10, z: -5 });
  Object.assign(m.players[2], { x: 10, z: -5 });
  Object.assign(m.ball, { owner: 0, x: 0, z: -0.75, y: 0.35 });
  return m;
}

test("movement accelerates immediately, brakes over a short distance, and settles", () => {
  const m = fixture(),
    p = m.players[0];
  m.step(dt, { x: 1 });
  assert.ok(p.vx > 0.7 && p.vx < 2);
  tick(m, 0.2, { x: 1 });
  assert.ok(p.vx > 8);
  const x = p.x,
    speed = p.vx;
  m.step(dt);
  assert.ok(p.vx > 0 && p.vx < speed);
  tick(m, 0.3);
  assert.equal(p.vx, 0);
  assert.ok(p.x > x && p.x - x < 1.2);
});
test("Pace raises top speed and acceleration while normal jogging tolerates exhausted stamina", () => {
  const slow = fixture({ attributes: { pace: 45, passing: 60, shooting: 60 } }),
    fast = fixture({ attributes: { pace: 99, passing: 60, shooting: 60 } });
  tick(slow, 0.5, { x: 1 });
  tick(fast, 0.5, { x: 1 });
  assert.ok(fast.players[0].vx > slow.players[0].vx * 1.25);
  const tired = fixture(),
    fresh = fixture();
  tired.players[0].stamina = 0.01;
  tick(tired, 0.3, { x: 1 });
  tick(fresh, 0.3, { x: 1 });
  assert.equal(tired.players[0].vx, fresh.players[0].vx);
});
test("a sprinting turn preserves momentum then slows, with gradual facing", () => {
  const m = fixture(),
    p = m.players[0];
  tick(m, 0.4, { x: 1, sprint: true });
  const speed = p.moving;
  m.step(dt, { z: -1, sprint: true });
  assert.ok(p.vx > 5);
  assert.ok(p.dz < 0 && p.dx > 0.5);
  tick(m, 0.15, { z: -1, sprint: true });
  assert.ok(p.moving < speed);
  assert.ok(p.vz < 0);
});
test("dribbling is bounded and continuous through repeated sprinting turns", () => {
  const m = fixture();
  let maxStep = 0;
  for (let i = 0; i < 480; i++) {
    const before = { x: m.ball.x, z: m.ball.z };
    const t = i * dt;
    m.step(dt, { x: Math.sin(t * 2), z: -Math.cos(t * 2), sprint: i > 120 });
    const gap = Math.hypot(
      m.ball.x - m.players[0].x,
      m.ball.z - m.players[0].z,
    );
    assert.equal(m.ball.owner, 0);
    assert.ok(gap >= 0.5 && gap < 2.6, `gap ${gap}`);
    maxStep = Math.max(
      maxStep,
      Math.hypot(m.ball.x - before.x, m.ball.z - before.z),
    );
    assert.ok(Number.isFinite(m.ball.vx + m.ball.vz));
  }
  assert.ok(maxStep < 0.65, `step ${maxStep}`);
});
test("sprint takes longer touches than close control, and shielding keeps the ball close", () => {
  const modes = [
    { x: 1, z: 0 },
    { x: 1, z: 0, sprint: true },
    { x: 0.4, z: 0, shield: true },
  ];
  const gaps = modes.map((input) => {
    const m = fixture();
    let sum = 0;
    for (let i = 0; i < 60; i++) {
      m.step(dt, input);
      if (i > 20)
        sum += Math.hypot(m.ball.x - m.players[0].x, m.ball.z - m.players[0].z);
    }
    return sum / 39;
  });
  assert.ok(gaps[1] > gaps[0] + 0.12);
  assert.ok(gaps[2] < gaps[0] - 0.25);
});
test("directional passing chooses the intended flank even if the other teammate is closer", () => {
  const left = fixture(),
    right = fixture();
  right.players[1].x = -5;
  left.players[2].x = 5;
  left.pass(0, "short", null, { x: -1, z: 0 });
  right.pass(0, "short", null, { x: 1, z: 0 });
  assert.equal(left.pendingPass.receiver, 1);
  assert.equal(right.pendingPass.receiver, 2);
  assert.ok(left.ball.vx < 0 && right.ball.vx > 0);
});
test("directional input travels through the real queued match command", () => {
  const m = fixture();
  m.step(dt, { pass: true, x: 1 });
  assert.equal(m.pendingPass.receiver, 2);
  assert.ok(m.ball.vx > 0);
});
test("through balls lead a runner into a lane beside a defender", () => {
  const m = fixture();
  Object.assign(m.players[1], { x: -10, z: -10, vz: -6, moving: 6 });
  Object.assign(m.players[3], { x: -10, z: -14 });
  m.pass(0, "through", 1);
  assert.ok(m.pendingPass.target.z < m.players[1].z - 4);
  assert.notEqual(m.pendingPass.target.x, m.players[3].x);
});
test("lob flight rises, falls and reaches the intended receiver area", () => {
  const m = fixture();
  m.pass(0, "lob", 1);
  let peak = 0;
  for (let i = 0; i < 110; i++) {
    m.step(dt);
    peak = Math.max(peak, m.ball.y);
  }
  assert.ok(peak > 1.2);
  assert.ok(m.ball.y < peak);
  assert.ok(
    m.ball.owner === 1 || Math.hypot(m.ball.x + 10, m.ball.z + 6.5) < 5,
  );
});
test("left/right movement aims shots at different sides and higher charge raises speed", () => {
  const left = fixture(),
    right = fixture(),
    low = fixture(),
    high = fixture();
  for (const m of [left, right, low, high]) {
    m.players[0].z = -20;
    m.ball.z = -20.75;
  }
  left.step(dt, { shoot: true, x: -1 });
  right.step(dt, { shoot: true, x: 1 });
  assert.ok(left.ball.vx < 0 && right.ball.vx > 0);
  low.shoot(0, true, { type: "power", power: 0.3 });
  high.shoot(0, true, { type: "power", power: 1 });
  assert.ok(
    Math.hypot(high.ball.vx, high.ball.vz) >
      Math.hypot(low.ball.vx, low.ball.vz) + 9,
  );
});
test("finesse improves placement spread and excessive power has an accuracy cost", () => {
  const m = fixture({ random: () => 0.9 }),
    f = fixture({ random: () => 0.9 }),
    power = fixture({ random: () => 0.9 });
  for (const g of [m, f, power]) {
    g.players[0].z = -20;
    g.ball.z = -20.75;
  }
  m.shoot(0, true, { aimX: 0 });
  f.shoot(0, true, { type: "finesse", aimX: 0 });
  power.shoot(0, true, { type: "power", power: 1, aimX: 0 });
  const slope = (g) => Math.abs(g.ball.vx / g.ball.vz);
  // Compare projected aim including the intentional finesse curve compensation.
  assert.ok(slope(power) > slope(m));
  assert.notEqual(f.ball.curve, 0);
  const fZero = fixture({ random: () => 0.5 });
  fZero.players[0].z = -20;
  fZero.ball.z = -20.75;
  fZero.shoot(0, true, { type: "finesse", aimX: 0 });
  assert.ok(Math.abs(slope(f) - slope(fZero)) < slope(m));
});
test("standing tackles use geometry, not random success rolls", () => {
  for (const random of [() => 0, () => 0.999]) {
    const m = fixture({ random });
    m.ball.owner = 3;
    Object.assign(m.players[3], { x: 0, z: -1.2, dx: 0, dz: 1 });
    m.ball.z = -0.4;
    assert.equal(m.tackle(0), true);
    assert.equal(m.ball.owner, 0);
    assert.equal(m.tackle(3), false);
    assert.ok(m.players[0].protected > 0);
  }
});
test("a tackle facing away misses, and a missed slide commits movement and recovery", () => {
  const m = fixture();
  m.ball.owner = 3;
  Object.assign(m.players[3], { x: 0, z: -1.3 });
  m.ball.z = -1.3;
  m.players[0].dz = 1;
  assert.equal(m.tackle(0), false);
  m.players[0].tackleCooldown = 0;
  m.players[0].dz = -1;
  m.players[3].z = -8;
  m.ball.z = -8;
  assert.equal(m.tackle(0, true), false);
  const z = m.players[0].z;
  tick(m, 0.1);
  assert.ok(m.players[0].z < z - 0.8);
  assert.ok(m.players[0].recovery > 0.6);
});
test("shielding protects the back while a front-facing exposed ball can be challenged", () => {
  const m = fixture();
  m.ball.owner = 3;
  Object.assign(m.players[3], { x: 0, z: -1.2, dx: 0, dz: 1, shield: true });
  m.ball.z = -0.4;
  assert.equal(m.tackle(0), true);
  const back = fixture();
  back.ball.owner = 3;
  Object.assign(back.players[3], { x: 0, z: -1.2, dx: 0, dz: 1, shield: true });
  Object.assign(back.players[0], { x: 0, z: -2.4, dx: 0, dz: 1 });
  back.ball.z = -0.4;
  assert.equal(back.tackle(0), false);
});
test("tactical support spreads midfielders, runs a forward and retains deeper defenders", () => {
  const m = fixture({ demo: true });
  m.buildTactics();
  m.players[0].z = -5;
  const targets = [1, 2, 6, 7].map((id) => m.aiTarget(m.players[id]));
  assert.ok(targets[0].x < -8 && targets[1].x > 8);
  assert.ok(
    targets[2].z > m.players[0].z + 7 && targets[3].z > m.players[0].z + 7,
  );
  m.ball.owner = 1;
  const forward = m.aiTarget(m.players[0]);
  assert.ok(forward.z < m.players[1].z - 8);
});
test("defence assigns one presser and a distinct cover player with a goal-side target", () => {
  const m = fixture({ demo: true });
  m.ball.owner = 3;
  Object.assign(m.players[3], { x: 0, z: -5 });
  Object.assign(m.ball, { x: 0, z: -5 });
  m.buildTactics();
  const plan = m.tactics[0];
  assert.notEqual(plan.presser, plan.cover);
  const cover = m.aiTarget(m.players[plan.cover]);
  assert.ok(cover.z > m.ball.z + 6);
  const targets = m.players
    .filter(
      (p) => p.team === 0 && p.role !== "goalkeeper" && p.id !== plan.presser,
    )
    .map((p) => m.aiTarget(p));
  assert.ok(
    targets.every((t) => Math.hypot(t.x - m.ball.x, t.z - m.ball.z) > 2),
  );
});
test("an AI carrier passes out of pressure to a free teammate instead of dribbling into a trap", () => {
  const m = fixture({ demo: true });
  Object.assign(m.players[3], { x: 0, z: -2 });
  m.players[0].possessionTime = 1;
  m.buildTactics();
  m.aiTarget(m.players[0]);
  assert.equal(m.ball.owner, null);
  assert.ok(m.pendingPass);
  assert.notEqual(m.pendingPass.receiver, 0);
});
test("difficulty changes reaction, anticipation and positioning rather than movement speed", () => {
  const easy = fixture({ difficulty: "easy" }),
    hard = fixture({ difficulty: "hard" });
  assert.ok(easy.config(1).reaction > hard.config(1).reaction);
  assert.ok(easy.config(1).positioning > hard.config(1).positioning);
  assert.ok(easy.config(1).anticipation < hard.config(1).anticipation);
  for (let i = 0; i < 30; i++) {
    easy.move(easy.players[3], 1, 0, false, dt);
    hard.move(hard.players[3], 1, 0, false, dt);
  }
  assert.equal(easy.players[3].moving, hard.players[3].moving);
  assert.equal(new Match({ difficulty: "invalid" }).difficulty, "normal");
  assert.equal(Object.keys(DIFFICULTIES).length, 4);
});
test("goalkeepers advance in an uncovered one-on-one but retain angle position at range", () => {
  const near = fixture(),
    far = fixture();
  for (const m of [near, far]) Object.assign(m.players[11], { x: 0, z: -32.7 });
  near.players[0].z = -23;
  near.ball.z = -23.75;
  far.players[0].z = -5;
  far.ball.z = -5.75;
  for (let i = 0; i < 60; i++) {
    near.goalkeeper(near.players[11], dt);
    far.goalkeeper(far.players[11], dt);
  }
  assert.ok(near.players[11].z > far.players[11].z + 1.3);
});
test("curved-ball prediction agrees with the airborne simulation", () => {
  const m = fixture();
  Object.assign(m.ball, {
    owner: null,
    x: 0,
    z: 0,
    y: 3,
    vx: 1,
    vz: -20,
    vy: 3,
    curve: 0.3,
  });
  const predicted = m.predictBall(0.4);
  tick(m, 0.4);
  assert.ok(Math.hypot(predicted.x - m.ball.x, predicted.z - m.ball.z) < 0.5);
});
test("keeper catches or parries are deterministic from speed and contact position", () => {
  for (const random of [() => 0, () => 0.999])
    for (const speed of [15, 34]) {
      const m = fixture({ random });
      Object.assign(m.players[11], {
        x: 0,
        z: -32.4,
        action: "dive",
        actionTime: 1,
      });
      Object.assign(m.ball, {
        owner: null,
        x: 0.8,
        z: -31.7,
        y: 1,
        vx: 0,
        vz: -speed,
      });
      assert.equal(m.trySaves(), true);
      assert.equal(m.ball.owner, speed === 15 ? 11 : null);
      if (speed > 24) {
        assert.ok(m.ball.vz > 0);
        assert.ok(m.ball.vy > 0);
      }
    }
});

test("a committed advanced keeper can be chipped, while a line keeper can cover that chip", () => {
  const shootAt = (keeperZ, type) => {
    const m = fixture();
    m.ai = (p, dt) => {
      if (p.role === "goalkeeper") m.goalkeeper(p, dt);
    };
    m.players.forEach((p, i) =>
      Object.assign(p, { x: i % 2 ? 20 : -20, z: 10 }),
    );
    Object.assign(m.players[0], { x: 0, z: -20, dx: 0, dz: -1 });
    Object.assign(m.players[11], { x: 0, z: keeperZ });
    Object.assign(m.ball, { owner: 0, x: 0, z: -20.8 });
    m.shoot(0, true, { type, aimX: 0 });
    tick(m, 2.5);
    return m;
  };
  assert.equal(shootAt(-26, "normal").score[0], 0);
  assert.equal(shootAt(-26, "chip").score[0], 1);
  assert.equal(shootAt(-32.7, "chip").score[0], 0);
});

test("AI power shots have an interruptible visible wind-up", () => {
  const m = fixture({ demo: true, random: () => 0 });
  Object.assign(m.players[0], { x: 0, z: -18, possessionTime: 1 });
  m.ball.z = -18.75;
  Object.assign(m.players[11], { x: 0, z: -32.7 });
  m.buildTactics();
  m.aiTarget(m.players[0]);
  assert.ok(m.players[0].aiShot);
  assert.equal(m.ball.owner, 0);
  for (let i = 0; i < 15; i++) Match.prototype.ai.call(m, m.players[0], dt);
  assert.ok(m.players[0].charging > 0);
  assert.equal(m.ball.owner, 0);
  for (let i = 0; i < 20; i++) Match.prototype.ai.call(m, m.players[0], dt);
  assert.ok(
    m.takeEvents().some((e) => e.type === "shot" && e.technique === "power"),
  );
  const interrupted = fixture({ demo: true, random: () => 0 });
  Object.assign(interrupted.players[0], { x: 0, z: -18, possessionTime: 1 });
  Object.assign(interrupted.players[11], { x: 0, z: -32.7 });
  interrupted.buildTactics();
  interrupted.aiTarget(interrupted.players[0]);
  interrupted.ball.owner = 3;
  Match.prototype.ai.call(interrupted, interrupted.players[0], dt);
  assert.equal(interrupted.players[0].aiShot, null);
});

test("a directional action keeps its sampled aim if movement is released before the next tick", () => {
  const m = fixture();
  m.step(dt, { pass: true, x: 0, z: 0, aimDirection: { x: 1, z: 0 } });
  assert.equal(m.pendingPass.receiver, 2);
});

test("a keeper cannot save or parry their own just-released distribution", () => {
  const m = fixture();
  m.ai = (p, dt) => {
    if (p.role === "goalkeeper") m.goalkeeper(p, dt);
  };
  Object.assign(m.players[8], { x: 0, z: 32, dx: 0, dz: -1, saveCooldown: 0 });
  Object.assign(m.ball, { owner: 8, x: 0, z: 31.45, y: 1.6 });
  tick(m, 0.92);
  assert.equal(m.stats.saves[0], 0);
  assert.equal(m.ball.owner, null);
  assert.ok(m.pendingPass);
  assert.equal(m.pendingPass.sender, 8);
});
