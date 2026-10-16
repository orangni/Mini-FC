import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../src/match.js";
import {
  newCareer,
  saveCareer,
  loadCareer,
  SAVE_KEY,
  finishMatch,
  upgrade,
  nextSeason,
} from "../src/career.js";
import {
  OUTFIELD_SKILLS,
  KEEPER_SKILLS,
  assignedSkill,
  getSkill,
} from "../src/skills.js";
import { CLUB_DATABASE } from "../src/clubs.js";
const tick = (m, seconds, input = {}) => {
  for (let n = 0; n < seconds * 60; n++) m.step(1 / 60, input);
};
function isolated(skillId = "body-feint") {
  const m = new Match({
    career: true,
    skillId,
    random: () => 0.5,
    assisted: true,
  });
  m.kickoffWait = 0;
  m.ai = () => {};
  m.players.forEach((p, i) =>
    Object.assign(p, {
      x: p.team ? 20 : -20,
      z: 20 + i * 0.3,
      protected: 0,
      cooldown: 0,
      stunned: 0,
    }),
  );
  Object.assign(m.players[0], { x: 0, z: 0, dx: 0, dz: -1 });
  Object.assign(m.ball, { owner: 0, x: 0, z: -0.75, y: 0.35 });
  return m;
}
const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
};
test("all clubs assign exactly one stable signature to every player, with five different outfield moves", () => {
  for (const club of CLUB_DATABASE) {
    const a = new Match({ teams: [club, club] }),
      b = new Match({ teams: [club, club] });
    assert.deepEqual(
      a.players.map((p) => p.skillId),
      b.players.map((p) => p.skillId),
    );
    for (const team of [0, 1]) {
      const players = a.players.filter((p) => p.team === team),
        out = players.filter((p) => p.role !== "goalkeeper");
      assert.equal(new Set(out.map((p) => p.skillId)).size, 5);
      for (const p of players) assert.equal(getSkill(p.skillId).id, p.skillId);
      assert.ok(
        KEEPER_SKILLS.some(
          (s) => s.id === players.find((p) => p.role === "goalkeeper").skillId,
        ),
      );
    }
  }
  assert.notEqual(assignedSkill("arsenal", 0), assignedSkill("chelsea", 0));
});
test("career can select every outfield skill regardless of position, without affecting NPC assignments", () => {
  for (const skill of OUTFIELD_SKILLS)
    for (const position of ["Striker", "Midfielder", "Defender"]) {
      const c = newCareer("Signature", position, "arsenal", skill.id);
      const m = new Match({ career: true, position, skillId: c.skillId });
      assert.equal(m.players[0].skillId, skill.id);
      assert.equal(m.players[0].role, position.toLowerCase());
      const base = new Match();
      for (const p of m.players.slice(1))
        assert.equal(p.skillId, base.players[p.id].skillId);
    }
});
test("selected signature survives rewards, upgrades, next season and storage", () => {
  const c = newCareer("Spinner", "Midfielder", "arsenal", "roulette"),
    s = memory();
  for (let i = 0; i < 5; i++) finishMatch(c, [3, 0], { goals: 1 }, () => 0.5);
  upgrade(c, "pace");
  nextSeason(c);
  saveCareer(s, c);
  assert.deepEqual(loadCareer(s), c);
  assert.equal(loadCareer(s).skillId, "roulette");
});
test("old v1/v2 and invalid skill values retain careers with a safe default", () => {
  for (const value of [
    undefined,
    "missing",
    "safe-hands",
    { id: "roulette" },
  ]) {
    const c = newCareer("Old captain", "Defender");
    c.xp = 450;
    c.points = 3;
    c.skillId = value;
    const s = memory();
    s.setItem(SAVE_KEY, JSON.stringify(c));
    const loaded = loadCareer(s);
    assert.equal(loaded.skillId, "body-feint");
    assert.equal(loaded.xp, 450);
    assert.equal(loaded.points, 3);
  }
  const c = newCareer("V1", "Striker");
  c.version = 1;
  delete c.skillId;
  const s = memory();
  s.setItem(SAVE_KEY, JSON.stringify(c));
  const loaded = loadCareer(s);
  assert.equal(loaded.skillId, "body-feint");
  saveCareer(s, loaded);
  assert.equal(JSON.parse(s.getItem(SAVE_KEY + "-backup-v1")).version, 1);
});
test("sixteen signatures have different integrated player/ball trajectories and expire normally", () => {
  const trajectories = [];
  for (const skill of OUTFIELD_SKILLS) {
    const m = isolated(skill.id),
      p = m.players[0];
    assert.equal(m.skill(0), true);
    const samples = [];
    for (let frame = 0; frame < 36; frame++) {
      m.step(1 / 60);
      assert.ok(Number.isFinite(p.x + p.z + m.ball.x + m.ball.z));
      assert.ok(Math.hypot(m.ball.x - p.x, m.ball.z - p.z) < 2.8);
      assert.ok(p.moving < 15);
      if (frame % 6 === 0)
        samples.push([p.x, p.z, m.ball.x, m.ball.z].map((n) => n.toFixed(2)));
    }
    trajectories.push(JSON.stringify(samples));
    assert.equal(p.skillTime, 0);
    assert.ok(p.skillCooldown > 0);
    assert.equal(m.controlled, 0);
    assert.equal(m.ball.owner, 0);
  }
  assert.equal(new Set(trajectories).size, 16);
});
test("drag back starts backwards, heel burst accelerates forwards, and side input mirrors feints", () => {
  const drag = isolated("drag-back"),
    heel = isolated("heel-burst");
  drag.skill(0);
  heel.skill(0);
  tick(drag, 0.15);
  tick(heel, 0.35);
  assert.ok(drag.players[0].z > 0.4);
  assert.ok(heel.players[0].z < -0.5);
  const left = isolated(),
    right = isolated();
  left.skill(0, -1);
  right.skill(0, 1);
  tick(left, 0.2);
  tick(right, 0.2);
  assert.ok(left.players[0].x > 0.5 && right.players[0].x < -0.5);
  assert.ok(Math.abs(left.players[0].x + right.players[0].x) < 0.01);
});
test("signatures cost stamina, respect cooldowns and cannot activate while stunned, recovering or off the ball", () => {
  const m = isolated(),
    p = m.players[0];
  assert.equal(m.skill(0), true);
  assert.ok(p.stamina < 0.93);
  assert.equal(m.skill(0), false);
  p.skillCooldown = 0;
  p.stamina = 0.07;
  assert.equal(m.skill(0), false);
  p.stamina = 1;
  p.stunned = 0.1;
  assert.equal(m.skill(0), false);
  p.stunned = 0;
  p.recovery = 0.1;
  assert.equal(m.skill(0), false);
  p.recovery = 0;
  m.ball.owner = 1;
  assert.equal(m.skill(0), false);
  m.ball.owner = 8;
  assert.equal(m.skill(8), false);
});
test("losing the ball interrupts movement, and signatures remain inside field bounds", () => {
  for (const skill of OUTFIELD_SKILLS) {
    const m = isolated(skill.id),
      p = m.players[0];
    Object.assign(p, { x: 21.8, z: 33.1 });
    m.skill(0);
    tick(m, 0.5);
    assert.ok(Math.abs(p.x) <= 22 && Math.abs(p.z) <= 33.5);
    p.skillCooldown = 0;
    m.ball.owner = 0;
    m.skill(0);
    m.ball.owner = 3;
    m.step(1 / 60);
    assert.equal(p.skillTime, 0);
  }
});
test("AI uses its own signature under frontal pressure, but never spams or activates in open space", () => {
  const m = isolated(),
    p = m.players[3];
  Object.assign(p, {
    x: 0,
    z: 0,
    dx: 0,
    dz: 1,
    possessionTime: 1,
    protected: 0,
    cooldown: 0,
    skillId: "roulette",
  });
  Object.assign(m.players[0], { x: 0, z: 2 });
  m.ball.owner = 3;
  Object.assign(m.ball, { x: 0, z: 0.75 });
  for (const [mate, marker, x, z] of [
    [4, 1, 8, 0],
    [5, 2, -8, 0],
    [9, 6, 15, 8],
    [10, 7, -15, 8],
  ]) {
    Object.assign(m.players[mate], { x, z });
    Object.assign(m.players[marker], { x, z: z + 0.5 });
  }
  m.aiTarget(p);
  assert.equal(m.ball.owner, 3);
  assert.ok(p.skillTime > 0);
  assert.equal(m.events.at(-1).skillId, "roulette");
  const events = m.events.length;
  m.aiTarget(p);
  assert.equal(m.events.length, events);
  p.skillTime = 0;
  p.skillCooldown = 0;
  m.players[0].z = 10;
  m.aiTarget(p);
  assert.equal(p.skillTime, 0);
});
test("keeper signatures give a modest catch or distribution benefit without losing catch immunity", () => {
  for (const signature of KEEPER_SKILLS) {
    const m = isolated(),
      keeper = m.players[8];
    keeper.skillId = signature.id;
    Object.assign(keeper, { x: 0, z: 32, protected: 0 });
    Object.assign(m.ball, {
      owner: null,
      x: 0,
      z: 32,
      y: 0.6,
      vx: 0,
      vz: 24.5,
      vy: 0,
      ignore: -1,
    });
    assert.equal(m.trySaves(), true);
    assert.equal(m.ball.owner === 8, signature.id === "safe-hands");
    Object.assign(m.ball, { owner: 8, x: 0, z: 32 });
    keeper.holdTime = 0;
    m.ai = (p, dt) => {
      if (p.id === 8) m.goalkeeper(p, dt);
    };
    assert.equal(m.tackle(3), false);
    tick(m, 0.8);
    assert.equal(m.ball.owner === 8, signature.id !== "quick-release");
  }
});
